"""MYU Tool - Notifications (Real - queries MongoDB)."""
from database import db


async def execute(user_id: str, city: str = None, geohash4: str = None, query: str = "", intent: str = "") -> dict:
    """Get notification summary for the user."""
    unread = await db.user_notifications.count_documents({"user_id": user_id, "status": "unread"})
    recent = await db.user_notifications.find(
        {"user_id": user_id},
        {"_id": 0, "notification_id": 1, "status": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(5)

    return {
        "unread_count": unread,
        "recent": recent,
    }
