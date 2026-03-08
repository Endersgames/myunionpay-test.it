"""MYU LLM Service Layer - Cost-aware LLM wrapper."""
import os
import json
import logging
from database import db
from myu.cost_control import MAX_OUTPUT_TOKENS, MAX_CONTEXT_TOKENS, cap_tokens, count_tokens

logger = logging.getLogger("myu.llm")

# System prompt - kept short to minimize token usage
SYSTEM_PROMPT = """Sei MYU, compagno digitale dell'app myUup.
REGOLE: rispondi in italiano, max 2 frasi, una domanda alla volta, tono amichevole e pratico.
Rispondi SOLO in JSON: {"message": "...", "actions": []}
ACTIONS: {"type": "navigate", "path": "...", "label": "..."}, {"type": "create_task", "title": "...", "due": "..."}, {"type": "suggest_merchant", "merchant_id": "...", "name": "..."}, {"type": "confirm_city", "city": "...", "label": "..."}"""


def normalize_model_for_responses(raw_model: str) -> str:
    """Normalize configured model to a known-safe OpenAI Responses model."""
    model = (raw_model or "").strip()
    aliases = {
        "gpt-4.1-nano": "gpt-4o-mini",
        "gpt-4o": "gpt-4o-mini",
    }
    if model in aliases:
        return aliases[model]
    if model.startswith("gpt-5"):
        return "gpt-4o-mini"
    if not model:
        return "gpt-4o-mini"
    return model


async def get_llm_config() -> dict:
    """Get LLM model config from DB or fallback to env defaults."""
    config = await db.app_config.find_one({"key": "openai"}, {"_id": 0})
    emergent_key = os.environ.get("EMERGENT_LLM_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    # Prefer OPENAI_API_KEY if available, fallback to EMERGENT_LLM_KEY
    env_key = openai_key or emergent_key
    env_key_source = "OPENAI_API_KEY" if openai_key else ("EMERGENT_LLM_KEY" if emergent_key else "none")

    if config and config.get("enabled", True):
        api_key = config.get("api_key")
        key_source = "db"
        # Fallback to env if DB key is invalid/placeholder
        if not api_key or api_key == "KEEP_EXISTING" or len(api_key) < 10:
            api_key = env_key
            key_source = env_key_source
        model = normalize_model_for_responses(config.get("model", "gpt-4o-mini"))
        logger.info("Resolved LLM config from db: model=%s key_source=%s", model, key_source)
        return {
            "api_key": api_key,
            "model": model,
            "max_tokens": min(config.get("max_tokens", MAX_OUTPUT_TOKENS), MAX_OUTPUT_TOKENS),
            "temperature": config.get("temperature", 0.7),
        }
    model = normalize_model_for_responses("gpt-4o-mini")
    logger.info("Resolved LLM config from env: model=%s key_source=%s", model, env_key_source)
    return {
        "api_key": env_key,
        "model": model,
        "max_tokens": MAX_OUTPUT_TOKENS,
        "temperature": 0.7,
    }


def build_context(
    user_name: str,
    wallet_balance: float = 0,
    active_tasks: list = None,
    conversation_summary: str = None,
    tool_result: dict = None,
    location_city: str = None,
) -> str:
    """Build minimal context string for the LLM prompt."""
    parts = [f"Utente: {user_name}"]
    if wallet_balance:
        parts.append(f"Saldo: {wallet_balance:.2f} UP")
    if active_tasks:
        parts.append(f"Task: {', '.join(t[:40] for t in active_tasks[:3])}")
    if location_city:
        parts.append(f"Citta: {location_city}")
    if tool_result:
        tool_text = json.dumps(tool_result.get("data", {}), ensure_ascii=False)
        parts.append(f"Risultato ricerca: {cap_tokens(tool_text, 200)}")
    if conversation_summary:
        parts.append(f"Contesto: {cap_tokens(conversation_summary, 80)}")
    return cap_tokens("\n".join(parts), MAX_CONTEXT_TOKENS)


async def call_llm(
    context: str,
    user_message: str,
    session_id: str,
) -> dict:
    """Call LLM with minimal context. Returns parsed response + token estimates."""
    logger.info("Starting LLM call for session=%s", session_id)

    config = await get_llm_config()
    logger.info(
        "LLM request config session=%s model=%s api_key_set=%s max_tokens=%s",
        session_id,
        config["model"],
        bool(config["api_key"]),
        config["max_tokens"],
    )
    if not config["api_key"]:
        raise RuntimeError("Nessuna API key trovata (OPENAI_API_KEY o EMERGENT_LLM_KEY).")

    prompt = f"CONTESTO:\n{context}\n\nMESSAGGIO: {user_message}"
    prompt = cap_tokens(prompt, MAX_CONTEXT_TOKENS)
    logger.debug("LLM prompt prepared session=%s chars=%s", session_id, len(prompt))

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        chat = LlmChat(
            api_key=config["api_key"],
            session_id=f"myu_{session_id}",
            system_message=SYSTEM_PROMPT,
        )
        chat.with_model("openai", config["model"])

        logger.info("Sending message to LLM provider=openai model=%s session=%s", config["model"], session_id)
        raw = await chat.send_message(UserMessage(text=prompt))
        logger.info("LLM response received session=%s chars=%s", session_id, len(raw))

        parsed = _parse_llm_response(raw)
        logger.debug("LLM parsed response keys=%s", list(parsed.keys()))

        input_tokens = count_tokens(SYSTEM_PROMPT) + count_tokens(prompt)
        output_tokens = count_tokens(raw)

        return {
            "parsed": parsed,
            "raw": raw,
            "model": config["model"],
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        }
    except Exception as e:
        logger.error("LLM call failed session=%s model=%s error=%s", session_id, config["model"], e, exc_info=True)
        raise


def _parse_llm_response(raw: str) -> dict:
    """Parse LLM response, handling markdown code blocks."""
    clean = raw.strip()
    if clean.startswith("```"):
        clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        clean = clean.strip()
    try:
        return json.loads(clean)
    except (json.JSONDecodeError, IndexError):
        return {
            "message": raw.strip()[:300],
            "actions": [],
        }
