"""
Test file for the NEW Notifications System Overhaul
Tests: template system, image upload, CTA buttons, click tracking

Endpoints tested:
- GET /api/notifications/templates - available notification templates
- POST /api/notifications/upload-image - upload promo image (merchant only)
- GET /api/notifications/image/{filename} - serve uploaded image
- POST /api/notifications/merchant/send - send notification with template, image, CTA
- GET /api/notifications/me - user notifications with new fields
- PUT /api/notifications/{id}/read - mark as read
- PUT /api/notifications/{id}/click - track click interaction
- GET /api/notifications/unread-count - unread count
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MERCHANT_USER = {"email": "test@test.com", "password": "test123"}  # Owns Trattoria da Mario
ADMIN_USER = {"email": "admin@test.com", "password": "test123"}

@pytest.fixture(scope="module")
def merchant_token():
    """Login as merchant user (test@test.com)"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=MERCHANT_USER)
    assert response.status_code == 200, f"Merchant login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="module")
def admin_token():
    """Login as admin user (admin@test.com) to receive notifications"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


class TestNotificationTemplates:
    """Test GET /api/notifications/templates"""
    
    def test_get_templates(self, merchant_token):
        """Templates should return list with promo_offer, new_menu, event, welcome, generic"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/templates",
            headers={"Authorization": f"Bearer {merchant_token}"}
        )
        assert response.status_code == 200
        templates = response.json()
        
        assert isinstance(templates, list)
        template_ids = [t["id"] for t in templates]
        
        # Verify expected templates exist
        expected = ["promo_offer", "new_menu", "event", "welcome", "generic"]
        for exp_id in expected:
            assert exp_id in template_ids, f"Missing template: {exp_id}"
        
        # Verify template structure
        for t in templates:
            assert "id" in t
            assert "name" in t
            assert "description" in t
            assert "fields" in t
            assert "icon" in t
        print(f"✓ Templates endpoint returns {len(templates)} templates: {template_ids}")


class TestNotificationImageUpload:
    """Test POST /api/notifications/upload-image and GET /api/notifications/image/{filename}"""
    
    def test_upload_image_success(self, merchant_token):
        """Merchant should be able to upload a JPG image"""
        # Create a small test image (1x1 red pixel JPG)
        from PIL import Image
        img = Image.new('RGB', (100, 100), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/upload-image",
            headers={"Authorization": f"Bearer {merchant_token}"},
            files={"file": ("test_promo.jpg", img_bytes, "image/jpeg")}
        )
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        assert "image_url" in data
        assert "filename" in data
        assert data["image_url"].startswith("/api/notifications/image/")
        assert data["filename"].endswith(".jpg") or data["filename"].endswith(".jpeg")
        print(f"✓ Image uploaded: {data['image_url']}")
        
        # Verify the image is accessible
        image_response = requests.get(f"{BASE_URL}{data['image_url']}")
        assert image_response.status_code == 200
        assert "image" in image_response.headers.get("content-type", "")
        print(f"✓ Uploaded image accessible at {data['image_url']}")
        
        return data["image_url"]

    def test_upload_image_invalid_format(self, merchant_token):
        """Should reject non-image files"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/upload-image",
            headers={"Authorization": f"Bearer {merchant_token}"},
            files={"file": ("test.txt", b"Hello World", "text/plain")}
        )
        assert response.status_code == 400
        print("✓ Invalid format correctly rejected")

    def test_get_image_not_found(self):
        """Should return 404 for non-existent image"""
        response = requests.get(f"{BASE_URL}/api/notifications/image/nonexistent.jpg")
        assert response.status_code == 404
        print("✓ Non-existent image returns 404")


class TestMerchantSendNotification:
    """Test POST /api/notifications/merchant/send with templates and CTA"""
    
    def test_send_promo_notification_with_cta(self, merchant_token):
        """Send a promo notification with image URL and CTA button"""
        # First upload an image
        from PIL import Image
        img = Image.new('RGB', (200, 200), color='blue')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        upload_response = requests.post(
            f"{BASE_URL}/api/notifications/upload-image",
            headers={"Authorization": f"Bearer {merchant_token}"},
            files={"file": ("promo_test.jpg", img_bytes, "image/jpeg")}
        )
        assert upload_response.status_code == 200
        image_url = upload_response.json()["image_url"]
        
        # Send notification with template, image, and CTA
        notification_data = {
            "template_type": "promo_offer",
            "title": "TEST Promo - 20% Sconto!",
            "message": "Vieni a provare i nostri piatti con uno sconto esclusivo del 20%!",
            "image_url": image_url,
            "cta_text": "Scopri di più",
            "cta_url": "/menu/0c702b63-0c00-43e3-bb1c-5dbf0242b17a",
            "reward_amount": 0.10,
            "target_all_italy": True,
            "priority": "high"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/merchant/send",
            headers={"Authorization": f"Bearer {merchant_token}"},
            json=notification_data
        )
        assert response.status_code == 200, f"Send failed: {response.text}"
        result = response.json()
        
        assert result["success"] == True
        assert result["recipients"] >= 1  # At least 1 recipient (admin)
        assert "cost" in result
        print(f"✓ Promo notification sent to {result['recipients']} recipients, cost: {result['cost']} UP")
        return result

    def test_send_event_notification(self, merchant_token):
        """Send event notification without image"""
        notification_data = {
            "template_type": "event",
            "title": "TEST Serata Jazz Live",
            "message": "Venerdi sera musica jazz dal vivo con buffet incluso!",
            "cta_text": "Prenota ora",
            "cta_url": "https://example.com/booking",
            "reward_amount": 0.05,
            "target_all_italy": True,
            "priority": "normal"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/merchant/send",
            headers={"Authorization": f"Bearer {merchant_token}"},
            json=notification_data
        )
        assert response.status_code == 200, f"Send failed: {response.text}"
        result = response.json()
        assert result["success"] == True
        print(f"✓ Event notification sent to {result['recipients']} recipients")

    def test_send_notification_insufficient_balance(self, merchant_token):
        """Should fail if merchant doesn't have enough balance"""
        notification_data = {
            "template_type": "promo_offer",
            "title": "TEST Massive Promo",
            "message": "Huge promo!",
            "reward_amount": 3.00,  # Max reward
            "target_all_italy": True
        }
        
        # This may or may not fail depending on merchant balance
        response = requests.post(
            f"{BASE_URL}/api/notifications/merchant/send",
            headers={"Authorization": f"Bearer {merchant_token}"},
            json=notification_data
        )
        # Either success or 400 for insufficient balance
        assert response.status_code in [200, 400]
        if response.status_code == 400:
            assert "insufficiente" in response.json().get("detail", "").lower()
            print("✓ Insufficient balance correctly handled")
        else:
            print("✓ Notification sent (merchant had sufficient balance)")


class TestUserNotifications:
    """Test GET /api/notifications/me with new fields"""
    
    def test_get_my_notifications_structure(self, admin_token):
        """Notifications should include new fields: type, image_url, cta_text, cta_url, priority"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        notifications = response.json()
        
        assert isinstance(notifications, list)
        if len(notifications) > 0:
            notif = notifications[0]
            # Check essential fields
            assert "id" in notif
            assert "title" in notif
            assert "message" in notif
            assert "is_read" in notif
            assert "created_at" in notif
            
            # Check new fields exist (may be None)
            assert "type" in notif
            assert "reward_amount" in notif
            
            # Log what fields we found
            print(f"✓ Got {len(notifications)} notifications")
            print(f"  Sample notification fields: {list(notif.keys())}")
            
            # Check if any have the new template fields
            has_cta = any(n.get("cta_text") for n in notifications)
            has_image = any(n.get("image_url") for n in notifications)
            has_type = any(n.get("type") for n in notifications)
            print(f"  Has CTA: {has_cta}, Has Image: {has_image}, Has Type: {has_type}")
        else:
            print("✓ No notifications found for this user (empty list returned)")
        
        return notifications


class TestNotificationInteractions:
    """Test read marking and click tracking"""
    
    def test_mark_notification_as_read(self, admin_token):
        """PUT /api/notifications/{id}/read should mark notification as read"""
        # First get notifications
        notifs_response = requests.get(
            f"{BASE_URL}/api/notifications/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert notifs_response.status_code == 200
        notifications = notifs_response.json()
        
        if len(notifications) == 0:
            pytest.skip("No notifications to test read marking")
        
        # Find an unread notification
        unread = [n for n in notifications if not n.get("is_read", True)]
        if not unread:
            # All are read, just test that the endpoint works
            notif_id = notifications[0]["id"]
        else:
            notif_id = unread[0]["id"]
        
        # Mark as read
        response = requests.put(
            f"{BASE_URL}/api/notifications/{notif_id}/read",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
        print(f"✓ Notification {notif_id} marked as read")

    def test_track_notification_click(self, admin_token):
        """PUT /api/notifications/{id}/click should track click interaction"""
        # Get notifications
        notifs_response = requests.get(
            f"{BASE_URL}/api/notifications/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        notifications = notifs_response.json()
        
        if len(notifications) == 0:
            pytest.skip("No notifications to test click tracking")
        
        notif_id = notifications[0]["id"]
        
        # Track click
        response = requests.put(
            f"{BASE_URL}/api/notifications/{notif_id}/click",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
        print(f"✓ Click tracked for notification {notif_id}")

    def test_get_unread_count(self, admin_token):
        """GET /api/notifications/unread-count should return count"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "count" in data
        assert isinstance(data["count"], int)
        assert data["count"] >= 0
        print(f"✓ Unread count: {data['count']}")


class TestLoginAfterNotifications:
    """Verify login still works (no up_points float issue)"""
    
    def test_login_returns_integer_up_points(self):
        """Login should work and up_points should be an integer"""
        # Login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=MERCHANT_USER
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Get user info
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response.status_code == 200
        user = me_response.json()
        
        # Verify up_points is integer (the bug was float causing issues)
        if "up_points" in user:
            assert isinstance(user["up_points"], int), f"up_points should be int, got {type(user['up_points'])}"
            print(f"✓ Login works, up_points is integer: {user['up_points']}")
        else:
            print("✓ Login works (up_points not in response)")


class TestPublicMenuStillWorks:
    """Verify public menu endpoint still works"""
    
    def test_public_menu_endpoint(self):
        """GET /api/menu/public/{merchant_id} should return menu"""
        merchant_id = "0c702b63-0c00-43e3-bb1c-5dbf0242b17a"  # Trattoria da Mario
        
        response = requests.get(f"{BASE_URL}/api/menu/public/{merchant_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert "merchant" in data
        assert "items" in data
        print(f"✓ Public menu works, {len(data['items'])} items found")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
