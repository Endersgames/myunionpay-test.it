"""
UpPay API Backend Tests
Tests all API endpoints for the PWA payments app
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "test123"
MERCHANT_QR = "MYU550443044492NI343"
USER_QR = "MYU920219713260OW230"
MERCHANT_ID = "0c702b63-0c00-43e3-bb1c-5dbf0242b17a"


class TestHealthEndpoints:
    """Health check endpoints"""
    
    def test_api_health(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ /api/health returns healthy status")
    
    def test_root_health(self):
        """Test /health root endpoint"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ /health returns healthy status")
    
    def test_api_root(self):
        """Test /api/ endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "UpPay" in data["message"]
        print("✓ /api/ returns UpPay API info")


class TestAuthEndpoints:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test successful login with test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user_id" in data
        assert len(data["token"]) > 0
        print(f"✓ POST /api/auth/login returns token for {TEST_EMAIL}")
        return data["token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ POST /api/auth/login returns 401 for invalid credentials")
    
    def test_get_me_with_token(self):
        """Test /auth/me with valid token"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Then get user info
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert data["email"] == TEST_EMAIL
        assert "qr_code" in data
        assert "referral_code" in data
        print(f"✓ GET /api/auth/me returns user data with id={data['id'][:8]}...")
    
    def test_get_me_without_token(self):
        """Test /auth/me without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403]
        print("✓ GET /api/auth/me returns 401/403 without token")


class TestWalletEndpoints:
    """Wallet API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_wallet(self, auth_token):
        """Test GET /wallet with auth token"""
        response = requests.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "balance" in data
        assert "currency" in data
        assert isinstance(data["balance"], (int, float))
        print(f"✓ GET /api/wallet returns balance: {data['balance']} {data['currency']}")
    
    def test_get_wallet_without_auth(self):
        """Test GET /wallet without auth"""
        response = requests.get(f"{BASE_URL}/api/wallet")
        assert response.status_code in [401, 403]
        print("✓ GET /api/wallet returns 401/403 without auth")


class TestMerchantEndpoints:
    """Merchant API tests - Public endpoints"""
    
    def test_get_merchants_list(self):
        """Test GET /merchants (public, no auth needed)"""
        response = requests.get(f"{BASE_URL}/api/merchants")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/merchants returns {len(data)} merchants (public)")
    
    def test_get_merchant_by_id(self):
        """Test GET /merchants/{id} for specific merchant"""
        response = requests.get(f"{BASE_URL}/api/merchants/{MERCHANT_ID}")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["id"] == MERCHANT_ID
        assert "business_name" in data
        assert "qr_code" in data
        print(f"✓ GET /api/merchants/{MERCHANT_ID[:8]}... returns merchant: {data['business_name']}")
    
    def test_get_merchant_not_found(self):
        """Test GET /merchants/{id} for non-existent merchant"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(f"{BASE_URL}/api/merchants/{fake_id}")
        assert response.status_code == 404
        print("✓ GET /api/merchants/{invalid_id} returns 404")
    
    def test_get_categories(self):
        """Test GET /merchants/categories/list"""
        response = requests.get(f"{BASE_URL}/api/merchants/categories/list")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "Ristorante" in data
        print(f"✓ GET /api/merchants/categories/list returns {len(data)} categories")


class TestQRReferralEndpoints:
    """QR Code referral lookup tests"""
    
    def test_merchant_qr_referral(self):
        """Test GET /qr/referral/{qr_code} for merchant QR - should return type=merchant"""
        response = requests.get(f"{BASE_URL}/api/qr/referral/{MERCHANT_QR}")
        assert response.status_code == 200
        data = response.json()
        assert "type" in data, f"Response missing 'type' field: {data}"
        assert data["type"] == "merchant", f"Expected type=merchant, got {data['type']}"
        assert "is_merchant" in data
        assert data["is_merchant"] == True
        assert "referral_code" in data
        assert "name" in data
        print(f"✓ GET /api/qr/referral/{MERCHANT_QR} returns type=merchant, name={data['name']}")
    
    def test_user_qr_referral(self):
        """Test GET /qr/referral/{qr_code} for user QR - should return type=user"""
        response = requests.get(f"{BASE_URL}/api/qr/referral/{USER_QR}")
        assert response.status_code == 200
        data = response.json()
        assert "type" in data, f"Response missing 'type' field: {data}"
        assert data["type"] == "user", f"Expected type=user, got {data['type']}"
        assert "is_merchant" in data
        assert data["is_merchant"] == False
        assert "referral_code" in data
        assert "name" in data
        print(f"✓ GET /api/qr/referral/{USER_QR} returns type=user, name={data['name']}")
    
    def test_invalid_qr_referral(self):
        """Test GET /qr/referral/{qr_code} for invalid QR"""
        response = requests.get(f"{BASE_URL}/api/qr/referral/INVALID_QR_CODE")
        assert response.status_code == 404
        print("✓ GET /api/qr/referral/INVALID returns 404")


class TestPaymentsEndpoints:
    """Payments API tests"""
    
    def test_get_user_by_merchant_qr(self):
        """Test GET /payments/user/{qr_code} for merchant QR"""
        response = requests.get(f"{BASE_URL}/api/payments/user/{MERCHANT_QR}")
        assert response.status_code == 200
        data = response.json()
        assert "type" in data
        assert "name" in data
        assert "qr_code" in data
        print(f"✓ GET /api/payments/user/{MERCHANT_QR} returns {data['type']}: {data['name']}")
    
    def test_get_user_by_invalid_qr(self):
        """Test GET /payments/user/{qr_code} for invalid QR"""
        response = requests.get(f"{BASE_URL}/api/payments/user/INVALID_QR")
        assert response.status_code == 404
        print("✓ GET /api/payments/user/INVALID returns 404")


class TestProfileEndpoints:
    """Profile API tests"""
    
    def test_get_profile_tags(self):
        """Test GET /profile/tags returns 15 tags"""
        response = requests.get(f"{BASE_URL}/api/profile/tags")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 15, f"Expected 15 tags, got {len(data)}"
        expected_tags = ["tech", "fashion", "food", "fitness", "travel"]
        for tag in expected_tags:
            assert tag in data, f"Missing expected tag: {tag}"
        print(f"✓ GET /api/profile/tags returns {len(data)} tags")


class TestNotificationsEndpoints:
    """Notifications API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_unread_count(self, auth_token):
        """Test GET /notifications/unread-count with auth token"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"✓ GET /api/notifications/unread-count returns count: {data['count']}")
    
    def test_get_unread_count_without_auth(self):
        """Test GET /notifications/unread-count without auth"""
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code in [401, 403]
        print("✓ GET /api/notifications/unread-count returns 401/403 without auth")


class TestReferralsEndpoints:
    """Referrals API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_referral_stats(self, auth_token):
        """Test GET /referrals/stats with auth token"""
        response = requests.get(
            f"{BASE_URL}/api/referrals/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "referral_code" in data
        assert "total_referrals" in data
        assert "up_points" in data
        print(f"✓ GET /api/referrals/stats returns referral_code={data['referral_code'][:10]}..., referrals={data['total_referrals']}")
    
    def test_get_referral_stats_without_auth(self):
        """Test GET /referrals/stats without auth"""
        response = requests.get(f"{BASE_URL}/api/referrals/stats")
        assert response.status_code in [401, 403]
        print("✓ GET /api/referrals/stats returns 401/403 without auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
