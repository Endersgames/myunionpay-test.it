# Image Testing Playbook for Merchant AI Features

## Overview
The merchant AI features (upload-visura, scan-menu) require image files for actual processing. Since we should NOT test with real images in automated tests (to avoid OpenAI costs), we only test:
1. Authentication validation
2. Merchant status validation  
3. File type validation (reject non-images)
4. Error handling
5. UI presence

## Test Users
- **Merchant User**: test@test.com / test123 (has merchant: Trattoria da Mario, category: Ristorante)
- **Admin User**: admin@test.com / test123 (is_admin but can test non-merchant access)
- **Regular User**: luca.bianchi@test.com / test123

## Backend API Tests

### 1. POST /api/merchant/ai/upload-visura
```bash
API_URL="https://payments-assistant.preview.emergentagent.com"

# Get merchant token
TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}' | jq -r '.token')

# Test 1: Reject non-image file
echo "test text" > /tmp/test.txt
curl -s -X POST "$API_URL/api/merchant/ai/upload-visura" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test.txt"
# Expected: 400 - Solo immagini sono accettate

# Test 2: Without auth
curl -s -X POST "$API_URL/api/merchant/ai/upload-visura" \
  -F "file=@/tmp/test.txt"
# Expected: 401 - Unauthorized
```

### 2. POST /api/merchant/ai/scan-menu
```bash
# Test 1: Reject non-image file
curl -s -X POST "$API_URL/api/merchant/ai/scan-menu" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test.txt"
# Expected: 400 - Solo immagini sono accettate

# Test 2: Check UP balance requirement
# The endpoint checks wallet balance >= 1 UP before processing
```

### 3. Non-merchant Access (403)
```bash
# Get regular user token
REG_TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"luca.bianchi@test.com","password":"test123"}' | jq -r '.token')

# Test upload-visura as non-merchant
curl -s -X POST "$API_URL/api/merchant/ai/upload-visura" \
  -H "Authorization: Bearer $REG_TOKEN" \
  -F "file=@/tmp/test.txt"
# Expected: 403 - Non sei un merchant

# Test scan-menu as non-merchant  
curl -s -X POST "$API_URL/api/merchant/ai/scan-menu" \
  -H "Authorization: Bearer $REG_TOKEN" \
  -F "file=@/tmp/test.txt"
# Expected: 403 - Non sei un merchant
```

## Frontend UI Tests

### Merchant Dashboard (test@test.com)
1. Login as merchant
2. Navigate to /merchant-dashboard
3. Verify presence of:
   - Visura Camerale section with upload area (`data-testid="visura-upload"`)
   - Scansiona Menu section with 1UP/piatto badge (`data-testid="menu-scan-upload"`)
   - Wallet balance display
   - QR Code section
   - "Gestisci Menu" button (for Ristorante category)
   - "Invia Notifica Profilata" button
   - "Utenti Presentati" button

## DO NOT TEST
- Actual image upload and AI processing (costs money)
- Real visura extraction
- Real menu scanning

## Test Coverage Goals
- Backend validation: 100%
- Frontend UI presence: 100%
- AI processing: 0% (manual testing only)
