from fastapi import APIRouter, Depends, HTTPException
import uuid
from datetime import datetime, timezone
from database import db
from models import WalletResponse, DepositRequest
from services.auth import get_current_user

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("", response_model=WalletResponse)
async def get_wallet(user: dict = Depends(get_current_user)):
    wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet non trovato")
    return WalletResponse(**wallet)


@router.post("/deposit", response_model=WalletResponse)
async def deposit_to_wallet(data: DepositRequest, user: dict = Depends(get_current_user)):
    if data.amount <= 0 or data.amount > 1000:
        raise HTTPException(status_code=400, detail="Importo non valido (max 1000)")

    await db.wallets.update_one(
        {"user_id": user["id"]},
        {"$inc": {"balance": data.amount}}
    )

    tx_doc = {
        "id": str(uuid.uuid4()),
        "sender_id": "SYSTEM",
        "sender_name": "Deposito",
        "recipient_id": user["id"],
        "recipient_name": user["full_name"],
        "amount": data.amount,
        "note": "Ricarica wallet",
        "transaction_type": "deposit",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(tx_doc)

    wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    return WalletResponse(**wallet)
