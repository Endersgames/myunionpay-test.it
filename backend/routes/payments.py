from fastapi import APIRouter, Depends, HTTPException
from typing import List
import uuid
from datetime import datetime, timezone
from database import db
from models import TransactionCreate, TransactionResponse
from services.auth import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/send", response_model=TransactionResponse)
async def send_payment(data: TransactionCreate, user: dict = Depends(get_current_user)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Importo non valido")

    recipient = await db.users.find_one({"qr_code": data.recipient_qr}, {"_id": 0})
    if not recipient:
        merchant = await db.merchants.find_one({"qr_code": data.recipient_qr}, {"_id": 0})
        if merchant:
            recipient = await db.users.find_one({"id": merchant["user_id"]}, {"_id": 0})

    if not recipient:
        raise HTTPException(status_code=404, detail="Destinatario non trovato")

    if recipient["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Non puoi pagare te stesso")

    sender_wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    if sender_wallet["balance"] < data.amount:
        raise HTTPException(status_code=400, detail="Saldo insufficiente")

    await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": -data.amount}})
    await db.wallets.update_one({"user_id": recipient["id"]}, {"$inc": {"balance": data.amount}})

    tx_doc = {
        "id": str(uuid.uuid4()),
        "sender_id": user["id"],
        "sender_name": user["full_name"],
        "recipient_id": recipient["id"],
        "recipient_name": recipient["full_name"],
        "amount": data.amount,
        "note": data.note,
        "transaction_type": "payment",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(tx_doc)

    return TransactionResponse(**tx_doc)


@router.get("/history")
async def get_payment_history(user: dict = Depends(get_current_user)):
    all_transactions = []

    # P2P payments
    p2p = await db.transactions.find(
        {"$or": [{"sender_id": user["id"]}, {"recipient_id": user["id"]}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for tx in p2p:
        is_sender = tx.get("sender_id") == user["id"]
        all_transactions.append({
            "id": tx.get("id", ""),
            "type": "sent" if is_sender else "received",
            "amount": tx["amount"],
            "description": f"{'Inviato a' if is_sender else 'Ricevuto da'} {tx.get('recipient_name' if is_sender else 'sender_name', '?')}",
            "note": tx.get("note", ""),
            "created_at": tx.get("created_at", ""),
        })

    # GestPay card payments
    gestpay = await db.gestpay_transactions.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    for tx in gestpay:
        all_transactions.append({
            "id": tx.get("shop_transaction_id", ""),
            "type": "card_payment",
            "amount": tx["amount"],
            "description": tx.get("description", "Pagamento con carta"),
            "note": f"Auth: {tx.get('authorization_code', '')}" if tx.get("success") else tx.get("error", ""),
            "created_at": tx.get("created_at", ""),
        })

    # Gift card purchases
    gc_purchases = await db.giftcard_purchases.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    for tx in gc_purchases:
        all_transactions.append({
            "id": tx.get("id", ""),
            "type": "giftcard",
            "amount": tx["amount"],
            "description": f"Gift Card {tx.get('brand', '')} - {tx['amount']} EUR",
            "note": f"Cashback: +{tx.get('cashback_earned', 0):.2f} UP",
            "created_at": tx.get("created_at", ""),
        })

    # Sort all by date descending
    all_transactions.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return all_transactions[:100]


@router.get("/user/{qr_code}", response_model=dict)
async def get_user_by_qr(qr_code: str):
    user = await db.users.find_one({"qr_code": qr_code}, {"_id": 0, "password_hash": 0})
    if not user:
        merchant = await db.merchants.find_one({"qr_code": qr_code}, {"_id": 0})
        if merchant:
            user = await db.users.find_one({"id": merchant["user_id"]}, {"_id": 0, "password_hash": 0})
            if user:
                return {"type": "merchant", "name": merchant["business_name"], "qr_code": qr_code, "user_id": user["id"], "referral_code": user.get("referral_code", "")}

    if not user:
        raise HTTPException(status_code=404, detail="QR code non valido")

    return {"type": "user", "name": user["full_name"], "qr_code": qr_code, "user_id": user["id"], "referral_code": user.get("referral_code", "")}
