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
- [x] Backend API CRUD menu multilingua (5 lingue: IT, EN, FR, DE, ES)
- [x] Pagina pubblica menu con switch lingua
- [x] Pagina gestione menu merchant (aggiungi/elimina piatti, cover image)
- [x] Campi: nome, descrizione, prezzo, origine, calorie, sezione salute
- [x] Categorie: Antipasti, Primi, Secondi, Dolci, Bevande
- [x] QR scan flow: registrato (2 opzioni) vs non registrato (3 opzioni)
- [x] Bottone "Vedi Menu" nella vetrina merchant (solo ristoranti/bar)
- [x] 13 piatti di esempio popolati su preview e live

### MYU - AI Companion (Completato - Marzo 2026)
- [x] Chat AI con gpt-4.1-nano (risposte brevi, max 2 frasi)
- [x] Costo 0.01 UP per messaggio (deduzione dal wallet)
- [x] Classificazione intent (domain/intent/confidence)
- [x] 6 domini: companion, wallet, marketplace, growth, support, general
- [x] 14 intenti: check_balance, discover_merchants, task_creation, etc.
- [x] Sistema task (crea, completa, cancella, postponi)
- [x] Suggerimenti merchant basati su profilo
- [x] Cronologia chat persistente in MongoDB
- [x] Stato conversazionale breve (no cronologia piena nel prompt)
- [x] System prompt personalizzato (amichevole, breve, italiano)
- [x] CTA azioni (navigate, create_task, suggest_merchant)
- [x] Bottone FAB flottante nella dashboard
- [x] Welcome screen con 3 suggerimenti rapidi
- [x] Nuova sessione (reset conversazione)
- [x] Pannello task nel header chat
- [x] Gestione saldo insufficiente (errore 402)
- [x] Intent logging per analytics

## Database Collections
- users, wallets, merchants, transactions
- gift_cards, giftcard_purchases, gestpay_transactions
- menu_items, notifications, push_subscriptions
- sim_cards, referrals, user_tasks
- myu_conversations, myu_conversation_state, myu_tasks, myu_intent_logs

## Credenziali Test
- User: test@test.com / test123
- Admin: admin@test.com / test123
- GestPay test card: 4111111111111111, exp: 12/26, CVV: 123

## Backlog Prioritizzato

### P0 - Critico
- [ ] Funzione modifica piatto esistente nel menu merchant

### P1 - Importante
- [ ] Finalizzare PWA Install flow (iOS/Android intuitivo)
- [ ] Implementare "Paga Merchant" con GestPay
- [ ] Integrazione Treezor (carta virtuale + IBAN) - richiede contratto Treezor

### P2 - Medio
- [ ] Passaggio GestPay a produzione
- [ ] Push Notifications reali
- [ ] Paginazione query database per scalabilità

### P3 - Futuro
- [ ] App nativa (React Native via Mobile Agent)
- [ ] MYU reminder e check-in task automatici
- [ ] MYU ranking merchant personalizzato (posizione, orario, cashback)
- [ ] Dashboard admin MYU (analytics intenti, costi)

## Note Tecniche
- GestPay è in SANDBOX mode
- "Conto UP" banking operations sono simulate
- Emergent LLM Key: sk-emergent-... (in backend/.env)
- Custom domain: myUup.com (collegato e funzionante)

---
Ultimo aggiornamento: Marzo 2026
