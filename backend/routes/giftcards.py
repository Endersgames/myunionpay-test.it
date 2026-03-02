from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
import uuid
import logging
from datetime import datetime, timezone
from database import db
from services.auth import get_current_user

router = APIRouter(prefix="/giftcards", tags=["giftcards"])
logger = logging.getLogger("giftcards")


class GiftCardResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    brand: str
    category: str
    cashback_percent: float
    logo_color: str
    available_amounts: List[int]
    active: bool


class GiftCardUpdate(BaseModel):
    cashback_percent: Optional[float] = None
    active: Optional[bool] = None


class GiftCardPurchase(BaseModel):
    giftcard_id: str
    amount: int


class GiftCardPurchaseResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    giftcard_id: str
    brand: str
    amount: int
    cashback_percent: float
    cashback_earned: float
    created_at: str


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

    wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    if not wallet or wallet["balance"] < data.amount:
        raise HTTPException(status_code=400, detail="Saldo UP insufficiente")

    # Deduct amount from wallet
    await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": -data.amount}})

    # Calculate and credit cashback
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


@router.get("/admin/all", response_model=List[GiftCardResponse])
async def admin_get_all_giftcards(user: dict = Depends(require_admin)):
    cards = await db.giftcards.find({}, {"_id": 0}).to_list(100)
    return [GiftCardResponse(**c) for c in cards]


@router.put("/admin/{giftcard_id}", response_model=GiftCardResponse)
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
    return GiftCardResponse(**card)
