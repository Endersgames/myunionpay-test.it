"""MYU LLM Service Layer - Cost-aware LLM wrapper."""
import json
import logging

from database import db
from myu.cost_control import MAX_OUTPUT_TOKENS, MAX_CONTEXT_TOKENS, cap_tokens, count_tokens
from myu.context_builder import build_myu_context
from services.ai_config import DEFAULT_CHAT_MODEL, get_ai_runtime_config
from services.myu_behavior_config import (
    default_behavior_config,
    ensure_myu_behavior_config_persisted,
    merge_myu_config,
)

logger = logging.getLogger("myu.llm")

DEFAULT_BEHAVIOR_CONFIG = default_behavior_config()

DEFAULT_COACHING_ENGINE_CONFIG = {
    "enabled": True,
    "coaching_prompt": "",
    "objective_notes": "",
    "escalation_policy": "balanced",
    "auto_suggestions": True,
}


def _compact_line(value: str, fallback: str = "", max_chars: int = 280) -> str:
    cleaned = " ".join((value or "").strip().split())
    if not cleaned:
        return fallback
    return cleaned[:max_chars]


def _normalize_behavior_config(raw: dict, fallback_personality: str = "amichevole") -> dict:
    behavior = merge_myu_config({"base_behavior": raw or {}}).get("base_behavior", DEFAULT_BEHAVIOR_CONFIG)
    if not (behavior.get("assistant_name") or "").strip():
        behavior["assistant_name"] = "MYU"
    if not (behavior.get("voice_tone") or "").strip():
        behavior["voice_tone"] = fallback_personality or "amichevole"
    behavior["emoji_enabled"] = bool(behavior.get("emoji_enabled", True))
    return behavior


async def get_myu_prompt_profile() -> dict:
    config_doc = await ensure_myu_behavior_config_persisted(updated_by="system") or {}
    myu_config = merge_myu_config(config_doc.get("myu_config") or {})
    coaching_engine = {
        **DEFAULT_COACHING_ENGINE_CONFIG,
        **(config_doc.get("coaching_engine") or {}),
    }
    behavior = _normalize_behavior_config(
        myu_config.get("base_behavior") or {},
        fallback_personality=(myu_config.get("personality") or "amichevole"),
    )

    response_max_sentences = int(myu_config.get("response_max_sentences") or 8)
    response_max_sentences = min(max(3, response_max_sentences), 16)

    return {
        "training_prompt": (config_doc.get("training_prompt") or "").strip(),
        "response_rules": (config_doc.get("response_rules") or "").strip(),
        "default_language": (myu_config.get("default_language") or "it").strip() or "it",
        "response_max_sentences": response_max_sentences,
        "allow_action_suggestions": bool(myu_config.get("allow_action_suggestions", True)),
        "coaching_engine": coaching_engine,
        "behavior": behavior,
    }


def build_system_prompt(profile: dict) -> str:
    behavior = profile.get("behavior") or DEFAULT_BEHAVIOR_CONFIG
    assistant_name = _compact_line(behavior.get("assistant_name", "MYU"), "MYU", max_chars=80)
    voice_tone = _compact_line(behavior.get("voice_tone", "umano_empatico_positivo"), "umano_empatico_positivo", max_chars=60)
    formality_level = _compact_line(behavior.get("formality_level", "adattiva"), "adattiva", max_chars=60)
    response_style = _compact_line(behavior.get("response_style", "conversazionale_adattivo"), "conversazionale_adattivo", max_chars=60)
    average_length = _compact_line(behavior.get("average_length", "adattiva_al_contesto"), "adattiva_al_contesto", max_chars=60)
    commercial_approach = _compact_line(
        behavior.get("commercial_approach", "consulenziale_empatico"),
        "consulenziale_empatico",
        max_chars=60,
    )
    educational_approach = _compact_line(
        behavior.get("educational_approach", "storytelling_pratico"),
        "storytelling_pratico",
        max_chars=60,
    )
    empathy = _compact_line(behavior.get("empathy", "alta"), "alta", max_chars=60)
    emoji_policy = "consentite occasionalmente se coerenti e sobrie" if behavior.get("emoji_enabled") else "non usare emoji"
    curiosity_level = _compact_line(behavior.get("curiosity_level", "alta"), "alta", max_chars=60)
    humor_style = _compact_line(behavior.get("humor_style", "leggera_irriverenza"), "leggera_irriverenza", max_chars=60)
    adaptive_style = bool(behavior.get("adaptive_style_enabled", True))
    human_mode = bool(behavior.get("human_mode_enabled", True))
    surprise_insights = bool(behavior.get("surprise_insights_enabled", True))
    proactive_enabled = bool(behavior.get("proactive_enabled", True))
    proactive_followups = bool(behavior.get("proactive_followups_enabled", True))
    proactive_checkins = bool(behavior.get("proactive_checkins_enabled", True))
    proactivity_boundaries = _compact_line(
        behavior.get("proactivity_boundaries", "gentile_non_invadente"),
        "gentile_non_invadente",
        max_chars=80,
    )

    follow_rules = _compact_line(behavior.get("follow_rules", ""), "-", max_chars=520)
    avoid_rules = _compact_line(behavior.get("avoid_rules", ""), "-", max_chars=520)
    training_prompt = _compact_line(profile.get("training_prompt", ""), "-", max_chars=700)
    response_rules = _compact_line(profile.get("response_rules", ""), "-", max_chars=700)
    coaching_engine = profile.get("coaching_engine") or DEFAULT_COACHING_ENGINE_CONFIG
    coaching_enabled = bool(coaching_engine.get("enabled", True))
    coaching_prompt = _compact_line(coaching_engine.get("coaching_prompt", ""), "-", max_chars=700)
    coaching_objectives = _compact_line(coaching_engine.get("objective_notes", ""), "-", max_chars=700)
    coaching_escalation = _compact_line(
        coaching_engine.get("escalation_policy", "balanced"),
        "balanced",
        max_chars=80,
    )
    coaching_auto_suggestions = bool(coaching_engine.get("auto_suggestions", True))
    response_max_sentences = int(profile.get("response_max_sentences") or 8)
    action_policy = (
        "Puoi proporre action utili quando servono."
        if profile.get("allow_action_suggestions", True)
        else "Non proporre action se non esplicitamente richieste."
    )
    default_language = _compact_line(profile.get("default_language", "it"), "it", max_chars=10)

    return (
        f"Sei {assistant_name}, assistente digitale dell'app myUup.\n"
        f"Lingua prioritaria: {default_language}.\n"
        "Regola non negoziabile: sii utile, chiaro, empatico; non essere mai aggressivo, "
        "manipolativo, pressante o colpevolizzante.\n"
        "Modalita assistente: umano, empatico, positivo, curioso verso la persona.\n"
        f"Tono di voce: {voice_tone}. Formalita: {formality_level}. Stile risposta: {response_style}.\n"
        f"Lunghezza media: {average_length}. Linea guida indicativa: {response_max_sentences} frasi, "
        "ma adatta la profondita al contesto (puoi essere piu esteso quando utile).\n"
        f"Approccio commerciale: {commercial_approach}. Approccio educativo: {educational_approach}. Empatia: {empathy}.\n"
        f"Curiosita: {curiosity_level}. Ironia: {humor_style}. Emoji: {emoji_policy}.\n"
        f"Adattamento stile utente: {'attivo' if adaptive_style else 'non attivo'}.\n"
        f"Modalita umana: {'attiva' if human_mode else 'non attiva'}. Insight sorprendenti: {'consentiti' if surprise_insights else 'non richiesti'}.\n"
        f"Proattivita: {'attiva' if proactive_enabled else 'non attiva'}; "
        f"follow-up: {'si' if proactive_followups else 'no'}; check-in: {'si' if proactive_checkins else 'no'}; "
        f"confini: {proactivity_boundaries}.\n"
        f"Regole da seguire: {follow_rules}\n"
        f"Cose da evitare: {avoid_rules}\n"
        f"Prompt di addestramento admin: {training_prompt}\n"
        f"Regole di risposta admin: {response_rules}\n"
        f"Coaching engine attivo: {'si' if coaching_enabled else 'no'}.\n"
        f"Coaching prompt admin: {coaching_prompt}\n"
        f"Obiettivi coaching admin: {coaching_objectives}\n"
        f"Escalation policy coaching: {coaching_escalation}. Auto suggestions coaching: {'si' if coaching_auto_suggestions else 'no'}.\n"
        "Adattati alla persona: "
        "utente diretto -> sintetico e concreto; "
        "utente curioso -> piu spiegazione ed esempi; "
        "utente motivazionale -> coaching energico ma realistico; "
        "utente stanco/stressato -> tono leggero, supportivo e meno carico.\n"
        "Nel coaching metti il benessere della persona prima della performance: "
        "incoraggia, riduci pressione se necessario, adatta i task e celebra i progressi; "
        "non forzare, non creare pressione, non promettere risultati economici garantiti "
        "e non usare framing manipolativi.\n"
        "Se nel contesto trovi trigger proattivi (eventi imminenti, task in scadenza, inattivita, milestone), "
        "puoi proporre check-in/follow-up utili con tono gentile e non invasivo.\n"
        "Se trovi blocchi 'Knowledge MYU' nel contesto, usali come base informativa prioritaria; "
        "se non bastano, dichiaralo senza inventare.\n"
        "Se nel contesto sono presenti fonti o blocchi knowledge, non dire che non hai accesso ai documenti: "
        "usa quelle fonti e indica solo i limiti specifici.\n"
        f"{action_policy}\n"
        'Rispondi SOLO in JSON: {"message": "...", "actions": []}\n'
        'ACTIONS: {"type": "navigate", "path": "...", "label": "..."}, '
        '{"type": "create_task", "title": "...", "due": "..."}, '
        '{"type": "suggest_merchant", "merchant_id": "...", "name": "..."}, '
        '{"type": "confirm_city", "city": "...", "label": "..."}'
    )


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
    coaching_context: str = None,
    coaching_plan_context: str = None,
    knowledge_context: dict = None,
    behavior_profile: dict = None,
    user_profile: dict = None,
    coaching_profile: dict = None,
    coaching_plan: dict = None,
    proactive_signals: list = None,
    recent_history: list = None,
    message: str = "",
) -> str:
    """Build final context using centralized context builder."""
    context_bundle = build_myu_context(
        user={"name": user_name, **(user_profile or {})},
        message=message or "",
        options={
            "wallet_balance": wallet_balance,
            "active_tasks": active_tasks or [],
            "conversation_summary": conversation_summary or "",
            "tool_result": tool_result,
            "location_city": location_city or "",
            "coaching_profile_context": coaching_context or "",
            "coaching_plan_context": coaching_plan_context or "",
            "knowledge_context": knowledge_context or {},
            "behavior_profile": behavior_profile or {},
            "coaching_profile": coaching_profile or {},
            "coaching_plan": coaching_plan or {},
            "proactive_signals": proactive_signals or [],
            "recent_history": recent_history or [],
            "max_tokens": MAX_CONTEXT_TOKENS,
        },
    )
    return context_bundle.get("final_context", "")


async def call_llm(
    context: str,
    user_message: str,
    session_id: str,
    prompt_profile: dict | None = None,
) -> dict:
    """Call LLM with minimal context. Returns parsed response + token estimates."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    config = await get_llm_config()
    if not config["enabled"]:
        raise RuntimeError("MYU AI disabilitata dal pannello admin")
    if not config["api_key"]:
        raise RuntimeError("MYU AI non configurata")
    prompt_profile = prompt_profile or await get_myu_prompt_profile()
    system_prompt = build_system_prompt(prompt_profile)
    prompt = f"CONTESTO:\n{context}\n\nMESSAGGIO: {user_message}"

    # Cap the prompt
    prompt = cap_tokens(prompt, MAX_CONTEXT_TOKENS)

    chat = LlmChat(
        api_key=config["api_key"],
        session_id=f"myu_{session_id}",
        system_message=system_prompt,
    )
    chat.with_model(config["provider"], config["model"])

    raw = await chat.send_message(UserMessage(text=prompt))

    # Parse JSON response
    parsed = _parse_llm_response(raw)

    # Estimate tokens
    input_tokens = count_tokens(system_prompt) + count_tokens(prompt)
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
