"""
Test suite for Admin/Merchant Panel Features:
1. Admin Users Management (/api/admin/users, /api/admin/user/{id}, etc.)
2. Admin OpenAI Config (/api/admin/openai/config, /api/admin/openai/test)
3. Merchant Referred Users (/api/merchant/referred-users)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAdminUsersAPI:
    """Test Admin User Management endpoints"""
    admin_token = None
    test_user_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        if not TestAdminUsersAPI.admin_token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "admin@test.com",
                "password": "test123"
            })
            assert response.status_code == 200, f"Admin login failed: {response.text}"
            TestAdminUsersAPI.admin_token = response.json().get("token")
        yield
    
    def auth_headers(self):
        return {"Authorization": f"Bearer {TestAdminUsersAPI.admin_token}", "Content-Type": "application/json"}
    
    def test_get_all_users(self):
        """GET /api/admin/users - should return list of users"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.auth_headers())
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "total" in data
        assert isinstance(data["users"], list)
        assert data["total"] > 0
        print(f"✓ GET /api/admin/users - {data['total']} users returned")
        
        # Store a user_id for later tests (not the admin user)
        for user in data["users"]:
            if not user.get("is_admin") and not user.get("is_blocked"):
                TestAdminUsersAPI.test_user_id = user["id"]
                break
    
    def test_get_users_with_search(self):
        """GET /api/admin/users?search=test - should filter users"""
        response = requests.get(f"{BASE_URL}/api/admin/users?search=test", headers=self.auth_headers())
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        print(f"✓ GET /api/admin/users?search=test - {data['total']} users matched")
    
    def test_get_users_filter_active(self):
        """GET /api/admin/users?status=active - should filter active users"""
        response = requests.get(f"{BASE_URL}/api/admin/users?status=active", headers=self.auth_headers())
        assert response.status_code == 200
        data = response.json()
        for user in data["users"]:
            assert user.get("is_blocked") != True
        print(f"✓ GET /api/admin/users?status=active - {data['total']} active users")
    
    def test_get_users_filter_blocked(self):
        """GET /api/admin/users?status=blocked - should filter blocked users"""
        response = requests.get(f"{BASE_URL}/api/admin/users?status=blocked", headers=self.auth_headers())
        assert response.status_code == 200
        data = response.json()
        for user in data["users"]:
            assert user.get("is_blocked") == True
        print(f"✓ GET /api/admin/users?status=blocked - {data['total']} blocked users")
    
    def test_get_users_filter_merchant(self):
        """GET /api/admin/users?status=merchant - should filter merchants"""
        response = requests.get(f"{BASE_URL}/api/admin/users?status=merchant", headers=self.auth_headers())
        assert response.status_code == 200
        data = response.json()
        for user in data["users"]:
            assert user.get("is_merchant") == True
        print(f"✓ GET /api/admin/users?status=merchant - {data['total']} merchants")
    
    def test_get_users_filter_admin(self):
        """GET /api/admin/users?status=admin - should filter admins"""
        response = requests.get(f"{BASE_URL}/api/admin/users?status=admin", headers=self.auth_headers())
        assert response.status_code == 200
        data = response.json()
        for user in data["users"]:
            assert user.get("is_admin") == True
        print(f"✓ GET /api/admin/users?status=admin - {data['total']} admins")
    
    def test_get_user_detail(self):
        """GET /api/admin/user/{id} - should return user details"""
        if not TestAdminUsersAPI.test_user_id:
            pytest.skip("No test user ID available")
        
        response = requests.get(f"{BASE_URL}/api/admin/user/{TestAdminUsersAPI.test_user_id}", headers=self.auth_headers())
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "wallet_balance" in data or "wallet_balance" == 0
        print(f"✓ GET /api/admin/user/{TestAdminUsersAPI.test_user_id[:8]}... - user detail retrieved")
    
    def test_update_user(self):
        """PUT /api/admin/user/{id} - should update user data"""
        if not TestAdminUsersAPI.test_user_id:
            pytest.skip("No test user ID available")
        
        # Get current name first
        response = requests.get(f"{BASE_URL}/api/admin/user/{TestAdminUsersAPI.test_user_id}", headers=self.auth_headers())
        original_name = response.json().get("full_name")
        
        # Update to test name
        test_name = "TEST_Updated_Name"
        response = requests.put(
            f"{BASE_URL}/api/admin/user/{TestAdminUsersAPI.test_user_id}",
            headers=self.auth_headers(),
            json={"full_name": test_name}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("full_name") == test_name
        print(f"✓ PUT /api/admin/user/{TestAdminUsersAPI.test_user_id[:8]}... - user updated")
        
        # Revert to original name
        requests.put(
            f"{BASE_URL}/api/admin/user/{TestAdminUsersAPI.test_user_id}",
            headers=self.auth_headers(),
            json={"full_name": original_name}
        )
    
    def test_block_unblock_user(self):
        """POST /api/admin/user/{id}/block and /unblock - should block/unblock user"""
        if not TestAdminUsersAPI.test_user_id:
            pytest.skip("No test user ID available")
        
        # Block user
        response = requests.post(
            f"{BASE_URL}/api/admin/user/{TestAdminUsersAPI.test_user_id}/block",
            headers=self.auth_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✓ POST /api/admin/user/{TestAdminUsersAPI.test_user_id[:8]}.../block - user blocked")
        
        # Verify blocked status
        response = requests.get(f"{BASE_URL}/api/admin/user/{TestAdminUsersAPI.test_user_id}", headers=self.auth_headers())
        assert response.json().get("is_blocked") == True
        
        # Unblock user
        response = requests.post(
            f"{BASE_URL}/api/admin/user/{TestAdminUsersAPI.test_user_id}/unblock",
            headers=self.auth_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✓ POST /api/admin/user/{TestAdminUsersAPI.test_user_id[:8]}.../unblock - user unblocked")
        
        # Verify unblocked
        response = requests.get(f"{BASE_URL}/api/admin/user/{TestAdminUsersAPI.test_user_id}", headers=self.auth_headers())
        assert response.json().get("is_blocked") == False


class TestAdminOpenAIAPI:
    """Test Admin OpenAI Configuration endpoints"""
    admin_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        if not TestAdminOpenAIAPI.admin_token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "admin@test.com",
                "password": "test123"
            })
            assert response.status_code == 200
            TestAdminOpenAIAPI.admin_token = response.json().get("token")
        yield
    
    def auth_headers(self):
        return {"Authorization": f"Bearer {TestAdminOpenAIAPI.admin_token}", "Content-Type": "application/json"}
    
    def test_get_openai_config(self):
        """GET /api/admin/openai/config - should return config"""
        response = requests.get(f"{BASE_URL}/api/admin/openai/config", headers=self.auth_headers())
        assert response.status_code == 200
        data = response.json()
        assert "api_key_set" in data
        assert "model" in data
        assert "enabled" in data
        assert "max_tokens" in data
        assert "temperature" in data
        print(f"✓ GET /api/admin/openai/config - api_key_set={data['api_key_set']}, model={data['model']}")
    
    def test_save_openai_config(self):
        """POST /api/admin/openai/config - should save config"""
        response = requests.post(
            f"{BASE_URL}/api/admin/openai/config",
            headers=self.auth_headers(),
            json={
                "api_key": "KEEP_EXISTING",
                "model": "gpt-4.1-nano",
                "enabled": True,
                "max_tokens": 150,
                "temperature": 0.7
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✓ POST /api/admin/openai/config - config saved")
    
    def test_test_openai_connection(self):
        """POST /api/admin/openai/test - should test connection"""
        response = requests.post(f"{BASE_URL}/api/admin/openai/test", headers=self.auth_headers())
        assert response.status_code == 200
        data = response.json()
        # Connection might succeed or fail depending on API key, but endpoint should return valid response
        assert "success" in data
        if data.get("success"):
            print(f"✓ POST /api/admin/openai/test - connection successful, model={data.get('model')}")
        else:
            print(f"✓ POST /api/admin/openai/test - returned error: {data.get('error')}")


class TestMerchantReferredUsersAPI:
    """Test Merchant Referred Users endpoints"""
    merchant_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as merchant before each test"""
        if not TestMerchantReferredUsersAPI.merchant_token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "test@test.com",
                "password": "test123"
            })
            assert response.status_code == 200
            TestMerchantReferredUsersAPI.merchant_token = response.json().get("token")
        yield
    
    def auth_headers(self):
        return {"Authorization": f"Bearer {TestMerchantReferredUsersAPI.merchant_token}", "Content-Type": "application/json"}
    
    def test_get_referred_users(self):
        """GET /api/merchant/referred-users - should return referred users"""
        response = requests.get(f"{BASE_URL}/api/merchant/referred-users", headers=self.auth_headers())
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "total_users" in data
        assert "total_transactions" in data
        assert "total_rewards" in data
        print(f"✓ GET /api/merchant/referred-users - {data['total_users']} referred users")
    
    def test_referred_users_no_sensitive_data(self):
        """GET /api/merchant/referred-users - should NOT contain phone, wallet_balance, qr_code"""
        response = requests.get(f"{BASE_URL}/api/merchant/referred-users", headers=self.auth_headers())
        assert response.status_code == 200
        data = response.json()
        
        for user in data["users"]:
            # User should only have: id, full_name, email, created_at, is_active, is_blocked, transactions_count, referral_date, reward_amount
            assert "phone" not in user, f"Phone should not be exposed: {user}"
            assert "wallet_balance" not in user, f"Wallet balance should not be exposed: {user}"
            assert "qr_code" not in user, f"QR code should not be exposed: {user}"
            assert "password_hash" not in user, f"Password hash should not be exposed: {user}"
        
        print(f"✓ Merchant referred users - no sensitive data (phone/wallet/qr) exposed")
    
    def test_referred_users_search(self):
        """GET /api/merchant/referred-users?search=test - should filter by search"""
        response = requests.get(f"{BASE_URL}/api/merchant/referred-users?search=test", headers=self.auth_headers())
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        print(f"✓ GET /api/merchant/referred-users?search=test - search working")


class TestSecurityAccessControl:
    """Test that non-admin/non-merchant users cannot access protected endpoints"""
    regular_token = None
    merchant_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as regular user and merchant"""
        # Login as regular user
        if not TestSecurityAccessControl.regular_token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "luca.bianchi@test.com",
                "password": "test123"
            })
            if response.status_code == 200:
                TestSecurityAccessControl.regular_token = response.json().get("token")
        
        # Login as merchant (not admin)
        if not TestSecurityAccessControl.merchant_token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "test@test.com",
                "password": "test123"
            })
            if response.status_code == 200:
                TestSecurityAccessControl.merchant_token = response.json().get("token")
        yield
    
    def test_regular_user_cannot_access_admin_users(self):
        """Non-admin users should get 403 on admin endpoints"""
        if not TestSecurityAccessControl.regular_token:
            pytest.skip("Regular user login failed")
        
        headers = {"Authorization": f"Bearer {TestSecurityAccessControl.regular_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 403
        print(f"✓ Regular user blocked from /api/admin/users (403)")
    
    def test_regular_user_cannot_access_admin_openai(self):
        """Non-admin users should get 403 on admin openai endpoints"""
        if not TestSecurityAccessControl.regular_token:
            pytest.skip("Regular user login failed")
        
        headers = {"Authorization": f"Bearer {TestSecurityAccessControl.regular_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/openai/config", headers=headers)
        assert response.status_code == 403
        print(f"✓ Regular user blocked from /api/admin/openai/config (403)")
    
    def test_merchant_cannot_access_admin_endpoints(self):
        """Merchants without is_admin should get 403 on admin endpoints"""
        if not TestSecurityAccessControl.merchant_token:
            pytest.skip("Merchant login failed")
        
        headers = {"Authorization": f"Bearer {TestSecurityAccessControl.merchant_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        # Merchant might also be admin, so check actual response
        # test@test.com is NOT admin, only merchant
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Merchant (non-admin) blocked from /api/admin/users (403)")
    
    def test_regular_user_cannot_access_merchant_referred_users(self):
        """Non-merchant users should get 403 on merchant endpoints"""
        if not TestSecurityAccessControl.regular_token:
            pytest.skip("Regular user login failed")
        
        # First check if this user is actually a merchant (seed data may vary)
        headers = {"Authorization": f"Bearer {TestSecurityAccessControl.regular_token}"}
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        if me_response.status_code == 200 and me_response.json().get("is_merchant"):
            pytest.skip("Test user (luca.bianchi@test.com) is actually a merchant in seed data")
        
        response = requests.get(f"{BASE_URL}/api/merchant/referred-users", headers=headers)
        assert response.status_code == 403
        print(f"✓ Regular user blocked from /api/merchant/referred-users (403)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
