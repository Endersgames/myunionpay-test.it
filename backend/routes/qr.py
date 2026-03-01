from fastapi import APIRouter, HTTPException
from database import db

router = APIRouter(tags=["qr"])


@router.get("/qr/referral/{qr_code}", response_model=dict)
async def get_referral_from_qr(qr_code: str):
    """Get referral code from a user's QR code - used when non-logged user scans QR"""
    merchant = await db.merchants.find_one({"qr_code": qr_code}, {"_id": 0})
    if merchant:
        user = await db.users.find_one({"id": merchant["user_id"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=404, detail="QR code non valido")
        return {
            "referral_code": user.get("referral_code", ""),
            "name": merchant.get("business_name", user.get("full_name", "")),
            "qr_code": qr_code,
            "type": "merchant",
            "is_merchant": True,
            "merchant_id": merchant.get("id", ""),
            "merchant_category": merchant.get("category", ""),
            "merchant_description": merchant.get("description", ""),
            "merchant_address": merchant.get("address", "")
        }

    user = await db.users.find_one({"qr_code": qr_code}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="QR code non valido")

    return {
        "referral_code": user.get("referral_code", ""),
        "name": user.get("full_name", ""),
        "qr_code": qr_code,
        "type": "user",
        "is_merchant": False
    }
