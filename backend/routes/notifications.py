from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from typing import List, Optional
import logging
import os
import uuid

from pydantic import BaseModel

from database import db
from models import (
    NotificationCreate,
    NotificationPreviewRequest,
    NotificationPreviewResponse,
    NotificationResponse,
)
from services.auth import get_current_user
from services.notification_rewards import (
    DEFAULT_NOTIFICATION_VALIDITY_MINUTES,
    build_notification_expiration,
    normalize_notification_validity_minutes,
    notification_is_expired,
    notification_now,
    notification_now_iso,
    refund_expired_notification_rewards,
)
from services.push import send_push_notification

router = APIRouter(prefix="/notifications", tags=["notifications"])

NOTIF_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "notifications")
os.makedirs(NOTIF_UPLOAD_DIR, exist_ok=True)


def _build_target_query(*, sender_user_id: str, target_tags: Optional[List[str]], target_cap: Optional[str], target_all_italy: bool) -> dict:
    query_conditions = [{"id": {"$ne": sender_user_id}}]
    if target_tags and len(target_tags) > 0:
        query_conditions.append({"profile_tags": {"$in": target_tags}})
    if not target_all_italy and target_cap:
        query_conditions.append({"cap": target_cap})
    return {"$and": query_conditions} if len(query_conditions) > 1 else query_conditions[0]


def _format_validity_window(minutes: int) -> str:
    if minutes < 60:
        return f"{minutes} min"
    hours, remainder = divmod(minutes, 60)
    if remainder == 0:
        return f"{hours}h"
    return f"{hours}h {remainder}m"


def _build_push_body(*, title: str, reward_amount: float, validity_minutes: int) -> str:
    return f"{title} - Leggi entro {_format_validity_window(validity_minutes)} per ricevere {reward_amount:.2f} UP"


async def _apply_notification_read(notification_doc: dict, user: dict) -> dict:
    now = notification_now()
    now_iso = now.isoformat()
    reward_amount = float(notification_doc.get("reward_amount") or 0)
    reward_status = notification_doc.get("reward_status") or ("credited" if reward_amount > 0 else "credited")

    base_updates = {}
    if not notification_doc.get("is_read"):
        base_updates["is_read"] = True
        base_updates["read_at"] = now_iso

    if reward_status == "pending" and reward_amount > 0 and not notification_is_expired(notification_doc, now=now):
        result = await db.user_notifications.update_one(
            {
                "id": notification_doc["id"],
                "user_id": user["id"],
                "reward_status": "pending",
            },
            {
                "$set": {
                    **base_updates,
                    "reward_status": "credited",
                    "credited_at": now_iso,
                }
            },
        )

        if result.modified_count > 0:
            await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": reward_amount}})
            await db.transactions.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "sender_id": notification_doc.get("merchant_user_id") or notification_doc.get("merchant_id") or "MERCHANT",
                    "sender_name": notification_doc.get("merchant_name", "Merchant"),
                    "recipient_id": user["id"],
                    "recipient_name": user["full_name"],
                    "amount": reward_amount,
                    "note": f"Reward lettura notifica: {notification_doc.get('title', 'Notifica')}",
                    "transaction_type": "notification_reward",
                    "created_at": now_iso,
                }
            )
            return {
                "success": True,
                "reward_status": "credited",
                "reward_amount": reward_amount,
                "credited": True,
                "expired": False,
                "is_read": True,
                "read_at": now_iso,
                "credited_at": now_iso,
            }

    if base_updates:
        await db.user_notifications.update_one(
            {"id": notification_doc["id"], "user_id": user["id"]},
            {"$set": base_updates},
        )

    refreshed = await db.user_notifications.find_one(
        {"id": notification_doc["id"], "user_id": user["id"]},
        {"_id": 0},
    )
    if not refreshed:
        raise HTTPException(status_code=404, detail="Notifica non trovata")

    refreshed_status = refreshed.get("reward_status", reward_status)
    return {
        "success": True,
        "reward_status": refreshed_status,
        "reward_amount": reward_amount,
        "credited": refreshed_status == "credited",
        "expired": refreshed.get("is_expired", False) or refreshed_status == "refunded",
        "is_read": refreshed.get("is_read", False),
        "read_at": refreshed.get("read_at"),
        "credited_at": refreshed.get("credited_at"),
    }


async def _dispatch_notification_campaign(*, merchant: dict, sender_user: dict, data) -> tuple[dict, int]:
    validity_minutes = normalize_notification_validity_minutes(getattr(data, "validity_minutes", DEFAULT_NOTIFICATION_VALIDITY_MINUTES))
    if data.reward_amount < 0.01 or data.reward_amount > 3.00:
        raise HTTPException(status_code=400, detail="Importo reward deve essere tra 0.01 e 3.00 UP")

    await refund_expired_notification_rewards(merchant_id=merchant["id"])

    query = _build_target_query(
        sender_user_id=sender_user["id"],
        target_tags=getattr(data, "target_tags", []) or [],
        target_cap=getattr(data, "target_cap", None),
        target_all_italy=getattr(data, "target_all_italy", True),
    )
    target_users = await db.users.find(query, {"_id": 0, "id": 1}).to_list(10000)
    total_recipients = len(target_users)
    total_cost = total_recipients * data.reward_amount

    merchant_wallet = await db.wallets.find_one({"user_id": sender_user["id"]}, {"_id": 0})
    if not merchant_wallet or merchant_wallet.get("balance", 0) < total_cost:
        raise HTTPException(status_code=400, detail=f"Saldo insufficiente. Costo totale: {total_cost:.2f}")

    now = notification_now()
    now_iso = now.isoformat()
    expires_at = build_notification_expiration(validity_minutes, start_at=now)

    await db.wallets.update_one({"user_id": sender_user["id"]}, {"$inc": {"balance": -total_cost}})

    notification_id = str(uuid.uuid4())
    notification_doc = {
        "id": notification_id,
        "merchant_id": merchant["id"],
        "merchant_user_id": sender_user["id"],
        "merchant_name": merchant["business_name"],
        "merchant_logo": merchant.get("logo_url", ""),
        "template_type": getattr(data, "template_type", "merchant_notification"),
        "title": data.title,
        "message": data.message,
        "target_tags": getattr(data, "target_tags", []) or [],
        "target_cap": getattr(data, "target_cap", None),
        "target_all_italy": getattr(data, "target_all_italy", True),
        "image_url": getattr(data, "image_url", None),
        "cta_text": getattr(data, "cta_text", None),
        "cta_url": getattr(data, "cta_url", None),
        "reward_amount": data.reward_amount,
        "priority": getattr(data, "priority", "normal"),
        "validity_minutes": validity_minutes,
        "expires_at": expires_at,
        "total_recipients": total_recipients,
        "total_cost": total_cost,
        "created_at": now_iso,
    }
    await db.notifications.insert_one(notification_doc)

    notif_docs = []
    notification_type = getattr(data, "template_type", "merchant_notification") or "merchant_notification"
    for target_user in target_users:
        notif_docs.append(
            {
                "id": str(uuid.uuid4()),
                "notification_id": notification_id,
                "user_id": target_user["id"],
                "type": notification_type,
                "merchant_id": merchant["id"],
                "merchant_user_id": sender_user["id"],
                "merchant_name": merchant["business_name"],
                "merchant_logo": merchant.get("logo_url", ""),
                "title": data.title,
                "message": data.message,
                "image_url": getattr(data, "image_url", None),
                "cta_text": getattr(data, "cta_text", None),
                "cta_url": getattr(data, "cta_url", None),
                "reward_amount": data.reward_amount,
                "reward_status": "pending",
                "priority": getattr(data, "priority", "normal"),
                "validity_minutes": validity_minutes,
                "expires_at": expires_at,
                "is_read": False,
                "is_clicked": False,
                "is_expired": False,
                "is_expanded": False,
                "created_at": now_iso,
            }
        )

    if notif_docs:
        await db.user_notifications.insert_many(notif_docs)

    push_body = _build_push_body(
        title=data.title,
        reward_amount=data.reward_amount,
        validity_minutes=validity_minutes,
    )
    for target_user in target_users:
        try:
            await send_push_notification(
                user_id=target_user["id"],
                title=f"{merchant['business_name']}",
                body=push_body,
                data={
                    "type": notification_type,
                    "notification_id": notification_id,
                    "url": "/notifications",
                    "priority": getattr(data, "priority", "normal"),
                    "expires_at": expires_at,
                    "reward_amount": data.reward_amount,
                },
            )
        except Exception as exc:
            logging.error("Failed to send push to user %s: %s", target_user["id"], exc)

    return notification_doc, total_recipients


@router.post("/upload-image")
async def upload_notification_image(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload a promo image for a notification."""
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=403, detail="Solo i merchant possono caricare immagini")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
        raise HTTPException(status_code=400, detail="Formato non supportato. Usa JPG, PNG, WebP o GIF.")

    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(NOTIF_UPLOAD_DIR, filename)

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Immagine troppo grande. Max 5MB.")

    with open(filepath, "wb") as file_handle:
        file_handle.write(content)

    image_url = f"/api/notifications/image/{filename}"
    return {"image_url": image_url, "filename": filename}


@router.get("/image/{filename}")
async def get_notification_image(filename: str):
    """Serve a notification image."""
    filepath = os.path.join(NOTIF_UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Immagine non trovata")
    return FileResponse(filepath)


NOTIFICATION_TEMPLATES = {
    "promo_offer": {
        "id": "promo_offer",
        "name": "Offerta Promozionale",
        "description": "Sconto o promozione speciale",
        "fields": ["title", "message", "image_url", "cta_text", "cta_url"],
        "icon": "tag",
    },
    "new_menu": {
        "id": "new_menu",
        "name": "Nuovo Menu",
        "description": "Nuovo piatto o menu aggiornato",
        "fields": ["title", "message", "image_url", "cta_text", "cta_url"],
        "icon": "utensils",
    },
    "event": {
        "id": "event",
        "name": "Evento Speciale",
        "description": "Evento, serata o iniziativa",
        "fields": ["title", "message", "image_url", "cta_text", "cta_url"],
        "icon": "calendar",
    },
    "welcome": {
        "id": "welcome",
        "name": "Benvenuto",
        "description": "Messaggio di benvenuto per nuovi clienti",
        "fields": ["title", "message"],
        "icon": "heart",
    },
    "generic": {
        "id": "generic",
        "name": "Comunicazione Generica",
        "description": "Messaggio libero",
        "fields": ["title", "message", "image_url"],
        "icon": "megaphone",
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
    validity_minutes: int = DEFAULT_NOTIFICATION_VALIDITY_MINUTES
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

    await refund_expired_notification_rewards(merchant_id=merchant["id"])

    query = _build_target_query(
        sender_user_id=user["id"],
        target_tags=data.target_tags,
        target_cap=data.target_cap,
        target_all_italy=data.target_all_italy,
    )
    target_users = await db.users.find(
        query,
        {"_id": 0, "id": 1, "full_name": 1, "cap": 1, "profile_tags": 1},
    ).to_list(1000)

    return NotificationPreviewResponse(
        total_users=len(target_users),
        users=[
            {
                "id": target_user["id"],
                "full_name": target_user["full_name"],
                "cap": target_user.get("cap", "N/A"),
                "tags": target_user.get("profile_tags", [])[:3],
            }
            for target_user in target_users[:20]
        ],
    )


@router.post("/send", response_model=NotificationResponse)
async def send_notification(data: NotificationCreate, user: dict = Depends(get_current_user)):
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=403, detail="Solo i merchant possono inviare notifiche")

    try:
        notification_doc, _ = await _dispatch_notification_campaign(merchant=merchant, sender_user=user, data=data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return NotificationResponse(**notification_doc)


@router.post("/merchant/send")
async def send_merchant_notification(data: MerchantNotificationCreate, user=Depends(get_current_user)):
    """Send notification using a template."""
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=403, detail="Solo i merchant possono inviare notifiche")

    try:
        notification_doc, total_recipients = await _dispatch_notification_campaign(merchant=merchant, sender_user=user, data=data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "success": True,
        "recipients": total_recipients,
        "cost": notification_doc["total_cost"],
        "validity_minutes": notification_doc["validity_minutes"],
        "expires_at": notification_doc["expires_at"],
    }


@router.get("/me")
async def get_my_notifications(user: dict = Depends(get_current_user)):
    await refund_expired_notification_rewards(user_id=user["id"])
    notifications = await db.user_notifications.find(
        {"user_id": user["id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)
    for notification in notifications:
        reward_amount = float(notification.get("reward_amount") or 0)
        if reward_amount > 0 and not notification.get("reward_status"):
            notification["reward_status"] = "credited"
        notification.setdefault("is_expired", False)
    return notifications


@router.put("/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    await refund_expired_notification_rewards(user_id=user["id"])
    notification_doc = await db.user_notifications.find_one(
        {"id": notification_id, "user_id": user["id"]},
        {"_id": 0},
    )
    if not notification_doc:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    return await _apply_notification_read(notification_doc, user)


@router.put("/{notification_id}/click")
async def track_notification_click(notification_id: str, user=Depends(get_current_user)):
    """Track that user clicked/expanded a notification."""
    await refund_expired_notification_rewards(user_id=user["id"])
    now_iso = notification_now_iso()
    await db.user_notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"is_clicked": True, "clicked_at": now_iso}},
    )
    await db.notification_interactions.insert_one(
        {
            "id": str(uuid.uuid4()),
            "notification_id": notification_id,
            "user_id": user["id"],
            "action": "click",
            "created_at": now_iso,
        }
    )
    return {"success": True}


@router.get("/unread-count", response_model=dict)
async def get_unread_count(user: dict = Depends(get_current_user)):
    await refund_expired_notification_rewards(user_id=user["id"])
    count = await db.user_notifications.count_documents(
        {
            "user_id": user["id"],
            "is_read": False,
            "is_expired": {"$ne": True},
        }
    )
    return {"count": count}
