"""MYU Tool - Tasks (Real - queries MongoDB)."""
import uuid
from datetime import datetime, timezone
from database import db


async def execute(user_id: str, city: str = None, geohash4: str = None, query: str = "", intent: str = "") -> dict:
    """Get or manage user tasks."""
    active = await db.myu_tasks.find(
        {"user_id": user_id, "status": "active"},
        {"_id": 0, "id": 1, "title": 1, "due_date": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(10)

    completed_count = await db.myu_tasks.count_documents({"user_id": user_id, "status": "completed"})

    return {
        "active_tasks": active,
        "active_count": len(active),
        "completed_count": completed_count,
    }


async def create_task(user_id: str, title: str, due_date: str = None) -> dict:
    """Create a new task."""
    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    task = {
        "id": task_id,
        "user_id": user_id,
        "title": title,
        "status": "active",
        "due_date": due_date,
        "created_at": now,
        "reminder_sent": False,
        "checkin_sent": False,
    }
    await db.myu_tasks.insert_one(task)
    return task
