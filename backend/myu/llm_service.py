"""MYU LLM Service Layer - Cost-aware LLM wrapper."""
import os
import json
import logging
from openai import AsyncOpenAI
from database import db
from myu.cost_control import MAX_OUTPUT_TOKENS, MAX_CONTEXT_TOKENS, cap_tokens, count_tokens

logger = logging.getLogger("myu.llm")

# System prompt focused on natural continuity and practical assistance
SYSTEM_PROMPT = """Sei MYU, personal shopper e guida operativa nella piattaforma myUup.
Priorita: aiutare in modo pratico tra Gift, servizi interni, task e funzioni della piattaforma.

Stile:
- italiano naturale, caldo ma non appiccicoso
- evita risposte template, filler, introduzioni inutili
- massimo una domanda utile per turno
- se l'obiettivo e chiaro, passa subito ad azioni concrete
- lunghezza breve/media, ma completa quando serve un mini piano

Saluti e nome utente:
- saluta solo all'inizio conversazione o in rari casi naturali
- non aprire ogni turno con "ciao"/equivalenti
- usa il nome utente raramente e solo quando suona naturale

Continuita:
- continua il filo del discorso, non ripartire da zero
- non ripetere premesse gia dette
- se c'e urgenza o obiettivo pratico, proponi subito un piano operativo a passi chiari

Gestione fastidio:
- se l'utente mostra fastidio (es. "basta", "sei pesante"), fermati con tatto
- non insistere, non proporre nuove azioni in quel turno
- nei turni successivi, solo se naturale, una breve nota non invadente e poi aiuto pratico

Formato obbligatorio:
Rispondi SOLO in JSON: {"message": "...", "actions": []}
ACTIONS: {"type": "navigate", "path": "...", "label": "..."}, {"type": "create_task", "title": "...", "due": "..."}, {"type": "suggest_merchant", "merchant_id": "...", "name": "..."}, {"type": "confirm_city", "city": "...", "label": "..."}"""


def normalize_model_for_responses(raw_model: str) -> str:
    """Normalize configured model to a known-safe OpenAI Responses model."""
    model = (raw_model or "").strip()
    if not model:
        return "gpt-4o-mini"
    # MYU is OpenAI-only: normalize obvious non-OpenAI leftovers.
    if "gemini" in model.lower() or "emergent" in model.lower():
        return "gpt-4o-mini"
    return model


def _extract_response_text(response_obj) -> str:
    """Extract text from OpenAI Responses API object safely."""
    output_text = getattr(response_obj, "output_text", None)
    if output_text:
        return output_text.strip()

    parts = []
    for item in getattr(response_obj, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            text = getattr(content, "text", None)
            if text:
                parts.append(text)
    return "\n".join(parts).strip()


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
    conversation_phase: str = "continuazione",
    user_annoyed_recently: bool = False,
    practical_goal_mode: bool = False,
) -> str:
    """Build minimal context string for the LLM prompt."""
    parts = [f"Nome utente (usalo raramente): {user_name}"]
    parts.append(f"Fase conversazione: {conversation_phase}")
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
        parts.append(f"Contesto conversazione: {cap_tokens(conversation_summary, 160)}")
    if user_annoyed_recently:
        parts.append("Nota tono: l'utente ha mostrato fastidio di recente; evita insistenza.")
    if practical_goal_mode:
        parts.append("Modalita: richiesta pratica/urgente, rispondi con piano operativo immediato.")
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
        raise RuntimeError(
            "Nessuna API key trovata (OPENAI_API_KEY o EMERGENT_LLM_KEY). "
            "Configura /var/www/myuup-dev/backend/.env e riavvia myuup-dev.service."
        )

    prompt = f"CONTESTO:\n{context}\n\nMESSAGGIO: {user_message}"
    prompt = cap_tokens(prompt, MAX_CONTEXT_TOKENS)
    logger.debug("LLM prompt prepared session=%s chars=%s", session_id, len(prompt))

    try:
        client = AsyncOpenAI(api_key=config["api_key"])
        logger.info("Sending message to OpenAI Responses API model=%s session=%s", config["model"], session_id)
        response = await client.responses.create(
            model=config["model"],
            input=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            max_output_tokens=config["max_tokens"],
            temperature=config["temperature"],
        )
        raw = _extract_response_text(response)
        if not raw:
            raise RuntimeError("Risposta vuota da OpenAI Responses API.")
        logger.info(
            "LLM response received session=%s response_id=%s chars=%s",
            session_id,
            getattr(response, "id", "n/a"),
            len(raw),
        )

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
