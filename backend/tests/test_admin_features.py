"""
Test Admin Features API - Feature Toggles and API Configuration
Tests for /api/admin/features endpoints:
- GET /api/admin/features/public - public endpoint, no auth
- GET /api/admin/features - admin gets all feature toggles
- PUT /api/admin/features - admin updates feature toggles  
- GET /api/admin/features/api-config - admin gets API configurations
- PUT /api/admin/features/api-config/{section} - admin updates API config
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPublicFeatures:
    """Test public features endpoint - no auth required"""
    
    def test_get_public_features_no_auth(self):
        """GET /api/admin/features/public returns feature states without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/features/public")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify all expected features are present
        expected_features = [
            "conto_up", "card_fisica", "sim_100gb", "invita_amici", 
            "tasks", "interessi", "merchant", "gift_cards", "myu_chat", "qr_payments"
        ]
        for feature in expected_features:
            assert feature in data, f"Missing feature: {feature}"
            assert isinstance(data[feature], bool), f"Feature {feature} should be boolean"
        
        print(f"Public features returned: {len(data)} features")
        
    def test_public_features_returns_only_enabled_state(self):
        """Public endpoint returns only enabled state (boolean), not full config"""
        response = requests.get(f"{BASE_URL}/api/admin/features/public")
        assert response.status_code == 200
        
        data = response.json()
        # Should be simple key:bool mapping, not nested objects
        for key, value in data.items():
            assert isinstance(value, bool), f"{key} should be bool, got {type(value)}"
            # Should NOT contain label, category, etc.
            assert not isinstance(value, dict), "Public endpoint should not expose full config"


class TestAdminFeaturesAuth:
    """Test admin features endpoints - auth required"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture
    def user_token(self):
        """Get regular user auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"User login failed: {response.text}"
        return response.json()["token"]
    
    def test_get_features_requires_admin(self, user_token):
        """Non-admin user cannot access GET /api/admin/features"""
        response = requests.get(
            f"{BASE_URL}/api/admin/features",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        assert "admin" in response.json().get("detail", "").lower()
    
    def test_get_features_as_admin(self, admin_token):
        """Admin can access GET /api/admin/features"""
        response = requests.get(
            f"{BASE_URL}/api/admin/features",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "toggles" in data, "Response should contain 'toggles' key"
        
        toggles = data["toggles"]
        # Verify toggle structure has label, category, enabled
        for key, toggle in toggles.items():
            assert "label" in toggle, f"Toggle {key} missing 'label'"
            assert "category" in toggle, f"Toggle {key} missing 'category'"
            assert "enabled" in toggle, f"Toggle {key} missing 'enabled'"
            assert toggle["category"] in ["generale", "fintech", "telefonia"], f"Invalid category for {key}"
            
        print(f"Admin features: {len(toggles)} toggles with full config")
    
    def test_update_features_requires_admin(self, user_token):
        """Non-admin user cannot update features"""
        response = requests.put(
            f"{BASE_URL}/api/admin/features",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"conto_up": False}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin PUT, got {response.status_code}"
    
    def test_update_feature_toggle_as_admin(self, admin_token):
        """Admin can toggle feature on/off and verify persistence"""
        # First get current state
        get_response = requests.get(
            f"{BASE_URL}/api/admin/features",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        original_state = get_response.json()["toggles"]["invita_amici"]["enabled"]
        
        # Toggle to opposite state
        new_state = not original_state
        update_response = requests.put(
            f"{BASE_URL}/api/admin/features",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"invita_amici": new_state}
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify response contains updated toggle
        update_data = update_response.json()
        assert "toggles" in update_data
        assert update_data["toggles"]["invita_amici"]["enabled"] == new_state
        
        # Verify public endpoint reflects change
        public_response = requests.get(f"{BASE_URL}/api/admin/features/public")
        assert public_response.json()["invita_amici"] == new_state
        
        # Restore original state
        requests.put(
            f"{BASE_URL}/api/admin/features",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"invita_amici": original_state}
        )
        print(f"Toggle test passed: invita_amici toggled from {original_state} to {new_state} and back")
    
    def test_update_multiple_toggles(self, admin_token):
        """Admin can update multiple toggles at once"""
        # Get current state
        get_response = requests.get(
            f"{BASE_URL}/api/admin/features",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        toggles = get_response.json()["toggles"]
        original_tasks = toggles["tasks"]["enabled"]
        original_interessi = toggles["interessi"]["enabled"]
        
        # Update both
        update_response = requests.put(
            f"{BASE_URL}/api/admin/features",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "tasks": not original_tasks,
                "interessi": not original_interessi
            }
        )
        assert update_response.status_code == 200
        
        updated = update_response.json()["toggles"]
        assert updated["tasks"]["enabled"] == (not original_tasks)
        assert updated["interessi"]["enabled"] == (not original_interessi)
        
        # Restore
        requests.put(
            f"{BASE_URL}/api/admin/features",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"tasks": original_tasks, "interessi": original_interessi}
        )
        print("Multiple toggle update test passed")


class TestAdminApiConfig:
    """Test API configuration endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture
    def user_token(self):
        """Get regular user auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_api_config_requires_admin(self, user_token):
        """Non-admin cannot access API config"""
        response = requests.get(
            f"{BASE_URL}/api/admin/features/api-config",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403
    
    def test_get_api_config_as_admin(self, admin_token):
        """Admin can get API configurations"""
        response = requests.get(
            f"{BASE_URL}/api/admin/features/api-config",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "configs" in data
        
        configs = data["configs"]
        # Should have telefonia and fintech sections
        assert "telefonia" in configs, "Missing telefonia config"
        assert "fintech" in configs, "Missing fintech config"
        
        # Each config should have expected fields
        for section in ["telefonia", "fintech"]:
            config = configs[section]
            expected_fields = ["label", "provider", "api_key", "api_secret", "endpoint", "enabled", "notes"]
            for field in expected_fields:
                assert field in config, f"{section} missing field: {field}"
        
        print(f"API configs: {list(configs.keys())}")
    
    def test_update_telefonia_config(self, admin_token):
        """Admin can update telefonia API config"""
        # Get current state
        get_response = requests.get(
            f"{BASE_URL}/api/admin/features/api-config",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        original = get_response.json()["configs"]["telefonia"]
        
        # Update with test data
        test_data = {
            "provider": "TestProvider",
            "api_key": "test-api-key-123",
            "api_secret": "test-secret-456",
            "endpoint": "https://api.test.com/v1",
            "enabled": True,
            "notes": "Test configuration"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/admin/features/api-config/telefonia",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_data
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify response
        updated_config = update_response.json()["config"]
        assert updated_config["provider"] == "TestProvider"
        assert updated_config["api_key"] == "test-api-key-123"
        assert updated_config["enabled"] == True
        
        # Verify persistence via GET
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/features/api-config",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        saved_config = verify_response.json()["configs"]["telefonia"]
        assert saved_config["provider"] == "TestProvider"
        
        # Restore original
        requests.put(
            f"{BASE_URL}/api/admin/features/api-config/telefonia",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=original
        )
        print("Telefonia config update test passed")
    
    def test_update_fintech_config(self, admin_token):
        """Admin can update fintech API config"""
        test_data = {
            "provider": "FintechTestProvider",
            "api_key": "fintech-key-789",
            "api_secret": "fintech-secret-012",
            "endpoint": "https://api.fintech.test/v2",
            "enabled": True,
            "notes": "Fintech test notes"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/features/api-config/fintech",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_data
        )
        assert response.status_code == 200
        
        config = response.json()["config"]
        assert config["provider"] == "FintechTestProvider"
        assert config["api_key"] == "fintech-key-789"
        
        # Reset
        requests.put(
            f"{BASE_URL}/api/admin/features/api-config/fintech",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"provider": "", "api_key": "", "api_secret": "", "endpoint": "", "enabled": False, "notes": ""}
        )
        print("Fintech config update test passed")
    
    def test_update_invalid_section_returns_404(self, admin_token):
        """Updating non-existent section returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/admin/features/api-config/invalid_section",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"provider": "Test"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_update_api_config_requires_admin(self, user_token):
        """Non-admin cannot update API config"""
        response = requests.put(
            f"{BASE_URL}/api/admin/features/api-config/telefonia",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"provider": "HackAttempt"}
        )
        assert response.status_code == 403


class TestFeatureToggleIntegration:
    """Test that feature toggles affect user-facing endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "test123"
        })
        return response.json()["token"]
    
    def test_disabled_feature_hidden_in_public(self, admin_token):
        """When admin disables a feature, public endpoint reflects it"""
        # Disable conto_up
        requests.put(
            f"{BASE_URL}/api/admin/features",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"conto_up": False}
        )
        
        # Check public endpoint
        public_response = requests.get(f"{BASE_URL}/api/admin/features/public")
        assert public_response.json()["conto_up"] == False
        
        # Re-enable
        requests.put(
            f"{BASE_URL}/api/admin/features",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"conto_up": True}
        )
        
        # Verify re-enabled
        public_response = requests.get(f"{BASE_URL}/api/admin/features/public")
        assert public_response.json()["conto_up"] == True
        
        print("Feature toggle integration test passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
