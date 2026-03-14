"""MYU Orchestrator - Main chat flow coordination.

Flow: message → classify → budget check → city confirm → tool → LLM → response
"""
import logging
import re
from datetime import datetime, timezone
from database import db
from myu.cost_control import (
    generate_request_id, estimate_request_cost, check_budget,
    log_request_cost, MAX_OUTPUT_TOKENS, MAX_CONTEXT_TOKENS,
    TOOL_COSTS,
)
from myu.intent import classify_intent
from myu.location import (
    get_location_state, extract_city_from_text, needs_city_confirmation,
    confirm_city as loc_confirm_city,
)
from myu.cache import build_cache_key, get_cached, set_cached
from myu.coaching_profile import get_user_coaching_profile, build_coaching_profile_context
from myu.coaching_planner import (
    build_coaching_plan,
    should_trigger_coaching_plan,
)
from myu.proactive_signals import collect_proactive_signals
from myu.tools.router import route_tool
from myu.tools.tasks import create_task
from myu.llm_service import call_llm, build_context, get_llm_config, get_myu_prompt_profile
from services.myu_knowledge_retrieval import get_relevant_knowledge_for_myu

logger = logging.getLogger("myu.orchestrator")

MYU_COST_PER_MSG = 0.01  # UP cost deducted from user wallet

# Fallback messages (no LLM needed)
FALLBACK_BUDGET = "Mi sa che questa richiesta e un po' complessa. Prova a riformulare in modo piu semplice!"
FALLBACK_TOOL_ERROR = "Non sono riuscito a trovare quello che cercavi. Dimmi la citta e riprovo."
FALLBACK_GENERIC = "Scusa, ho avuto un problema. Riprova tra un momento."


async def handle_chat(user_id: str, message: str, session_id: str) -> dict:
    """Main orchestration: user message → structured response.

    Returns: {message, intent, actions, cost, balance_after, request_id, meta}
    """
    request_id = generate_request_id()
    now = datetime.now(timezone.utc).isoformat()

    # 1. Check balance
    wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0, "balance": 1})
    balance = wallet.get("balance", 0) if wallet else 0
    if balance < MYU_COST_PER_MSG:
        return _error_response(request_id, "Saldo insufficiente per chattare con MYU.", balance)

    # 2. Load user state
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "full_name": 1, "profile_tags": 1})
    user_name = user.get("full_name", "Utente") if user else "Utente"
    user_profile_data = {
        "id": user_id,
        "name": user_name,
        "profile_tags": (user or {}).get("profile_tags", []),
    }
    conv_state = await db.myu_conversation_state.find_one({"user_id": user_id}, {"_id": 0, "summary": 1, "awaiting_city_confirm": 1, "pending_intent": 1})
    location = await get_location_state(user_id)
    coaching_profile = None
    coaching_context = ""
    try:
        coaching_profile = await get_user_coaching_profile(user_id)
        coaching_context = build_coaching_profile_context(coaching_profile)
    except Exception as coaching_exc:
        logger.warning(f"Coaching profile load failed: {coaching_exc}")

    # 3. Check if awaiting city confirmation from previous turn
    classification = None
    if conv_state and conv_state.get("awaiting_city_confirm"):
        mentioned_city = extract_city_from_text(message)
        affirmatives = ["si", "sì", "ok", "va bene", "certo", "esatto", "giusto", "confermo"]
        is_affirmative = any(a in message.lower().strip() for a in affirmatives)

        if mentioned_city or is_affirmative:
            return await _handle_city_confirmation(
                user_id,
                message,
                session_id,
                request_id,
                conv_state,
                location,
                user_name,
                user_profile_data,
            )
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
    logger.info(f"Intent: {classification['domain']}/{classification['intent']} conf={classification['confidence']}")

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
    if not llm_config["enabled"]:
        logger.warning("MYU disabled by admin configuration")
        return _error_response(request_id, "MYU e momentaneamente disattivata dall'amministrazione.", balance)
    if not llm_config["api_key"]:
        logger.error("MYU AI is not configured with a usable API key")
        return _error_response(request_id, "MYU non e ancora configurata. Riprova tra poco.", balance)
    model = llm_config["model"]
    est_input = MAX_CONTEXT_TOKENS
    est_output = MAX_OUTPUT_TOKENS
    tool_name = classification.get("needs_tool")
    est_cost = estimate_request_cost(model, est_input, est_output, tool_name)
    budget = check_budget(est_cost)

    if not budget["allowed"]:
        # Budget exceeded - use fallback
        new_balance = await _deduct_cost(user_id)
        await _save_conversation(user_id, session_id, message, FALLBACK_BUDGET, classification, now)
        await log_request_cost(request_id, user_id, model, 0, 0, tool_name, 0, True)
        return _build_response(request_id, FALLBACK_BUDGET, classification, [], MYU_COST_PER_MSG, new_balance)

    # 8. Call tool if needed (max 1 per request)
    tool_result = None
    if tool_name:
        cache_key = build_cache_key(tool_name, location.get("geohash_4", "") if location else "", message[:60])
        tool_result = await get_cached(cache_key)
        if not tool_result:
            tool_result = await route_tool(tool_name, user_id, tool_city, location.get("geohash_4") if location else None, message, classification["intent"])
            if tool_result and not tool_result.get("error"):
                await set_cached(cache_key, tool_name, location.get("geohash_4", "") if location else "", tool_city or "", classification["intent"], tool_result.get("data", {}))
            elif tool_result and tool_result.get("error"):
                logger.warning(f"Tool error: {tool_result['error']}")

    # 9. Build context and call LLM (1 call)
    active_tasks_data = await db.myu_tasks.find(
        {"user_id": user_id, "status": "active"}, {"_id": 0, "title": 1}
    ).to_list(3)
    active_task_titles = [t["title"] for t in active_tasks_data]
    knowledge_result = {
        "found": False,
        "sources": [],
        "chunks": [],
        "context_text": "",
        "fallback_reason": "",
    }

    recent_history = await _get_recent_history(user_id, limit=8)
    knowledge_result = await _retrieve_knowledge_with_fallback(
        query=message,
        user_id=user_id,
        session_id=session_id,
        classification=classification,
        conversation_summary=conv_state.get("summary") if conv_state else "",
        recent_history=recent_history,
        max_chunks=4,
        min_score=1.6,
    )

    prompt_profile = await _safe_get_prompt_profile()
    proactive_bundle = await _get_proactive_bundle(user_id)
    proactive_signals = proactive_bundle.get("signals", [])

    coaching_plan = None
    if should_trigger_coaching_plan(message, classification, coaching_profile):
        compensation_context = {
            "found": False,
            "sources": [],
            "chunks": [],
            "context_text": "",
            "fallback_reason": "",
        }
        compensation_query = (message or "").strip()
        if not compensation_query and coaching_profile:
            compensation_query = coaching_profile.get("economic_goal", "")
        compensation_query = compensation_query or "piano compensi"

        try:
            compensation_context = await get_relevant_knowledge_for_myu(
                query=compensation_query,
                user_context={
                    "user_id": user_id,
                    "session_id": session_id,
                    "classification": classification,
                    "category_filter": ["compensation_plan"],
                    "max_chunks": 5,
                    "min_score": 1.2,
                },
            )
        except Exception as comp_exc:
            logger.warning(f"Compensation retrieval failed: {comp_exc}")

        try:
            coaching_plan = build_coaching_plan(
                user_profile=coaching_profile or {},
                financial_goal=message,
                compensation_context=compensation_context,
            )
        except Exception as plan_exc:
            logger.warning(f"Coaching plan build failed: {plan_exc}")

    context = build_context(
        user_name=user_name,
        wallet_balance=balance,
        active_tasks=active_task_titles,
        conversation_summary=conv_state.get("summary") if conv_state else None,
        tool_result=tool_result,
        location_city=tool_city,
        coaching_context=coaching_context,
        knowledge_context=knowledge_result,
        behavior_profile=prompt_profile,
        user_profile=user_profile_data,
        coaching_profile=coaching_profile or {},
        coaching_plan=coaching_plan,
        proactive_signals=proactive_signals,
        recent_history=recent_history,
        message=message,
    )

    try:
        llm_result = await call_llm(
            context,
            message,
            session_id,
            prompt_profile=prompt_profile,
        )
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        new_balance = await _deduct_cost(user_id)
        await _save_conversation(user_id, session_id, message, FALLBACK_GENERIC, classification, now)
        await log_request_cost(request_id, user_id, model, 0, 0, tool_name, 0, True)
        return _build_response(
            request_id,
            FALLBACK_GENERIC,
            classification,
            [],
            MYU_COST_PER_MSG,
            new_balance,
            coaching_plan=coaching_plan,
        )

    parsed = llm_result["parsed"]
    response_msg = parsed.get("message", "")
    actions = parsed.get("actions", [])

    # 10. Handle task creation actions
    if actions:
        for action in actions:
            if action.get("type") == "create_task" and action.get("title"):
                await create_task(user_id, action["title"], action.get("due"))

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

    return _build_response(
        request_id,
        response_msg,
        classification,
        actions,
        MYU_COST_PER_MSG,
        new_balance,
        sources=knowledge_result.get("sources", []),
        coaching_plan=coaching_plan,
    )


async def _handle_city_confirmation(
    user_id,
    message,
    session_id,
    request_id,
    conv_state,
    location,
    user_name,
    user_profile_data,
):
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
    coaching_context = ""
    try:
        coaching_profile = await get_user_coaching_profile(user_id)
        coaching_context = build_coaching_profile_context(coaching_profile)
    except Exception as coaching_exc:
        logger.warning(f"Coaching profile load failed during city confirmation: {coaching_exc}")
    knowledge_result = {
        "found": False,
        "sources": [],
        "chunks": [],
        "context_text": "",
        "fallback_reason": "",
    }
    recent_history = await _get_recent_history(user_id, limit=8)
    trigger_message = pending_msg or message
    knowledge_result = await _retrieve_knowledge_with_fallback(
        query=trigger_message,
        user_id=user_id,
        session_id=session_id,
        classification=classification,
        conversation_summary="",
        recent_history=recent_history,
        max_chunks=4,
        min_score=1.6,
    )

    prompt_profile = await _safe_get_prompt_profile()
    proactive_bundle = await _get_proactive_bundle(user_id)
    proactive_signals = proactive_bundle.get("signals", [])
    coaching_plan = None
    if should_trigger_coaching_plan(trigger_message, classification, coaching_profile):
        compensation_context = {
            "found": False,
            "sources": [],
            "chunks": [],
            "context_text": "",
            "fallback_reason": "",
        }
        compensation_query = trigger_message or "piano compensi"
        try:
            compensation_context = await get_relevant_knowledge_for_myu(
                query=compensation_query,
                user_context={
                    "user_id": user_id,
                    "session_id": session_id,
                    "classification": classification,
                    "category_filter": ["compensation_plan"],
                    "max_chunks": 5,
                    "min_score": 1.2,
                },
            )
        except Exception as comp_exc:
            logger.warning(f"Compensation retrieval failed during city confirmation: {comp_exc}")

        try:
            coaching_plan = build_coaching_plan(
                user_profile=coaching_profile or {},
                financial_goal=trigger_message,
                compensation_context=compensation_context,
            )
        except Exception as plan_exc:
            logger.warning(f"Coaching plan build failed during city confirmation: {plan_exc}")

    context = build_context(
        user_name=user_name,
        wallet_balance=balance,
        tool_result=tool_result,
        location_city=confirmed_city,
        coaching_context=coaching_context,
        knowledge_context=knowledge_result,
        behavior_profile=prompt_profile,
        user_profile=user_profile_data or {"id": user_id, "name": user_name},
        coaching_profile=coaching_profile or {},
        coaching_plan=coaching_plan,
        proactive_signals=proactive_signals,
        recent_history=recent_history,
        message=trigger_message,
    )

    try:
        llm_result = await call_llm(
            context,
            trigger_message,
            session_id,
            prompt_profile=prompt_profile,
        )
        parsed = llm_result["parsed"]
        response_msg = parsed.get("message", "")
        actions = parsed.get("actions", [])
    except Exception:
        response_msg = f"Cerco a {confirmed_city}... ma ho avuto un problema. Riprova!"
        actions = []

    new_balance = await _deduct_cost(user_id)
    await _save_conversation(user_id, session_id, message, response_msg, classification, now, actions)
    await _update_state(user_id, message, response_msg)
    await log_request_cost(request_id, user_id, "gpt-4.1-nano", MAX_CONTEXT_TOKENS, MAX_OUTPUT_TOKENS, tool_name, 0, False)

    return _build_response(
        request_id,
        response_msg,
        classification,
        actions,
        MYU_COST_PER_MSG,
        new_balance,
        sources=knowledge_result.get("sources", []),
        coaching_plan=coaching_plan,
    )


async def _safe_get_prompt_profile() -> dict:
    try:
        return await get_myu_prompt_profile()
    except Exception as prompt_exc:
        logger.warning(f"MYU prompt profile load failed: {prompt_exc}")
        return {}


async def _get_proactive_bundle(user_id: str) -> dict:
    try:
        return await collect_proactive_signals(user_id, max_signals=5)
    except Exception as proactive_exc:
        logger.warning(f"Proactive signal collection failed: {proactive_exc}")
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "has_signals": False,
            "can_start_conversation": False,
            "signals": [],
            "top_signal": None,
        }


async def _retrieve_knowledge_with_fallback(
    *,
    query: str,
    user_id: str,
    session_id: str,
    classification: dict,
    conversation_summary: str = "",
    recent_history: list | None = None,
    max_chunks: int = 4,
    min_score: float = 1.6,
) -> dict:
    """Run retrieval and retry with recent context for low-information follow-up queries."""
    fallback = {
        "found": False,
        "sources": [],
        "chunks": [],
        "context_text": "",
        "fallback_reason": "",
    }

    try:
        primary = await get_relevant_knowledge_for_myu(
            query=query,
            user_context={
                "user_id": user_id,
                "session_id": session_id,
                "classification": classification,
                "max_chunks": max_chunks,
                "min_score": min_score,
            },
        )
    except Exception as retrieval_exc:
        logger.warning(f"Knowledge retrieval failed: {retrieval_exc}")
        return fallback

    if primary.get("found"):
        primary["query_mode"] = "primary"
        return primary

    if not _is_low_information_query(query):
        return primary

    fallback_query = _build_knowledge_fallback_query(
        current_query=query,
        conversation_summary=conversation_summary,
        recent_history=recent_history or [],
    )
    if not fallback_query:
        return primary

    try:
        secondary = await get_relevant_knowledge_for_myu(
            query=fallback_query,
            user_context={
                "user_id": user_id,
                "session_id": session_id,
                "classification": classification,
                "max_chunks": max_chunks,
                "min_score": 1.1,
            },
        )
    except Exception as fallback_exc:
        logger.warning(f"Knowledge fallback retrieval failed: {fallback_exc}")
        return primary

    if secondary.get("found"):
        secondary["query_mode"] = "fallback_recent_context"
        secondary["original_query"] = query
        return secondary
    return primary


def _is_low_information_query(text: str) -> bool:
    normalized = (text or "").strip().lower()
    if not normalized:
        return True
    if len(normalized) <= 36:
        return True

    weak_tokens = {
        "non",
        "si",
        "sì",
        "no",
        "ok",
        "bene",
        "come",
        "cosa",
        "quindi",
        "allora",
        "tu",
        "te",
        "lo",
        "la",
        "li",
        "le",
        "conosci",
        "sai",
        "capito",
        "chiaro",
    }
    tokens = re.findall(r"[a-zA-Z0-9_]{3,}", normalized)
    informative = [token for token in tokens if token not in weak_tokens]
    return len(informative) <= 2


def _build_knowledge_fallback_query(
    *,
    current_query: str,
    conversation_summary: str,
    recent_history: list[dict],
) -> str:
    parts = []
    summary_text = (conversation_summary or "").strip()
    if summary_text:
        parts.append(summary_text)

    user_turns = []
    current = (current_query or "").strip().lower()
    for row in reversed(recent_history or []):
        if not isinstance(row, dict):
            continue
        if row.get("role") != "user":
            continue
        text = (row.get("text") or "").strip()
        if not text or text.lower() == current:
            continue
        user_turns.append(text)
        if len(user_turns) >= 3:
            break

    if user_turns:
        parts.extend(reversed(user_turns))
    if not parts:
        return ""
    return " | ".join(parts)[:650]


async def _get_recent_history(user_id: str, limit: int = 6) -> list[dict]:
    try:
        rows = await db.myu_conversations.find(
            {"user_id": user_id},
            {"_id": 0, "role": 1, "text": 1, "created_at": 1},
        ).sort("created_at", -1).limit(limit).to_list(limit)
    except Exception as hist_exc:
        logger.warning(f"Recent history load failed: {hist_exc}")
        return []
    rows.reverse()
    return rows


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


def _build_response(
    request_id,
    message,
    classification,
    actions,
    cost,
    balance_after,
    sources=None,
    coaching_plan=None,
):
    """Build standardized response dict."""
    return {
        "message": message,
        "intent": {"domain": classification.get("domain"), "intent": classification.get("intent"), "confidence": classification.get("confidence", 0)},
        "actions": actions or [],
        "sources": sources or [],
        "coaching_plan": coaching_plan,
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
