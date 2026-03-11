import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

mongo_client = MongoClient(MONGO_URL)
mongo_db = mongo_client[DB_NAME]

MERCHANT_USER = {"email": "test@test.com", "password": "test123"}
ADMIN_USER = {"email": "admin@test.com", "password": "test123"}


def login(credentials: dict) -> str:
    response = requests.post(f"{BASE_URL}/api/auth/login", json=credentials)
    assert response.status_code == 200, response.text
    return response.json()["token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def get_wallet_balance(token: str) -> float:
    response = requests.get(f"{BASE_URL}/api/wallet", headers=auth_headers(token))
    assert response.status_code == 200, response.text
    return float(response.json()["balance"])


def get_notification_by_title(token: str, title: str) -> dict:
    response = requests.get(f"{BASE_URL}/api/notifications/me", headers=auth_headers(token))
    assert response.status_code == 200, response.text
    notifications = response.json()

    for notification in notifications:
        if notification.get("title") == title:
            return notification

    raise AssertionError(f"Notification '{title}' not found")


class TestNotificationRewardLifecycle:
    def test_reward_is_credited_only_after_read(self):
        merchant_token = login(MERCHANT_USER)
        admin_token = login(ADMIN_USER)

        merchant_balance_before = get_wallet_balance(merchant_token)
        admin_balance_before = get_wallet_balance(admin_token)

        title = f"TEST READ {uuid.uuid4().hex[:8]}"
        payload = {
            "template_type": "generic",
            "title": title,
            "message": "Leggi questa notifica per riscuotere il reward.",
            "reward_amount": 0.11,
            "validity_minutes": 60,
            "target_all_italy": True,
        }

        send_response = requests.post(
            f"{BASE_URL}/api/notifications/merchant/send",
            headers=auth_headers(merchant_token),
            json=payload,
        )
        assert send_response.status_code == 200, send_response.text
        send_data = send_response.json()

        merchant_balance_after_send = get_wallet_balance(merchant_token)
        assert merchant_balance_after_send == pytest.approx(
            merchant_balance_before - float(send_data["cost"]),
            abs=0.001,
        )

        admin_balance_after_send = get_wallet_balance(admin_token)
        assert admin_balance_after_send == pytest.approx(admin_balance_before, abs=0.001)

        notification = get_notification_by_title(admin_token, title)
        assert notification["reward_status"] == "pending"
        assert notification["validity_minutes"] == 60
        assert notification.get("expires_at")

        read_response = requests.put(
            f"{BASE_URL}/api/notifications/{notification['id']}/read",
            headers=auth_headers(admin_token),
        )
        assert read_response.status_code == 200, read_response.text
        read_data = read_response.json()
        assert read_data["reward_status"] == "credited"
        assert read_data["credited"] is True

        admin_balance_after_read = get_wallet_balance(admin_token)
        assert admin_balance_after_read == pytest.approx(
            admin_balance_before + payload["reward_amount"],
            abs=0.001,
        )

    def test_expired_pending_notifications_are_refunded_to_merchant(self):
        merchant_token = login(MERCHANT_USER)
        admin_token = login(ADMIN_USER)

        merchant_balance_before = get_wallet_balance(merchant_token)
        admin_balance_before = get_wallet_balance(admin_token)

        title = f"TEST EXPIRE {uuid.uuid4().hex[:8]}"
        payload = {
            "template_type": "generic",
            "title": title,
            "message": "Questa notifica verra forzata a scadenza nei test.",
            "reward_amount": 0.09,
            "validity_minutes": 1,
            "target_all_italy": True,
        }

        send_response = requests.post(
            f"{BASE_URL}/api/notifications/merchant/send",
            headers=auth_headers(merchant_token),
            json=payload,
        )
        assert send_response.status_code == 200, send_response.text
        send_data = send_response.json()

        merchant_balance_after_send = get_wallet_balance(merchant_token)
        assert merchant_balance_after_send == pytest.approx(
            merchant_balance_before - float(send_data["cost"]),
            abs=0.001,
        )

        notification = get_notification_by_title(admin_token, title)
        expired_at = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()

        mongo_db.user_notifications.update_many(
            {"notification_id": notification["notification_id"]},
            {
                "$set": {
                    "expires_at": expired_at,
                    "reward_status": "pending",
                    "is_expired": False,
                }
            },
        )
        mongo_db.notifications.update_one(
            {"id": notification["notification_id"]},
            {"$set": {"expires_at": expired_at}},
        )

        merchant_balance_after_refund = get_wallet_balance(merchant_token)
        assert merchant_balance_after_refund == pytest.approx(merchant_balance_before, abs=0.001)

        admin_balance_after_refund = get_wallet_balance(admin_token)
        assert admin_balance_after_refund == pytest.approx(admin_balance_before, abs=0.001)

        expired_notification = get_notification_by_title(admin_token, title)
        assert expired_notification["reward_status"] == "refunded"
        assert expired_notification["is_expired"] is True
