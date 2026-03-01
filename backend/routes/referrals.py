from fastapi import APIRouter, Depends
from database import db
from services.auth import get_current_user

router = APIRouter(prefix="/referrals", tags=["referrals"])


@router.get("/stats", response_model=dict)
async def get_referral_stats(user: dict = Depends(get_current_user)):
    total_referrals = await db.referrals.count_documents({"referrer_id": user["id"]})
    return {
        "referral_code": user["referral_code"],
        "total_referrals": total_referrals,
        "up_points": user["up_points"]
    }
