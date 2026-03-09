# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('app_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  phone: '+39 333 9999999',
  full_name: 'Test Google User',
  password_hash: '',
  google_auth: true,
  qr_code: 'MYUTEST123',
  referral_code: 'MYUTEST123',
  up_points: 0,
  profile_tags: [],
  is_merchant: false,
  created_at: new Date().toISOString()
});
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API
```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

# Test google callback
curl -X POST "$API_URL/api/auth/google/callback" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test_invalid"}'

# Test google complete
curl -X POST "$API_URL/api/auth/google/complete" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test_invalid", "phone": "+39 333 0000000"}'
```

## Step 3: Browser Testing
```python
# Set auth token and navigate
await page.evaluate("localStorage.setItem('auth_token', 'YOUR_TOKEN')")
await page.goto("https://your-app.com/dashboard")
```

## Checklist
- [ ] Google button visible on Login page
- [ ] Google button visible on Register page
- [ ] Clicking Google button redirects to auth.emergentagent.com
- [ ] After Google auth, callback processes session_id
- [ ] Existing user logs in directly
- [ ] New user sees phone number form
- [ ] Phone validation works
- [ ] New user registration completes with phone
- [ ] JWT token is set after auth
- [ ] Dashboard loads after auth
