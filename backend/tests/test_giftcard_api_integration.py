"""
Gift Card API Integration Tests
Tests for the NEW gift card admin API config and brand API call feature.
Features tested:
- POST /api/giftcards/admin/create - Admin creates new gift card
- PUT /api/giftcards/admin/{id}/api-config - Admin configures brand API
- POST /api/giftcards/admin/{id}/test-api - Admin tests brand API
- POST /api/giftcards/purchase - User purchase with activation code
- GET /api/giftcards/admin/all - List cards with api_configured field
- POST /api/giftcards/link-card - Link credit card for payment
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "test123"
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "test123"

# Test brand name to track our test cards
TEST_BRAND_NAME = f"TEST_Brand_{uuid.uuid4().hex[:8]}"

class TestGiftCardAdminCreate:
    """Admin gift card creation tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Login as admin and return token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture
    def user_token(self):
        """Login as regular user and return token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"User login failed: {response.text}"
        return response.json()["token"]
    
    def test_admin_create_giftcard(self, admin_token):
        """Test POST /api/giftcards/admin/create - Admin creates new gift card"""
        response = requests.post(
            f"{BASE_URL}/api/giftcards/admin/create",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "brand": TEST_BRAND_NAME,
                "category": "Elettronica",
                "cashback_percent": 2.5,
                "logo_color": "#FF5500",
                "available_amounts": [10, 25, 50, 100]
            }
        )
        assert response.status_code == 200, f"Create gift card failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Missing 'id' in response"
        assert data["brand"] == TEST_BRAND_NAME, "Brand name mismatch"
        assert data["category"] == "Elettronica", "Category mismatch"
        assert data["cashback_percent"] == 2.5, "Cashback mismatch"
        assert data["available_amounts"] == [10, 25, 50, 100], "Amounts mismatch"
        assert data.get("api_configured") == False, "New card should have api_configured=False"
        
        print(f"✓ POST /api/giftcards/admin/create - Created '{TEST_BRAND_NAME}' with id={data['id'][:8]}...")
        return data["id"]
    
    def test_admin_create_giftcard_non_admin_fails(self, user_token):
        """Test POST /api/giftcards/admin/create - Non-admin should fail"""
        response = requests.post(
            f"{BASE_URL}/api/giftcards/admin/create",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "brand": "ShouldFail",
                "category": "Shopping online",
                "cashback_percent": 1.0
            }
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ POST /api/giftcards/admin/create - Non-admin gets 403")
    
    def test_admin_create_giftcard_without_auth(self):
        """Test POST /api/giftcards/admin/create - No auth should fail"""
        response = requests.post(
            f"{BASE_URL}/api/giftcards/admin/create",
            json={
                "brand": "ShouldFail",
                "category": "Shopping online",
                "cashback_percent": 1.0
            }
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ POST /api/giftcards/admin/create - No auth gets 401/403")


class TestGiftCardAdminApiConfig:
    """Admin API configuration tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Login as admin and return token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture
    def test_card_id(self, admin_token):
        """Create a test gift card and return its ID"""
        response = requests.post(
            f"{BASE_URL}/api/giftcards/admin/create",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "brand": f"APITest_{uuid.uuid4().hex[:8]}",
                "category": "Intrattenimento",
                "cashback_percent": 3.0,
                "available_amounts": [20, 50]
            }
        )
        assert response.status_code == 200
        return response.json()["id"]
    
    def test_admin_update_api_config(self, admin_token, test_card_id):
        """Test PUT /api/giftcards/admin/{id}/api-config - Configure brand API"""
        response = requests.put(
            f"{BASE_URL}/api/giftcards/admin/{test_card_id}/api-config",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "api_endpoint": "https://httpbin.org/post",
                "api_key": "test-api-key-123",
                "api_method": "POST",
                "api_headers": '{"X-Partner-Id": "test-partner"}',
                "api_body_template": '{"amount": {amount}, "email": "{email}", "brand": "{brand}"}'
            }
        )
        assert response.status_code == 200, f"API config update failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Expected success=True"
        assert data.get("api_configured") == True, "Expected api_configured=True"
        
        print(f"✓ PUT /api/giftcards/admin/{test_card_id[:8]}../api-config - API configured")
        return test_card_id
    
    def test_admin_update_api_config_missing_fields(self, admin_token, test_card_id):
        """Test PUT /api/giftcards/admin/{id}/api-config - Missing required fields"""
        # Missing api_key
        response = requests.put(
            f"{BASE_URL}/api/giftcards/admin/{test_card_id}/api-config",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "api_endpoint": "https://httpbin.org/post"
            }
        )
        # Should fail validation (422) because api_key is required
        assert response.status_code == 422, f"Expected 422 for missing api_key, got {response.status_code}"
        print("✓ PUT /api/giftcards/admin/../api-config - Missing api_key returns 422")
    
    def test_admin_update_api_config_card_not_found(self, admin_token):
        """Test PUT /api/giftcards/admin/{id}/api-config - Card not found"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.put(
            f"{BASE_URL}/api/giftcards/admin/{fake_id}/api-config",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "api_endpoint": "https://httpbin.org/post",
                "api_key": "test-key"
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ PUT /api/giftcards/admin/{invalid_id}/api-config - Returns 404")


class TestGiftCardAdminTestApi:
    """Admin API testing endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Login as admin and return token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture
    def configured_card_id(self, admin_token):
        """Create a gift card with API config and return its ID"""
        # Create card
        create_resp = requests.post(
            f"{BASE_URL}/api/giftcards/admin/create",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "brand": f"TestAPI_{uuid.uuid4().hex[:8]}",
                "category": "Shopping online",
                "cashback_percent": 1.5,
                "available_amounts": [25, 50]
            }
        )
        assert create_resp.status_code == 200
        card_id = create_resp.json()["id"]
        
        # Configure API
        config_resp = requests.put(
            f"{BASE_URL}/api/giftcards/admin/{card_id}/api-config",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "api_endpoint": "https://httpbin.org/post",
                "api_key": "test-key-for-testing",
                "api_method": "POST",
                "api_body_template": '{"amount": {amount}, "test": true}'
            }
        )
        assert config_resp.status_code == 200
        return card_id
    
    def test_admin_test_api_success(self, admin_token, configured_card_id):
        """Test POST /api/giftcards/admin/{id}/test-api - Test configured API"""
        response = requests.post(
            f"{BASE_URL}/api/giftcards/admin/{configured_card_id}/test-api",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Test API failed: {response.text}"
        data = response.json()
        
        assert "brand" in data, "Missing 'brand' in response"
        assert "api_status" in data, "Missing 'api_status' in response"
        assert "raw_response" in data, "Missing 'raw_response' in response"
        # httpbin.org/post should return success
        assert data["api_status"] == "success", f"Expected success, got {data['api_status']}"
        
        print(f"✓ POST /api/giftcards/admin/{configured_card_id[:8]}../test-api - Status: {data['api_status']}")
    
    def test_admin_test_api_not_configured(self, admin_token):
        """Test POST /api/giftcards/admin/{id}/test-api - API not configured"""
        # Create card WITHOUT configuring API
        create_resp = requests.post(
            f"{BASE_URL}/api/giftcards/admin/create",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "brand": f"NoAPI_{uuid.uuid4().hex[:8]}",
                "category": "Altro",
                "cashback_percent": 1.0,
                "available_amounts": [25]
            }
        )
        card_id = create_resp.json()["id"]
        
        # Try to test API - should fail
        response = requests.post(
            f"{BASE_URL}/api/giftcards/admin/{card_id}/test-api",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ POST /api/giftcards/admin/../test-api - Unconfigured API returns 400")
    
    def test_admin_test_api_card_not_found(self, admin_token):
        """Test POST /api/giftcards/admin/{id}/test-api - Card not found"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.post(
            f"{BASE_URL}/api/giftcards/admin/{fake_id}/test-api",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ POST /api/giftcards/admin/{invalid_id}/test-api - Returns 404")


class TestGiftCardAdminGetAll:
    """Admin get all cards with api_configured field"""
    
    @pytest.fixture
    def admin_token(self):
        """Login as admin and return token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_admin_get_all_giftcards(self, admin_token):
        """Test GET /api/giftcards/admin/all - Returns all cards with api_configured"""
        response = requests.get(
            f"{BASE_URL}/api/giftcards/admin/all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Get all cards failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list response"
        assert len(data) > 0, "Expected at least one card"
        
        # Check that all cards have api_configured field
        for card in data:
            assert "id" in card, "Missing 'id' in card"
            assert "brand" in card, "Missing 'brand' in card"
            assert "api_configured" in card, f"Missing 'api_configured' in card {card.get('brand')}"
            assert isinstance(card["api_configured"], bool), "api_configured should be boolean"
        
        # Count configured vs not configured
        configured = sum(1 for c in data if c["api_configured"])
        not_configured = len(data) - configured
        print(f"✓ GET /api/giftcards/admin/all - {len(data)} cards ({configured} with API, {not_configured} without)")
    
    def test_admin_get_all_giftcards_non_admin_fails(self):
        """Test GET /api/giftcards/admin/all - Non-admin should fail"""
        # Login as regular user
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        user_token = login_resp.json()["token"]
        
        response = requests.get(
            f"{BASE_URL}/api/giftcards/admin/all",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ GET /api/giftcards/admin/all - Non-admin gets 403")


class TestGiftCardPurchaseWithActivationCode:
    """Gift card purchase with brand API call tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture
    def user_token(self):
        """Login as regular user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture
    def user_with_linked_card(self, user_token):
        """Link a credit card to user for payment"""
        # First try to unlink any existing card
        requests.delete(
            f"{BASE_URL}/api/giftcards/unlink-card",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # Link new card
        response = requests.post(
            f"{BASE_URL}/api/giftcards/link-card",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "card_number": "4111111111111111",
                "expiry": "12/28",
                "cvv": "123",
                "holder_name": "Test User"
            }
        )
        assert response.status_code == 200, f"Link card failed: {response.text}"
        return user_token
    
    @pytest.fixture
    def configured_purchasable_card(self, admin_token):
        """Create a gift card with API config for purchase testing"""
        # Create card
        create_resp = requests.post(
            f"{BASE_URL}/api/giftcards/admin/create",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "brand": f"PurchaseTest_{uuid.uuid4().hex[:8]}",
                "category": "Elettronica",
                "cashback_percent": 2.0,
                "available_amounts": [10, 25, 50]
            }
        )
        assert create_resp.status_code == 200
        card = create_resp.json()
        
        # Configure API using httpbin.org/post
        config_resp = requests.put(
            f"{BASE_URL}/api/giftcards/admin/{card['id']}/api-config",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "api_endpoint": "https://httpbin.org/post",
                "api_key": "test-purchase-key",
                "api_method": "POST",
                "api_body_template": '{"amount": {amount}, "currency": "EUR", "email": "{email}"}'
            }
        )
        assert config_resp.status_code == 200
        return card
    
    def test_purchase_giftcard_with_linked_card(self, user_with_linked_card, configured_purchasable_card):
        """Test POST /api/giftcards/purchase - Purchase with linked card, get activation code"""
        response = requests.post(
            f"{BASE_URL}/api/giftcards/purchase",
            headers={"Authorization": f"Bearer {user_with_linked_card}"},
            json={
                "giftcard_id": configured_purchasable_card["id"],
                "amount": 25,
                "payment_method": "linked_card"
            }
        )
        assert response.status_code == 200, f"Purchase failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Missing 'id' in purchase response"
        assert "brand" in data, "Missing 'brand' in purchase response"
        assert "amount" in data, "Missing 'amount' in purchase response"
        assert data["amount"] == 25, "Amount mismatch"
        assert "cashback_earned" in data, "Missing 'cashback_earned'"
        assert data["cashback_earned"] == 0.5, f"Expected 0.5 cashback, got {data['cashback_earned']}"
        
        # Check for activation code fields
        assert "activation_code" in data, "Missing 'activation_code' in response"
        assert "api_response" in data, "Missing 'api_response' in response"
        assert "api_status" in data, "Missing 'api_status' in response"
        assert data["api_status"] == "success", f"Expected api_status=success, got {data['api_status']}"
        
        # activation_code should contain something from httpbin response
        assert data["activation_code"] is not None, "activation_code should not be None for configured API"
        
        print(f"✓ POST /api/giftcards/purchase - Brand: {data['brand']}, Amount: {data['amount']}EUR")
        print(f"  Cashback: {data['cashback_earned']}UP, API Status: {data['api_status']}")
        print(f"  Activation Code: {data['activation_code'][:50]}...")
    
    def test_purchase_giftcard_invalid_amount(self, user_with_linked_card, configured_purchasable_card):
        """Test POST /api/giftcards/purchase - Invalid amount should fail"""
        response = requests.post(
            f"{BASE_URL}/api/giftcards/purchase",
            headers={"Authorization": f"Bearer {user_with_linked_card}"},
            json={
                "giftcard_id": configured_purchasable_card["id"],
                "amount": 999,  # Not in available_amounts
                "payment_method": "linked_card"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ POST /api/giftcards/purchase - Invalid amount returns 400")
    
    def test_purchase_giftcard_invalid_payment_method(self, user_token, configured_purchasable_card):
        """Test POST /api/giftcards/purchase - Invalid payment method should fail"""
        response = requests.post(
            f"{BASE_URL}/api/giftcards/purchase",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "giftcard_id": configured_purchasable_card["id"],
                "amount": 25,
                "payment_method": "bitcoin"  # Invalid
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ POST /api/giftcards/purchase - Invalid payment method returns 400")
    
    def test_purchase_giftcard_not_found(self, user_with_linked_card):
        """Test POST /api/giftcards/purchase - Card not found"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.post(
            f"{BASE_URL}/api/giftcards/purchase",
            headers={"Authorization": f"Bearer {user_with_linked_card}"},
            json={
                "giftcard_id": fake_id,
                "amount": 25,
                "payment_method": "linked_card"
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ POST /api/giftcards/purchase - Invalid card ID returns 404")


class TestLinkCard:
    """Credit card linking tests"""
    
    @pytest.fixture
    def user_token(self):
        """Login as regular user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_link_card_success(self, user_token):
        """Test POST /api/giftcards/link-card - Link credit card"""
        # First unlink any existing
        requests.delete(
            f"{BASE_URL}/api/giftcards/unlink-card",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        response = requests.post(
            f"{BASE_URL}/api/giftcards/link-card",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "card_number": "5500000000000004",  # Mastercard test
                "expiry": "06/29",
                "cvv": "456",
                "holder_name": "Test Cardholder"
            }
        )
        assert response.status_code == 200, f"Link card failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Missing 'id'"
        assert "last_four" in data, "Missing 'last_four'"
        assert data["last_four"] == "0004", f"Expected last_four=0004, got {data['last_four']}"
        assert "brand" in data, "Missing 'brand'"
        assert data["brand"] == "Mastercard", f"Expected brand=Mastercard, got {data['brand']}"
        assert "holder_name" in data, "Missing 'holder_name'"
        
        print(f"✓ POST /api/giftcards/link-card - Linked {data['brand']} ****{data['last_four']}")
    
    def test_link_card_invalid_number(self, user_token):
        """Test POST /api/giftcards/link-card - Invalid card number"""
        response = requests.post(
            f"{BASE_URL}/api/giftcards/link-card",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "card_number": "123",  # Too short
                "expiry": "12/25",
                "cvv": "123",
                "holder_name": "Test"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ POST /api/giftcards/link-card - Invalid card number returns 400")
    
    def test_get_linked_card(self, user_token):
        """Test GET /api/giftcards/linked-card - Get linked card"""
        response = requests.get(
            f"{BASE_URL}/api/giftcards/linked-card",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Get linked card failed: {response.text}"
        # Response can be null or card object
        print(f"✓ GET /api/giftcards/linked-card - Returns {'card data' if response.json() else 'null'}")
    
    def test_unlink_card(self, user_token):
        """Test DELETE /api/giftcards/unlink-card - Unlink card"""
        # First link a card
        requests.post(
            f"{BASE_URL}/api/giftcards/link-card",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "card_number": "4111111111111111",
                "expiry": "12/28",
                "cvv": "123",
                "holder_name": "Test"
            }
        )
        
        # Then unlink
        response = requests.delete(
            f"{BASE_URL}/api/giftcards/unlink-card",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Unlink failed: {response.text}"
        print("✓ DELETE /api/giftcards/unlink-card - Card unlinked")


class TestPublicGiftCardEndpoints:
    """Public gift card endpoints (user-facing)"""
    
    @pytest.fixture
    def user_token(self):
        """Login as regular user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_all_active_giftcards(self, user_token):
        """Test GET /api/giftcards - Returns active gift cards"""
        response = requests.get(
            f"{BASE_URL}/api/giftcards",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Get cards failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list response"
        for card in data:
            assert "id" in card
            assert "brand" in card
            assert "cashback_percent" in card
            assert "available_amounts" in card
            # Public endpoint should NOT expose api_endpoint or api_key
            # api_configured might be exposed, but api credentials should not
        
        print(f"✓ GET /api/giftcards - Returns {len(data)} active gift cards")
    
    def test_get_my_purchases(self, user_token):
        """Test GET /api/giftcards/my-purchases - Returns user's purchases"""
        response = requests.get(
            f"{BASE_URL}/api/giftcards/my-purchases",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Get purchases failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list response"
        for purchase in data:
            assert "id" in purchase
            assert "brand" in purchase
            assert "amount" in purchase
            assert "cashback_earned" in purchase
        
        print(f"✓ GET /api/giftcards/my-purchases - Returns {len(data)} purchases")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
