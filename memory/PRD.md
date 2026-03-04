# My Union Pay (Myunionpaytest.it) - PRD

## Descrizione Progetto
App PWA per pagamenti P2P con sistema di wallet digitale, marketplace merchant, notifiche reward, e Conto UP (conto bancario virtuale).

## Stack Tecnologico
- **Frontend**: React 19, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI, MongoDB (pymongo/motor), httpx (per chiamate API brand)
- **PWA**: Service Worker, Manifest
- **Auth**: JWT Bearer Token

## Architettura Backend (v2.1)
```
/app/backend/
  server.py          # Entry point
  database.py        # MongoDB connection, config
  models/__init__.py # Pydantic models
  routes/
    auth.py          # Login (case-insensitive), register, diagnostics
    wallet.py        # Wallet CRUD
    payments.py      # P2P payments
    merchants.py     # Merchants CRUD
    notifications.py # Notifications
    profile.py       # User profile tags
    push.py          # Push notifications
    referrals.py     # Referral stats
    sim.py           # Conto UP
    qr.py            # QR code routing
    tasks.py         # User tasks
    giftcards.py     # Gift cards + Brand API integration + Admin CRUD
  services/
    auth.py          # Password hashing, JWT, auth utils
    push.py          # Push notification sender
    seed.py          # DB seeder (only updates SEED_EMAILS passwords)
  uploads/logos/     # Gift card logos
```

## Funzionalita Implementate
- Auth (registrazione, login case-insensitive, JWT, diagnostics)
- Wallet (saldo, deposito, pagamenti P2P)
- QR Code (generazione, scansione, condivisione)
- Merchant (registrazione, marketplace, categorie)
- Notifiche (profilate per merchant, preview, reward)
- Profilo (tag interessi, referral stats, task)
- Referral (codice = QR code, bonus +1 UP)
- Conto UP (carta virtuale, IBAN, saldo EUR, top-up, bonifico, conversione)
- PWA Install Prompt
- Merchant QR Scan (Menu / Installa ed Ordina / Paga)
- Task Verifica Residenza (upload fattura per +5 UP)
- **Gift Card con integrazione API Brand**:
  - Admin crea nuove gift card (brand, categoria, cashback, importi)
  - Admin configura API per ogni brand (endpoint, API key, metodo, headers, body template)
  - Admin testa API dal pannello
  - Utente acquista gift card con EUR (Conto UP o carta collegata)
  - Sistema chiama automaticamente API brand per ottenere codice attivazione
  - Codice attivazione mostrato all'utente dopo acquisto con possibilita di copia
  - Cashback accreditato in UP
  - Admin gestisce cashback % e stato on/off per ogni card
  - Upload logo manuale per ogni gift card

## Branding
- Nome: **Myunionpaytest.it**
- Primary: #2B7AB8 (Blu)
- Accent: #E85A24 (Arancione)

## Credenziali Test
- Email: test@test.com / Password: test123
- Admin: admin@test.com / Password: test123

## API Endpoints Gift Card (nuovi)
- POST /api/giftcards/admin/create - Crea nuova gift card
- PUT /api/giftcards/admin/{id}/api-config - Configura API brand
- POST /api/giftcards/admin/{id}/test-api - Testa API brand
- POST /api/giftcards/admin/{id}/logo - Upload logo
- POST /api/giftcards/purchase - Acquisto con chiamata API brand (restituisce activation_code)

## Backlog

### P1 - Alta Priorita
- [ ] Definire e implementare Menu Merchant (struttura dati, API, UI)

### P2 - Media Priorita
- [ ] Push Notifications reali con pywebpush
- [ ] Integrazione gateway Fabrick.com

### P3 - Bassa Priorita
- [ ] Marketplace avanzato
- [ ] Gamification / progressione utente

## Note
- Le operazioni bancarie sono SIMULATE
- Badge "Made with Emergent" non rimovibile (feature piattaforma)
- API brand usa httpbin.org/post per test. In produzione usare API reali dei brand
- Il seed script aggiorna SOLO le password degli utenti seed (SEED_EMAILS)

---
Ultimo aggiornamento: Marzo 2026
