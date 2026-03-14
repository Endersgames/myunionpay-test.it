from collections import defaultdict
from datetime import datetime, timedelta, timezone
import uuid

from pymongo import UpdateOne

from database import db

MIN_NOTIFICATION_VALIDITY_MINUTES = 1
MAX_NOTIFICATION_VALIDITY_MINUTES = 36 * 60
DEFAULT_NOTIFICATION_VALIDITY_MINUTES = 60


def notification_now() -> datetime:
    return datetime.now(timezone.utc)


def notification_now_iso() -> str:
    return notification_now().isoformat()


def parse_notification_datetime(value: str | None) -> datetime | None:
    if not value or not isinstance(value, str):
        return None

    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def normalize_notification_validity_minutes(value: int | float | None) -> int:
    if value is None:
        return DEFAULT_NOTIFICATION_VALIDITY_MINUTES

    try:
        minutes = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("La validita deve essere espressa in minuti") from exc

    if minutes < MIN_NOTIFICATION_VALIDITY_MINUTES or minutes > MAX_NOTIFICATION_VALIDITY_MINUTES:
        raise ValueError(
            f"La validita deve essere tra {MIN_NOTIFICATION_VALIDITY_MINUTES} minuto e {MAX_NOTIFICATION_VALIDITY_MINUTES // 60} ore"
        )

    return minutes


def build_notification_expiration(validity_minutes: int, *, start_at: datetime | None = None) -> str:
    start = start_at or notification_now()
    return (start + timedelta(minutes=validity_minutes)).isoformat()


def notification_is_expired(notification_doc: dict, *, now: datetime | None = None) -> bool:
    expires_at = parse_notification_datetime(notification_doc.get("expires_at"))
    if not expires_at:
        return False
    return expires_at <= (now or notification_now())


async def _resolve_merchant_user_id(notification_doc: dict) -> str | None:
    merchant_user_id = notification_doc.get("merchant_user_id")
    if merchant_user_id:
        return merchant_user_id

    merchant_id = notification_doc.get("merchant_id")
    if not merchant_id:
        return None

    merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0, "user_id": 1})
    return merchant.get("user_id") if merchant else None


async def refund_expired_notification_rewards(*, user_id: str | None = None, merchant_id: str | None = None) -> dict:
    now = notification_now()
    now_iso = now.isoformat()

    query = {
        "reward_amount": {"$gt": 0},
        "reward_status": "pending",
        "expires_at": {"$lte": now_iso},
    }
    if user_id:
        query["user_id"] = user_id
    if merchant_id:
        query["merchant_id"] = merchant_id

    expired_notifications = await db.user_notifications.find(query, {"_id": 0}).to_list(5000)
    if not expired_notifications:
        return {"count": 0, "refunded_total": 0.0}

    merchant_totals: dict[str, float] = defaultdict(float)
    transaction_docs = []
    refunded_count = 0

    for notification in expired_notifications:
        reward_amount = float(notification.get("reward_amount") or 0)
        update_result = await db.user_notifications.update_one(
            {
                "id": notification["id"],
                "reward_status": "pending",
            },
            {
                "$set": {
                    "reward_status": "refunded",
                    "is_expired": True,
                    "expired_at": now_iso,
                    "refunded_at": now_iso,
                }
            },
        )

        if update_result.modified_count == 0:
            continue

        refunded_count += 1
        merchant_user_id = await _resolve_merchant_user_id(notification)
        if not merchant_user_id or reward_amount <= 0:
            continue

        merchant_totals[merchant_user_id] += reward_amount
        transaction_docs.append(
            {
                "id": str(uuid.uuid4()),
                "sender_id": "SYSTEM",
                "sender_name": "Refund Notifica",
                "recipient_id": merchant_user_id,
                "recipient_name": notification.get("merchant_name", "Merchant"),
                "amount": reward_amount,
                "note": f"Riaccredito notifica scaduta: {notification.get('title', 'Notifica')}",
                "transaction_type": "notification_refund",
                "created_at": now_iso,
            }
        )

    if merchant_totals:
        wallet_ops = [
            UpdateOne({"user_id": merchant_user_id}, {"$inc": {"balance": amount}})
            for merchant_user_id, amount in merchant_totals.items()
        ]
        await db.wallets.bulk_write(wallet_ops)

    if transaction_docs:
        await db.transactions.insert_many(transaction_docs)

    return {
        "count": refunded_count,
        "refunded_total": round(sum(merchant_totals.values()), 2),
    }
