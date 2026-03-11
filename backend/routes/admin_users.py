from fastapi import APIRouter, Depends, HTTPException
from database import db
from services.auth import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta

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


@router.get("/dashboard")
async def get_admin_dashboard(admin=Depends(require_admin)):
    """Platform-level metrics for the admin dashboard."""
    non_admin_users = await db.users.find(
        {"is_admin": {"$ne": True}},
        {"_id": 0, "id": 1},
    ).to_list(10000)
    non_admin_user_ids = [user["id"] for user in non_admin_users]

    circulating_debt = 0.0
    if non_admin_user_ids:
        debt_rows = await db.wallets.aggregate(
            [
                {"$match": {"user_id": {"$in": non_admin_user_ids}}},
                {"$group": {"_id": None, "total": {"$sum": "$balance"}}},
            ]
        ).to_list(1)
        if debt_rows:
            circulating_debt = float(debt_rows[0].get("total", 0) or 0)

    since_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    recent_transactions = await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(20)
    transactions_last_24h = await db.transactions.count_documents({"created_at": {"$gte": since_24h}})

    totals_rows = await db.transactions.aggregate(
        [
            {
                "$group": {
                    "_id": None,
                    "total_volume": {"$sum": "$amount"},
                    "average_value": {"$avg": "$amount"},
                    "total_transactions": {"$sum": 1},
                }
            }
        ]
    ).to_list(1)
    totals = totals_rows[0] if totals_rows else {}

    serialized_recent_transactions = []
    for tx in recent_transactions:
        tx_type = tx.get("transaction_type", "payment")
        if tx_type == "deposit" or tx.get("sender_id") == "SYSTEM":
            description = f"Deposito a {tx.get('recipient_name', 'Utente')}"
        else:
            description = f"{tx.get('sender_name', 'Utente')} -> {tx.get('recipient_name', 'Utente')}"

        serialized_recent_transactions.append(
            {
                "id": tx.get("id", ""),
                "type": "platform",
                "amount": float(tx.get("amount", 0) or 0),
                "description": description,
                "note": tx.get("note") or tx_type,
                "created_at": tx.get("created_at", ""),
            }
        )

    return {
        "circulating_debt": round(circulating_debt, 2),
        "transactions_last_24h": transactions_last_24h,
        "total_volume": round(float(totals.get("total_volume", 0) or 0), 2),
        "average_transaction_value": round(float(totals.get("average_value", 0) or 0), 2),
        "total_transactions": int(totals.get("total_transactions", 0) or 0),
        "total_users": len(non_admin_user_ids),
        "recent_transactions": serialized_recent_transactions,
    }


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
