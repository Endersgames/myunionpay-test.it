"""
Google Authentication API Tests
Tests for:
- POST /api/auth/google/callback - Exchange session_id for token (existing users) or user info (new users)
- POST /api/auth/google/complete - Complete registration for new Google users with phone number
- Existing login/register regression tests
"""

import pytest
import requests
import os
import random
import string


BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestGoogleAuthCallback:
    """Tests for POST /api/auth/google/callback endpoint"""

    def test_callback_missing_session_id(self):
        """Should return 400 when session_id is missing"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/callback",
            json={},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "session_id" in data.get("detail", "").lower() or "mancante" in data.get("detail", "").lower()
        print(f"PASS: Missing session_id returns 400 - {data.get('detail')}")

    def test_callback_invalid_session_id(self):
        """Should return 401 for invalid session_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/callback",
            json={"session_id": "invalid_test_session_12345"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "non valida" in data.get("detail", "").lower() or "invalid" in data.get("detail", "").lower()
        print(f"PASS: Invalid session_id returns 401 - {data.get('detail')}")

    def test_callback_empty_session_id(self):
        """Should return 400 when session_id is empty string"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/callback",
            json={"session_id": ""},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        print(f"PASS: Empty session_id returns 400")


class TestGoogleAuthComplete:
    """Tests for POST /api/auth/google/complete endpoint"""

    def test_complete_missing_session_id(self):
        """Should return 400 when session_id is missing"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/complete",
            json={"phone": "+39 333 1234567"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "session_id" in data.get("detail", "").lower() or "mancante" in data.get("detail", "").lower()
        print(f"PASS: Missing session_id returns 400 - {data.get('detail')}")

    def test_complete_missing_phone(self):
        """Should return 400 when phone is missing"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/complete",
            json={"session_id": "test_session_123"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "telefono" in data.get("detail", "").lower() or "phone" in data.get("detail", "").lower() or "obbligatorio" in data.get("detail", "").lower()
        print(f"PASS: Missing phone returns 400 - {data.get('detail')}")

    def test_complete_empty_phone(self):
        """Should return 400 when phone is empty"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/complete",
            json={"session_id": "test_session_123", "phone": ""},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "telefono" in data.get("detail", "").lower() or "obbligatorio" in data.get("detail", "").lower()
        print(f"PASS: Empty phone returns 400 - {data.get('detail')}")

    def test_complete_whitespace_phone(self):
        """Should return 400 when phone is only whitespace"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/complete",
            json={"session_id": "test_session_123", "phone": "   "},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        print(f"PASS: Whitespace phone returns 400")

    def test_complete_invalid_session(self):
        """Should return 401 for invalid session_id (valid phone but invalid session)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/complete",
            json={"session_id": "invalid_session_xyz", "phone": "+39 333 9876543"},
            headers={"Content-Type": "application/json"}
        )
        # Could be 400 or 401 depending on validation order
        assert response.status_code in [400, 401]
        print(f"PASS: Invalid session with valid phone returns {response.status_code}")


class TestExistingAuthRegression:
    """Regression tests for existing email/password authentication"""

    def test_login_valid_credentials(self):
        """Test login with test@test.com / test123"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "test123"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user_id" in data
        assert len(data["token"]) > 0
        print(f"PASS: Login successful - user_id: {data['user_id']}")

    def test_login_invalid_password(self):
        """Test login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "wrongpassword"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401
        print(f"PASS: Wrong password returns 401")

    def test_login_nonexistent_user(self):
        """Test login with non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent@test.com", "password": "test123"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401
        print(f"PASS: Non-existent user returns 401")

    def test_register_new_user(self):
        """Test registration creates new user and returns token"""
        random_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        test_email = f"test_reg_{random_id}@example.com"
        test_phone = f"+39 333 {random.randint(1000000, 9999999)}"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "phone": test_phone,
                "full_name": "Test Registration User",
                "password": "testpass123"
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user_id" in data
        print(f"PASS: Registration successful - user_id: {data['user_id']}, email: {test_email}")

    def test_register_duplicate_email(self):
        """Test registration fails for duplicate email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": "test@test.com",  # Already exists
                "phone": "+39 333 0000001",
                "full_name": "Duplicate Test",
                "password": "testpass123"
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "già registrat" in data.get("detail", "").lower() or "already" in data.get("detail", "").lower()
        print(f"PASS: Duplicate email returns 400 - {data.get('detail')}")

    def test_get_me_with_valid_token(self):
        """Test /auth/me returns user data with valid token"""
        # First login to get token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "test123"},
            headers={"Content-Type": "application/json"}
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Then get user info
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert data["email"] == "test@test.com"
        print(f"PASS: /auth/me returns user data - email: {data['email']}")

    def test_get_me_without_token(self):
        """Test /auth/me returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403, 422]
        print(f"PASS: /auth/me without token returns {response.status_code}")


class TestHealthCheck:
    """Basic health check tests"""

    def test_health_endpoint(self):
        """Test health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"PASS: Health check returns healthy")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
