from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
import uuid
import logging
import re
import httpx
import os
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode
from database import db
from models import UserCreate, UserLogin, UserResponse
from services.auth import hash_password, verify_password, create_token, get_current_user, generate_qr_code

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("auth")


@router.post("/register", response_model=dict)
async def register(data: UserCreate):
    email_lower = data.email.strip().lower()
    existing = await db.users.find_one(
        {"$or": [
            {"email": re.compile(f"^{re.escape(email_lower)}$", re.IGNORECASE)},
            {"phone": data.phone}
        ]},
        {"_id": 0, "id": 1}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email o telefono già registrati")

    user_id = str(uuid.uuid4())
    qr_code = generate_qr_code()
    referral_code = qr_code

    user_doc = {
        "id": user_id,
        "email": email_lower,
        "phone": data.phone,
        "full_name": data.full_name,
        "password_hash": hash_password(data.password),
        "qr_code": qr_code,
        "referral_code": referral_code,
        "up_points": 0,
        "profile_tags": [],
        "is_merchant": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    wallet_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "balance": 100.0,
        "currency": "EUR",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.users.insert_one(user_doc)
    await db.wallets.insert_one(wallet_doc)

    if data.referral_code:
        referrer = await db.users.find_one(
            {"referral_code": data.referral_code},
            {"_id": 0, "id": 1}
        )
        if referrer:
            await db.wallets.update_one({"user_id": referrer["id"]}, {"$inc": {"balance": 1}})
            await db.wallets.update_one({"user_id": user_id}, {"$inc": {"balance": 1}})
            await db.users.update_one({"id": referrer["id"]}, {"$inc": {"up_points": 1}})
            await db.users.update_one({"id": user_id}, {"$inc": {"up_points": 1}})

            referral_doc = {
                "id": str(uuid.uuid4()),
                "referrer_id": referrer["id"],
                "referred_id": user_id,
                "bonus_amount": 1,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.referrals.insert_one(referral_doc)

    token = create_token(user_id)
    return {"token": token, "user_id": user_id}


@router.post("/login", response_model=dict)
async def login(data: UserLogin):
    email_lower = data.email.strip().lower()
    logger.info(f"Login attempt for: {email_lower}")

    # Case-insensitive email lookup
    user = await db.users.find_one(
        {"email": re.compile(f"^{re.escape(email_lower)}$", re.IGNORECASE)},
        {"_id": 0}
    )
    if not user:
        logger.warning(f"Login failed: user not found for {email_lower}")
        raise HTTPException(status_code=401, detail="Credenziali non valide - utente non trovato")

    # Support both field names
    stored_hash = user.get("password_hash") or user.get("password", "")
    if not stored_hash:
        logger.error(f"Login failed: no password hash stored for {email_lower}")
        raise HTTPException(status_code=401, detail="Credenziali non valide - password non configurata")

    if not verify_password(data.password, stored_hash):
        logger.warning(f"Login failed: wrong password for {email_lower}")
        raise HTTPException(status_code=401, detail="Credenziali non valide - password errata")

    token = create_token(user["id"])
    logger.info(f"Login success for: {email_lower}")
    return {"token": token, "user_id": user["id"]}


@router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(**user)


@router.post("/fix-passwords", response_model=dict)
@router.get("/fix-passwords", response_model=dict)
async def fix_all_passwords():
    """Fix password hashes for all existing users - sets all to test123"""
    new_hash = hash_password("test123")
    result = await db.users.update_many(
        {},
        {"$set": {"password_hash": new_hash}}
    )
    return {"updated": result.modified_count, "message": f"Aggiornate password per {result.modified_count} utenti"}


@router.get("/debug-users", response_model=dict)
async def debug_users():
    """Debug: check user fields and password hash status"""
    users = await db.users.find({}, {"_id": 0}).to_list(50)
    debug_info = []
    for u in users:
        ph = u.get("password_hash", "")
        debug_info.append({
            "email": u.get("email", "?"),
            "has_password_hash": bool(ph),
            "hash_valid_bcrypt": ph.startswith("$2") if ph else False,
            "hash_length": len(ph) if ph else 0,
            "has_id": bool(u.get("id")),
            "fields": list(u.keys())[:12]
        })
    return {"total": len(users), "users": debug_info}


@router.get("/verify-login-test", response_model=dict)
async def verify_login_test():
    """Diagnostic: verify that test@test.com can authenticate"""
    user = await db.users.find_one({"email": "test@test.com"}, {"_id": 0})
    if not user:
        return {"status": "FAIL", "reason": "user not found", "email": "test@test.com"}

    stored_hash = user.get("password_hash", "")
    can_verify = False
    if stored_hash:
        try:
            can_verify = verify_password("test123", stored_hash)
        except Exception as e:
            return {"status": "FAIL", "reason": f"verify error: {str(e)}", "hash_preview": stored_hash[:20]}

    return {
        "status": "OK" if can_verify else "FAIL",
        "email": "test@test.com",
        "user_exists": True,
        "has_password_hash": bool(stored_hash),
        "hash_is_bcrypt": stored_hash.startswith("$2") if stored_hash else False,
        "password_verifies": can_verify,
        "user_id": user.get("id", "MISSING")
    }


# ========================
# GOOGLE AUTH
# ========================

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_SESSION_TTL_MINUTES = int(os.environ.get("GOOGLE_SESSION_TTL_MINUTES", "15"))


def _get_google_redirect_uri() -> str:
    return os.environ.get("GOOGLE_REDIRECT_URI", "https://dev.myuup.com/api/auth/google/callback").strip()


def _get_google_frontend_callback_url() -> str:
    return os.environ.get("GOOGLE_FRONTEND_CALLBACK_URL", "https://dev.myuup.com/google-auth/callback").strip()


def _build_frontend_callback_url(session_id: str = "", error: str = "") -> str:
    base = _get_google_frontend_callback_url()
    params = {}
    if session_id:
        params["session_id"] = session_id
    if error:
        params["error"] = error
    if not params:
        return base
    return f"{base}?{urlencode(params)}"


def _parse_iso_datetime(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return None


async def _get_google_session(session_id: str) -> dict:
    google_session = await db.google_oauth_sessions.find_one({"id": session_id}, {"_id": 0})
    if not google_session:
        raise HTTPException(status_code=401, detail="Sessione Google non valida")

    expires_at = _parse_iso_datetime(google_session.get("expires_at", ""))
    if not expires_at or expires_at <= datetime.now(timezone.utc):
        await db.google_oauth_sessions.delete_one({"id": session_id})
        raise HTTPException(status_code=401, detail="Sessione Google scaduta o non valida")

    return google_session


@router.get("/google/login")
async def google_login():
    """Start Google OAuth flow using backend callback on dev.myuup.com."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID non configurato")

    state = str(uuid.uuid4())
    await db.google_oauth_states.insert_one({
        "state": state,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    query = urlencode({
        "client_id": client_id,
        "redirect_uri": _get_google_redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
        "access_type": "offline",
    })
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{query}", status_code=302)


@router.get("/google/callback")
async def google_oauth_callback(code: str = "", state: str = "", error: str = ""):
    """Google OAuth callback endpoint on backend."""
    if error:
        logger.warning(f"Google OAuth error: {error}")
        return RedirectResponse(url=_build_frontend_callback_url(error=error), status_code=302)

    if not code or not state:
        return RedirectResponse(
            url=_build_frontend_callback_url(error="missing_code_or_state"),
            status_code=302
        )

    state_doc = await db.google_oauth_states.find_one({"state": state})
    if not state_doc:
        return RedirectResponse(url=_build_frontend_callback_url(error="invalid_state"), status_code=302)
    await db.google_oauth_states.delete_one({"state": state})

    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        logger.error("Google OAuth not configured: missing client credentials")
        return RedirectResponse(url=_build_frontend_callback_url(error="google_not_configured"), status_code=302)

    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": _get_google_redirect_uri(),
                "grant_type": "authorization_code",
            }
        )

        if token_resp.status_code != 200:
            logger.warning(f"Google token exchange failed: {token_resp.status_code} {token_resp.text[:200]}")
            return RedirectResponse(url=_build_frontend_callback_url(error="token_exchange_failed"), status_code=302)

        access_token = token_resp.json().get("access_token", "")
        if not access_token:
            return RedirectResponse(url=_build_frontend_callback_url(error="missing_access_token"), status_code=302)

        user_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if user_resp.status_code != 200:
            logger.warning(f"Google userinfo failed: {user_resp.status_code}")
            return RedirectResponse(url=_build_frontend_callback_url(error="userinfo_failed"), status_code=302)

    google_data = user_resp.json()
    google_email = google_data.get("email", "").strip().lower()
    google_name = google_data.get("name", "")
    google_picture = google_data.get("picture", "")

    if not google_email:
        return RedirectResponse(url=_build_frontend_callback_url(error="google_email_missing"), status_code=302)

    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    await db.google_oauth_sessions.insert_one({
        "id": session_id,
        "email": google_email,
        "name": google_name,
        "picture": google_picture,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(minutes=GOOGLE_SESSION_TTL_MINUTES)).isoformat(),
    })

    return RedirectResponse(url=_build_frontend_callback_url(session_id=session_id), status_code=302)


@router.post("/google/callback", response_model=dict)
async def google_callback(data: dict):
    """Process Google OAuth session_id stored by backend callback."""
    session_id = data.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id mancante")

    google_data = await _get_google_session(session_id)
    google_email = google_data.get("email", "").strip().lower()
    google_name = google_data.get("name", "")
    google_picture = google_data.get("picture", "")

    if not google_email:
        raise HTTPException(status_code=400, detail="Email Google non disponibile")

    existing_user = await db.users.find_one(
        {"email": re.compile(f"^{re.escape(google_email)}$", re.IGNORECASE)},
        {"_id": 0}
    )

    if existing_user:
        token = create_token(existing_user["id"])
        await db.google_oauth_sessions.delete_one({"id": session_id})
        return {"token": token, "user_id": existing_user["id"], "is_new": False}

    return {
        "is_new": True,
        "google_email": google_email,
        "google_name": google_name,
        "google_picture": google_picture,
        "session_id": session_id
    }


@router.post("/google/complete", response_model=dict)
async def google_complete(data: dict):
    """Complete Google registration with mandatory phone number."""
    session_id = data.get("session_id")
    phone = data.get("phone", "").strip()

    if not session_id:
        raise HTTPException(status_code=400, detail="session_id mancante")
    if not phone:
        raise HTTPException(status_code=400, detail="Numero di telefono obbligatorio")

    google_data = await _get_google_session(session_id)
    google_email = google_data.get("email", "").strip().lower()
    google_name = google_data.get("name", "")
    google_picture = google_data.get("picture", "")

    existing = await db.users.find_one(
        {"$or": [
            {"email": re.compile(f"^{re.escape(google_email)}$", re.IGNORECASE)},
            {"phone": phone}
        ]},
        {"_id": 0, "id": 1}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email o telefono già registrati")

    user_id = str(uuid.uuid4())
    qr_code = generate_qr_code()

    user_doc = {
        "id": user_id,
        "email": google_email,
        "phone": phone,
        "full_name": google_name,
        "password_hash": "",
        "google_auth": True,
        "google_picture": google_picture,
        "qr_code": qr_code,
        "referral_code": qr_code,
        "up_points": 0,
        "profile_tags": [],
        "is_merchant": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    wallet_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "balance": 100.0,
        "currency": "EUR",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.users.insert_one(user_doc)
    await db.wallets.insert_one(wallet_doc)
    await db.google_oauth_sessions.delete_one({"id": session_id})

    token = create_token(user_id)
    return {"token": token, "user_id": user_id, "is_new": False}
