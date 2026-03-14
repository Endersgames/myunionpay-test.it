from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import logging
from datetime import datetime, timezone
from database import db
from services.auth import get_current_user
from services.gestpay import process_card_payment

router = APIRouter(prefix="/gestpay", tags=["gestpay"])
logger = logging.getLogger("gestpay_routes")


class CardPaymentRequest(BaseModel):
    amount: float
    card_number: str
    exp_month: str
    exp_year: str
    cvv: str
    description: Optional[str] = None


class CardTokenizeRequest(BaseModel):
    card_number: str
    exp_month: str
    exp_year: str
    cvv: str
    holder_name: str


@router.post("/pay")
async def pay_with_card(data: CardPaymentRequest, user: dict = Depends(get_current_user)):
    """Process a card payment through GestPay"""
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Importo non valido")

    result = await process_card_payment(
        amount=data.amount,
        card_number=data.card_number,
        exp_month=data.exp_month,
        exp_year=data.exp_year,
        cvv=data.cvv,
        buyer_email=user.get("email"),
        buyer_name=user.get("full_name"),
    )

    # Store transaction
    tx_doc = {
        "user_id": user["id"],
        "type": "gestpay_payment",
        "amount": data.amount,
        "description": data.description or "Pagamento con carta",
        "shop_transaction_id": result.get("shop_transaction_id"),
        "payment_id": result.get("payment_id"),
        "bank_transaction_id": result.get("bank_transaction_id"),
        "authorization_code": result.get("authorization_code"),
        "transaction_result": result.get("transaction_result"),
        "success": result.get("success", False),
        "error": result.get("error"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.gestpay_transactions.insert_one(tx_doc)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Pagamento fallito"))

    return {
        "success": True,
        "transaction_result": result.get("transaction_result"),
        "bank_transaction_id": result.get("bank_transaction_id"),
        "authorization_code": result.get("authorization_code"),
        "shop_transaction_id": result.get("shop_transaction_id"),
        "amount": data.amount,
    }


@router.post("/tokenize")
async def tokenize_card(data: CardTokenizeRequest, user: dict = Depends(get_current_user)):
    """Tokenize a card with a 0 EUR transaction to verify and store it"""
    result = await process_card_payment(
        amount=0.01,
        card_number=data.card_number,
        exp_month=data.exp_month,
        exp_year=data.exp_year,
        cvv=data.cvv,
        buyer_email=user.get("email"),
        buyer_name=user.get("full_name"),
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Tokenizzazione fallita"))

    # Store tokenized card
    clean_number = data.card_number.replace(" ", "").replace("-", "")
    first_digit = clean_number[0]
    card_brand = {"4": "Visa", "5": "Mastercard", "3": "Amex"}.get(first_digit, "Carta")

    await db.linked_cards.delete_many({"user_id": user["id"]})

    import uuid
    card_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "last_four": clean_number[-4:],
        "holder_name": data.holder_name,
        "expiry": f"{data.exp_month}/{data.exp_year}",
        "brand": card_brand,
        "gestpay_verified": True,
        "bank_transaction_id": result.get("bank_transaction_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.linked_cards.insert_one(card_doc)

    return {
        "success": True,
        "card_brand": card_brand,
        "last_four": clean_number[-4:],
        "message": "Carta verificata e collegata con successo",
    }


@router.post("/callback")
async def gestpay_callback(request: Request):
    """Server-to-Server callback from GestPay"""
    body = await request.body()
    logger.info(f"GestPay S2S callback received: {body[:500]}")

    try:
        data = await request.json()
    except Exception:
        data = {"raw": body.decode("utf-8", errors="replace")[:500]}

    await db.gestpay_callbacks.insert_one({
        "data": data,
        "received_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"status": "OK"}


@router.get("/test-connection")
async def test_gestpay_connection():
    """Test the GestPay sandbox connection"""
    from services.gestpay import create_payment
    result = await create_payment(0.01, f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}")
    return {
        "gestpay_reachable": result["success"],
        "details": result,
    }
