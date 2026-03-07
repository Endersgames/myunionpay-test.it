from fastapi import APIRouter, Depends, HTTPException
from database import db
from services.auth import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin(user=Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Accesso riservato agli admin")
    return user


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_merchant: Optional[bool] = None
    is_admin: Optional[bool] = None


@router.get("/users")
async def get_all_users(search: str = "", status: str = "all", admin=Depends(require_admin)):
    """Get all users with filters."""
    query = {}
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    if status == "active":
        query["is_blocked"] = {"$ne": True}
    elif status == "blocked":
        query["is_blocked"] = True
    elif status == "merchant":
        query["is_merchant"] = True
    elif status == "admin":
        query["is_admin"] = True

    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)

    user_list = []
    for u in users:
        wallet = await db.wallets.find_one({"user_id": u["id"]}, {"_id": 0, "balance": 1})
        merchant = await db.merchants.find_one({"user_id": u["id"]}, {"_id": 0, "business_name": 1, "id": 1})
        tx_count = await db.transactions.count_documents({"$or": [{"sender_id": u["id"]}, {"receiver_id": u["id"]}]})
        ref_count = await db.referrals.count_documents({"referrer_id": u["id"]})

        user_list.append({
            **{k: v for k, v in u.items()},
            "wallet_balance": wallet.get("balance", 0) if wallet else 0,
            "merchant_name": merchant.get("business_name") if merchant else None,
            "merchant_id": merchant.get("id") if merchant else None,
            "transactions_count": tx_count,
            "referrals_count": ref_count,
        })

    return {"users": user_list, "total": len(user_list)}


@router.get("/user/{user_id}")
async def get_user_detail(user_id: str, admin=Depends(require_admin)):
    """Get detailed user info."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0, "balance": 1})
    merchant = await db.merchants.find_one({"user_id": user_id}, {"_id": 0})
    transactions = await db.transactions.find(
        {"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    referrals = await db.referrals.find({"referrer_id": user_id}, {"_id": 0}).to_list(50)
    referred_by = await db.referrals.find_one({"referred_id": user_id}, {"_id": 0})

    return {
        **user,
        "wallet_balance": wallet.get("balance", 0) if wallet else 0,
        "merchant": merchant,
        "recent_transactions": transactions,
        "referrals_made": referrals,
        "referred_by": referred_by,
    }


@router.put("/user/{user_id}")
async def update_user(user_id: str, data: UserUpdate, admin=Depends(require_admin)):
    """Update user data."""
    update = {k: v for k, v in data.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nessun dato da aggiornare")

    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.users.update_one({"id": user_id}, {"$set": update})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated


@router.post("/user/{user_id}/block")
async def block_user(user_id: str, admin=Depends(require_admin)):
    """Block a user."""
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_blocked": True, "blocked_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return {"success": True, "message": "Utente bloccato"}


@router.post("/user/{user_id}/unblock")
async def unblock_user(user_id: str, admin=Depends(require_admin)):
    """Unblock a user."""
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_blocked": False}, "$unset": {"blocked_at": ""}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return {"success": True, "message": "Utente sbloccato"}
