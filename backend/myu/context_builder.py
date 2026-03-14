"""MYU Context Builder - centralized final context composition for chat."""

from __future__ import annotations

import json
from typing import Any

from myu.cost_control import MAX_CONTEXT_TOKENS, cap_tokens

CONTEXT_VERSION = "myu_context_v1"

DEFAULT_ETHICAL_RULES = [
    "Benessere utente prima della performance.",
    "Mai aggressivo, manipolativo o pressante.",
    "Nessuna promessa economica garantita o irrealistica.",
    "Se i dati non bastano, dichiararlo esplicitamente senza inventare.",
]

LAYER_SEQUENCE = [
    ("ethics", "Regole Etiche"),
    ("base_behavior", "Comportamento Base MYU"),
    ("user_profile", "Profilo Utente"),
    ("user_style", "Adattamento Stile Utente"),
    ("coaching_profile", "Profilo Coaching"),
    ("coaching_plan", "Piano Coaching Attivo"),
    ("proactive_signals", "Trigger Proattivi"),
    ("knowledge_category", "Categoria Knowledge MYU"),
    ("knowledge_documents", "Knowledge MYU"),
    ("runtime_state", "Stato Conversazione"),
    ("recent_history", "Storico Recente Utile"),
]


def _clean_line(value: Any, *, max_chars: int = 280) -> str:
    text = " ".join(str(value or "").strip().split())
    return text[:max_chars]


def _clean_multiline(value: Any, *, max_chars: int = 900) -> str:
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = [_clean_line(line, max_chars=500) for line in text.split("\n")]
    compact = "\n".join(line for line in lines if line)
    return compact[:max_chars]


def _ordered_unique(values: list[str]) -> list[str]:
    seen = set()
    ordered = []
    for raw in values:
        normalized = _clean_line(raw, max_chars=80).lower().replace("-", "_").replace(" ", "_")
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)
    return ordered


def _build_ethics_layer(options: dict[str, Any]) -> dict[str, Any]:
    rules = options.get("ethical_rules") or DEFAULT_ETHICAL_RULES
    if isinstance(rules, str):
        rules = [rules]
    lines = [f"- {_clean_line(rule, max_chars=240)}" for rule in rules if _clean_line(rule, max_chars=240)]
    return {
        "applied": bool(lines),
        "text": "\n".join(lines),
        "summary": f"{len(lines)} regole etiche applicate",
    }


def _build_base_behavior_layer(behavior_profile: dict[str, Any]) -> dict[str, Any]:
    profile = behavior_profile or {}
    behavior = profile.get("behavior") or {}
    coaching_engine = profile.get("coaching_engine") or {}

    lines = []
    assistant_name = _clean_line(behavior.get("assistant_name", "MYU"), max_chars=80)
    if assistant_name:
        lines.append(f"- Assistente: {assistant_name}")
    lines.append(f"- Tono: {_clean_line(behavior.get('voice_tone', 'amichevole'), max_chars=80)}")
    lines.append(f"- Formalita: {_clean_line(behavior.get('formality_level', 'bilanciato'), max_chars=80)}")
    lines.append(f"- Stile risposta: {_clean_line(behavior.get('response_style', 'bilanciato'), max_chars=80)}")
    lines.append(f"- Lunghezza media: {_clean_line(behavior.get('average_length', 'media'), max_chars=80)}")
    lines.append(
        f"- Approccio commerciale/educativo: "
        f"{_clean_line(behavior.get('commercial_approach', 'soft'), max_chars=70)} / "
        f"{_clean_line(behavior.get('educational_approach', 'pratico'), max_chars=70)}"
    )
    lines.append(f"- Empatia: {_clean_line(behavior.get('empathy', 'alta'), max_chars=70)}")
    lines.append(f"- Emoji: {'abilitate' if behavior.get('emoji_enabled') else 'disabilitate'}")
    lines.append(f"- Curiosita: {_clean_line(behavior.get('curiosity_level', 'alta'), max_chars=60)}")
    lines.append(f"- Ironia: {_clean_line(behavior.get('humor_style', 'leggera_irriverenza'), max_chars=80)}")
    lines.append(f"- Modalita umana: {'attiva' if behavior.get('human_mode_enabled', True) else 'off'}")
    lines.append(
        f"- Stile adattivo: {'attivo' if behavior.get('adaptive_style_enabled', True) else 'off'} | "
        f"Insight sorprendenti: {'si' if behavior.get('surprise_insights_enabled', True) else 'no'}"
    )
    lines.append(
        f"- Proattivita: {'attiva' if behavior.get('proactive_enabled', True) else 'off'} | "
        f"follow-up: {'si' if behavior.get('proactive_followups_enabled', True) else 'no'} | "
        f"check-in: {'si' if behavior.get('proactive_checkins_enabled', True) else 'no'} | "
        f"confini: {_clean_line(behavior.get('proactivity_boundaries', 'gentile_non_invadente'), max_chars=60)}"
    )
    lines.append(
        f"- Coaching engine: {'attivo' if coaching_engine.get('enabled', True) else 'disattivo'} "
        f"(policy: {_clean_line(coaching_engine.get('escalation_policy', 'balanced'), max_chars=60)})"
    )

    training_prompt = _clean_line(profile.get("training_prompt", ""), max_chars=240)
    response_rules = _clean_line(profile.get("response_rules", ""), max_chars=240)
    if training_prompt:
        lines.append(f"- Prompt addestramento admin: {training_prompt}")
    if response_rules:
        lines.append(f"- Regole risposta admin: {response_rules}")

    return {
        "applied": bool(lines),
        "text": "\n".join(lines),
        "summary": "Profilo base MYU caricato",
    }


def _build_user_profile_layer(user: dict[str, Any], options: dict[str, Any]) -> dict[str, Any]:
    user_profile = options.get("user_profile") or {}
    lines = []
    name = _clean_line(user.get("name") or user_profile.get("name"), max_chars=120)
    if name:
        lines.append(f"- Nome utente: {name}")

    tags = user_profile.get("profile_tags") or user.get("profile_tags") or []
    if isinstance(tags, list) and tags:
        compact_tags = ", ".join(_clean_line(tag, max_chars=40) for tag in tags[:8] if _clean_line(tag, max_chars=40))
        if compact_tags:
            lines.append(f"- Tag profilo: {compact_tags}")

    wallet_balance = options.get("wallet_balance")
    if isinstance(wallet_balance, (int, float)):
        lines.append(f"- Saldo wallet: {float(wallet_balance):.2f} UP")

    active_tasks = options.get("active_tasks") or []
    if isinstance(active_tasks, list) and active_tasks:
        compact_tasks = ", ".join(_clean_line(task, max_chars=45) for task in active_tasks[:4] if _clean_line(task, max_chars=45))
        if compact_tasks:
            lines.append(f"- Task attivi: {compact_tasks}")

    return {
        "applied": bool(lines),
        "text": "\n".join(lines),
        "summary": "Dati utente disponibili",
    }


def _infer_user_style(message: str, recent_history: list[dict[str, Any]]) -> list[str]:
    samples = []
    for row in recent_history[-6:]:
        if isinstance(row, dict) and row.get("role") == "user":
            text = _clean_line(row.get("text", ""), max_chars=180)
            if text:
                samples.append(text.lower())
    current = _clean_line(message or "", max_chars=220).lower()
    if current:
        samples.append(current)

    if not samples:
        return []

    joined = " ".join(samples)
    styles = []

    avg_len = sum(len(s) for s in samples) / max(1, len(samples))
    question_marks = joined.count("?")
    curiosity_tokens = ("come", "perche", "spiegami", "dettagli", "approfond", "esempio")
    stress_tokens = ("stanco", "stress", "ansia", "pressione", "stremato", "poco tempo")
    motivation_tokens = ("obiettivo", "crescere", "spingere", "motiv", "determinato", "farcela")

    if avg_len <= 38 and question_marks <= 1:
        styles.append("diretto")
    if question_marks >= 2 or any(token in joined for token in curiosity_tokens):
        styles.append("curioso")
    if any(token in joined for token in motivation_tokens):
        styles.append("motivazionale")
    if any(token in joined for token in stress_tokens):
        styles.append("stanco_stressato")
    if not styles:
        styles.append("bilanciato")
    return styles


def _build_user_style_layer(message: str, options: dict[str, Any]) -> dict[str, Any]:
    recent_history = options.get("recent_history") or []
    styles = _infer_user_style(message, recent_history if isinstance(recent_history, list) else [])
    if not styles:
        return {"applied": False, "text": "", "summary": "Stile utente non determinato"}

    suggestions = []
    if "diretto" in styles:
        suggestions.append("risposte piu concise e operative")
    if "curioso" in styles:
        suggestions.append("spiegazioni piu ampie con esempi")
    if "motivazionale" in styles:
        suggestions.append("coaching piu energico ma realistico")
    if "stanco_stressato" in styles:
        suggestions.append("tono leggero, supportivo e basso carico")
    if "bilanciato" in styles:
        suggestions.append("stile conversazionale equilibrato")

    text = (
        f"- Stile utente stimato: {', '.join(styles)}\n"
        f"- Adattamento consigliato: {', '.join(suggestions)}"
    )
    return {
        "applied": True,
        "text": text,
        "summary": "Adattamento stile utente attivo",
    }


def _build_coaching_profile_layer(options: dict[str, Any]) -> dict[str, Any]:
    coaching_profile_context = _clean_multiline(options.get("coaching_profile_context", ""), max_chars=850)
    if coaching_profile_context:
        return {
            "applied": True,
            "text": coaching_profile_context,
            "summary": "Profilo coaching iniettato",
        }

    profile = options.get("coaching_profile") or {}
    if not isinstance(profile, dict) or not profile.get("exists"):
        return {"applied": False, "text": "", "summary": "Profilo coaching non disponibile"}

    lines = []
    if _clean_line(profile.get("current_job"), max_chars=160):
        lines.append(f"- Lavoro attuale: {_clean_line(profile.get('current_job'), max_chars=160)}")
    lines.append(f"- Ore lavoro/settimana: {int(profile.get('weekly_work_hours') or 0)}")
    lines.append(f"- Ore network/settimana: {float(profile.get('weekly_network_time_hours') or 0):.2f}")
    if _clean_line(profile.get("sales_network_experience"), max_chars=180):
        lines.append(
            f"- Esperienza commerciale/network: {_clean_line(profile.get('sales_network_experience'), max_chars=180)}"
        )
    if _clean_line(profile.get("economic_goal"), max_chars=220):
        lines.append(f"- Obiettivo economico dichiarato: {_clean_line(profile.get('economic_goal'), max_chars=220)}")
    lines.append(f"- Urgenza: {_clean_line(profile.get('urgency_level', 'media'), max_chars=30)}")
    lines.append(f"- Stress: {_clean_line(profile.get('stress_level', 'medio'), max_chars=30)}")

    return {
        "applied": bool(lines),
        "text": "\n".join(lines),
        "summary": "Profilo coaching derivato",
    }


def _build_coaching_plan_layer(options: dict[str, Any]) -> dict[str, Any]:
    explicit_context = _clean_multiline(options.get("coaching_plan_context", ""), max_chars=900)
    if explicit_context:
        return {
            "applied": True,
            "text": explicit_context,
            "summary": "Piano coaching attivo (contesto precomposto)",
        }

    plan = options.get("coaching_plan") or {}
    if not isinstance(plan, dict) or not plan:
        return {"applied": False, "text": "", "summary": "Nessun piano coaching attivo"}

    horizon = plan.get("orizzonte_temporale") or {}
    realism = plan.get("realism_assessment") or {}
    steps = plan.get("step_intermedi_realistici") or []
    first_step = steps[0] if steps and isinstance(steps[0], dict) else {}
    kpis = plan.get("kpi_sostenibili") or []
    kpi_preview = "; ".join(
        f"{_clean_line(item.get('nome'), max_chars=70)}={_clean_line(item.get('target'), max_chars=20)}"
        for item in kpis[:3]
        if isinstance(item, dict) and _clean_line(item.get("nome"), max_chars=70)
    )
    lines = [
        f"- Obiettivo finale: {_clean_line(plan.get('obiettivo_finale'), max_chars=260)}",
        f"- Versione progressiva: {_clean_line(plan.get('obiettivo_progressivo_onesto'), max_chars=260)}",
        f"- Orizzonte: {_clean_line(horizon.get('label'), max_chars=80)}",
        f"- Realismo: {_clean_line(realism.get('note'), max_chars=220)}",
    ]
    if first_step:
        lines.append(
            f"- Primo step: {_clean_line(first_step.get('periodo'), max_chars=40)} | "
            f"{_clean_line(first_step.get('focus'), max_chars=160)} | "
            f"target {_clean_line(first_step.get('target_up_mensile'), max_chars=20)} UP/mese"
        )
    if kpi_preview:
        lines.append(f"- KPI chiave: {kpi_preview}")

    return {
        "applied": True,
        "text": "\n".join(line for line in lines if _clean_line(line, max_chars=400)),
        "summary": "Piano coaching attivo",
    }


def _build_proactive_signals_layer(options: dict[str, Any]) -> dict[str, Any]:
    signals = options.get("proactive_signals") or []
    if not isinstance(signals, list) or not signals:
        return {"applied": False, "text": "", "summary": "Nessun trigger proattivo"}

    lines = []
    for signal in signals[:5]:
        if not isinstance(signal, dict):
            continue
        signal_type = _clean_line(signal.get("type", "trigger"), max_chars=40)
        title = _clean_line(signal.get("title", ""), max_chars=120)
        detail = _clean_line(signal.get("detail", ""), max_chars=220)
        suggested = _clean_line(signal.get("suggested_opening", ""), max_chars=220)
        priority = _clean_line(signal.get("priority", "normal"), max_chars=20)
        parts = [f"type={signal_type}", f"priority={priority}"]
        if title:
            parts.append(f"titolo={title}")
        if detail:
            parts.append(f"dettaglio={detail}")
        if suggested:
            parts.append(f"suggerimento='{suggested}'")
        lines.append("- " + " | ".join(parts))

    if not lines:
        return {"applied": False, "text": "", "summary": "Trigger proattivi non utilizzabili"}
    return {
        "applied": True,
        "text": "\n".join(lines),
        "summary": f"{len(lines)} trigger proattivi disponibili",
    }


def _extract_knowledge_categories(knowledge_context: dict[str, Any]) -> list[str]:
    context = knowledge_context or {}
    collected = []
    raw_filter = context.get("category_filter") or []
    if isinstance(raw_filter, str):
        raw_filter = [raw_filter]
    for raw in raw_filter:
        collected.append(str(raw))

    for source in context.get("sources") or []:
        if isinstance(source, dict):
            collected.append(str(source.get("category") or ""))
    for chunk in context.get("chunks") or []:
        if isinstance(chunk, dict):
            collected.append(str(chunk.get("category") or ""))
    return _ordered_unique(collected)


def _build_knowledge_category_layer(options: dict[str, Any]) -> dict[str, Any]:
    knowledge_context = options.get("knowledge_context") or {}
    categories = _extract_knowledge_categories(knowledge_context)
    if not categories:
        return {"applied": False, "text": "", "summary": "Categorie knowledge non determinate"}
    return {
        "applied": True,
        "text": "- Categorie rilevanti: " + ", ".join(categories),
        "summary": f"{len(categories)} categorie knowledge",
    }


def _build_knowledge_documents_layer(options: dict[str, Any]) -> dict[str, Any]:
    knowledge_context = options.get("knowledge_context") or {}
    if not knowledge_context.get("found"):
        reason = _clean_line(knowledge_context.get("fallback_reason", ""), max_chars=80)
        summary = f"Nessuna knowledge rilevante ({reason})" if reason else "Nessuna knowledge rilevante"
        return {"applied": False, "text": "", "summary": summary}

    sources = knowledge_context.get("sources") or []
    source_labels = []
    for source in sources[:5]:
        if not isinstance(source, dict):
            continue
        label = _clean_line(
            source.get("source_display_name") or source.get("source_document_key") or "Fonte",
            max_chars=90,
        )
        version = _clean_line(source.get("source_version_tag", ""), max_chars=20)
        if label:
            source_labels.append((label + f" {version}").strip())
    source_line = ", ".join(_ordered_unique(source_labels))

    context_text = _clean_multiline(knowledge_context.get("context_text", ""), max_chars=1300)
    if not context_text:
        compact_chunks = []
        for chunk in (knowledge_context.get("chunks") or [])[:4]:
            if not isinstance(chunk, dict):
                continue
            title = _clean_line(chunk.get("title", ""), max_chars=90) or "Chunk"
            text = _clean_line(chunk.get("text", ""), max_chars=220)
            if text:
                compact_chunks.append(f"[{title}] {text}")
        context_text = "\n".join(compact_chunks)

    lines = []
    if source_line:
        lines.append(f"- Fonti: {source_line}")
    if context_text:
        lines.append(cap_tokens(context_text, 260))

    return {
        "applied": bool(lines),
        "text": "\n".join(lines),
        "summary": f"{len(source_labels)} fonti knowledge applicate",
    }


def _build_runtime_state_layer(message: str, options: dict[str, Any]) -> dict[str, Any]:
    lines = []
    location_city = _clean_line(options.get("location_city", ""), max_chars=80)
    if location_city:
        lines.append(f"- Citta risolta: {location_city}")

    tool_result = options.get("tool_result")
    if isinstance(tool_result, dict) and tool_result:
        tool_data = tool_result.get("data", tool_result)
        compact_tool = cap_tokens(json.dumps(tool_data, ensure_ascii=False), 140)
        lines.append(f"- Output tool: {compact_tool}")

    summary = _clean_line(options.get("conversation_summary", ""), max_chars=220)
    if summary:
        lines.append(f"- Summary stato: {summary}")

    user_message = _clean_line(message, max_chars=240)
    if user_message:
        lines.append(f"- Messaggio corrente: {user_message}")

    return {
        "applied": bool(lines),
        "text": "\n".join(lines),
        "summary": "Stato runtime pronto",
    }


def _build_recent_history_layer(options: dict[str, Any]) -> dict[str, Any]:
    recent_history = options.get("recent_history") or []
    if not isinstance(recent_history, list):
        return {"applied": False, "text": "", "summary": "Storico non disponibile"}

    lines = []
    seen = set()
    for row in recent_history[-8:]:
        if not isinstance(row, dict):
            continue
        role = _clean_line(row.get("role", ""), max_chars=20).lower()
        if role not in {"user", "assistant"}:
            continue
        text = _clean_line(row.get("text", ""), max_chars=190)
        if not text:
            continue
        marker = f"{role}:{text}"
        if marker in seen:
            continue
        seen.add(marker)
        role_label = "Utente" if role == "user" else "MYU"
        lines.append(f"- {role_label}: {text}")

    return {
        "applied": bool(lines),
        "text": "\n".join(lines),
        "summary": f"{len(lines)} messaggi storici rilevanti",
    }


def _resolve_layer_payload(layer_id: str, user: dict[str, Any], message: str, options: dict[str, Any]) -> dict[str, Any]:
    behavior_profile = options.get("behavior_profile") or {}
    if layer_id == "ethics":
        return _build_ethics_layer(options)
    if layer_id == "base_behavior":
        return _build_base_behavior_layer(behavior_profile)
    if layer_id == "user_profile":
        return _build_user_profile_layer(user, options)
    if layer_id == "user_style":
        return _build_user_style_layer(message, options)
    if layer_id == "coaching_profile":
        return _build_coaching_profile_layer(options)
    if layer_id == "coaching_plan":
        return _build_coaching_plan_layer(options)
    if layer_id == "proactive_signals":
        return _build_proactive_signals_layer(options)
    if layer_id == "knowledge_category":
        return _build_knowledge_category_layer(options)
    if layer_id == "knowledge_documents":
        return _build_knowledge_documents_layer(options)
    if layer_id == "runtime_state":
        return _build_runtime_state_layer(message, options)
    if layer_id == "recent_history":
        return _build_recent_history_layer(options)
    return {"applied": False, "text": "", "summary": "Layer non riconosciuto"}


def build_myu_context(user: dict[str, Any], message: str, options: dict[str, Any] | None = None) -> dict[str, Any]:
    """Build final MYU context with explicit ordered layers."""
    opts = options or {}
    max_tokens = int(opts.get("max_tokens") or MAX_CONTEXT_TOKENS)
    max_tokens = min(max(200, max_tokens), 1400)

    layers = []
    sections = []
    applied_order = []

    for index, (layer_id, title) in enumerate(LAYER_SEQUENCE, start=1):
        payload = _resolve_layer_payload(layer_id, user or {}, message or "", opts)
        applied = bool(payload.get("applied"))
        text = _clean_multiline(payload.get("text", ""), max_chars=1800)

        layer_info = {
            "id": layer_id,
            "title": title,
            "priority": index,
            "applied": applied,
            "summary": _clean_line(payload.get("summary", ""), max_chars=160),
        }
        layers.append(layer_info)

        if not applied or not text:
            continue
        applied_order.append(layer_id)
        sections.append(f"{title}:\n{text}")

    final_context = cap_tokens("\n\n".join(sections).strip(), max_tokens)
    knowledge_context = opts.get("knowledge_context") or {}
    knowledge_sources = []
    for source in (knowledge_context.get("sources") or [])[:8]:
        if not isinstance(source, dict):
            continue
        knowledge_sources.append(
            {
                "source_document_id": source.get("source_document_id", ""),
                "source_document_key": source.get("source_document_key", ""),
                "source_display_name": source.get("source_display_name", ""),
                "source_version_tag": source.get("source_version_tag", ""),
                "category": source.get("category", ""),
            }
        )

    return {
        "version": CONTEXT_VERSION,
        "final_context": final_context,
        "layer_order": [layer_id for layer_id, _ in LAYER_SEQUENCE],
        "applied_layer_order": applied_order,
        "layers": layers,
        "knowledge_categories": _extract_knowledge_categories(knowledge_context),
        "knowledge_sources": knowledge_sources,
    }


def buildMYUContext(user: dict[str, Any], message: str, options: dict[str, Any] | None = None) -> dict[str, Any]:
    """Camel-case alias for integration compatibility."""
    return build_myu_context(user=user, message=message, options=options)
