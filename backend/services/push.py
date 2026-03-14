import json
import logging
from datetime import datetime
from pywebpush import webpush, WebPushException
from database import db, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_EMAIL


async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        logging.warning("VAPID keys not configured, skipping push notification")
        return False

    subscriptions = await db.push_subscriptions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(10)

    if not subscriptions:
        return False

    payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/icon.svg",
        "badge": "/icon.svg",
        "data": data or {},
        "tag": f"myUup-{datetime.now().timestamp()}",
        "silent": False,
        "renotify": True,
        "requireInteraction": True,
        "vibrate": [260, 120, 260, 120, 340],
        "timestamp": int(datetime.now().timestamp() * 1000),
        "soundHint": "default",
    })

    success = False
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"]
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={
                    "sub": VAPID_EMAIL
                },
                ttl=60,
                timeout=10,
                headers={"Urgency": "high"},
            )
            success = True
        except WebPushException as e:
            logging.error(f"Push notification failed: {e}")
            if e.response and e.response.status_code in [404, 410]:
                await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
        except Exception as e:
            logging.error(f"Push notification error: {e}")

    return success
