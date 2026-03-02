from fastapi import APIRouter, Depends, HTTPException
import uuid
from datetime import datetime, timezone
from database import db
from models import UserCreate, UserLogin, UserResponse
from services.auth import hash_password, verify_password, create_token, get_current_user, generate_qr_code

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=dict)
async def register(data: UserCreate):
    existing = await db.users.find_one(
        {"$or": [{"email": data.email}, {"phone": data.phone}]},
        {"_id": 0, "id": 1}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email o telefono già registrati")

    user_id = str(uuid.uuid4())
    qr_code = generate_qr_code()
    referral_code = qr_code

    user_doc = {
        "id": user_id,
        "email": data.email,
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
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    token = create_token(user["id"])
    return {"token": token, "user_id": user["id"]}


@router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(**user)


@router.post("/fix-passwords", response_model=dict)
@router.get("/fix-passwords", response_model=dict)
async def fix_all_passwords():
    """One-time endpoint to fix password hashes for all existing users"""
    new_hash = hash_password("test123")
    result = await db.users.update_many(
        {},
        {"$set": {"password_hash": new_hash}}
    )
    return {"updated": result.modified_count, "message": f"Aggiornate password per {result.modified_count} utenti"}


@router.get("/debug-users", response_model=dict)
async def debug_users():
    """Debug: check user fields in database"""
    users = await db.users.find({}, {"_id": 0}).to_list(50)
    debug_info = []
    for u in users:
        has_password_hash = "password_hash" in u
        has_password = "password" in u
        debug_info.append({
            "email": u.get("email", "?"),
            "has_password_hash": has_password_hash,
            "has_password": has_password,
            "hash_preview": u.get("password_hash", "MISSING")[:20] if has_password_hash else "MISSING",
            "fields": list(u.keys())[:10]
        })
    return {"total": len(users), "users": debug_info}
