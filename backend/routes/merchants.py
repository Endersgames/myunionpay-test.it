from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from database import db, MERCHANT_CATEGORIES
from models import MerchantCreate, MerchantResponse
from services.auth import get_current_user, generate_qr_code

router = APIRouter(prefix="/merchants", tags=["merchants"])


@router.post("", response_model=MerchantResponse)
async def create_merchant(data: MerchantCreate, user: dict = Depends(get_current_user)):
    existing = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Sei già registrato come merchant")

    merchant_id = str(uuid.uuid4())
    qr_code = generate_qr_code()

    merchant_doc = {
        "id": merchant_id,
        "user_id": user["id"],
        "business_name": data.business_name,
        "description": data.description,
        "category": data.category,
        "address": data.address,
        "image_url": data.image_url,
        "qr_code": qr_code,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.merchants.insert_one(merchant_doc)
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_merchant": True}})

    return MerchantResponse(**merchant_doc)


@router.get("", response_model=List[MerchantResponse])
async def get_merchants(category: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category

    merchants = await db.merchants.find(query, {"_id": 0}).to_list(100)
    return [MerchantResponse(**m) for m in merchants]


@router.get("/me", response_model=MerchantResponse)
async def get_my_merchant(user: dict = Depends(get_current_user)):
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Non sei un merchant")
    return MerchantResponse(**merchant)


@router.get("/categories/list", response_model=List[str])
async def get_merchant_categories():
    return MERCHANT_CATEGORIES


@router.get("/{merchant_id}", response_model=MerchantResponse)
async def get_merchant(merchant_id: str):
    merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant non trovato")
    return MerchantResponse(**merchant)
