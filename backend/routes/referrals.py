from fastapi import APIRouter, Depends
from database import db
from services.auth import get_current_user

router = APIRouter(prefix="/referrals", tags=["referrals"])


@router.get("/stats", response_model=dict)
async def get_referral_stats(user: dict = Depends(get_current_user)):
    referral_docs = await db.referrals.find(
        {"referrer_id": user["id"]},
        {"_id": 0, "reward_amount": 1, "bonus_amount": 1, "referred_bonus_amount": 1}
    ).to_list(1000)
    total_referrals = len(referral_docs)
    total_referral_bonus = sum(
        float(doc.get("reward_amount", doc.get("bonus_amount", 0)) or 0)
        for doc in referral_docs
    )
    total_referred_bonus = sum(
        float(doc.get("referred_bonus_amount", 0) or 0)
        for doc in referral_docs
    )
    return {
        "referral_code": user["referral_code"],
        "total_referrals": total_referrals,
        "up_points": user["up_points"],
        "total_referral_bonus": total_referral_bonus,
        "total_referred_bonus": total_referred_bonus,
    }
