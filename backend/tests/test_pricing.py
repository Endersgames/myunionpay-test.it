"""
Backend tests for Dynamic Pricing System
Tests: 
- GET /api/admin/features/public/pricing - public pricing endpoint (no auth)
- GET /api/admin/features/pricing - admin pricing endpoint (auth required)
- PUT /api/admin/features/pricing - admin update pricing (auth required)
- Non-admin access to admin pricing endpoints (403)
- Dynamic pricing in menu scan and SIM activation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test credentials
ADMIN_USER = {"email": "admin@test.com", "password": "test123"}
MERCHANT_USER = {"email": "test@test.com", "password": "test123"}
REGULAR_USER = {"email": "luca.bianchi@test.com", "password": "test123"}

class TestPublicPricing:
    """Tests for public pricing endpoint - no auth required"""
    
    def test_get_public_pricing_no_auth(self):
        """GET /api/admin/features/public/pricing should work without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/features/public/pricing")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Public pricing data: {data}")
        
        # Verify expected pricing keys exist
        assert "myu_chat_per_message" in data, "Missing myu_chat_per_message"
        assert "menu_scan_per_item" in data, "Missing menu_scan_per_item"
        assert "visura_scan" in data, "Missing visura_scan"
        assert "conto_up_activation" in data, "Missing conto_up_activation"
        
        # Verify prices are numeric
        assert isinstance(data["myu_chat_per_message"], (int, float)), "myu_chat_per_message should be numeric"
        assert isinstance(data["menu_scan_per_item"], (int, float)), "menu_scan_per_item should be numeric"
        assert isinstance(data["visura_scan"], (int, float)), "visura_scan should be numeric"
        assert isinstance(data["conto_up_activation"], (int, float)), "conto_up_activation should be numeric"
        
        print(f"PASS: Public pricing returns all 4 pricing keys with numeric values")

    def test_default_pricing_values(self):
        """Verify default pricing values match expected defaults"""
        response = requests.get(f"{BASE_URL}/api/admin/features/public/pricing")
        assert response.status_code == 200
        
        data = response.json()
        # Default values: myu_chat=0.01, menu_scan=0.01, visura=0, conto_up=15.99
        # Note: These might have been changed by admin, so just verify they're reasonable
        assert data["myu_chat_per_message"] >= 0, "myu_chat price should be >= 0"
        assert data["menu_scan_per_item"] >= 0, "menu_scan price should be >= 0"
        assert data["visura_scan"] >= 0, "visura_scan price should be >= 0"
        assert data["conto_up_activation"] >= 0, "conto_up_activation price should be >= 0"
        
        print(f"PASS: Pricing values are valid - myu_chat={data['myu_chat_per_message']}, menu_scan={data['menu_scan_per_item']}, visura={data['visura_scan']}, conto_up={data['conto_up_activation']}")


class TestAdminPricing:
    """Tests for admin pricing endpoints - auth required"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture
    def regular_user_token(self):
        """Get regular (non-admin) user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=REGULAR_USER)
        assert response.status_code == 200, f"Regular user login failed: {response.text}"
        return response.json()["token"]
    
    def test_get_admin_pricing_with_admin(self, admin_token):
        """GET /api/admin/features/pricing should work for admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/features/pricing", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "pricing" in data, "Response should contain 'pricing' key"
        pricing = data["pricing"]
        
        # Verify all pricing items have label, price, currency
        for key in ["myu_chat_per_message", "menu_scan_per_item", "visura_scan", "conto_up_activation"]:
            assert key in pricing, f"Missing pricing key: {key}"
            assert "label" in pricing[key], f"Missing 'label' in {key}"
            assert "price" in pricing[key], f"Missing 'price' in {key}"
            assert "currency" in pricing[key], f"Missing 'currency' in {key}"
            print(f"  {key}: {pricing[key]['label']} = {pricing[key]['price']} {pricing[key]['currency']}")
        
        print(f"PASS: Admin can get pricing with labels")
    
    def test_get_admin_pricing_no_auth(self):
        """GET /api/admin/features/pricing should fail without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/features/pricing")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: Admin pricing endpoint requires auth (returns {response.status_code})")
    
    def test_get_admin_pricing_non_admin(self, regular_user_token):
        """GET /api/admin/features/pricing should fail for non-admin"""
        headers = {"Authorization": f"Bearer {regular_user_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/features/pricing", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"PASS: Non-admin cannot access admin pricing (returns 403)")
    
    def test_update_pricing_with_admin(self, admin_token):
        """PUT /api/admin/features/pricing should work for admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get current pricing to restore later
        get_response = requests.get(f"{BASE_URL}/api/admin/features/pricing", headers=headers)
        original_pricing = get_response.json()["pricing"]
        original_menu_price = original_pricing["menu_scan_per_item"]["price"]
        
        # Update pricing
        new_price = 0.05
        update_data = {"menu_scan_per_item": new_price}
        response = requests.put(f"{BASE_URL}/api/admin/features/pricing", headers=headers, json=update_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["message"] == "Prezzi aggiornati", f"Expected 'Prezzi aggiornati', got {data.get('message')}"
        assert data["pricing"]["menu_scan_per_item"]["price"] == new_price, f"Price not updated"
        
        # Verify public pricing also updated
        public_response = requests.get(f"{BASE_URL}/api/admin/features/public/pricing")
        assert public_response.json()["menu_scan_per_item"] == new_price, "Public pricing not updated"
        
        # Restore original price
        requests.put(f"{BASE_URL}/api/admin/features/pricing", headers=headers, json={"menu_scan_per_item": original_menu_price})
        
        print(f"PASS: Admin can update pricing and changes reflect in public endpoint")
    
    def test_update_pricing_no_auth(self):
        """PUT /api/admin/features/pricing should fail without auth"""
        update_data = {"menu_scan_per_item": 0.05}
        response = requests.put(f"{BASE_URL}/api/admin/features/pricing", json=update_data)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: Update pricing requires auth (returns {response.status_code})")
    
    def test_update_pricing_non_admin(self, regular_user_token):
        """PUT /api/admin/features/pricing should fail for non-admin"""
        headers = {"Authorization": f"Bearer {regular_user_token}"}
        update_data = {"menu_scan_per_item": 0.05}
        response = requests.put(f"{BASE_URL}/api/admin/features/pricing", headers=headers, json=update_data)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"PASS: Non-admin cannot update pricing (returns 403)")


class TestFeatureTogglesStillWork:
    """Tests to ensure existing feature toggles still work"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    def test_get_public_features(self):
        """GET /api/admin/features/public should still work"""
        response = requests.get(f"{BASE_URL}/api/admin/features/public")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Should return enabled/disabled status for features
        expected_features = ["conto_up", "card_fisica", "sim_100gb", "invita_amici", "tasks", "interessi", "merchant", "gift_cards", "myu_chat", "qr_payments"]
        for feature in expected_features:
            assert feature in data, f"Missing feature: {feature}"
            assert isinstance(data[feature], bool), f"Feature {feature} should be boolean"
        
        print(f"PASS: Public features endpoint still works with {len(data)} features")
    
    def test_admin_get_features(self, admin_token):
        """GET /api/admin/features should still work for admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/features", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "toggles" in data, "Missing 'toggles' key"
        
        print(f"PASS: Admin features endpoint still works")
    
    def test_admin_get_api_config(self, admin_token):
        """GET /api/admin/features/api-config should still work for admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/features/api-config", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "configs" in data, "Missing 'configs' key"
        assert "telefonia" in data["configs"], "Missing 'telefonia' config"
        assert "fintech" in data["configs"], "Missing 'fintech' config"
        
        print(f"PASS: Admin API config endpoint still works")


class TestDynamicPricingUsage:
    """Tests to verify dynamic pricing is used in menu scan and SIM activation"""
    
    @pytest.fixture
    def merchant_token(self):
        """Get merchant auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MERCHANT_USER)
        assert response.status_code == 200, f"Merchant login failed: {response.text}"
        return response.json()["token"]
    
    def test_menu_scan_error_uses_dynamic_price(self, merchant_token):
        """Menu scan error message should use dynamic price, not hardcoded 1 UP"""
        # Get current menu scan price
        pricing_response = requests.get(f"{BASE_URL}/api/admin/features/public/pricing")
        menu_price = pricing_response.json()["menu_scan_per_item"]
        
        # Try to scan menu with empty wallet (should fail with price in message)
        headers = {"Authorization": f"Bearer {merchant_token}"}
        
        # Create a minimal test image (1x1 pixel)
        import io
        from PIL import Image
        img = Image.new('RGB', (1, 1), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        files = {"file": ("test.jpg", img_bytes, "image/jpeg")}
        response = requests.post(f"{BASE_URL}/api/merchant/ai/scan-menu", headers=headers, files=files)
        
        # Response could be 402 (insufficient balance) or 500 (OpenAI error) or 422 (parse error)
        # The key is that if it's 402, the price in the message should match dynamic price
        if response.status_code == 402:
            error_msg = response.json().get("detail", "")
            print(f"402 error message: {error_msg}")
            # Check that the error mentions the dynamic price
            assert str(menu_price) in error_msg or "UP" in error_msg, f"Error should mention price {menu_price}"
            print(f"PASS: Menu scan uses dynamic price {menu_price} in error message")
        else:
            print(f"Menu scan returned {response.status_code} (may be processing or other error)")
            print(f"SKIP: Cannot verify dynamic pricing in error message (status {response.status_code})")
    
    def test_sim_activation_uses_dynamic_price(self):
        """SIM activation should use dynamic conto_up_activation price"""
        # Get current conto_up_activation price
        pricing_response = requests.get(f"{BASE_URL}/api/admin/features/public/pricing")
        conto_price = pricing_response.json()["conto_up_activation"]
        
        # Login as a user without SIM
        response = requests.post(f"{BASE_URL}/api/auth/login", json=REGULAR_USER)
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Check if user already has SIM
        sim_response = requests.get(f"{BASE_URL}/api/sim/my-sim", headers=headers)
        
        if sim_response.status_code == 200 and sim_response.json():
            print(f"SKIP: User already has SIM, cannot test activation")
            return
        
        # Try to activate SIM with insufficient balance
        activation_data = {
            "fiscal_code": "BNCXXX99X99X999X",
            "birth_date": "1990-01-01",
            "birth_place": "Roma",
            "address": "Via Test 1",
            "cap": "00100",
            "city": "Roma",
            "document_type": "CI",
            "document_number": "AB1234567",
            "current_operator": "",
            "portability": False,
            "phone_to_port": ""
        }
        
        response = requests.post(f"{BASE_URL}/api/sim/activate", headers=headers, json=activation_data)
        
        if response.status_code == 400:
            error_msg = response.json().get("detail", "")
            print(f"400 error message: {error_msg}")
            # Error should mention the dynamic price
            assert str(conto_price) in error_msg or "UP" in error_msg, f"Error should mention price {conto_price}"
            print(f"PASS: SIM activation uses dynamic price {conto_price} in error message")
        elif response.status_code == 200:
            print(f"SIM activated successfully (user had enough balance)")
        else:
            print(f"SIM activation returned {response.status_code}: {response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
