"""MYU Tool - Notifications (Real - queries MongoDB)."""
from database import db
from services.notification_rewards import refund_expired_notification_rewards


async def execute(user_id: str, city: str = None, geohash4: str = None, query: str = "", intent: str = "") -> dict:
    """Get notification summary for the user."""
    await refund_expired_notification_rewards(user_id=user_id)
    unread = await db.user_notifications.count_documents(
        {"user_id": user_id, "is_read": False, "is_expired": {"$ne": True}}
    )
    recent = await db.user_notifications.find(
        {"user_id": user_id},
        {"_id": 0, "notification_id": 1, "reward_status": 1, "is_read": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(5)

    return {
        "unread_count": unread,
        "recent": recent,
    }
