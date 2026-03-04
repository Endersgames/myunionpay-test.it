from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
import uuid
import os
import logging
from datetime import datetime, timezone
from database import db
from services.auth import get_current_user

router = APIRouter(prefix="/giftcards", tags=["giftcards"])
logger = logging.getLogger("giftcards")

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "logos")
os.makedirs(UPLOAD_DIR, exist_ok=True)


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


class GiftCardUpdate(BaseModel):
    cashback_percent: Optional[float] = None
    active: Optional[bool] = None


class GiftCardPurchase(BaseModel):
    giftcard_id: str
    amount: int
    payment_method: str  # "conto_up" or "linked_card"


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
    # Validate card number (basic check)
    clean_number = data.card_number.replace(" ", "").replace("-", "")
    if len(clean_number) < 13 or len(clean_number) > 19:
        raise HTTPException(status_code=400, detail="Numero carta non valido")

    if len(data.cvv) < 3:
        raise HTTPException(status_code=400, detail="CVV non valido")

    # Detect card brand
    first_digit = clean_number[0]
    if first_digit == "4":
        card_brand = "Visa"
    elif first_digit == "5":
        card_brand = "Mastercard"
    elif first_digit == "3":
        card_brand = "Amex"
    else:
        card_brand = "Carta"

    # Remove existing card
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

    # Payment with EUR (not UP)
    if data.payment_method == "conto_up":
        sim = await db.sims.find_one({"user_id": user["id"]}, {"_id": 0})
        if not sim:
            raise HTTPException(status_code=400, detail="Devi attivare il Conto UP per pagare con saldo EUR")
        eur_balance = sim.get("eur_balance", 0)
        if eur_balance < data.amount:
            raise HTTPException(status_code=400, detail=f"Saldo EUR insufficiente. Disponibile: {eur_balance:.2f}")
        # Deduct EUR from Conto UP
        await db.sims.update_one({"user_id": user["id"]}, {"$inc": {"eur_balance": -data.amount}})

    elif data.payment_method == "linked_card":
        linked = await db.linked_cards.find_one({"user_id": user["id"]}, {"_id": 0})
        if not linked:
            raise HTTPException(status_code=400, detail="Nessuna carta collegata. Collega una carta prima di procedere.")
        # Simulated payment - in production would call Fabrick API
        logger.info(f"Simulated card payment: {data.amount} EUR from card ****{linked['last_four']}")

    else:
        raise HTTPException(status_code=400, detail="Metodo di pagamento non valido")

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
    return cards


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
    return {k: v for k, v in card.items() if k != "_id"}


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
