from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
import uuid
import logging
from datetime import datetime, timezone
from database import db
from models import (
    NotificationCreate, NotificationResponse,
    UserNotificationResponse, NotificationPreviewRequest, NotificationPreviewResponse
)
from services.auth import get_current_user
from services.push import send_push_notification
from pydantic import BaseModel

router = APIRouter(prefix="/notifications", tags=["notifications"])

# ========================
# NOTIFICATION TEMPLATES
# ========================

NOTIFICATION_TEMPLATES = {
    "promo_offer": {
        "id": "promo_offer",
        "name": "Offerta Promozionale",
        "description": "Sconto o promozione speciale",
        "fields": ["title", "message", "image_url", "cta_text", "cta_url"],
        "icon": "tag"
    },
    "new_menu": {
        "id": "new_menu",
        "name": "Nuovo Menu",
        "description": "Nuovo piatto o menu aggiornato",
        "fields": ["title", "message", "image_url", "cta_text", "cta_url"],
        "icon": "utensils"
    },
    "event": {
        "id": "event",
        "name": "Evento Speciale",
        "description": "Evento, serata o iniziativa",
        "fields": ["title", "message", "image_url", "cta_text", "cta_url"],
        "icon": "calendar"
    },
    "welcome": {
        "id": "welcome",
        "name": "Benvenuto",
        "description": "Messaggio di benvenuto per nuovi clienti",
        "fields": ["title", "message"],
        "icon": "heart"
    },
    "generic": {
        "id": "generic",
        "name": "Comunicazione Generica",
        "description": "Messaggio libero",
        "fields": ["title", "message", "image_url"],
        "icon": "megaphone"
    },
}


class MerchantNotificationCreate(BaseModel):
    template_type: str = "generic"
    title: str
    message: str
    image_url: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    target_tags: Optional[List[str]] = []
    target_cap: Optional[str] = None
    target_all_italy: bool = True
    reward_amount: float = 0.10
    priority: str = "normal"


@router.get("/templates")
async def get_templates(user=Depends(get_current_user)):
    """Get available notification templates for merchants."""
    return list(NOTIFICATION_TEMPLATES.values())


@router.post("/preview", response_model=NotificationPreviewResponse)
async def preview_notification_targets(data: NotificationPreviewRequest, user: dict = Depends(get_current_user)):
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=403, detail="Solo i merchant possono inviare notifiche")

    query_conditions = [{"id": {"$ne": user["id"]}}]
    if data.target_tags and len(data.target_tags) > 0:
        query_conditions.append({"profile_tags": {"$in": data.target_tags}})
    if not data.target_all_italy and data.target_cap:
        query_conditions.append({"cap": data.target_cap})
    query = {"$and": query_conditions} if len(query_conditions) > 1 else query_conditions[0]

    target_users = await db.users.find(
        query, {"_id": 0, "id": 1, "full_name": 1, "cap": 1, "profile_tags": 1}
    ).to_list(1000)

    return NotificationPreviewResponse(
        total_users=len(target_users),
        users=[{"id": u["id"], "full_name": u["full_name"], "cap": u.get("cap", "N/A"), "tags": u.get("profile_tags", [])[:3]} for u in target_users[:20]]
    )


@router.post("/send", response_model=NotificationResponse)
async def send_notification(data: NotificationCreate, user: dict = Depends(get_current_user)):
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=403, detail="Solo i merchant possono inviare notifiche")

    if data.reward_amount < 0.01 or data.reward_amount > 3.00:
        raise HTTPException(status_code=400, detail="Importo reward deve essere tra 0.01 e 3.00 UP")

    query_conditions = [{"id": {"$ne": user["id"]}}]
    if data.target_tags and len(data.target_tags) > 0:
        query_conditions.append({"profile_tags": {"$in": data.target_tags}})
    if not data.target_all_italy and data.target_cap:
        query_conditions.append({"cap": data.target_cap})
    query = {"$and": query_conditions} if len(query_conditions) > 1 else query_conditions[0]

    target_users = await db.users.find(query, {"_id": 0, "id": 1}).to_list(10000)
    total_recipients = len(target_users)
    total_cost = total_recipients * data.reward_amount

    merchant_wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    if merchant_wallet["balance"] < total_cost:
        raise HTTPException(status_code=400, detail=f"Saldo insufficiente. Costo totale: {total_cost:.2f}")

    await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": -total_cost}})

    notification_id = str(uuid.uuid4())
    notification_doc = {
        "id": notification_id,
        "merchant_id": merchant["id"],
        "merchant_name": merchant["business_name"],
        "merchant_logo": merchant.get("logo_url", ""),
        "title": data.title,
        "message": data.message,
        "target_tags": data.target_tags,
        "reward_amount": data.reward_amount,
        "total_recipients": total_recipients,
        "total_cost": total_cost,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)

    now = datetime.now(timezone.utc).isoformat()
    notif_docs = []
    for target_user in target_users:
        notif_docs.append({
            "id": str(uuid.uuid4()),
            "notification_id": notification_id,
            "user_id": target_user["id"],
            "type": getattr(data, "template_type", "merchant_notification") if hasattr(data, "template_type") else "merchant_notification",
            "merchant_id": merchant["id"],
            "merchant_name": merchant["business_name"],
            "merchant_logo": merchant.get("logo_url", ""),
            "title": data.title,
            "message": data.message,
            "image_url": getattr(data, "image_url", None) if hasattr(data, "image_url") else None,
            "cta_text": getattr(data, "cta_text", None) if hasattr(data, "cta_text") else None,
            "cta_url": getattr(data, "cta_url", None) if hasattr(data, "cta_url") else None,
            "reward_amount": data.reward_amount,
            "is_read": False,
            "is_clicked": False,
            "is_expanded": False,
            "created_at": now
        })

    if notif_docs:
        await db.user_notifications.insert_many(notif_docs)

    from pymongo import UpdateOne
    wallet_ops = [UpdateOne({"user_id": u["id"]}, {"$inc": {"balance": data.reward_amount}}) for u in target_users]
    if wallet_ops:
        await db.wallets.bulk_write(wallet_ops)

    for target_user in target_users:
        try:
            await send_push_notification(
                user_id=target_user["id"],
                title=f"{merchant['business_name']}",
                body=f"{data.title} - Hai guadagnato {data.reward_amount:.2f}!",
                data={"type": "merchant_notification", "notification_id": notification_id, "url": "/notifications"}
            )
        except Exception as e:
            logging.error(f"Failed to send push to user {target_user['id']}: {e}")

    return NotificationResponse(**notification_doc)


@router.post("/merchant/send")
async def send_merchant_notification(data: MerchantNotificationCreate, user=Depends(get_current_user)):
    """Send notification using a template."""
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=403, detail="Solo i merchant possono inviare notifiche")

    if data.reward_amount < 0.01 or data.reward_amount > 3.00:
        raise HTTPException(status_code=400, detail="Importo reward deve essere tra 0.01 e 3.00 UP")

    query_conditions = [{"id": {"$ne": user["id"]}}]
    if data.target_tags and len(data.target_tags) > 0:
        query_conditions.append({"profile_tags": {"$in": data.target_tags}})
    if not data.target_all_italy and data.target_cap:
        query_conditions.append({"cap": data.target_cap})
    query = {"$and": query_conditions} if len(query_conditions) > 1 else query_conditions[0]

    target_users = await db.users.find(query, {"_id": 0, "id": 1}).to_list(10000)
    total_recipients = len(target_users)
    total_cost = total_recipients * data.reward_amount

    merchant_wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant_wallet or merchant_wallet["balance"] < total_cost:
        raise HTTPException(status_code=400, detail=f"Saldo insufficiente. Costo: {total_cost:.2f}")

    await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": -total_cost}})

    notification_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    await db.notifications.insert_one({
        "id": notification_id, "merchant_id": merchant["id"],
        "merchant_name": merchant["business_name"],
        "template_type": data.template_type,
        "title": data.title, "message": data.message,
        "image_url": data.image_url, "cta_text": data.cta_text, "cta_url": data.cta_url,
        "reward_amount": data.reward_amount, "priority": data.priority,
        "total_recipients": total_recipients, "total_cost": total_cost,
        "created_at": now
    })

    notif_docs = [{
        "id": str(uuid.uuid4()), "notification_id": notification_id,
        "user_id": u["id"], "type": data.template_type,
        "merchant_id": merchant["id"], "merchant_name": merchant["business_name"],
        "merchant_logo": merchant.get("logo_url", ""),
        "title": data.title, "message": data.message,
        "image_url": data.image_url, "cta_text": data.cta_text, "cta_url": data.cta_url,
        "reward_amount": data.reward_amount, "priority": data.priority,
        "is_read": False, "is_clicked": False, "created_at": now
    } for u in target_users]

    if notif_docs:
        await db.user_notifications.insert_many(notif_docs)

    from pymongo import UpdateOne
    ops = [UpdateOne({"user_id": u["id"]}, {"$inc": {"balance": data.reward_amount}}) for u in target_users]
    if ops:
        await db.wallets.bulk_write(ops)

    return {"success": True, "recipients": total_recipients, "cost": total_cost}


@router.get("/me")
async def get_my_notifications(user: dict = Depends(get_current_user)):
    notifications = await db.user_notifications.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return notifications


@router.put("/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    result = await db.user_notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"is_read": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    return {"success": True}


@router.put("/{notification_id}/click")
async def track_notification_click(notification_id: str, user=Depends(get_current_user)):
    """Track that user clicked/expanded a notification."""
    await db.user_notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"is_clicked": True, "clicked_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.notification_interactions.insert_one({
        "id": str(uuid.uuid4()), "notification_id": notification_id,
        "user_id": user["id"], "action": "click",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True}


@router.get("/unread-count", response_model=dict)
async def get_unread_count(user: dict = Depends(get_current_user)):
    count = await db.user_notifications.count_documents({"user_id": user["id"], "is_read": False})
    return {"count": count}
