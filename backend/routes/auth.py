from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
import uuid
import logging
import re
import httpx
import os
import jwt
from datetime import datetime, timezone
from urllib.parse import urlencode
from database import db
from database import JWT_SECRET, JWT_ALGORITHM
from models import UserCreate, UserLogin, UserResponse
from routes.admin_features import get_price
from services.auth import hash_password, verify_password, create_token, get_current_user, generate_qr_code

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("auth")
DEFAULT_SIGNUP_BALANCE = 1.0


async def _get_referral_bonus_amounts() -> tuple[float, float]:
    referrer_bonus = await get_price("referral_bonus_referrer")
    referred_bonus = await get_price("referral_bonus_referred")
    return float(referrer_bonus), float(referred_bonus)


def _extract_oauth_context(google_data: dict) -> tuple[str, str]:
    redirect_path = (
        google_data.get("redirect_path")
        or google_data.get("redirect")
        or ""
    )
    referral_code = (
        google_data.get("referral_code")
        or google_data.get("ref")
        or ""
    )
    return redirect_path, referral_code


async def _apply_referral_bonus(user_id: str, referral_code: str) -> None:
    if not referral_code:
        return

    referrer = await db.users.find_one(
        {"referral_code": referral_code},
        {"_id": 0, "id": 1}
    )
    if not referrer or referrer["id"] == user_id:
        return

    existing_referral = await db.referrals.find_one(
        {"referrer_id": referrer["id"], "referred_id": user_id},
        {"_id": 0, "id": 1}
    )
    if existing_referral:
        return

    referrer_bonus, referred_bonus = await _get_referral_bonus_amounts()

    if referrer_bonus:
        await db.wallets.update_one({"user_id": referrer["id"]}, {"$inc": {"balance": referrer_bonus}})
        await db.users.update_one({"id": referrer["id"]}, {"$inc": {"up_points": referrer_bonus}})

    if referred_bonus:
        await db.wallets.update_one({"user_id": user_id}, {"$inc": {"balance": referred_bonus}})
        await db.users.update_one({"id": user_id}, {"$inc": {"up_points": referred_bonus}})

    referral_doc = {
        "id": str(uuid.uuid4()),
        "referrer_id": referrer["id"],
        "referred_id": user_id,
        "bonus_amount": referrer_bonus,
        "reward_amount": referrer_bonus,
        "referred_bonus_amount": referred_bonus,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.referrals.insert_one(referral_doc)


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
        "balance": DEFAULT_SIGNUP_BALANCE,
        "currency": "EUR",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.users.insert_one(user_doc)
    await db.wallets.insert_one(wallet_doc)

    await _apply_referral_bonus(user_id, data.referral_code or "")

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

    # Cancel pending account deletion on login
    if user.get("is_deleted"):
        await db.users.update_one(
            {"id": user["id"]},
            {"$unset": {"is_deleted": "", "deleted_at": "", "deletion_scheduled_at": ""}}
        )
        logger.info(f"Account deletion cancelled for: {email_lower}")

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

GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_SESSION_TTL_SECONDS = 600


def _google_env(key: str) -> str:
    return os.environ.get(key, "").strip()


def _build_google_state_payload(redirect_path: str, referral_code: str) -> str:
    payload = {
        "redirect_path": redirect_path,
        "referral_code": referral_code,
        "exp": datetime.now(timezone.utc).timestamp() + 600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_google_state(state: str) -> tuple[str, str]:
    if not state:
        return "", ""

    try:
        payload = jwt.decode(state, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=400, detail="Stato OAuth non valido")

    return (
        str(payload.get("redirect_path", "") or "").strip(),
        str(payload.get("referral_code", "") or "").strip(),
    )


def _build_frontend_callback_url(params: dict[str, str]) -> str:
    frontend_callback_url = _google_env("GOOGLE_FRONTEND_CALLBACK_URL")
    if not frontend_callback_url:
        raise HTTPException(status_code=500, detail="Google frontend callback non configurato")

    filtered = {k: v for k, v in params.items() if v}
    if not filtered:
        return frontend_callback_url

    separator = "&" if "?" in frontend_callback_url else "?"
    return f"{frontend_callback_url}{separator}{urlencode(filtered)}"


async def _create_google_session(google_data: dict, redirect_path: str, referral_code: str) -> str:
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    session_doc = {
        "id": session_id,
        "email": google_data.get("email", "").strip().lower(),
        "name": google_data.get("name", ""),
        "picture": google_data.get("picture", ""),
        "redirect_path": redirect_path,
        "referral_code": referral_code,
        "created_at": now.isoformat(),
        "expires_at": (now.timestamp() + GOOGLE_SESSION_TTL_SECONDS),
    }
    await db.google_auth_sessions.insert_one(session_doc)
    return session_id


async def _get_google_session(session_id: str) -> dict:
    session_doc = await db.google_auth_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Sessione Google non valida")

    expires_at = float(session_doc.get("expires_at", 0) or 0)
    if expires_at < datetime.now(timezone.utc).timestamp():
        await db.google_auth_sessions.delete_one({"id": session_id})
        raise HTTPException(status_code=401, detail="Sessione Google scaduta o non valida")

    return session_doc


async def _delete_google_session(session_id: str) -> None:
    await db.google_auth_sessions.delete_one({"id": session_id})


@router.get("/google/login")
async def google_login(request: Request):
    client_id = _google_env("GOOGLE_CLIENT_ID")
    redirect_uri = _google_env("GOOGLE_REDIRECT_URI")
    if not client_id or not redirect_uri:
        raise HTTPException(status_code=500, detail="Google OAuth non configurato")

    redirect_path = request.query_params.get("redirect", "").strip()
    referral_code = request.query_params.get("ref", "").strip()
    state = _build_google_state_payload(redirect_path, referral_code)

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    return RedirectResponse(url=f"{GOOGLE_AUTH_BASE_URL}?{urlencode(params)}", status_code=307)


@router.get("/google/callback")
async def google_oauth_callback(code: str = "", state: str = "", error: str = ""):
    if error:
        return RedirectResponse(
            url=_build_frontend_callback_url({"error": error}),
            status_code=307,
        )

    if not code:
        return RedirectResponse(
            url=_build_frontend_callback_url({"error": "missing_code"}),
            status_code=307,
        )

    client_id = _google_env("GOOGLE_CLIENT_ID")
    client_secret = _google_env("GOOGLE_CLIENT_SECRET")
    redirect_uri = _google_env("GOOGLE_REDIRECT_URI")
    if not client_id or not client_secret or not redirect_uri:
        raise HTTPException(status_code=500, detail="Google OAuth non configurato")

    redirect_path, referral_code = _decode_google_state(state)

    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if token_resp.status_code != 200:
            logger.warning("Google token exchange failed: %s", token_resp.text[:300])
            return RedirectResponse(
                url=_build_frontend_callback_url({"error": "token_exchange_failed"}),
                status_code=307,
            )

        token_data = token_resp.json()
        access_token = token_data.get("access_token", "")
        if not access_token:
            return RedirectResponse(
                url=_build_frontend_callback_url({"error": "missing_access_token"}),
                status_code=307,
            )

        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if userinfo_resp.status_code != 200:
        logger.warning("Google userinfo failed: %s", userinfo_resp.text[:300])
        return RedirectResponse(
            url=_build_frontend_callback_url({"error": "userinfo_failed"}),
            status_code=307,
        )

    google_data = userinfo_resp.json()
    google_email = google_data.get("email", "").strip().lower()
    if not google_email:
        return RedirectResponse(
            url=_build_frontend_callback_url({"error": "missing_google_email"}),
            status_code=307,
        )

    session_id = await _create_google_session(google_data, redirect_path, referral_code)
    return RedirectResponse(
        url=_build_frontend_callback_url({"session_id": session_id}),
        status_code=307,
    )


@router.post("/google/callback", response_model=dict)
async def google_callback(data: dict):
    """Process internal Google OAuth session. Returns token for existing users or user info for new users."""
    session_id = data.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id mancante")

    google_data = await _get_google_session(session_id)
    google_email = google_data.get("email", "").strip().lower()
    google_name = google_data.get("name", "")
    google_picture = google_data.get("picture", "")
    redirect_path, referral_code = _extract_oauth_context(google_data)

    if not google_email:
        raise HTTPException(status_code=400, detail="Email Google non disponibile")

    existing_user = await db.users.find_one(
        {"email": re.compile(f"^{re.escape(google_email)}$", re.IGNORECASE)},
        {"_id": 0}
    )

    if existing_user:
        await _delete_google_session(session_id)
        token = create_token(existing_user["id"])
        return {
            "token": token,
            "user_id": existing_user["id"],
            "is_new": False,
            "redirect_path": redirect_path,
            "referral_code": referral_code,
        }

    return {
        "is_new": True,
        "google_email": google_email,
        "google_name": google_name,
        "google_picture": google_picture,
        "session_id": session_id,
        "redirect_path": redirect_path,
        "referral_code": referral_code,
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
    redirect_path, fallback_referral_code = _extract_oauth_context(google_data)
    referral_code = (data.get("referral_code") or fallback_referral_code or "").strip()

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
        "balance": DEFAULT_SIGNUP_BALANCE,
        "currency": "EUR",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.users.insert_one(user_doc)
    await db.wallets.insert_one(wallet_doc)
    await _apply_referral_bonus(user_id, referral_code)
    await _delete_google_session(session_id)

    token = create_token(user_id)
    return {
        "token": token,
        "user_id": user_id,
        "is_new": False,
        "redirect_path": data.get("redirect") or redirect_path or "",
    }


@router.post("/delete-account", response_model=dict)
async def request_account_deletion(user: dict = Depends(get_current_user)):
    """Request account deletion. Account is deactivated immediately, deleted after 30 days."""
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    deletion_date = now + timedelta(days=30)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "is_deleted": True,
            "deleted_at": now.isoformat(),
            "deletion_scheduled_at": deletion_date.isoformat()
        }}
    )
    return {
        "message": "Account disattivato. Sarà eliminato definitivamente tra 30 giorni.",
        "deletion_scheduled_at": deletion_date.isoformat()
    }
