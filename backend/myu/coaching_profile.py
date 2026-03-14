"""MYU Coaching Profile - user profile persistence and context helpers."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from database import db
from myu.cost_control import cap_tokens

_COACHING_PROFILE_INDEXES_READY = False

ALLOWED_URGENCY_LEVELS = {"bassa", "media", "alta", "critica"}
ALLOWED_STRESS_LEVELS = {"basso", "medio", "alto", "critico"}

DEFAULT_COACHING_PROFILE = {
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


def _clean_text(value: Any, *, max_len: int) -> str:
    cleaned = " ".join(str(value or "").strip().split())
    return cleaned[:max_len]


def _clean_multiline_text(value: Any, *, max_len: int) -> str:
    cleaned = (value or "")
    if not isinstance(cleaned, str):
        cleaned = str(cleaned)
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = "\n".join(line.strip() for line in cleaned.split("\n"))
    cleaned = "\n".join(line for line in cleaned.split("\n") if line)
    return cleaned[:max_len]


def _as_int(value: Any, *, default: int, min_value: int, max_value: int) -> int:
    try:
        parsed = int(float(value))
    except (TypeError, ValueError):
        parsed = default
    return min(max(parsed, min_value), max_value)


def _as_float(value: Any, *, default: float, min_value: float, max_value: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = default
    parsed = min(max(parsed, min_value), max_value)
    return round(parsed, 2)


def _normalize_enum(raw: Any, *, allowed: set[str], default: str) -> str:
    normalized = str(raw or "").strip().lower()
    return normalized if normalized in allowed else default


def normalize_coaching_profile_payload(
    payload: dict[str, Any] | None = None,
    *,
    base: dict[str, Any] | None = None,
) -> dict[str, Any]:
    source = payload or {}
    baseline = {
        **DEFAULT_COACHING_PROFILE,
        **(base or {}),
    }
    return {
        "current_job": (
            _clean_text(source.get("current_job"), max_len=180)
            if "current_job" in source
            else _clean_text(baseline.get("current_job"), max_len=180)
        ),
        "weekly_work_hours": (
            _as_int(
                source.get("weekly_work_hours"),
                default=baseline["weekly_work_hours"],
                min_value=0,
                max_value=120,
            )
            if "weekly_work_hours" in source
            else _as_int(baseline.get("weekly_work_hours"), default=40, min_value=0, max_value=120)
        ),
        "weekly_network_time_hours": (
            _as_float(
                source.get("weekly_network_time_hours"),
                default=baseline["weekly_network_time_hours"],
                min_value=0.0,
                max_value=80.0,
            )
            if "weekly_network_time_hours" in source
            else _as_float(
                baseline.get("weekly_network_time_hours"),
                default=3.0,
                min_value=0.0,
                max_value=80.0,
            )
        ),
        "sales_network_experience": (
            _clean_text(source.get("sales_network_experience"), max_len=200)
            if "sales_network_experience" in source
            else _clean_text(baseline.get("sales_network_experience"), max_len=200)
        ),
        "economic_goal": (
            _clean_multiline_text(source.get("economic_goal"), max_len=1500)
            if "economic_goal" in source
            else _clean_multiline_text(baseline.get("economic_goal"), max_len=1500)
        ),
        "urgency_level": (
            _normalize_enum(
                source.get("urgency_level"),
                allowed=ALLOWED_URGENCY_LEVELS,
                default=baseline["urgency_level"],
            )
            if "urgency_level" in source
            else _normalize_enum(
                baseline.get("urgency_level"),
                allowed=ALLOWED_URGENCY_LEVELS,
                default="media",
            )
        ),
        "personal_dreams_goals": (
            _clean_multiline_text(source.get("personal_dreams_goals"), max_len=1800)
            if "personal_dreams_goals" in source
            else _clean_multiline_text(baseline.get("personal_dreams_goals"), max_len=1800)
        ),
        "deep_motivation": (
            _clean_multiline_text(source.get("deep_motivation"), max_len=1800)
            if "deep_motivation" in source
            else _clean_multiline_text(baseline.get("deep_motivation"), max_len=1800)
        ),
        "stress_level": (
            _normalize_enum(
                source.get("stress_level"),
                allowed=ALLOWED_STRESS_LEVELS,
                default=baseline["stress_level"],
            )
            if "stress_level" in source
            else _normalize_enum(
                baseline.get("stress_level"),
                allowed=ALLOWED_STRESS_LEVELS,
                default="medio",
            )
        ),
        "family_context": (
            _clean_multiline_text(source.get("family_context"), max_len=1200)
            if "family_context" in source
            else _clean_multiline_text(baseline.get("family_context"), max_len=1200)
        ),
        "sustainable_availability": (
            _clean_multiline_text(source.get("sustainable_availability"), max_len=1200)
            if "sustainable_availability" in source
            else _clean_multiline_text(baseline.get("sustainable_availability"), max_len=1200)
        ),
    }


async def _ensure_indexes() -> None:
    global _COACHING_PROFILE_INDEXES_READY
    if _COACHING_PROFILE_INDEXES_READY:
        return
    await db.myu_coaching_profiles.create_index("user_id", unique=True)
    await db.myu_coaching_profiles.create_index("updated_at")
    _COACHING_PROFILE_INDEXES_READY = True


def _response_profile(document: dict[str, Any], *, exists: bool) -> dict[str, Any]:
    normalized = normalize_coaching_profile_payload(document, base=DEFAULT_COACHING_PROFILE)
    return {
        "id": document.get("id", ""),
        "user_id": document.get("user_id", ""),
        **normalized,
        "wellbeing_first": True,
        "exists": exists,
        "created_at": document.get("created_at"),
        "updated_at": document.get("updated_at"),
    }


async def get_user_coaching_profile(user_id: str) -> dict[str, Any]:
    await _ensure_indexes()
    row = await db.myu_coaching_profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not row:
        now = datetime.now(timezone.utc).isoformat()
        return {
            "id": "",
            "user_id": user_id,
            **DEFAULT_COACHING_PROFILE,
            "wellbeing_first": True,
            "exists": False,
            "created_at": None,
            "updated_at": now,
        }
    return _response_profile(row, exists=True)


async def upsert_user_coaching_profile(
    user_id: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    await _ensure_indexes()
    existing = await db.myu_coaching_profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
    existing_normalized = normalize_coaching_profile_payload(existing, base=DEFAULT_COACHING_PROFILE)
    normalized = normalize_coaching_profile_payload(payload or {}, base=existing_normalized)

    now = datetime.now(timezone.utc).isoformat()
    to_store = {
        "id": existing.get("id") or str(uuid.uuid4()),
        "user_id": user_id,
        **normalized,
        "wellbeing_first": True,
        "created_at": existing.get("created_at") or now,
        "updated_at": now,
    }
    await db.myu_coaching_profiles.update_one(
        {"user_id": user_id},
        {"$set": to_store},
        upsert=True,
    )
    return _response_profile(to_store, exists=True)


def build_coaching_profile_context(profile: dict[str, Any] | None) -> str:
    if not profile or not profile.get("exists"):
        return ""

    lines = ["Profilo coaching utente (benessere prima della performance):"]
    if profile.get("current_job"):
        lines.append(f"- Lavoro attuale: {profile['current_job']}")
    lines.append(f"- Ore lavorative settimanali: {profile.get('weekly_work_hours', 0)}")
    lines.append(
        f"- Tempo disponibile per network (ore/settimana): {profile.get('weekly_network_time_hours', 0)}"
    )
    if profile.get("sales_network_experience"):
        lines.append(f"- Esperienza commerciale/network: {profile['sales_network_experience']}")
    if profile.get("economic_goal"):
        lines.append(f"- Obiettivo economico: {profile['economic_goal']}")
    lines.append(f"- Livello urgenza: {profile.get('urgency_level', 'media')}")
    if profile.get("personal_dreams_goals"):
        lines.append(f"- Sogni e obiettivi personali: {profile['personal_dreams_goals']}")
    if profile.get("deep_motivation"):
        lines.append(f"- Motivazione profonda: {profile['deep_motivation']}")
    lines.append(f"- Livello stress: {profile.get('stress_level', 'medio')}")
    if profile.get("family_context"):
        lines.append(f"- Contesto familiare: {profile['family_context']}")
    if profile.get("sustainable_availability"):
        lines.append(f"- Disponibilita reale/sostenibile: {profile['sustainable_availability']}")

    risk_notes = []
    if profile.get("stress_level") in {"alto", "critico"}:
        risk_notes.append("stress elevato: proponi passi leggeri e recupero energie")
    if (profile.get("weekly_work_hours") or 0) >= 50:
        risk_notes.append("carico lavoro alto: evitare piano intenso")
    if (profile.get("weekly_network_time_hours") or 0) <= 1:
        risk_notes.append("tempo network molto ridotto: micro-azioni realistiche")
    if risk_notes:
        lines.append("- Note sostenibilita: " + "; ".join(risk_notes))

    lines.append(
        "- Vincolo etico coaching: non forzare, non creare pressione, non promettere risultati economici garantiti."
    )
    return cap_tokens("\n".join(lines), 260)
