# My Union Pay (Myunionpaytest.it) - PRD

## Descrizione Progetto
App PWA per pagamenti P2P con sistema di wallet digitale, marketplace merchant, notifiche reward, e Conto UP (conto bancario virtuale).

## Stack Tecnologico
- **Frontend**: React 19, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI, MongoDB (pymongo/motor)
- **PWA**: Service Worker, Manifest
- **Auth**: JWT Bearer Token

## Architettura Backend (v2.0 - Refactored)
```
/app/backend/
  server.py          # Entry point - app setup, middleware, router includes
  database.py        # MongoDB connection, config constants (JWT, VAPID, tags, categories)
  models/__init__.py # All Pydantic models (User, Wallet, Transaction, Merchant, etc.)
  routes/
    auth.py          # /auth/register, /auth/login, /auth/me, /auth/verify-login-test, /auth/debug-users
    wallet.py        # /wallet, /wallet/deposit
    payments.py      # /payments/send, /payments/history, /payments/user/{qr}
    merchants.py     # /merchants CRUD, /merchants/categories/list
    notifications.py # /notifications/send, /notifications/me, /notifications/preview
    profile.py       # /profile/tags, /profile/my-tags
    push.py          # /push/vapid-key, /push/subscribe, /push/unsubscribe
    referrals.py     # /referrals/stats
    sim.py           # /sim/* (Conto UP: activate, deposit-eur, bonifico, convert-to-up)
    qr.py            # /qr/referral/{qr_code}
    tasks.py         # /tasks, /tasks/{id}/upload (verifica residenza)
    giftcards.py     # /giftcards, /giftcards/purchase, admin endpoints
  services/
    auth.py          # hash_password, verify_password, create_token, get_current_user, generate_qr_code
    push.py          # send_push_notification
    seed.py          # Seed test data, SEED_EMAILS list (only updates seed users' passwords)
  uploads/           # Uploaded task documents
```

## Funzionalita Implementate
- Auth (registrazione, login con email case-insensitive, JWT)
- Wallet (saldo, deposito, pagamenti P2P)
- QR Code (generazione, scansione, condivisione)
- Merchant (registrazione, marketplace, categorie, dettaglio pubblico)
- Notifiche (profilate per merchant, preview, reward)
- Profilo (tag interessi, referral stats, task)
- Referral (codice = QR code, bonus +1 UP)
- Conto UP (carta virtuale, IBAN, saldo EUR, top-up, bonifico, conversione EUR->UP)
- PWA Install Prompt (aggressivo su scan QR)
- Merchant QR Scan (Menu / Installa ed Ordina / Paga)
- Task Verifica Residenza (upload fattura energia/gas per +5 UP)
- Gift Card con cashback (12 brand)
- Admin Panel Gift Card (admin@test.com gestisce cashback % e on/off per ogni card)
- Endpoint diagnostici auth (/verify-login-test, /debug-users, /fix-passwords)

## Branding
- Nome: **Myunionpaytest.it**
- Primary: #2B7AB8 (Blu)
- Accent: #E85A24 (Arancione)

## Credenziali Test
- Email: test@test.com / Password: test123
- Admin: admin@test.com / Password: test123
- 18 utenti seed, 5 merchant test

## API Endpoints (tutti con prefisso /api)
- POST /api/auth/register, /api/auth/login
- GET /api/auth/me, /api/auth/verify-login-test, /api/auth/debug-users
- POST /api/auth/fix-passwords
- GET /api/wallet, POST /api/wallet/deposit
- POST /api/payments/send, GET /api/payments/history
- GET /api/payments/user/{qr_code}
- GET /api/qr/referral/{qr_code}
- GET/POST /api/merchants, GET /api/merchants/me, /api/merchants/{id}
- POST /api/notifications/send, /api/notifications/preview
- GET /api/notifications/me, /api/notifications/unread-count
- PUT /api/notifications/{id}/read
- GET /api/profile/tags, /api/profile/my-tags, PUT /api/profile/tags
- GET /api/referrals/stats
- GET /api/sim/my-sim, POST /api/sim/activate, /api/sim/deposit-eur, /api/sim/bonifico, /api/sim/convert-to-up
- GET/POST /api/tasks, POST /api/tasks/{id}/upload
- GET /api/giftcards, POST /api/giftcards/purchase

## Backlog

### P1 - Alta Priorita
- [ ] Completare feature Gift Card: pagamento in EUR (Conto UP o carta simulata), upload logo admin
- [ ] Definire e implementare funzionalita Menu Merchant

### P2 - Media Priorita
- [ ] Push Notifications reali con FastAPI/pywebpush
- [ ] Integrazione gateway Fabrick.com (futuro)

### P3 - Bassa Priorita
- [ ] Marketplace avanzato
- [ ] Gamification / progressione utente

## Note
- Le operazioni bancarie (top-up, bonifico, conversione) sono SIMULATE
- Badge "Made with Emergent" non rimovibile (feature piattaforma)
- Il seed script aggiorna SOLO le password degli utenti seed (SEED_EMAILS), non di tutti gli utenti

---
Ultimo aggiornamento: Marzo 2026
