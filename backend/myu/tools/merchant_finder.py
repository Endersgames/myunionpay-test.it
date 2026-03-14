"""MYU Tool - Merchant Finder (Real - queries MongoDB)."""
from database import db


async def execute(user_id: str, city: str = None, geohash4: str = None, query: str = "", intent: str = "") -> dict:
    """Find merchants, optionally filtered by city or user interests."""
    # Get user interests for ranking
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "profile_tags": 1})
    tags = user.get("profile_tags", []) if user else []

    # Build query
    q = {"is_active": True}
    if city:
        q["address"] = {"$regex": city, "$options": "i"}

    merchants = await db.merchants.find(
        q, {"_id": 0, "id": 1, "business_name": 1, "category": 1, "description": 1, "address": 1}
    ).to_list(10)

    # Simple ranking: merchants matching user tags score higher
    if tags:
        tag_lower = [t.lower() for t in tags]
        for m in merchants:
            cat = (m.get("category") or "").lower()
            desc = (m.get("description") or "").lower()
            m["_score"] = sum(1 for t in tag_lower if t in cat or t in desc)
        merchants.sort(key=lambda x: x.get("_score", 0), reverse=True)
        for m in merchants:
            m.pop("_score", None)

    return {"merchants": merchants, "count": len(merchants), "city": city}
