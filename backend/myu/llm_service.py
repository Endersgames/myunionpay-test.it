"""MYU LLM Service Layer - Cost-aware LLM wrapper."""
import json
import logging
from openai import AsyncOpenAI
from myu.cost_control import MAX_OUTPUT_TOKENS, MAX_CONTEXT_TOKENS, cap_tokens, count_tokens
from services.ai_config import DEFAULT_CHAT_MODEL, get_ai_runtime_config

logger = logging.getLogger("myu.llm")

# System prompt - kept short to minimize token usage
SYSTEM_PROMPT = """Sei MYU, compagno digitale dell'app myUup.
REGOLE: rispondi in italiano, max 2 frasi, una domanda alla volta, tono amichevole e pratico.
Rispondi SOLO in JSON: {"message": "...", "actions": []}
ACTIONS: {"type": "navigate", "path": "...", "label": "..."}, {"type": "create_task", "title": "...", "due": "..."}, {"type": "suggest_merchant", "merchant_id": "...", "name": "..."}, {"type": "confirm_city", "city": "...", "label": "..."}"""


async def get_llm_config() -> dict:
    """Get LLM model config from DB or fallback to env defaults."""
    runtime = await get_ai_runtime_config(default_model=DEFAULT_CHAT_MODEL)
    return {
        "api_key": runtime["api_key"],
        "provider": runtime["provider"],
        "model": runtime["model"],
        "enabled": runtime["enabled"],
        "source": runtime["source"],
        "max_tokens": min(runtime["max_tokens"], MAX_OUTPUT_TOKENS),
        "temperature": runtime["temperature"],
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
    config = await get_llm_config()
    if not config["enabled"]:
        raise RuntimeError("MYU AI disabilitata dal pannello admin")
    if not config["api_key"]:
        raise RuntimeError("MYU AI non configurata")
    prompt = f"CONTESTO:\n{context}\n\nMESSAGGIO: {user_message}"

    # Cap the prompt
    prompt = cap_tokens(prompt, MAX_CONTEXT_TOKENS)

    client = AsyncOpenAI(
        api_key=config["api_key"],
    )
    response = await client.chat.completions.create(
        model=config["model"],
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        max_tokens=config["max_tokens"],
        temperature=config["temperature"],
    )
    raw = response.choices[0].message.content or ""

    # Parse JSON response
    parsed = _parse_llm_response(raw)

    # Estimate tokens
    input_tokens = count_tokens(SYSTEM_PROMPT) + count_tokens(prompt)
    output_tokens = count_tokens(raw)

    return {
        "parsed": parsed,
        "raw": raw,
        "model": config["model"],
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }


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
