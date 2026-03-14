"""MYU Coaching Planner - realistic and sustainable task plan builder.

This module transforms user goal + human profile + compensation context
into a coaching plan that prioritizes wellbeing before performance.
"""

from __future__ import annotations

import math
import re
from statistics import median
from typing import Any

from myu.cost_control import cap_tokens

DEFAULT_PROFILE = {
    "current_job": "",
    "weekly_work_hours": 40,
    "weekly_network_time_hours": 3.0,
    "sales_network_experience": "",
    "economic_goal": "",
    "urgency_level": "media",
    "personal_dreams_goals": "",
    "deep_motivation": "",
    "stress_level": "medio",
    "family_context": "",
    "sustainable_availability": "",
}

GOAL_TRIGGER_KEYWORDS = {
    "voglio raggiungere",
    "obiettivo",
    "target",
    "guadagnare",
    "guadagno",
    "entrate",
    "entrata",
    "up al mese",
    "euro al mese",
    "piano compensi",
    "compensi",
    "commissioni",
    "provvigioni",
    "network",
}

MONEY_RE = re.compile(
    r"(?:(?:€|eur|euro|up)\s*([0-9][0-9\.,\s]{0,14})|([0-9][0-9\.,\s]{0,14})\s*(?:€|eur|euro|up))",
    re.IGNORECASE,
)
GENERIC_NUMBER_RE = re.compile(r"\b([0-9][0-9\.,\s]{0,14})\b")
TIME_RE = re.compile(
    r"(\d{1,3})\s*(giorni|giorno|settimane|settimana|mesi|mese|anni|anno)",
    re.IGNORECASE,
)
PERCENT_RE = re.compile(r"\b(\d{1,2}(?:[\.,]\d+)?)\s*%", re.IGNORECASE)

STRESS_FACTORS = {
    "basso": 1.0,
    "medio": 0.86,
    "alto": 0.68,
    "critico": 0.5,
}

URGENCY_DEFAULT_MONTHS = {
    "critica": 1,
    "alta": 2,
    "media": 3,
    "bassa": 4,
}


def _clean_text(value: Any, max_len: int = 400) -> str:
    text = " ".join(str(value or "").strip().split())
    return text[:max_len]


def _normalize_number(raw: str) -> float | None:
    value = (raw or "").strip().replace(" ", "")
    if not value:
        return None
    if "," in value and "." in value:
        value = value.replace(".", "").replace(",", ".")
    elif "," in value:
        value = value.replace(",", ".")
    try:
        parsed = float(value)
    except ValueError:
        return None
    if parsed <= 0:
        return None
    return parsed


def _normalize_profile(user_profile: dict[str, Any] | None = None) -> dict[str, Any]:
    source = user_profile or {}
    merged = {**DEFAULT_PROFILE, **source}
    try:
        merged["weekly_work_hours"] = int(float(merged.get("weekly_work_hours", 40)))
    except (TypeError, ValueError):
        merged["weekly_work_hours"] = 40
    merged["weekly_work_hours"] = min(max(merged["weekly_work_hours"], 0), 120)

    try:
        merged["weekly_network_time_hours"] = float(merged.get("weekly_network_time_hours", 3.0))
    except (TypeError, ValueError):
        merged["weekly_network_time_hours"] = 3.0
    merged["weekly_network_time_hours"] = min(max(merged["weekly_network_time_hours"], 0.0), 80.0)

    merged["urgency_level"] = str(merged.get("urgency_level") or "media").strip().lower()
    if merged["urgency_level"] not in URGENCY_DEFAULT_MONTHS:
        merged["urgency_level"] = "media"
    merged["stress_level"] = str(merged.get("stress_level") or "medio").strip().lower()
    if merged["stress_level"] not in STRESS_FACTORS:
        merged["stress_level"] = "medio"
    return merged


def _extract_goal_text(financial_goal: Any, profile: dict[str, Any]) -> str:
    if isinstance(financial_goal, (int, float)):
        return f"{float(financial_goal):.2f} UP"
    text = _clean_text(financial_goal, max_len=500)
    if text:
        return text
    fallback = _clean_text(profile.get("economic_goal", ""), max_len=500)
    return fallback


def _extract_requested_amount(goal_text: str) -> tuple[float | None, str]:
    if not goal_text:
        return None, "no_goal_text"

    currency_values: list[float] = []
    for match in MONEY_RE.findall(goal_text):
        raw_value = match[0] or match[1]
        parsed = _normalize_number(raw_value)
        if parsed is not None:
            currency_values.append(parsed)
    if currency_values:
        return max(currency_values), "currency"

    raw_numbers = GENERIC_NUMBER_RE.findall(goal_text)
    parsed_values = [v for v in (_normalize_number(raw) for raw in raw_numbers) if v is not None]
    parsed_values = [v for v in parsed_values if v >= 50]
    if parsed_values:
        return max(parsed_values), "generic"
    return None, "not_found"


def _extract_horizon_months(goal_text: str, urgency_level: str) -> tuple[int, bool]:
    default_months = URGENCY_DEFAULT_MONTHS.get(urgency_level, 3)
    if not goal_text:
        return default_months, False

    candidates = []
    for raw_value, unit in TIME_RE.findall(goal_text):
        try:
            amount = int(raw_value)
        except ValueError:
            continue
        unit_lower = unit.lower()
        if unit_lower.startswith("giorn"):
            candidates.append(max(1, round(amount / 30)))
        elif unit_lower.startswith("settiman"):
            candidates.append(max(1, round(amount / 4.35)))
        elif unit_lower.startswith("mes"):
            candidates.append(max(1, amount))
        elif unit_lower.startswith("ann"):
            candidates.append(max(1, amount * 12))

    if not candidates:
        return default_months, False
    months = min(max(candidates[0], 1), 24)
    return months, True


def _infer_requested_monthly_amount(
    *,
    requested_amount: float | None,
    goal_text: str,
    horizon_months: int,
    horizon_explicit: bool,
) -> tuple[float | None, str]:
    if requested_amount is None:
        return None, "missing_amount"

    text = goal_text.lower()
    monthly_hint = bool(re.search(r"\b(al mese|mensile|ogni mese)\b", text))
    yearly_hint = bool(re.search(r"\b(all'anno|annuo|annuale|ogni anno)\b", text))

    if monthly_hint and not yearly_hint:
        return round(requested_amount, 2), "monthly_hint"
    if yearly_hint and not monthly_hint:
        return round(requested_amount / 12.0, 2), "yearly_hint"

    if horizon_explicit and any(token in text for token in ("entro", "in ", "fra ", "tra ")):
        return round(requested_amount / max(1, horizon_months), 2), "explicit_horizon_total"
    return round(requested_amount, 2), "default_monthly"


def _workload_factor(weekly_work_hours: int) -> float:
    if weekly_work_hours <= 35:
        return 1.0
    if weekly_work_hours <= 45:
        return 0.9
    if weekly_work_hours <= 55:
        return 0.78
    return 0.65


def _availability_factor(text: str) -> float:
    normalized = (text or "").lower()
    if not normalized:
        return 1.0
    factor = 1.0
    if "solo weekend" in normalized or "weekend" in normalized:
        factor *= 0.82
    if "saltuar" in normalized or "variabile" in normalized:
        factor *= 0.88
    if "costante" in normalized or "stabile" in normalized:
        factor *= 1.05
    if "pochi minuti" in normalized:
        factor *= 0.78
    return min(max(factor, 0.55), 1.15)


def _collect_compensation_text(compensation_context: Any) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]]:
    if not isinstance(compensation_context, dict):
        text = _clean_text(compensation_context, max_len=6000)
        return text, [], []

    chunks = compensation_context.get("chunks") or []
    sources = compensation_context.get("sources") or []
    context_text = compensation_context.get("context_text") or ""
    if context_text:
        return context_text, chunks, sources

    chunk_text = "\n".join((chunk.get("text") or "") for chunk in chunks if isinstance(chunk, dict))
    return chunk_text, chunks, sources


def _summarize_compensation_context(compensation_context: Any) -> dict[str, Any]:
    text, chunks, sources = _collect_compensation_text(compensation_context)
    normalized_text = " ".join(text.split())

    currency_values: list[float] = []
    for match in MONEY_RE.findall(normalized_text):
        value = _normalize_number(match[0] or match[1])
        if value is not None and value <= 50000:
            currency_values.append(value)

    percent_values: list[float] = []
    for raw in PERCENT_RE.findall(normalized_text):
        value = _normalize_number(raw)
        if value is not None and 0 < value <= 100:
            percent_values.append(value)

    compact_currency = [v for v in currency_values if 1 <= v <= 1000]
    median_bonus = round(median(compact_currency), 2) if compact_currency else 0.0
    median_percent = round(median(percent_values), 2) if percent_values else 0.0

    if median_bonus > 0:
        estimated_hourly = median_bonus * 0.33
    else:
        estimated_hourly = 8.0

    if median_percent > 0:
        estimated_hourly *= 1 + min(0.35, (median_percent / 100.0) * 0.45)
    lowered = normalized_text.lower()
    if "ricorrente" in lowered or "mensile" in lowered:
        estimated_hourly *= 1.08
    if "una tantum" in lowered:
        estimated_hourly *= 0.94
    estimated_hourly = round(min(max(estimated_hourly, 2.5), 35.0), 2)

    assumptions = []
    if median_bonus > 0:
        assumptions.append(
            f"Valore unitario mediano individuato nel piano compensi: {median_bonus:.2f} UP."
        )
    else:
        assumptions.append(
            "Nessun valore economico esplicito robusto nel piano compensi: stima prudente predefinita."
        )
    if median_percent > 0:
        assumptions.append(f"Percentuale mediana rilevata: {median_percent:.2f}%.")
    assumptions.append(
        f"Rendimento orario stimato (prudente): {estimated_hourly:.2f} UP/ora di network sostenibile."
    )

    compact_sources = []
    for source in sources:
        if not isinstance(source, dict):
            continue
        compact_sources.append(
            {
                "source_document_id": source.get("source_document_id", ""),
                "source_document_key": source.get("source_document_key", ""),
                "source_display_name": source.get("source_display_name", ""),
                "source_version_tag": source.get("source_version_tag", ""),
                "category": source.get("category", ""),
            }
        )

    return {
        "found": bool(chunks or normalized_text),
        "estimated_hourly_up": estimated_hourly,
        "median_bonus_up": median_bonus,
        "median_percentage": median_percent,
        "assumptions": assumptions,
        "sources": compact_sources,
    }


def _compute_capacity(profile: dict[str, Any], estimated_hourly_up: float) -> dict[str, Any]:
    weekly_network_hours = float(profile.get("weekly_network_time_hours") or 0.0)
    weekly_work_hours = int(profile.get("weekly_work_hours") or 0)
    stress_level = str(profile.get("stress_level") or "medio")

    stress_factor = STRESS_FACTORS.get(stress_level, STRESS_FACTORS["medio"])
    workload_factor = _workload_factor(weekly_work_hours)
    availability_factor = _availability_factor(str(profile.get("sustainable_availability") or ""))

    effective_network_hours = weekly_network_hours * stress_factor * workload_factor * availability_factor
    effective_network_hours = round(max(effective_network_hours, 0.0), 2)

    monthly_capacity = round(effective_network_hours * estimated_hourly_up * 4.2, 2)
    safe_monthly_capacity = round(monthly_capacity * 0.9, 2)

    return {
        "weekly_network_hours_declared": round(weekly_network_hours, 2),
        "effective_network_hours_week": effective_network_hours,
        "weekly_work_hours": weekly_work_hours,
        "stress_level": stress_level,
        "stress_factor": round(stress_factor, 2),
        "workload_factor": round(workload_factor, 2),
        "availability_factor": round(availability_factor, 2),
        "estimated_hourly_up": estimated_hourly_up,
        "estimated_monthly_capacity_up": monthly_capacity,
        "safe_monthly_capacity_up": safe_monthly_capacity,
    }


def _build_realism_assessment(
    *,
    requested_monthly_up: float | None,
    safe_monthly_capacity_up: float,
) -> dict[str, Any]:
    if requested_monthly_up is None:
        return {
            "is_realistic": True,
            "status": "goal_not_numeric",
            "requested_monthly_up": None,
            "sustainable_monthly_up": safe_monthly_capacity_up,
            "gap_monthly_up": 0.0,
            "ratio_requested_vs_sustainable": None,
            "note": "Obiettivo non numerico: piano impostato su crescita graduale sostenibile.",
        }

    if safe_monthly_capacity_up <= 0:
        return {
            "is_realistic": False,
            "status": "no_capacity",
            "requested_monthly_up": requested_monthly_up,
            "sustainable_monthly_up": 0.0,
            "gap_monthly_up": requested_monthly_up,
            "ratio_requested_vs_sustainable": None,
            "note": "Disponibilita attuale troppo bassa: prima fase su riassetto tempo e benessere.",
        }

    ratio = requested_monthly_up / safe_monthly_capacity_up
    if ratio <= 1.15:
        status = "realistic"
        note = "Obiettivo coerente con capacita sostenibile stimata."
        is_realistic = True
    elif ratio <= 1.65:
        status = "stretch"
        note = "Obiettivo ambizioso ma raggiungibile con progressione controllata."
        is_realistic = False
    else:
        status = "overstretch"
        note = "Obiettivo non realistico nel breve: serve una versione progressiva e onesta."
        is_realistic = False

    return {
        "is_realistic": is_realistic,
        "status": status,
        "requested_monthly_up": round(requested_monthly_up, 2),
        "sustainable_monthly_up": round(safe_monthly_capacity_up, 2),
        "gap_monthly_up": round(max(requested_monthly_up - safe_monthly_capacity_up, 0.0), 2),
        "ratio_requested_vs_sustainable": round(ratio, 2),
        "note": note,
    }


def _progressive_target_monthly(realism: dict[str, Any]) -> float:
    requested = realism.get("requested_monthly_up")
    sustainable = float(realism.get("sustainable_monthly_up") or 0.0)
    if requested is None:
        if sustainable > 0:
            return round(sustainable * 0.9, 2)
        return 80.0

    if realism.get("is_realistic"):
        return round(requested, 2)

    ratio = float(realism.get("ratio_requested_vs_sustainable") or 0.0)
    if ratio <= 1.65:
        return round(sustainable * 1.0, 2)
    return round(sustainable * 0.85, 2)


def _format_period(start_week: int, end_week: int) -> str:
    if start_week == end_week:
        return f"settimana {start_week}"
    return f"settimane {start_week}-{end_week}"


def _build_steps(
    *,
    target_monthly_up: float,
    horizon_weeks: int,
    dream_anchor: str,
    realistic: bool,
    requested_monthly_up: float | None,
) -> list[dict[str, Any]]:
    horizon_weeks = max(horizon_weeks, 4)
    step_1_end = max(2, round(horizon_weeks * 0.33))
    step_2_end = max(step_1_end + 2, round(horizon_weeks * 0.66))
    step_3_end = horizon_weeks

    dream_suffix = f" Collega ogni azione a: {dream_anchor}." if dream_anchor else ""
    steps = [
        {
            "step": 1,
            "periodo": _format_period(1, step_1_end),
            "target_up_mensile": round(target_monthly_up * 0.45, 2),
            "focus": "Fondamenta: routine leggera, ascolto bisogni, pipeline iniziale.",
            "note": "Nessuna pressione: conta la costanza, non l'intensita." + dream_suffix,
        },
        {
            "step": 2,
            "periodo": _format_period(step_1_end + 1, step_2_end),
            "target_up_mensile": round(target_monthly_up * 0.75, 2),
            "focus": "Trazione: follow-up regolari e miglioramento conversione.",
            "note": "Mantieni margini di recupero energia settimanali.",
        },
        {
            "step": 3,
            "periodo": _format_period(step_2_end + 1, step_3_end),
            "target_up_mensile": round(target_monthly_up, 2),
            "focus": "Consolidamento: stabilita dei risultati e qualita relazioni.",
            "note": "Ottimizza solo cio che resta sostenibile per te.",
        },
    ]

    if not realistic and requested_monthly_up and requested_monthly_up > target_monthly_up:
        steps.append(
            {
                "step": 4,
                "periodo": f"dopo settimana {step_3_end}",
                "target_up_mensile": round(requested_monthly_up, 2),
                "focus": "Progressione verso obiettivo pieno, senza forzature.",
                "note": "Si procede solo se KPI sostenibili e benessere restano stabili.",
            }
        )
    return steps


def _build_daily_tasks(effective_network_hours_week: float) -> list[dict[str, Any]]:
    micro_mode = effective_network_hours_week < 2.5
    outreach_people = 1 if micro_mode else min(max(round(effective_network_hours_week / 2.0), 2), 5)
    followups = 1 if micro_mode else min(max(round(effective_network_hours_week / 2.8), 1), 4)
    study_minutes = 8 if micro_mode else 15

    tasks = [
        {
            "task": "Check-in personale: definisci priorita e limite energetico della giornata.",
            "durata_min": 5,
            "frequenza_settimana": 5,
        },
        {
            "task": f"Outreach relazionale: contatta {outreach_people} persone con approccio di ascolto.",
            "durata_min": 12 if micro_mode else 20,
            "frequenza_settimana": 4,
        },
        {
            "task": "Follow-up gentile su conversazioni aperte, senza pressione commerciale.",
            "durata_min": 10 if micro_mode else 15,
            "frequenza_settimana": min(followups + 2, 6),
        },
        {
            "task": "Micro studio piano compensi/contenuti MYU Training per chiarezza e accuratezza.",
            "durata_min": study_minutes,
            "frequenza_settimana": 4,
        },
    ]
    return tasks


def _build_weekly_tasks(effective_network_hours_week: float) -> list[dict[str, Any]]:
    discovery_slots = max(1, min(round(effective_network_hours_week / 1.4), 6))
    learning_minutes = 30 if effective_network_hours_week < 3 else 50

    return [
        {
            "task": "Pianificazione settimana: agenda sostenibile, blocchi orari e margini di recupero.",
            "durata_min": 30,
            "frequenza_settimana": 1,
        },
        {
            "task": f"Conversazioni discovery qualitative: {discovery_slots} slot settimanali.",
            "durata_min": 35,
            "frequenza_settimana": discovery_slots,
        },
        {
            "task": "Sessione formazione/role-play su script etico e gestione obiezioni.",
            "durata_min": learning_minutes,
            "frequenza_settimana": 1,
        },
        {
            "task": "Revisione KPI e carico personale; adegua piano se emerge stress.",
            "durata_min": 25,
            "frequenza_settimana": 1,
        },
        {
            "task": "Un giorno pieno senza attivita network per recupero.",
            "durata_min": 0,
            "frequenza_settimana": 1,
        },
    ]


def _build_kpis(effective_network_hours_week: float, target_monthly_up: float) -> list[dict[str, Any]]:
    qualified_contacts = max(2, min(round(effective_network_hours_week * 1.6), 12))
    followups = max(2, min(round(effective_network_hours_week * 1.4), 10))
    discovery_calls = max(1, min(round(effective_network_hours_week / 1.5), 6))
    monthly_target = round(max(target_monthly_up, 20.0), 2)

    return [
        {
            "nome": "Ore network sostenibili / settimana",
            "target": round(effective_network_hours_week, 2),
            "soglia_allerta": "riduci target del 20% se non sostenibile per 2 settimane",
        },
        {
            "nome": "Nuovi contatti qualificati / settimana",
            "target": qualified_contacts,
            "soglia_allerta": "non aumentare volume se stress > medio",
        },
        {
            "nome": "Follow-up completati / settimana",
            "target": followups,
            "soglia_allerta": "privilegia qualita conversazioni, non spam",
        },
        {
            "nome": "Conversazioni discovery / settimana",
            "target": discovery_calls,
            "soglia_allerta": "fermati se calendario personale diventa insostenibile",
        },
        {
            "nome": "Target economico mensile progressivo (UP)",
            "target": monthly_target,
            "soglia_allerta": "mai promettere risultati certi o tempi garantiti",
        },
    ]


def _build_wellbeing_notes(profile: dict[str, Any], realistic: bool) -> list[str]:
    notes = [
        "Benessere prima della performance: il piano si adatta alla tua energia reale.",
        "Mantieni almeno 1 giorno senza attivita network ogni settimana.",
        "Se lo stress sale, riduci volume e torna a micro-task ad alta qualita.",
        "Nessuna pressione aggressiva: relazioni autentiche prima dei numeri.",
    ]

    if (profile.get("stress_level") or "") in {"alto", "critico"}:
        notes.append("Stress elevato: inserisci pause brevi quotidiane e confronto settimanale con MYU.")
    if int(profile.get("weekly_work_hours") or 0) >= 50:
        notes.append("Carico lavoro principale alto: evita sprint, punta su continuita minima sostenibile.")
    if not realistic:
        notes.append("Obiettivo iniziale rivisto in modo progressivo e onesto per evitare sovraccarico.")
    return notes


def _goal_statement(requested_monthly_up: float | None, target_monthly_up: float, realistic: bool) -> tuple[str, str]:
    if requested_monthly_up is None:
        return (
            f"Costruire una crescita sostenibile fino a {target_monthly_up:.2f} UP/mese.",
            f"Versione progressiva: {target_monthly_up:.2f} UP/mese come baseline sostenibile.",
        )
    requested_label = f"{requested_monthly_up:.2f} UP/mese"
    if realistic:
        return (
            f"Raggiungere {requested_label} in modo sostenibile.",
            f"Versione progressiva: mantenere {requested_label} con stabilita e benessere.",
        )
    return (
        f"Obiettivo dichiarato: {requested_label}.",
        f"Versione progressiva e onesta: {target_monthly_up:.2f} UP/mese nel breve, poi scalare.",
    )


def should_trigger_coaching_plan(
    message: str,
    classification: dict[str, Any] | None = None,
    user_profile: dict[str, Any] | None = None,
) -> bool:
    text = (message or "").strip().lower()
    if not text:
        return False

    if any(keyword in text for keyword in GOAL_TRIGGER_KEYWORDS):
        return True
    if re.search(r"\b\d+[.,]?\d*\s*(up|euro|€)\b", text):
        return True

    classification = classification or {}
    if (classification.get("domain") or "").lower() == "growth":
        return True
    if (classification.get("intent") or "").lower() in {"referral_info"} and re.search(r"\d", text):
        return True

    profile = user_profile or {}
    if profile.get("economic_goal") and any(token in text for token in ("come", "piano", "organizza", "aiutami")):
        return True
    return False


def build_coaching_plan(
    user_profile: dict[str, Any] | None,
    financial_goal: Any,
    compensation_context: Any,
) -> dict[str, Any]:
    """Build a realistic coaching plan from profile + goal + compensation context."""
    profile = _normalize_profile(user_profile)
    goal_text = _extract_goal_text(financial_goal, profile)
    requested_amount, amount_source = _extract_requested_amount(goal_text)
    horizon_months, horizon_explicit = _extract_horizon_months(goal_text, profile.get("urgency_level", "media"))
    requested_monthly_up, monthly_source = _infer_requested_monthly_amount(
        requested_amount=requested_amount,
        goal_text=goal_text,
        horizon_months=horizon_months,
        horizon_explicit=horizon_explicit,
    )

    compensation_summary = _summarize_compensation_context(compensation_context)
    capacity = _compute_capacity(profile, compensation_summary["estimated_hourly_up"])
    realism = _build_realism_assessment(
        requested_monthly_up=requested_monthly_up,
        safe_monthly_capacity_up=capacity["safe_monthly_capacity_up"],
    )
    progressive_target = _progressive_target_monthly(realism)

    if requested_monthly_up and progressive_target > 0 and requested_monthly_up > progressive_target:
        scaling = requested_monthly_up / progressive_target
        horizon_months = min(24, max(horizon_months, int(math.ceil(horizon_months * min(scaling, 2.8)))))
    horizon_weeks = max(4, horizon_months * 4)

    dream_anchor = _clean_text(
        profile.get("personal_dreams_goals") or profile.get("deep_motivation") or "",
        max_len=170,
    )

    obiettivo_finale, obiettivo_progressivo = _goal_statement(
        requested_monthly_up=requested_monthly_up,
        target_monthly_up=progressive_target,
        realistic=bool(realism.get("is_realistic")),
    )
    if dream_anchor:
        obiettivo_finale = f"{obiettivo_finale} Collegamento ai sogni: {dream_anchor}."

    steps = _build_steps(
        target_monthly_up=progressive_target,
        horizon_weeks=horizon_weeks,
        dream_anchor=dream_anchor,
        realistic=bool(realism.get("is_realistic")),
        requested_monthly_up=requested_monthly_up,
    )
    daily_tasks = _build_daily_tasks(capacity["effective_network_hours_week"])
    weekly_tasks = _build_weekly_tasks(capacity["effective_network_hours_week"])
    kpis = _build_kpis(capacity["effective_network_hours_week"], progressive_target)
    wellbeing_notes = _build_wellbeing_notes(profile, bool(realism.get("is_realistic")))

    return {
        "obiettivo_finale": obiettivo_finale,
        "obiettivo_progressivo_onesto": obiettivo_progressivo,
        "orizzonte_temporale": {
            "weeks": horizon_weeks,
            "months": horizon_months,
            "label": f"{horizon_weeks} settimane ({horizon_months} mesi)",
        },
        "step_intermedi_realistici": steps,
        "task_giornalieri": daily_tasks,
        "task_settimanali": weekly_tasks,
        "kpi_sostenibili": kpis,
        "note_benessere_carico": wellbeing_notes,
        "realism_assessment": realism,
        "capacity_estimate": capacity,
        "goal_inputs": {
            "goal_text": goal_text,
            "amount_source": amount_source,
            "requested_amount_raw": requested_amount,
            "requested_monthly_up": requested_monthly_up,
            "monthly_source": monthly_source,
            "horizon_explicit": horizon_explicit,
        },
        "compensation_context_summary": compensation_summary,
        "sources": compensation_summary.get("sources", []),
        "wellbeing_guardrail": "Il benessere utente viene prima della performance.",
    }


def build_coaching_plan_context(plan: dict[str, Any] | None) -> str:
    """Compact plan summary for LLM context injection."""
    if not plan:
        return ""

    horizon = plan.get("orizzonte_temporale") or {}
    realism = plan.get("realism_assessment") or {}
    first_steps = plan.get("step_intermedi_realistici") or []
    first_step = first_steps[0] if first_steps else {}
    kpis = plan.get("kpi_sostenibili") or []
    top_kpis = "; ".join(
        f"{item.get('nome', '')}: {item.get('target', '')}"
        for item in kpis[:3]
        if isinstance(item, dict)
    )
    sources = plan.get("sources") or []
    source_names = ", ".join(
        source.get("source_display_name", source.get("source_document_key", ""))
        for source in sources[:3]
        if isinstance(source, dict)
    )
    lines = [
        "Piano coaching sostenibile (autogenerato):",
        f"- Obiettivo finale: {plan.get('obiettivo_finale', '')}",
        f"- Versione progressiva: {plan.get('obiettivo_progressivo_onesto', '')}",
        f"- Orizzonte: {horizon.get('label', '')}",
        f"- Realismo: {realism.get('note', '')}",
        (
            f"- Primo step: {first_step.get('periodo', '')} | "
            f"{first_step.get('focus', '')} | target {first_step.get('target_up_mensile', '')} UP/mese"
        ),
        f"- KPI sostenibili: {top_kpis}",
        f"- Fonti piano compensi: {source_names or 'non disponibili'}",
    ]
    return cap_tokens("\n".join(lines), 280)


def buildCoachingPlan(
    userProfile: dict[str, Any] | None,
    financialGoal: Any,
    compensationContext: Any,
) -> dict[str, Any]:
    """Camel-case alias for external compatibility."""
    return build_coaching_plan(
        user_profile=userProfile,
        financial_goal=financialGoal,
        compensation_context=compensationContext,
    )
