# myUup (myUup.com) - PRD

## Problema Originale
App PWA per pagamenti digitali con wallet UP, gift card, merchant affiliati, QR code e compagno AI.

## Architettura
- **Frontend:** React + Shadcn UI + PWA (Service Workers)
- **Backend:** FastAPI + MongoDB + JWT Auth
- **AI:** OpenAI gpt-4.1-nano via Emergent LLM Key
- **Pagamenti:** GestPay/Axerve (Sandbox)

## Funzionalità Implementate

### Core (Completate)
- [x] Autenticazione (registrazione, login, JWT)
- [x] Wallet UP con saldo e transazioni
- [x] QR Code per pagamenti e referral
- [x] Sistema Gift Card con pannello admin
- [x] GestPay/Axerve sandbox integration
- [x] Sistema referral con punti UP
- [x] Storico transazioni unificato
- [x] PWA con Service Worker e cache versioning
- [x] SIM virtuale (attivazione, dashboard)
- [x] Profilo utente con tag interessi
- [x] Notifiche push
- [x] Marketplace merchant

### Menu Merchant (Completato)
- [x] Backend API CRUD menu multilingua (5 lingue)
- [x] Pagina pubblica menu con switch lingua
- [x] Pagina gestione menu merchant
- [x] QR scan flow

### Pannelli Admin/Merchant (Completato - Marzo 2026)
- [x] Admin - Gestione Utenti (/admin/users)
- [x] Admin - Configurazione AI (/admin/openai)
- [x] Merchant - Utenti Presentati (/merchant/referred-users) - solo nome e email

### MYU - AI Companion v2 (Completato - Marzo 2026)
**Architettura a 6 layer production-ready:**

#### 1. UI/Chat Layer (Frontend)
- [x] Chat con MYU (0.01 UP per messaggio)
- [x] Action buttons: navigate, create_task, suggest_merchant, confirm_city
- [x] Geolocalizzazione automatica (navigator.geolocation)
- [x] Welcome screen con suggerimenti rapidi

#### 2. Orchestration Layer (myu/orchestrator.py)
- [x] Flow: message → classify → budget → city confirm → tool → LLM → response
- [x] Gestione stato city confirmation (multi-turn)
- [x] Riconoscimento cambio topic durante city confirmation
- [x] Max 1 LLM call + 1 tool call per richiesta

#### 3. Intent/Decision Layer (myu/intent.py)
- [x] Classificazione keyword-based (NO LLM, costo zero)
- [x] 6 domini: companion, wallet, marketplace, growth, support, general
- [x] 15+ intenti con pattern regex
- [x] Risposte statiche per greeting (no LLM)
- [x] Detection: needs_tool, needs_llm, is_location_based

#### 4. Tool Layer (myu/tools/)
- [x] Tool Router con max 1 tool per richiesta
- [x] **Reali**: merchant_finder, wallet, tasks, notifications
- [x] **MOCK**: cinema_finder, restaurant_finder, weather
- [x] Caching aggressivo con TTL (15-60 min per tipo)

#### 5. LLM Integration Layer (myu/llm_service.py)
- [x] Wrapper cost-aware con token capping
- [x] Modello configurabile da admin panel
- [x] Context minimo (max 500 token input, 150 output)
- [x] System prompt compatto
- [x] Fallback su env key se DB key invalida

#### 6. Cost Control Layer (myu/cost_control.py)
- [x] Budget max $0.0035 USD per richiesta
- [x] Stima costo per modello (token pricing)
- [x] Hard stop se costo stimato supera budget
- [x] Log costo per ogni richiesta (request_cost_logs)
- [x] Costo reale misurato: ~$0.00004 per richiesta (89x sotto budget)

#### 7. Location Layer (myu/location.py)
- [x] Geohash-4 encoding (risoluzione ~39km)
- [x] 30 città italiane con coordinate
- [x] Doppia conferma città (geo vs menzione utente)
- [x] City aliases (roma/rome/Roma, milano/milan/Milano...)
- [x] Persistenza stato location in MongoDB

### Google Authentication (Completato - Marzo 2026)
- [x] Backend endpoints: POST /api/auth/google/callback, POST /api/auth/google/complete
- [x] Verifica token Google via Emergent Auth
- [x] Controllo utente esistente per email
- [x] Raccolta numero telefono obbligatoria per nuovi utenti
- [x] Pulsante "Continua con Google" su Login e Register
- [x] Flusso completo: Google sign-in → callback → phone form → registrazione
- [x] Compatibilità JWT mantenuta con auth esistente

### Notifiche Avanzate (Completato)
- [x] Hub notifiche con template merchant
- [x] Upload immagini, CTA link, interazioni MYU

## Database Collections
- users, wallets, merchants, transactions
- gift_cards, giftcard_purchases, gestpay_transactions
- menu_items, notifications, push_subscriptions
- sim_cards, referrals, user_tasks
- myu_conversations, myu_conversation_state, myu_tasks, myu_intent_logs
- app_config, user_notifications, notification_interactions
- **NEW**: user_location_state, tool_cache, request_cost_logs
- **NEW**: app_content (admin-managed: privacy_policy, data_treatment_1-4)

## API Endpoints Auth
- POST /api/auth/register - Registrazione classica
- POST /api/auth/login - Login classico
- GET /api/auth/me - Info utente corrente
- POST /api/auth/google/callback - Verifica sessione Google (nuovo/esistente)
- POST /api/auth/google/complete - Completa registrazione Google con telefono
- POST /api/auth/delete-account - Richiesta eliminazione account (30 giorni)

## API Endpoints Profilo/Impostazioni
- PUT /api/profile/personal - Aggiorna dati personali (nome, telefono, indirizzo)
- POST /api/profile/picture - Upload foto profilo
- GET /api/profile/data-treatment - Preferenze trattamento dati
- PUT /api/profile/data-treatment - Aggiorna switch trattamento dati
- GET /api/content/{key} - Contenuto pubblico (privacy policy, etc.)
- GET /api/admin/content - Admin: tutti i contenuti
- PUT /api/admin/content/{key} - Admin: aggiorna contenuto

## API Endpoints MYU
- POST /api/myu/chat - Chat principale orchestrato
- GET /api/myu/history - Storico chat
- POST /api/myu/new-session - Nuova sessione
- GET /api/myu/tasks - Lista task
- PUT /api/myu/tasks/{id} - Aggiorna task
- GET /api/myu/suggestions - Suggerimenti merchant
- POST /api/myu/location - Aggiorna posizione (lat/lng → geohash_4)
- GET /api/myu/location - Stato posizione corrente
- POST /api/myu/location/confirm - Conferma città
- POST /api/myu/tool/cinema - Tool cinema diretto
- POST /api/myu/tool/restaurants - Tool ristoranti diretto
- POST /api/myu/tool/weather - Tool meteo diretto
- POST /api/myu/tool/merchants - Tool merchant diretto
- GET /api/myu/costs/{requestId} - Costo singola richiesta

## Credenziali Test
- User: test@test.com / test123
- Admin: admin@test.com / test123
- GestPay test card: 4111111111111111, exp: 12/26, CVV: 123

## Backlog Prioritizzato

### P0 - Critico
- [x] Google Authentication con verifica numero telefono

### P1 - Importante
- [ ] Funzione modifica piatto esistente nel menu merchant
- [ ] Integrare API reali per cinema/weather/restaurant (sostituire mock)
- [ ] Finalizzare PWA Install flow
- [ ] Implementare "Paga Merchant" con GestPay
- [ ] Integrazione Treezor (carta virtuale + IBAN)

### P2 - Medio
- [ ] Passaggio GestPay a produzione
- [ ] Push Notifications reali
- [ ] Paginazione query database per scalabilità
- [ ] Dashboard admin MYU analytics (intenti, costi, usage)

### P3 - Futuro
- [ ] App nativa (React Native)
- [ ] MYU reminder e check-in task automatici
- [ ] MYU ranking merchant personalizzato (posizione, orario, cashback)

## Note Tecniche
- GestPay in SANDBOX mode
- "Conto UP" banking simulate
- Tool cinema/weather/restaurant: MOCK (pronti per API reali)
- Tool wallet/merchant/tasks/notifications: REALI (MongoDB)
- Costo MYU: ~$0.00004/richiesta con gpt-4.1-nano
- Merchant "Utenti Presentati" mostra solo nome/email
- Google Auth via Emergent-managed OAuth (auth.emergentagent.com)
- Utenti Google senza password (password_hash vuoto, google_auth: true)

---
Ultimo aggiornamento: Marzo 2026 (Impostazioni + Profilo redesign)
