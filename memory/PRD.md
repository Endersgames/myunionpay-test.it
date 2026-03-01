# My Union Pay - PRD

## Descrizione Progetto
App PWA per pagamenti P2P con sistema di wallet digitale, marketplace merchant e notifiche reward.

## Stato Attuale: FUNZIONANTE ✅
L'applicazione è completamente funzionante con backend FastAPI + MongoDB.

## Stack Tecnologico
- **Frontend**: React 19, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI, MongoDB
- **PWA**: Service Worker, Manifest

## Funzionalità Implementate

### Autenticazione
- ✅ Registrazione con email/password
- ✅ Login
- ✅ Logout
- ✅ JWT Token auth

### Wallet
- ✅ Visualizzazione saldo
- ✅ Deposito demo (+50 UP)
- ✅ Saldo iniziale 100 UP per nuovi utenti

### Pagamenti
- ✅ Invio pagamento tramite QR code
- ✅ Storico transazioni
- ✅ Note sui pagamenti

### QR Code
- ✅ Generazione QR personale
- ✅ Scansione QR per pagamenti
- ✅ Condivisione link QR

### Merchant
- ✅ Registrazione merchant
- ✅ Dashboard merchant
- ✅ QR code negozio
- ✅ Marketplace con categorie
- ✅ Dettaglio merchant

### Notifiche
- ✅ Invio notifiche profilate (merchant)
- ✅ Lista notifiche utente
- ✅ Mark as read
- ✅ Reward automatico

### Profilo
- ✅ Visualizzazione dati utente
- ✅ Tag interessi
- ✅ Codice referral
- ✅ Statistiche referral

### Referral
- ✅ Sistema referral code
- ✅ Bonus +1 UP per invitante e invitato

## Branding
- Nome: **My Union Pay**
- Colori:
  - Primary: #2B7AB8 (Blu)
  - Accent: #E85A24 (Arancione)
  - Background: #FFFFFF (Bianco)
  - Text: #1A1A1A (Nero)
- Logo: `/app/frontend/public/logo.png`

## Credenziali Test
- Email: test@test.com
- Password: test123

## API Endpoints
Tutti gli endpoint sono prefissati con `/api`:
- POST `/api/auth/register` - Registrazione
- POST `/api/auth/login` - Login
- GET `/api/auth/me` - Info utente corrente
- GET `/api/wallet` - Saldo wallet
- POST `/api/wallet/deposit` - Deposito
- POST `/api/payments/send` - Invio pagamento
- GET `/api/payments/history` - Storico
- GET `/api/merchants` - Lista merchant
- POST `/api/merchants` - Crea merchant
- POST `/api/notifications/send` - Invia notifica
- GET `/api/notifications/me` - Mie notifiche

## Prossimi Step (Backlog)

### P1 - Alta Priorità
- [ ] Integrazione Firebase (quando l'utente sarà pronto)
- [ ] Push notifications con FCM

### P2 - Media Priorità
- [ ] Sezione Task nel profilo
- [ ] Sezione Feed nel profilo
- [ ] Barra gamification/progressione

### P3 - Bassa Priorità
- [ ] Marketplace avanzato
- [ ] Rimuovere badge "Made with Emergent"

## Note Tecniche
- Il file `firebase.js` e `firestore.js` esistono ma non sono attualmente usati
- L'app usa `api.js` per comunicare con il backend FastAPI
- Database: MongoDB `app_database`

---
Ultimo aggiornamento: Dicembre 2025
