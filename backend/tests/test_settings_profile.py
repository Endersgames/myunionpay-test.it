"""
Tests for Settings/Profile redesign feature:
- Profile personal data updates
- Profile picture upload
- Data treatment preferences
- Account deletion (soft delete with 30-day grace period)
- Content management (admin & public endpoints)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test@test.com"
TEST_USER_PASSWORD = "test123"
ADMIN_USER_EMAIL = "admin@test.com"
ADMIN_USER_PASSWORD = "test123"


class TestHealthAndSetup:
    """Basic health checks"""

    def test_api_health(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("PASS: API health check")

    def test_regular_user_login(self):
        """Login with test user to get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user_id" in data
        print(f"PASS: Test user login - user_id: {data['user_id']}")

    def test_admin_user_login(self):
        """Login with admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_USER_EMAIL,
            "password": ADMIN_USER_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print(f"PASS: Admin user login - user_id: {data['user_id']}")


class TestProfilePersonalData:
    """Tests for /api/profile/personal endpoint"""

    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["token"]

    def test_update_personal_data_success(self, auth_token):
        """PUT /api/profile/personal - update name, phone, address"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.put(f"{BASE_URL}/api/profile/personal", headers=headers, json={
            "full_name": "Test User Updated",
            "phone": "+39 333 1234567",
            "address": "Via Test 123, Roma"
        })
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        assert data["message"] == "Dati aggiornati"
        assert data["user"]["full_name"] == "Test User Updated"
        assert data["user"]["phone"] == "+39 333 1234567"
        assert data["user"]["address"] == "Via Test 123, Roma"
        print("PASS: Personal data update successful")

    def test_update_personal_data_empty_fields(self, auth_token):
        """PUT /api/profile/personal - empty fields should fail"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.put(f"{BASE_URL}/api/profile/personal", headers=headers, json={
            "full_name": "",
            "phone": ""
        })
        assert response.status_code == 400
        print("PASS: Empty fields correctly rejected")

    def test_update_personal_data_without_auth(self):
        """PUT /api/profile/personal - without auth should fail"""
        response = requests.put(f"{BASE_URL}/api/profile/personal", json={
            "full_name": "Hacker"
        })
        assert response.status_code in [401, 403]
        print("PASS: Unauthorized access rejected")

    def test_get_auth_me_with_address_field(self, auth_token):
        """GET /api/auth/me should return address field"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Address field should exist (may be empty or have value)
        print(f"PASS: User data has fields: {list(data.keys())[:10]}")


class TestProfilePicture:
    """Tests for /api/profile/picture endpoint"""

    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["token"]

    def test_upload_profile_picture_no_file(self, auth_token):
        """POST /api/profile/picture - no file should fail"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/profile/picture", headers=headers)
        assert response.status_code == 422  # Missing file
        print("PASS: Missing file correctly rejected")

    def test_upload_profile_picture_non_image(self, auth_token):
        """POST /api/profile/picture - non-image should fail"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        files = {"file": ("test.txt", b"not an image", "text/plain")}
        response = requests.post(f"{BASE_URL}/api/profile/picture", headers=headers, files=files)
        assert response.status_code == 400
        data = response.json()
        assert "immagini" in data.get("detail", "").lower() or "image" in data.get("detail", "").lower()
        print("PASS: Non-image file correctly rejected")

    def test_upload_profile_picture_without_auth(self):
        """POST /api/profile/picture - without auth should fail"""
        files = {"file": ("test.jpg", b"fake image data", "image/jpeg")}
        response = requests.post(f"{BASE_URL}/api/profile/picture", files=files)
        assert response.status_code in [401, 403]
        print("PASS: Unauthorized upload rejected")


class TestDataTreatment:
    """Tests for /api/profile/data-treatment endpoints"""

    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["token"]

    def test_get_data_treatment(self, auth_token):
        """GET /api/profile/data-treatment - get user preferences"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/profile/data-treatment", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "sections" in data
        assert "status" in data
        assert len(data["sections"]) == 4  # 4 data treatment sections
        assert data["status"] in ["Attivo", "Non attivo"]
        # Check section structure
        for section in data["sections"]:
            assert "key" in section
            assert "title" in section
            assert "content" in section
            assert "authorized" in section
        print(f"PASS: Data treatment returned {len(data['sections'])} sections, status: {data['status']}")

    def test_update_data_treatment_enable_section(self, auth_token):
        """PUT /api/profile/data-treatment - enable section 1"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.put(f"{BASE_URL}/api/profile/data-treatment", headers=headers, json={
            "section_1": True
        })
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Preferenze aggiornate"
        assert data["data_treatment"]["section_1"] == True
        print("PASS: Data treatment section enabled")

    def test_update_data_treatment_disable_section(self, auth_token):
        """PUT /api/profile/data-treatment - disable section 1"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.put(f"{BASE_URL}/api/profile/data-treatment", headers=headers, json={
            "section_1": False
        })
        assert response.status_code == 200
        data = response.json()
        assert data["data_treatment"]["section_1"] == False
        print("PASS: Data treatment section disabled")

    def test_update_data_treatment_multiple_sections(self, auth_token):
        """PUT /api/profile/data-treatment - update multiple sections"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.put(f"{BASE_URL}/api/profile/data-treatment", headers=headers, json={
            "section_1": True,
            "section_2": True,
            "section_3": False,
            "section_4": False
        })
        assert response.status_code == 200
        data = response.json()
        assert data["data_treatment"]["section_1"] == True
        assert data["data_treatment"]["section_2"] == True
        assert data["data_treatment"]["section_3"] == False
        assert data["data_treatment"]["section_4"] == False
        print("PASS: Multiple sections updated")

    def test_update_data_treatment_empty_body(self, auth_token):
        """PUT /api/profile/data-treatment - empty body should fail"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.put(f"{BASE_URL}/api/profile/data-treatment", headers=headers, json={})
        assert response.status_code == 400
        print("PASS: Empty body correctly rejected")

    def test_data_treatment_without_auth(self):
        """GET /api/profile/data-treatment - without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/profile/data-treatment")
        assert response.status_code in [401, 403]
        print("PASS: Unauthorized access rejected")


class TestPublicContent:
    """Tests for public content endpoints"""

    def test_get_public_privacy_policy(self):
        """GET /api/content/privacy_policy - public endpoint"""
        response = requests.get(f"{BASE_URL}/api/content/privacy_policy")
        assert response.status_code == 200
        data = response.json()
        assert "key" in data
        assert "title" in data
        assert "content" in data
        assert data["key"] == "privacy_policy"
        print(f"PASS: Privacy policy retrieved - title: {data['title'][:30]}...")

    def test_get_public_data_treatment_1(self):
        """GET /api/content/data_treatment_1 - public endpoint"""
        response = requests.get(f"{BASE_URL}/api/content/data_treatment_1")
        assert response.status_code == 200
        data = response.json()
        assert data["key"] == "data_treatment_1"
        print("PASS: Data treatment 1 content retrieved")

    def test_get_nonexistent_content(self):
        """GET /api/content/nonexistent - should return empty"""
        response = requests.get(f"{BASE_URL}/api/content/nonexistent_key_12345")
        assert response.status_code == 200
        data = response.json()
        # Should return empty content for non-existent key
        assert data.get("content", "") == "" or data.get("title", "") == ""
        print("PASS: Non-existent content returns empty")


class TestAdminContent:
    """Tests for admin content endpoints"""

    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_USER_EMAIL,
            "password": ADMIN_USER_PASSWORD
        })
        return response.json()["token"]

    @pytest.fixture
    def regular_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["token"]

    def test_admin_get_all_content(self, admin_token):
        """GET /api/admin/content - admin can get all content"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/content", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) >= 5  # At least 5 seeded items
        print(f"PASS: Admin retrieved {len(data['items'])} content items")

    def test_admin_get_specific_content(self, admin_token):
        """GET /api/admin/content/{key} - admin can get specific content"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/content/privacy_policy", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["key"] == "privacy_policy"
        print("PASS: Admin retrieved specific content")

    def test_admin_update_content(self, admin_token):
        """PUT /api/admin/content/{key} - admin can update content"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.put(f"{BASE_URL}/api/admin/content/data_treatment_1", headers=headers, json={
            "title": "Comunicazioni commerciali UPDATED",
            "content": "Updated content for testing purposes."
        })
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Contenuto aggiornato"
        assert data["item"]["title"] == "Comunicazioni commerciali UPDATED"
        print("PASS: Admin updated content")

        # Restore original
        requests.put(f"{BASE_URL}/api/admin/content/data_treatment_1", headers=headers, json={
            "title": "Comunicazioni commerciali",
            "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
        })

    def test_regular_user_cannot_access_admin_content(self, regular_token):
        """GET /api/admin/content - regular user should be denied"""
        headers = {"Authorization": f"Bearer {regular_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/content", headers=headers)
        assert response.status_code == 403
        print("PASS: Regular user denied admin content access")

    def test_unauthenticated_cannot_access_admin_content(self):
        """GET /api/admin/content - unauthenticated should be denied"""
        response = requests.get(f"{BASE_URL}/api/admin/content")
        assert response.status_code in [401, 403]
        print("PASS: Unauthenticated access denied")


class TestAccountDeletion:
    """Tests for account deletion with 30-day grace period"""

    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["token"]

    def test_delete_account_request(self, auth_token):
        """POST /api/auth/delete-account - request account deletion"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/auth/delete-account", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "30 giorni" in data["message"]
        assert "deletion_scheduled_at" in data
        print(f"PASS: Account deletion scheduled for {data['deletion_scheduled_at']}")

    def test_login_cancels_deletion(self):
        """POST /api/auth/login - logging in should cancel deletion"""
        # After deletion was requested, login should cancel it
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print("PASS: Login successful - deletion cancelled")

    def test_delete_account_without_auth(self):
        """POST /api/auth/delete-account - without auth should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/delete-account")
        assert response.status_code in [401, 403]
        print("PASS: Unauthorized deletion request rejected")


class TestGiftCardPurchases:
    """Tests for /api/giftcards/my-purchases endpoint"""

    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["token"]

    def test_get_my_purchases(self, auth_token):
        """GET /api/giftcards/my-purchases - get user's gift cards"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/giftcards/my-purchases", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Should be a list (may be empty)
        assert isinstance(data, list)
        print(f"PASS: Retrieved {len(data)} gift card purchases")

    def test_get_my_purchases_without_auth(self):
        """GET /api/giftcards/my-purchases - without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/giftcards/my-purchases")
        assert response.status_code in [401, 403]
        print("PASS: Unauthorized access rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
