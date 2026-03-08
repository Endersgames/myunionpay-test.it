"""MYU Orchestrator - Main chat flow coordination.

Flow: message → classify → budget check → city confirm → tool → LLM → response
"""
import logging
import os
from datetime import datetime, timezone
from database import db
from myu.cost_control import (
    generate_request_id, estimate_request_cost, check_budget,
    log_request_cost, count_tokens, MAX_OUTPUT_TOKENS, MAX_CONTEXT_TOKENS,
    TOOL_COSTS,
)
from myu.intent import classify_intent
from myu.location import (
    get_location_state, extract_city_from_text, needs_city_confirmation,
    confirm_city as loc_confirm_city,
)
from myu.cache import build_cache_key, get_cached, set_cached
from myu.tools.router import route_tool
from myu.tools.tasks import create_task
from myu.llm_service import call_llm, build_context, get_llm_config

logger = logging.getLogger("myu.orchestrator")

MYU_COST_PER_MSG = 0.01  # UP cost deducted from user wallet

# Fallback messages (no LLM needed)
FALLBACK_BUDGET = "Mi sa che questa richiesta e un po' complessa. Prova a riformulare in modo piu semplice!"
FALLBACK_TOOL_ERROR = "Non sono riuscito a trovare quello che cercavi. Dimmi la citta e riprovo."
FALLBACK_GENERIC = "Scusa, ho avuto un problema. Riprova tra un momento."


def get_fallback_message(error: Exception = None, is_dev: bool = False) -> str:
    """Get fallback message with diagnostic info in dev mode."""
    if is_dev and error:
        return f"Errore LLM in sviluppo: {str(error)[:200]}. Riprova o controlla i log."
    return FALLBACK_GENERIC


async def handle_chat(user_id: str, message: str, session_id: str) -> dict:
    """Main orchestration: user message → structured response.

    Returns: {message, intent, actions, cost, balance_after, request_id, meta}
    """
    request_id = generate_request_id()
    now = datetime.now(timezone.utc).isoformat()
    logger.info("MYU pipeline start request_id=%s user_id=%s session_id=%s", request_id, user_id, session_id)

    # 1. Check balance
    wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0, "balance": 1})
    balance = wallet.get("balance", 0) if wallet else 0
    if balance < MYU_COST_PER_MSG:
        logger.warning("MYU balance check failed request_id=%s balance=%s required=%s", request_id, balance, MYU_COST_PER_MSG)
        return _error_response(request_id, "Saldo insufficiente per chattare con MYU.", balance)

    # 2. Load user state
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "full_name": 1, "profile_tags": 1})
    user_name = user.get("full_name", "Utente") if user else "Utente"
    conv_state = await db.myu_conversation_state.find_one({"user_id": user_id}, {"_id": 0, "summary": 1, "awaiting_city_confirm": 1, "pending_intent": 1})
    location = await get_location_state(user_id)

    # 3. Check if awaiting city confirmation from previous turn
    classification = None
    if conv_state and conv_state.get("awaiting_city_confirm"):
        mentioned_city = extract_city_from_text(message)
        affirmatives = ["si", "sì", "ok", "va bene", "certo", "esatto", "giusto", "confermo"]
        is_affirmative = any(a in message.lower().strip() for a in affirmatives)

        if mentioned_city or is_affirmative:
            return await _handle_city_confirmation(user_id, message, session_id, request_id, conv_state, location, user_name)
        else:
            # User abandoned city flow - clear state and re-classify
            await db.myu_conversation_state.update_one(
                {"user_id": user_id},
                {"$unset": {"awaiting_city_confirm": "", "pending_intent": "", "pending_message": ""}},
            )
            classification = classify_intent(message)

    # 4. Classify intent (keyword-based, no LLM)
    if not classification:
        classification = classify_intent(message)
    logger.info(
        "MYU intent request_id=%s domain=%s intent=%s conf=%s needs_tool=%s needs_llm=%s",
        request_id,
        classification["domain"],
        classification["intent"],
        classification["confidence"],
        classification.get("needs_tool"),
        classification.get("needs_llm"),
    )

    # 5. Static response shortcut (e.g., greetings)
    if classification["static_response"] and not classification["needs_llm"]:
        new_balance = await _deduct_cost(user_id)
        await _save_conversation(user_id, session_id, message, classification["static_response"], classification, now)
        await log_request_cost(request_id, user_id, "none", 0, 0, fallback_triggered=False)
        return _build_response(request_id, classification["static_response"], classification, [], MYU_COST_PER_MSG, new_balance)

    # 6. Location-based: check city confirmation
    tool_city = None
    if classification["is_location_based"]:
        mentioned_city = extract_city_from_text(message)
        confirm = needs_city_confirmation(location, mentioned_city)

        if confirm["need_confirm"] and not confirm.get("resolved_city"):
            # Need to ask user for city - don't call LLM, use structured response
            new_balance = await _deduct_cost(user_id)
            # Store pending intent so we can resume after confirmation
            await db.myu_conversation_state.update_one(
                {"user_id": user_id},
                {"$set": {
                    "awaiting_city_confirm": True,
                    "pending_intent": classification,
                    "pending_message": message,
                }},
                upsert=True,
            )
            actions = []
            if confirm.get("options"):
                actions = [{"type": "confirm_city", "city": c, "label": c} for c in confirm["options"]]
            await _save_conversation(user_id, session_id, message, confirm["message"], classification, now)
            await log_request_cost(request_id, user_id, "none", 0, 0, fallback_triggered=False)
            return _build_response(request_id, confirm["message"], classification, actions, MYU_COST_PER_MSG, new_balance)

        tool_city = confirm.get("resolved_city")
        # If geo city was just confirmed implicitly, save it
        if tool_city and location and not location.get("city_confirmed"):
            await loc_confirm_city(user_id, tool_city)

    # 7. Estimate cost and check budget
    llm_config = await get_llm_config()
    model = llm_config["model"]
    est_input = MAX_CONTEXT_TOKENS
    est_output = MAX_OUTPUT_TOKENS
    tool_name = classification.get("needs_tool")
    est_cost = estimate_request_cost(model, est_input, est_output, tool_name)
    budget = check_budget(est_cost)
    logger.info(
        "MYU budget check request_id=%s model=%s est_cost=%s allowed=%s",
        request_id,
        model,
        est_cost,
        budget["allowed"],
    )

    if not budget["allowed"]:
        # Budget exceeded - use fallback
        new_balance = await _deduct_cost(user_id)
        await _save_conversation(user_id, session_id, message, FALLBACK_BUDGET, classification, now)
        await log_request_cost(request_id, user_id, model, 0, 0, tool_name, 0, True)
        return _build_response(request_id, FALLBACK_BUDGET, classification, [], MYU_COST_PER_MSG, new_balance)

    # 8. Call tool if needed (max 1 per request)
    tool_result = None
    if tool_name:
        logger.info("MYU tool stage request_id=%s tool=%s city=%s", request_id, tool_name, tool_city)
        cache_key = build_cache_key(tool_name, location.get("geohash_4", "") if location else "", message[:60])
        tool_result = await get_cached(cache_key)
        if not tool_result:
            tool_result = await route_tool(tool_name, user_id, tool_city, location.get("geohash_4") if location else None, message, classification["intent"])
            if tool_result and not tool_result.get("error"):
                await set_cached(cache_key, tool_name, location.get("geohash_4", "") if location else "", tool_city or "", classification["intent"], tool_result.get("data", {}))
            elif tool_result and tool_result.get("error"):
                logger.warning("MYU tool error request_id=%s tool=%s err=%s", request_id, tool_name, tool_result["error"])

    # 9. Build context and call LLM (1 call)
    active_tasks_data = await db.myu_tasks.find(
        {"user_id": user_id, "status": "active"}, {"_id": 0, "title": 1}
    ).to_list(3)
    active_task_titles = [t["title"] for t in active_tasks_data]

    context = build_context(
        user_name=user_name,
        wallet_balance=balance,
        active_tasks=active_task_titles,
        conversation_summary=conv_state.get("summary") if conv_state else None,
        tool_result=tool_result,
        location_city=tool_city,
    )

    try:
        logger.info("MYU llm stage request_id=%s session_id=%s model=%s", request_id, session_id, model)
        llm_result = await call_llm(context, message, session_id)
    except Exception as e:
        logger.error("MYU llm stage failed request_id=%s error=%s", request_id, e)
        is_dev = os.environ.get("ENV") == "development" or os.environ.get("DEBUG") == "true"
        fallback_msg = get_fallback_message(e, is_dev)
        new_balance = await _deduct_cost(user_id)
        await _save_conversation(user_id, session_id, message, fallback_msg, classification, now)
        await log_request_cost(request_id, user_id, model, 0, 0, tool_name, 0, True)
        return _build_response(request_id, fallback_msg, classification, [], MYU_COST_PER_MSG, new_balance)

    parsed = llm_result["parsed"]
    response_msg = parsed.get("message", "")
    actions = parsed.get("actions", [])

    # 10. Handle task creation actions
    if actions:
        for action in actions:
            if action.get("type") == "create_task" and action.get("title"):
                await create_task(user_id, action["title"], action.get("due"))
                logger.info("MYU task created request_id=%s title=%s", request_id, action["title"][:80])

    # 11. Deduct cost and save conversation
    new_balance = await _deduct_cost(user_id)
    await _save_conversation(user_id, session_id, message, response_msg, classification, now, actions)
    await _update_state(user_id, message, response_msg)

    # 12. Log cost
    tool_cost = TOOL_COSTS.get(tool_name, 0) if tool_name else 0
    await log_request_cost(
        request_id, user_id, llm_result["model"],
        llm_result["input_tokens"], llm_result["output_tokens"],
        tool_name, tool_cost, False,
    )
    logger.info(
        "MYU pipeline success request_id=%s model=%s input_tokens=%s output_tokens=%s",
        request_id,
        llm_result["model"],
        llm_result["input_tokens"],
        llm_result["output_tokens"],
    )

    # 13. Log intent
    await db.myu_intent_logs.insert_one({
        "user_id": user_id,
        "session_id": session_id,
        "domain": classification["domain"],
        "intent": classification["intent"],
        "subintent": classification.get("subintent"),
        "confidence": classification["confidence"],
        "user_text": message[:100],
        "tool_used": tool_name,
        "request_id": request_id,
        "created_at": now,
    })

    return _build_response(request_id, response_msg, classification, actions, MYU_COST_PER_MSG, new_balance)


async def _handle_city_confirmation(user_id, message, session_id, request_id, conv_state, location, user_name):
    """Handle the second turn when user confirms a city."""
    now = datetime.now(timezone.utc).isoformat()
    pending = conv_state.get("pending_intent", {})
    pending_msg = conv_state.get("pending_message", "")

    # Clear the waiting flag
    await db.myu_conversation_state.update_one(
        {"user_id": user_id},
        {"$unset": {"awaiting_city_confirm": "", "pending_intent": "", "pending_message": ""}},
    )

    # Try to extract city from user's confirmation response
    confirmed_city = extract_city_from_text(message)
    if not confirmed_city:
        # Maybe user just said "si" or "ok" - use the inferred city
        affirmatives = ["si", "sì", "ok", "va bene", "certo", "esatto", "giusto", "confermo"]
        if any(a in message.lower().strip() for a in affirmatives):
            confirmed_city = location.get("inferred_city") if location else None

    if not confirmed_city:
        # Still can't determine city, ask again
        fallback_msg = "Non ho capito la citta. Dimmi dove vuoi che cerchi."
        new_balance = await _deduct_cost(user_id)
        await _save_conversation(user_id, session_id, message, fallback_msg, pending, now)
        await log_request_cost(request_id, user_id, "none", 0, 0, fallback_triggered=False)
        return _build_response(request_id, fallback_msg, pending, [], MYU_COST_PER_MSG, new_balance)

    # Save confirmed city
    await loc_confirm_city(user_id, confirmed_city)

    # Now re-run the original request with the city
    # Re-classify using the original message
    classification = pending if pending.get("domain") else classify_intent(pending_msg or message)
    tool_name = classification.get("needs_tool")
    logger.info("MYU city-confirm flow request_id=%s city=%s tool=%s", request_id, confirmed_city, tool_name)

    # Call tool with confirmed city
    tool_result = None
    if tool_name:
        cache_key = build_cache_key(tool_name, location.get("geohash_4", "") if location else "", (pending_msg or message)[:60])
        tool_result = await get_cached(cache_key)
        if not tool_result:
            tool_result = await route_tool(tool_name, user_id, confirmed_city, location.get("geohash_4") if location else None, pending_msg or message, classification.get("intent", ""))
            if tool_result and not tool_result.get("error"):
                await set_cached(cache_key, tool_name, location.get("geohash_4", "") if location else "", confirmed_city, classification.get("intent", ""), tool_result.get("data", {}))

    # Call LLM
    wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0, "balance": 1})
    balance = wallet.get("balance", 0) if wallet else 0
    context = build_context(user_name=user_name, wallet_balance=balance, tool_result=tool_result, location_city=confirmed_city)

    try:
        llm_result = await call_llm(context, pending_msg or message, session_id)
        parsed = llm_result["parsed"]
        response_msg = parsed.get("message", "")
        actions = parsed.get("actions", [])
    except Exception as e:
        is_dev = os.environ.get("ENV") == "development" or os.environ.get("DEBUG") == "true"
        response_msg = get_fallback_message(e, is_dev)
        actions = []

    new_balance = await _deduct_cost(user_id)
    await _save_conversation(user_id, session_id, message, response_msg, classification, now, actions)
    await _update_state(user_id, message, response_msg)
    if "llm_result" in locals():
        await log_request_cost(
            request_id,
            user_id,
            llm_result["model"],
            llm_result["input_tokens"],
            llm_result["output_tokens"],
            tool_name,
            0,
            False,
        )
    else:
        await log_request_cost(request_id, user_id, "none", 0, 0, tool_name, 0, True)

    return _build_response(request_id, response_msg, classification, actions, MYU_COST_PER_MSG, new_balance)


async def _deduct_cost(user_id: str) -> float:
    """Deduct MYU message cost from wallet."""
    result = await db.wallets.find_one_and_update(
        {"user_id": user_id},
        {"$inc": {"balance": -MYU_COST_PER_MSG}},
        return_document=True,
        projection={"_id": 0, "balance": 1},
    )
    return round(result.get("balance", 0), 2) if result else 0


async def _save_conversation(user_id, session_id, user_msg, assistant_msg, classification, timestamp, actions=None):
    """Save both user and assistant messages to conversation history."""
    await db.myu_conversations.insert_one({
        "user_id": user_id, "session_id": session_id,
        "role": "user", "text": user_msg, "created_at": timestamp,
    })
    await db.myu_conversations.insert_one({
        "user_id": user_id, "session_id": session_id,
        "role": "assistant", "text": assistant_msg,
        "intent": {"domain": classification.get("domain"), "intent": classification.get("intent")} if classification else None,
        "actions": actions or [], "created_at": timestamp,
    })


async def _update_state(user_id, user_msg, assistant_msg):
    """Update short conversation state summary."""
    summary = f"Utente: {user_msg[:80]} | MYU: {assistant_msg[:80]}"
    await db.myu_conversation_state.update_one(
        {"user_id": user_id},
        {"$set": {"summary": summary, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


def _build_response(request_id, message, classification, actions, cost, balance_after):
    """Build standardized response dict."""
    return {
        "message": message,
        "intent": {"domain": classification.get("domain"), "intent": classification.get("intent"), "confidence": classification.get("confidence", 0)},
        "actions": actions or [],
        "cost": cost,
        "balance_after": balance_after,
        "request_id": request_id,
    }


def _error_response(request_id, message, balance):
    return {
        "message": message,
        "intent": {"domain": "support", "intent": "error", "confidence": 1.0},
        "actions": [{"type": "navigate", "path": "/dashboard", "label": "Ricarica"}],
        "cost": 0,
        "balance_after": balance,
        "request_id": request_id,
    }
