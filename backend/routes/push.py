from fastapi import APIRouter, Depends
from datetime import datetime, timezone
from database import db, VAPID_PUBLIC_KEY
from models import PushSubscription
from services.auth import get_current_user

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/vapid-key")
async def get_vapid_key():
    return {"publicKey": VAPID_PUBLIC_KEY}


@router.post("/subscribe")
async def subscribe_push(subscription: PushSubscription, user: dict = Depends(get_current_user)):
    sub_doc = {
        "user_id": user["id"],
        "endpoint": subscription.endpoint,
        "keys": subscription.keys,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.push_subscriptions.update_one(
        {"user_id": user["id"], "endpoint": subscription.endpoint},
        {"$set": sub_doc},
        upsert=True
    )

    return {"success": True, "message": "Push subscription registered"}


@router.delete("/unsubscribe")
async def unsubscribe_push(user: dict = Depends(get_current_user)):
    await db.push_subscriptions.delete_many({"user_id": user["id"]})
    return {"success": True, "message": "Push subscriptions removed"}
