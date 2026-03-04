"""
Comprehensive Auth Tests for myunionpay-test.it
Tests login robustness: case-insensitivity, email trimming, error messages,
new user registration, and seed script password preservation.
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
ADMIN_EMAIL = "admin@test.com"
TEST_PASSWORD = "test123"


class TestLoginBasic:
    """Basic login functionality tests"""
    
    def test_login_test_user(self):
        """Test login with test@test.com / test123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user_id" in data
        assert len(data["token"]) > 50  # JWT is long
        print(f"✓ Login test@test.com successful, token length: {len(data['token'])}")
    
    def test_login_admin_user(self):
        """Test login with admin@test.com / test123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user_id" in data
        print(f"✓ Login admin@test.com successful")


class TestLoginCaseInsensitivity:
    """Test case-insensitive email login"""
    
    def test_login_uppercase_email(self):
        """Test login with TEST@TEST.COM (all uppercase)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "TEST@TEST.COM",
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Uppercase login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print("✓ Login with TEST@TEST.COM works (case-insensitive)")
    
    def test_login_mixed_case_email(self):
        """Test login with Test@Test.com (mixed case)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "Test@Test.com",
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Mixed case login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print("✓ Login with Test@Test.com works (case-insensitive)")
    
    def test_login_random_case_email(self):
        """Test login with tEsT@tEsT.cOm (random case)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tEsT@tEsT.cOm",
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Random case login failed: {response.text}"
        print("✓ Login with tEsT@tEsT.cOm works (case-insensitive)")


class TestLoginEmailTrimming:
    """Test email trimming - spaces around email should be ignored"""
    
    def test_login_email_with_leading_spaces(self):
        """Test login with '  test@test.com' (leading spaces)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "  test@test.com",
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Leading spaces login failed: {response.text}"
        print("✓ Login with leading spaces works")
    
    def test_login_email_with_trailing_spaces(self):
        """Test login with 'test@test.com  ' (trailing spaces)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com  ",
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Trailing spaces login failed: {response.text}"
        print("✓ Login with trailing spaces works")
    
    def test_login_email_with_both_spaces(self):
        """Test login with ' test@test.com ' (spaces on both sides)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": " test@test.com ",
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Both spaces login failed: {response.text}"
        print("✓ Login with spaces on both sides works")


class TestLoginErrorMessages:
    """Test specific error messages for different failure cases (Italian)"""
    
    def test_wrong_password_error_message(self):
        """Test wrong password returns 401 with 'password errata' message"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": "wrongpassword123"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        assert "password errata" in data["detail"].lower(), f"Expected 'password errata' in error, got: {data['detail']}"
        print(f"✓ Wrong password returns: {data['detail']}")
    
    def test_nonexistent_user_error_message(self):
        """Test non-existent email returns 401 with 'utente non trovato' message"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent_user_xyz123@test.com",
            "password": TEST_PASSWORD
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        assert "utente non trovato" in data["detail"].lower(), f"Expected 'utente non trovato' in error, got: {data['detail']}"
        print(f"✓ Non-existent user returns: {data['detail']}")


class TestDiagnosticEndpoints:
    """Test diagnostic endpoints for debugging auth issues"""
    
    def test_verify_login_test_endpoint(self):
        """Test GET /api/auth/verify-login-test returns OK status"""
        response = requests.get(f"{BASE_URL}/api/auth/verify-login-test")
        assert response.status_code == 200, f"Diagnostic endpoint failed: {response.text}"
        data = response.json()
        assert "status" in data
        assert data["status"] == "OK", f"Expected status OK, got: {data['status']}"
        assert "password_verifies" in data
        assert data["password_verifies"] == True, f"Password should verify: {data}"
        assert "email" in data
        assert data["email"] == TEST_EMAIL
        assert "hash_is_bcrypt" in data
        assert data["hash_is_bcrypt"] == True
        print(f"✓ verify-login-test: status={data['status']}, password_verifies={data['password_verifies']}")
    
    def test_debug_users_endpoint(self):
        """Test GET /api/auth/debug-users returns user list with valid bcrypt hashes"""
        response = requests.get(f"{BASE_URL}/api/auth/debug-users")
        assert response.status_code == 200, f"Debug users endpoint failed: {response.text}"
        data = response.json()
        assert "total" in data
        assert "users" in data
        assert isinstance(data["users"], list)
        assert data["total"] > 0, "Should have at least some users"
        
        # Verify all users have valid bcrypt hashes
        invalid_users = []
        for user in data["users"]:
            if not user.get("hash_valid_bcrypt"):
                invalid_users.append(user.get("email"))
        
        assert len(invalid_users) == 0, f"Users with invalid bcrypt: {invalid_users}"
        print(f"✓ debug-users: {data['total']} users, all with valid bcrypt hashes")


class TestRegistrationAndLogin:
    """Test new user registration then login flow"""
    
    @pytest.fixture(scope="class")
    def unique_user(self):
        """Generate unique user credentials for test"""
        unique_id = str(uuid.uuid4())[:8]
        return {
            "email": f"TEST_newuser_{unique_id}@test.com",
            "password": "newpass123",
            "phone": f"+393{unique_id}123",
            "full_name": "Test New User"
        }
    
    def test_register_new_user(self, unique_user):
        """Register a new user and verify response"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_user["email"],
            "password": unique_user["password"],
            "phone": unique_user["phone"],
            "full_name": unique_user["full_name"]
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user_id" in data
        print(f"✓ Registered new user: {unique_user['email']}")
        return data
    
    def test_login_with_newly_registered_user(self, unique_user):
        """Login with the newly registered user"""
        # First register
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_user["email"].replace("TEST_", "TEST2_"),  # Different email
            "password": unique_user["password"],
            "phone": unique_user["phone"].replace("393", "394"),
            "full_name": unique_user["full_name"]
        })
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        
        # Then login
        login_email = unique_user["email"].replace("TEST_", "TEST2_")
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": login_email,
            "password": unique_user["password"]
        })
        assert login_response.status_code == 200, f"Login after registration failed: {login_response.text}"
        data = login_response.json()
        assert "token" in data
        print(f"✓ Login with newly registered user works: {login_email}")


class TestSeedUserPasswordPreservation:
    """
    Test that seed script does NOT reset passwords for newly registered users.
    This tests the fix where seed_test_data() only updates SEED_EMAILS list users.
    """
    
    def test_seed_user_has_working_password(self):
        """Verify seed users (test@test.com, admin@test.com) can still login"""
        # Test user from seed
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Seed user login failed: {response.text}"
        print(f"✓ Seed user {TEST_EMAIL} can login with test123")
        
        # Admin user from seed
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Admin seed user login failed: {response.text}"
        print(f"✓ Seed admin {ADMIN_EMAIL} can login with test123")
    
    def test_verify_bcrypt_hashes_are_valid(self):
        """Verify all users have valid bcrypt hashes (not corrupted)"""
        response = requests.get(f"{BASE_URL}/api/auth/debug-users")
        assert response.status_code == 200
        data = response.json()
        
        # Check all users have valid bcrypt
        for user in data["users"]:
            email = user.get("email", "unknown")
            assert user.get("hash_valid_bcrypt") == True, f"Invalid bcrypt for {email}"
            assert user.get("hash_length") == 60, f"Wrong hash length for {email}: {user.get('hash_length')}"
        
        print(f"✓ All {data['total']} users have valid bcrypt hashes")


class TestAuthMeEndpoint:
    """Test authenticated /auth/me endpoint"""
    
    def test_get_me_with_valid_token(self):
        """Test GET /auth/me returns user data with valid token"""
        # Login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Get user info
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response.status_code == 200, f"GET /auth/me failed: {me_response.text}"
        data = me_response.json()
        assert "id" in data
        assert "email" in data
        assert data["email"] == TEST_EMAIL
        assert "qr_code" in data
        assert "full_name" in data
        print(f"✓ GET /auth/me returns user: {data['full_name']} ({data['email']})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
