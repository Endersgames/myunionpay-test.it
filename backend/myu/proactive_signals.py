"""MYU proactive signals - detect gentle opportunities for follow-up/check-ins."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from database import db

PRIORITY_SCORE = {
    "high": 30,
    "medium": 20,
    "low": 10,
}

EVENT_KEYWORDS = (
    "presentazione",
    "webinar",
    "incontro",
    "call",
    "meeting",
    "evento",
    "rete",
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso_datetime(raw: Any) -> datetime | None:
    text = str(raw or "").strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _short(text: Any, max_chars: int = 160) -> str:
    compact = " ".join(str(text or "").strip().split())
    return compact[:max_chars]


def _build_signal(
    *,
    signal_type: str,
    title: str,
    detail: str,
    priority: str,
    suggested_opening: str,
    due_at: str = "",
    source: str = "",
) -> dict[str, Any]:
    return {
        "type": signal_type,
        "title": _short(title, 120),
        "detail": _short(detail, 260),
        "priority": priority if priority in PRIORITY_SCORE else "medium",
        "due_at": due_at,
        "source": source,
        "suggested_opening": _short(suggested_opening, 240),
    }


def _sort_signals(signals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def _key(item: dict[str, Any]) -> tuple[int, str]:
        prio = PRIORITY_SCORE.get(item.get("priority", "medium"), 20)
        due_at = item.get("due_at") or "9999-99-99"
        return (-prio, due_at)

    return sorted(signals, key=_key)


async def collect_proactive_signals(
    user_id: str,
    *,
    max_signals: int = 6,
) -> dict[str, Any]:
    """Collect non-invasive proactive triggers for MYU context and follow-up."""
    now = _now()
    now_iso = now.isoformat()
    signals: list[dict[str, Any]] = []

    active_tasks = await db.myu_tasks.find(
        {"user_id": user_id, "status": "active"},
        {"_id": 0, "id": 1, "title": 1, "due_date": 1, "created_at": 1},
    ).to_list(200)
    due_soon_cutoff = now + timedelta(hours=48)
    for task in active_tasks:
        due_raw = task.get("due_date")
        due_dt = _parse_iso_datetime(due_raw)
        if not due_dt:
            continue

        title = _short(task.get("title", "Task"), 120)
        lower_title = title.lower()
        is_event_like = any(keyword in lower_title for keyword in EVENT_KEYWORDS)
        due_iso = due_dt.isoformat()

        if due_dt < now:
            signals.append(
                _build_signal(
                    signal_type="task_overdue",
                    title="Task coaching oltre scadenza",
                    detail=f"'{title}' risulta oltre la scadenza.",
                    priority="high",
                    due_at=due_iso,
                    source="myu_tasks",
                    suggested_opening=(
                        f"Ho visto che il task '{title}' e oltre scadenza. "
                        "Se vuoi lo ridisegniamo in modo piu leggero e realistico."
                    ),
                )
            )
        elif due_dt <= due_soon_cutoff:
            signals.append(
                _build_signal(
                    signal_type="event_imminent" if is_event_like else "task_due_soon",
                    title="Evento imminente" if is_event_like else "Task in scadenza",
                    detail=f"'{title}' scade entro 48h.",
                    priority="high" if is_event_like else "medium",
                    due_at=due_iso,
                    source="myu_tasks",
                    suggested_opening=(
                        f"Domani hai '{title}', giusto? Se vuoi lo prepariamo insieme in 10 minuti."
                        if is_event_like
                        else f"Il task '{title}' scade a breve: vuoi un mini piano operativo sostenibile?"
                    ),
                )
            )

    event_notifications = await db.user_notifications.find(
        {
            "user_id": user_id,
            "type": "event",
            "is_expired": {"$ne": True},
            "is_read": {"$ne": True},
        },
        {"_id": 0, "title": 1, "message": 1, "expires_at": 1},
    ).sort("expires_at", 1).to_list(5)
    for event in event_notifications:
        expires_dt = _parse_iso_datetime(event.get("expires_at"))
        if not expires_dt:
            continue
        if expires_dt <= now + timedelta(hours=36):
            title = _short(event.get("title", "Evento"), 120)
            detail = _short(event.get("message", "Evento in arrivo"), 200)
            signals.append(
                _build_signal(
                    signal_type="event_imminent",
                    title="Evento imminente",
                    detail=f"{title}: {detail}",
                    priority="medium",
                    due_at=expires_dt.isoformat(),
                    source="user_notifications",
                    suggested_opening=f"Ho notato un evento imminente ('{title}'). Vuoi prepararlo insieme?",
                )
            )

    latest_user_message = await db.myu_conversations.find(
        {"user_id": user_id, "role": "user"},
        {"_id": 0, "created_at": 1},
    ).sort("created_at", -1).limit(1).to_list(1)
    if latest_user_message:
        last_user_dt = _parse_iso_datetime(latest_user_message[0].get("created_at"))
        if last_user_dt:
            inactivity_days = (now - last_user_dt).days
            if inactivity_days >= 7:
                signals.append(
                    _build_signal(
                        signal_type="period_without_activity",
                        title="Periodo senza attivita",
                        detail=f"Nessun messaggio MYU da circa {inactivity_days} giorni.",
                        priority="medium",
                        source="myu_conversations",
                        suggested_opening=(
                            "Ehi, e un po' che non ci sentiamo: vuoi un check-in rapido "
                            "per riallineare il piano senza pressione?"
                        ),
                    )
                )

    completed_count = await db.myu_tasks.count_documents({"user_id": user_id, "status": "completed"})
    milestone_levels = {1, 3, 5, 10, 15}
    if completed_count in milestone_levels:
        signals.append(
            _build_signal(
                signal_type="milestone_reached",
                title="Milestone raggiunta",
                detail=f"Hai completato {completed_count} task MYU.",
                priority="low",
                source="myu_tasks",
                suggested_opening=(
                    f"Hai appena raggiunto {completed_count} task completati: ottimo progresso. "
                    "Vuoi consolidare il prossimo step?"
                ),
            )
        )

    completed_recent = await db.myu_tasks.count_documents(
        {
            "user_id": user_id,
            "status": "completed",
            "updated_at": {"$gte": (now - timedelta(days=14)).isoformat()},
        }
    )
    if completed_recent >= 2:
        signals.append(
            _build_signal(
                signal_type="important_progress",
                title="Progresso importante",
                detail=f"Hai completato {completed_recent} task nelle ultime 2 settimane.",
                priority="low",
                source="myu_tasks",
                suggested_opening=(
                    "Hai fatto un bel progresso recente: vuoi trasformarlo in una routine sostenibile?"
                ),
            )
        )

    ordered = _sort_signals(signals)[:max_signals]
    return {
        "generated_at": now_iso,
        "has_signals": bool(ordered),
        "can_start_conversation": bool(ordered),
        "signals": ordered,
        "top_signal": ordered[0] if ordered else None,
    }

