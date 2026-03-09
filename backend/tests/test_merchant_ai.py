"""
Merchant AI Features Backend Tests
Tests: upload-visura, scan-menu endpoints
- Authentication validation
- Merchant status validation
- File type validation
- Error handling

NOTE: Does NOT test actual AI processing (OpenAI calls) to avoid costs
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MERCHANT_USER = {"email": "test@test.com", "password": "test123"}
ADMIN_USER = {"email": "admin@test.com", "password": "test123"}
REGULAR_USER = {"email": "luca.bianchi@test.com", "password": "test123"}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    return session


@pytest.fixture(scope="module")
def merchant_token(api_client):
    """Get merchant user token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=MERCHANT_USER)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Merchant login failed: {response.text}")


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin user token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin login failed: {response.text}")


@pytest.fixture(scope="module")
def non_merchant_token(api_client):
    """Get non-merchant user token (admin has is_merchant=false)"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin (non-merchant) login failed: {response.text}")


# ========================
# UPLOAD VISURA TESTS
# ========================

class TestUploadVisura:
    """Test POST /api/merchant/ai/upload-visura"""
    
    def test_upload_visura_requires_auth(self, api_client):
        """Without auth token, should return 403 (Not authenticated)"""
        files = {"file": ("test.txt", io.BytesIO(b"test content"), "text/plain")}
        response = api_client.post(f"{BASE_URL}/api/merchant/ai/upload-visura", files=files)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "authenticated" in data.get("detail", "").lower(), f"Expected auth error, got: {data}"
        print("PASS: upload-visura requires authentication")
    
    def test_upload_visura_requires_merchant_status(self, api_client, non_merchant_token):
        """Non-merchant user (admin@test.com) should get 403 when sending valid image"""
        headers = {"Authorization": f"Bearer {non_merchant_token}"}
        # Need to send actual image content to pass file type check first
        # Create a minimal valid JPEG (1x1 pixel)
        jpeg_header = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
        jpeg_footer = b'\xff\xd9'
        files = {"file": ("test.jpg", io.BytesIO(jpeg_header + jpeg_footer), "image/jpeg")}
        response = api_client.post(
            f"{BASE_URL}/api/merchant/ai/upload-visura",
            headers=headers,
            files=files
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "merchant" in data.get("detail", "").lower(), f"Expected merchant error, got: {data}"
        print("PASS: upload-visura requires merchant status")
    
    def test_upload_visura_rejects_non_image(self, api_client, merchant_token):
        """Non-image files should be rejected with 400"""
        headers = {"Authorization": f"Bearer {merchant_token}"}
        files = {"file": ("test.txt", io.BytesIO(b"test content"), "text/plain")}
        response = api_client.post(
            f"{BASE_URL}/api/merchant/ai/upload-visura",
            headers=headers,
            files=files
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "immagini" in data.get("detail", "").lower(), f"Expected image error, got: {data}"
        print("PASS: upload-visura rejects non-image files")
    
    def test_upload_visura_rejects_pdf(self, api_client, merchant_token):
        """PDF files should be rejected (only images allowed)"""
        headers = {"Authorization": f"Bearer {merchant_token}"}
        files = {"file": ("test.pdf", io.BytesIO(b"%PDF-1.4 test pdf"), "application/pdf")}
        response = api_client.post(
            f"{BASE_URL}/api/merchant/ai/upload-visura",
            headers=headers,
            files=files
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("PASS: upload-visura rejects PDF files")


# ========================
# SCAN MENU TESTS
# ========================

class TestScanMenu:
    """Test POST /api/merchant/ai/scan-menu"""
    
    def test_scan_menu_requires_auth(self, api_client):
        """Without auth token, should return 403 (Not authenticated)"""
        files = {"file": ("test.txt", io.BytesIO(b"test content"), "text/plain")}
        response = api_client.post(f"{BASE_URL}/api/merchant/ai/scan-menu", files=files)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "authenticated" in data.get("detail", "").lower(), f"Expected auth error, got: {data}"
        print("PASS: scan-menu requires authentication")
    
    def test_scan_menu_requires_merchant_status(self, api_client, non_merchant_token):
        """Non-merchant user (admin@test.com) should get 403 when sending valid image"""
        headers = {"Authorization": f"Bearer {non_merchant_token}"}
        # Need to send actual image content to pass file type check first
        jpeg_header = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
        jpeg_footer = b'\xff\xd9'
        files = {"file": ("test.jpg", io.BytesIO(jpeg_header + jpeg_footer), "image/jpeg")}
        response = api_client.post(
            f"{BASE_URL}/api/merchant/ai/scan-menu",
            headers=headers,
            files=files
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "merchant" in data.get("detail", "").lower(), f"Expected merchant error, got: {data}"
        print("PASS: scan-menu requires merchant status")
    
    def test_scan_menu_rejects_non_image(self, api_client, merchant_token):
        """Non-image files should be rejected with 400"""
        headers = {"Authorization": f"Bearer {merchant_token}"}
        files = {"file": ("test.txt", io.BytesIO(b"test content"), "text/plain")}
        response = api_client.post(
            f"{BASE_URL}/api/merchant/ai/scan-menu",
            headers=headers,
            files=files
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "immagini" in data.get("detail", "").lower(), f"Expected image error, got: {data}"
        print("PASS: scan-menu rejects non-image files")


# ========================
# MERCHANT DASHBOARD TESTS
# ========================

class TestMerchantDashboardAPI:
    """Test merchant dashboard related APIs"""
    
    def test_merchant_me_returns_merchant_data(self, api_client, merchant_token):
        """GET /api/merchants/me should return merchant data for merchant user"""
        headers = {"Authorization": f"Bearer {merchant_token}"}
        response = api_client.get(f"{BASE_URL}/api/merchants/me", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "business_name" in data, f"Missing business_name in response: {data}"
        assert "qr_code" in data, f"Missing qr_code in response: {data}"
        assert data.get("category", "").lower() == "ristorante", f"Expected Ristorante category, got: {data.get('category')}"
        print(f"PASS: merchant/me returns data: {data.get('business_name')}, category: {data.get('category')}")
    
    def test_wallet_balance_accessible(self, api_client, merchant_token):
        """GET /api/wallet should return wallet with balance"""
        headers = {"Authorization": f"Bearer {merchant_token}"}
        response = api_client.get(f"{BASE_URL}/api/wallet", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "balance" in data, f"Missing balance in response: {data}"
        print(f"PASS: wallet balance accessible: {data.get('balance')} UP")


# ========================
# MENU ROUTES STILL WORK
# ========================

class TestMenuRoutesIntact:
    """Verify existing menu routes still work"""
    
    def test_menu_my_items_works(self, api_client, merchant_token):
        """GET /api/menu/my-items should work for restaurant merchant"""
        headers = {"Authorization": f"Bearer {merchant_token}"}
        response = api_client.get(f"{BASE_URL}/api/menu/my-items", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got: {type(data)}"
        print(f"PASS: menu/my-items returns {len(data)} items")


# ========================
# MERCHANT REGISTRATION FLOW
# ========================

class TestMerchantRegistrationFlow:
    """Verify merchant registration still works"""
    
    def test_merchants_categories_list(self, api_client):
        """GET /api/merchants/categories/list should return categories"""
        response = api_client.get(f"{BASE_URL}/api/merchants/categories/list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list of categories, got: {type(data)}"
        assert "Ristorante" in data or "ristorante" in [c.lower() for c in data], f"Missing Ristorante in categories: {data}"
        print(f"PASS: merchants/categories/list returns {len(data)} categories")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
