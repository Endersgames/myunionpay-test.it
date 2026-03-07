from fastapi import APIRouter, Depends, HTTPException
from database import db
from services.auth import get_current_user
import csv
import io
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/merchant", tags=["merchant-referred"])


@router.get("/referred-users")
async def get_referred_users(search: str = "", user=Depends(get_current_user)):
    """Get users referred by this merchant."""
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=403, detail="Solo i merchant possono accedere")

    referrals = await db.referrals.find(
        {"referrer_id": user["id"]}, {"_id": 0}
    ).to_list(500)

    referred_ids = [r["referred_id"] for r in referrals]
    if not referred_ids:
        return {"merchant_id": merchant["id"], "users": [], "total_users": 0, "total_transactions": 0, "total_rewards": 0}

    query = {"id": {"$in": referred_ids}}
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]

    users = await db.users.find(
        query, {"_id": 0, "password_hash": 0}
    ).to_list(500)

    total_transactions = 0
    total_rewards = 0
    user_list = []

    for u in users:
        tx_count = await db.transactions.count_documents({"$or": [{"sender_id": u["id"]}, {"receiver_id": u["id"]}]})
        wallet = await db.wallets.find_one({"user_id": u["id"]}, {"_id": 0, "balance": 1})
        ref = next((r for r in referrals if r["referred_id"] == u["id"]), {})

        total_transactions += tx_count
        total_rewards += ref.get("reward_amount", 0)

        user_list.append({
            "id": u["id"],
            "full_name": u.get("full_name", ""),
            "email": u.get("email", ""),
            "phone": u.get("phone", ""),
            "created_at": u.get("created_at", ""),
            "is_active": u.get("is_active", True),
            "is_blocked": u.get("is_blocked", False),
            "wallet_balance": wallet.get("balance", 0) if wallet else 0,
            "qr_code": u.get("qr_code", ""),
            "referral_code": u.get("referral_code", ""),
            "transactions_count": tx_count,
            "referral_date": ref.get("created_at", ""),
            "reward_amount": ref.get("reward_amount", 0),
        })

    return {
        "merchant_id": merchant["id"],
        "users": user_list,
        "total_users": len(user_list),
        "total_transactions": total_transactions,
        "total_rewards": total_rewards,
    }


@router.get("/referred-users/export")
async def export_referred_users_csv(user=Depends(get_current_user)):
    """Export referred users as CSV."""
    data = await get_referred_users(search="", user=user)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Nome", "Email", "Telefono", "Data Registrazione", "Saldo Wallet", "Transazioni", "QR Code", "Stato"])

    for u in data["users"]:
        writer.writerow([
            u["full_name"], u["email"], u["phone"], u["created_at"],
            f"{u['wallet_balance']:.2f}", u["transactions_count"],
            u["qr_code"], "Bloccato" if u.get("is_blocked") else "Attivo"
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=utenti_presentati.csv"}
    )
