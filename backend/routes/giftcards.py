from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
import uuid
import os
import logging
import httpx
import json
from datetime import datetime, timezone
from database import db
from services.auth import get_current_user

router = APIRouter(prefix="/giftcards", tags=["giftcards"])
logger = logging.getLogger("giftcards")

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "logos")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ========================
# MODELS
# ========================

class GiftCardResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    brand: str
    category: str
    cashback_percent: float
    logo_color: str
    logo_url: Optional[str] = None
    available_amounts: List[int]
    active: bool


class GiftCardAdminResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    brand: str
    category: str
    cashback_percent: float
    logo_color: str
    logo_url: Optional[str] = None
    available_amounts: List[int]
    active: bool
    api_endpoint: Optional[str] = None
    api_key: Optional[str] = None
    api_method: Optional[str] = "POST"
    api_headers: Optional[str] = None
    api_body_template: Optional[str] = None
    api_configured: Optional[bool] = False


class GiftCardUpdate(BaseModel):
    cashback_percent: Optional[float] = None
    active: Optional[bool] = None


class GiftCardApiConfig(BaseModel):
    api_endpoint: str
    api_key: str
    api_method: Optional[str] = "POST"
    api_headers: Optional[str] = None
    api_body_template: Optional[str] = None


class GiftCardCreate(BaseModel):
    brand: str
    category: str
    cashback_percent: float = 1.0
    logo_color: str = "#333333"
    available_amounts: List[int] = [25, 50, 100]


class GiftCardPurchase(BaseModel):
    giftcard_id: str
    amount: int
    payment_method: str  # "conto_up" or "card"
    card_number: Optional[str] = None
    exp_month: Optional[str] = None
    exp_year: Optional[str] = None
    cvv: Optional[str] = None


class GiftCardPurchaseResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    giftcard_id: str
    brand: str
    amount: int
    cashback_percent: float
    cashback_earned: float
    payment_method: str
    activation_code: Optional[str] = None
    api_response: Optional[str] = None
    api_status: Optional[str] = None
    created_at: str


class LinkCardRequest(BaseModel):
    card_number: str
    expiry: str
    cvv: str
    holder_name: str


class LinkedCardResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    last_four: str
    holder_name: str
    expiry: str
    brand: str
    created_at: str


# ========================
# BRAND API CALLER
# ========================

async def call_brand_api(card: dict, amount: int, user: dict) -> dict:
    """Call the brand's API to activate a gift card and get activation code."""
    api_endpoint = card.get("api_endpoint")
    api_key = card.get("api_key")
    api_method = card.get("api_method", "POST").upper()
    api_headers_str = card.get("api_headers")
    api_body_template_str = card.get("api_body_template")

    if not api_endpoint or not api_key:
        return {"status": "no_api", "activation_code": None, "raw_response": None}

    # Build headers
    headers = {"Content-Type": "application/json"}
    if api_headers_str:
        try:
            custom_headers = json.loads(api_headers_str)
            headers.update(custom_headers)
        except json.JSONDecodeError:
            pass

    # Replace {API_KEY} placeholder in headers
    for k, v in headers.items():
        if isinstance(v, str):
            headers[k] = v.replace("{API_KEY}", api_key)

    # If no Authorization header set, add Bearer by default
    if "Authorization" not in headers and "authorization" not in headers:
        headers["Authorization"] = f"Bearer {api_key}"

    # Build request body from template
    body = None
    if api_body_template_str:
        try:
            body_str = api_body_template_str.replace("{amount}", str(amount))
            body_str = body_str.replace("{email}", user.get("email", ""))
            body_str = body_str.replace("{user_name}", user.get("full_name", ""))
            body_str = body_str.replace("{brand}", card.get("brand", ""))
            body_str = body_str.replace("{API_KEY}", api_key)
            body = json.loads(body_str)
        except json.JSONDecodeError:
            body = {"amount": amount, "api_key": api_key}
    else:
        body = {"amount": amount, "currency": "EUR", "api_key": api_key}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if api_method == "GET":
                resp = await client.get(api_endpoint, headers=headers, params=body)
            else:
                resp = await client.post(api_endpoint, headers=headers, json=body)

        raw_response = resp.text
        activation_code = None

        # Try to extract activation code from response
        try:
            resp_data = resp.json()
            # Try common field names for activation codes
            for field in ["code", "activation_code", "gift_code", "voucher_code",
                          "pin", "redemption_code", "serial", "card_code",
                          "giftCardCode", "voucherCode", "redeemCode", "data"]:
                if field in resp_data:
                    val = resp_data[field]
                    if isinstance(val, str):
                        activation_code = val
                        break
                    elif isinstance(val, dict):
                        # Nested: look for code inside data object
                        for subfield in ["code", "activation_code", "pin", "voucher_code"]:
                            if subfield in val:
                                activation_code = str(val[subfield])
                                break
                        if activation_code:
                            break
            # If no known field, use the full response
            if not activation_code:
                activation_code = raw_response[:200]
        except Exception:
            activation_code = raw_response[:200] if raw_response else None

        status = "success" if resp.status_code < 400 else f"error_{resp.status_code}"
        logger.info(f"Brand API call to {card['brand']}: status={resp.status_code}")

        return {
            "status": status,
            "activation_code": activation_code,
            "raw_response": raw_response[:500]
        }

    except httpx.TimeoutException:
        logger.error(f"Brand API timeout for {card['brand']}: {api_endpoint}")
        return {"status": "timeout", "activation_code": None, "raw_response": "Timeout connessione API brand"}
    except Exception as e:
        logger.error(f"Brand API error for {card['brand']}: {e}")
        return {"status": "error", "activation_code": None, "raw_response": str(e)[:300]}


# ========================
# LINKED CARDS
# ========================

@router.get("/linked-card")
async def get_linked_card(user: dict = Depends(get_current_user)):
    card = await db.linked_cards.find_one({"user_id": user["id"]}, {"_id": 0})
    if not card:
        return None
    return LinkedCardResponse(**card)


@router.post("/link-card", response_model=LinkedCardResponse)
async def link_credit_card(data: LinkCardRequest, user: dict = Depends(get_current_user)):
    clean_number = data.card_number.replace(" ", "").replace("-", "")
    if len(clean_number) < 13 or len(clean_number) > 19:
        raise HTTPException(status_code=400, detail="Numero carta non valido")
    if len(data.cvv) < 3:
        raise HTTPException(status_code=400, detail="CVV non valido")

    first_digit = clean_number[0]
    card_brand = {"4": "Visa", "5": "Mastercard", "3": "Amex"}.get(first_digit, "Carta")

    await db.linked_cards.delete_many({"user_id": user["id"]})

    card_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "last_four": clean_number[-4:],
        "holder_name": data.holder_name,
        "expiry": data.expiry,
        "brand": card_brand,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.linked_cards.insert_one(card_doc)
    return LinkedCardResponse(**card_doc)


@router.delete("/unlink-card")
async def unlink_card(user: dict = Depends(get_current_user)):
    await db.linked_cards.delete_many({"user_id": user["id"]})
    return {"success": True}


# ========================
# PUBLIC ROUTES
# ========================

@router.get("", response_model=List[GiftCardResponse])
async def get_giftcards(user: dict = Depends(get_current_user)):
    cards = await db.giftcards.find({"active": True}, {"_id": 0}).to_list(100)
    return [GiftCardResponse(**c) for c in cards]


@router.post("/purchase", response_model=GiftCardPurchaseResponse)
async def purchase_giftcard(data: GiftCardPurchase, user: dict = Depends(get_current_user)):
    card = await db.giftcards.find_one({"id": data.giftcard_id, "active": True}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Gift card non trovata")

    if data.amount not in card["available_amounts"]:
        raise HTTPException(status_code=400, detail="Importo non valido")

    # Payment with EUR
    if data.payment_method == "conto_up":
        sim = await db.sims.find_one({"user_id": user["id"]}, {"_id": 0})
        if not sim:
            raise HTTPException(status_code=400, detail="Devi attivare il Conto UP per pagare con saldo EUR")
        eur_balance = sim.get("eur_balance", 0)
        if eur_balance < data.amount:
            raise HTTPException(status_code=400, detail=f"Saldo EUR insufficiente. Disponibile: {eur_balance:.2f}")
        await db.sims.update_one({"user_id": user["id"]}, {"$inc": {"eur_balance": -data.amount}})

    elif data.payment_method == "card":
        # Real payment through GestPay
        if not data.card_number or not data.exp_month or not data.exp_year or not data.cvv:
            raise HTTPException(status_code=400, detail="Dati carta richiesti per il pagamento")

        from services.gestpay import process_card_payment
        gestpay_result = await process_card_payment(
            amount=float(data.amount),
            card_number=data.card_number,
            exp_month=data.exp_month,
            exp_year=data.exp_year,
            cvv=data.cvv,
            buyer_email=user.get("email"),
            buyer_name=user.get("full_name"),
        )

        if not gestpay_result["success"]:
            raise HTTPException(status_code=400, detail=f"Pagamento rifiutato: {gestpay_result.get('error', 'Errore')}")

        # Store GestPay transaction
        await db.gestpay_transactions.insert_one({
            "user_id": user["id"],
            "type": "giftcard_purchase",
            "amount": float(data.amount),
            "description": f"Gift Card {card['brand']} - {data.amount} EUR",
            "shop_transaction_id": gestpay_result.get("shop_transaction_id"),
            "payment_id": gestpay_result.get("payment_id"),
            "bank_transaction_id": gestpay_result.get("bank_transaction_id"),
            "authorization_code": gestpay_result.get("authorization_code"),
            "transaction_result": gestpay_result.get("transaction_result"),
            "success": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"GestPay payment OK for {card['brand']}: {gestpay_result.get('authorization_code')}")

    else:
        raise HTTPException(status_code=400, detail="Metodo di pagamento non valido")

    # Call brand API for activation code
    api_result = await call_brand_api(card, data.amount, user)

    # Credit cashback in UP
    cashback = round(data.amount * card["cashback_percent"] / 100, 2)
    await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": cashback}})

    purchase_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "giftcard_id": card["id"],
        "brand": card["brand"],
        "amount": data.amount,
        "cashback_percent": card["cashback_percent"],
        "cashback_earned": cashback,
        "payment_method": data.payment_method,
        "activation_code": api_result.get("activation_code"),
        "api_response": api_result.get("raw_response"),
        "api_status": api_result.get("status"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.giftcard_purchases.insert_one(purchase_doc)

    return GiftCardPurchaseResponse(**purchase_doc)


@router.get("/my-purchases")
async def get_my_purchases(user: dict = Depends(get_current_user)):
    purchases = await db.giftcard_purchases.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return purchases


# ========================
# ADMIN ROUTES
# ========================

async def require_admin(user: dict = Depends(get_current_user)):
    if user.get("email") != "admin@test.com":
        raise HTTPException(status_code=403, detail="Accesso admin richiesto")
    return user


@router.get("/admin/all")
async def admin_get_all_giftcards(user: dict = Depends(require_admin)):
    cards = await db.giftcards.find({}, {"_id": 0}).to_list(100)
    result = []
    for c in cards:
        c["api_configured"] = bool(c.get("api_endpoint") and c.get("api_key"))
        result.append(c)
    return result


@router.post("/admin/create")
async def admin_create_giftcard(data: GiftCardCreate, user: dict = Depends(require_admin)):
    card_doc = {
        "id": str(uuid.uuid4()),
        "brand": data.brand,
        "category": data.category,
        "cashback_percent": data.cashback_percent,
        "logo_color": data.logo_color,
        "logo_url": None,
        "available_amounts": data.available_amounts,
        "active": True,
        "api_endpoint": None,
        "api_key": None,
        "api_method": "POST",
        "api_headers": None,
        "api_body_template": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.giftcards.insert_one(card_doc)
    card_doc.pop("_id", None)
    card_doc["api_configured"] = False
    return card_doc


@router.put("/admin/{giftcard_id}")
async def admin_update_giftcard(giftcard_id: str, data: GiftCardUpdate, user: dict = Depends(require_admin)):
    update_fields = {}
    if data.cashback_percent is not None:
        if data.cashback_percent < 0 or data.cashback_percent > 50:
            raise HTTPException(status_code=400, detail="Cashback deve essere tra 0% e 50%")
        update_fields["cashback_percent"] = data.cashback_percent
    if data.active is not None:
        update_fields["active"] = data.active

    if not update_fields:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

    result = await db.giftcards.update_one({"id": giftcard_id}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Gift card non trovata")

    card = await db.giftcards.find_one({"id": giftcard_id}, {"_id": 0})
    return card


@router.put("/admin/{giftcard_id}/api-config")
async def admin_update_api_config(giftcard_id: str, data: GiftCardApiConfig, user: dict = Depends(require_admin)):
    """Configure the brand API for a gift card."""
    card = await db.giftcards.find_one({"id": giftcard_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Gift card non trovata")

    update = {
        "api_endpoint": data.api_endpoint,
        "api_key": data.api_key,
        "api_method": data.api_method or "POST",
        "api_headers": data.api_headers,
        "api_body_template": data.api_body_template,
    }
    await db.giftcards.update_one({"id": giftcard_id}, {"$set": update})
    logger.info(f"API config updated for {card['brand']}: {data.api_endpoint}")

    return {"success": True, "brand": card["brand"], "api_configured": True}


@router.post("/admin/{giftcard_id}/test-api")
async def admin_test_api(giftcard_id: str, user: dict = Depends(require_admin)):
    """Test the brand API configuration with a test call."""
    card = await db.giftcards.find_one({"id": giftcard_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Gift card non trovata")

    if not card.get("api_endpoint") or not card.get("api_key"):
        raise HTTPException(status_code=400, detail="API non configurata per questa gift card")

    test_user = {"email": "test@test.com", "full_name": "Test User"}
    result = await call_brand_api(card, 0, test_user)

    return {
        "brand": card["brand"],
        "api_status": result["status"],
        "activation_code": result.get("activation_code"),
        "raw_response": result.get("raw_response"),
    }


@router.post("/admin/{giftcard_id}/logo")
async def admin_upload_logo(giftcard_id: str, file: UploadFile = File(...), user: dict = Depends(require_admin)):
    card = await db.giftcards.find_one({"id": giftcard_id})
    if not card:
        raise HTTPException(status_code=404, detail="Gift card non trovata")

    allowed = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Formato non supportato. Usa JPG, PNG, WebP o SVG")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File troppo grande (max 5MB)")

    ext = os.path.splitext(file.filename)[1] if file.filename else ".png"
    filename = f"{giftcard_id}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(content)

    logo_url = f"/api/giftcards/logo/{filename}"
    await db.giftcards.update_one({"id": giftcard_id}, {"$set": {"logo_url": logo_url}})

    return {"success": True, "logo_url": logo_url}


@router.get("/logo/{filename}")
async def get_logo(filename: str):
    from fastapi.responses import FileResponse
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Logo non trovato")
    return FileResponse(filepath)
