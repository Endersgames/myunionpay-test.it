"""MYU Tool - Wallet (Real - queries MongoDB)."""
from database import db


async def execute(user_id: str, city: str = None, geohash4: str = None, query: str = "", intent: str = "") -> dict:
    """Get wallet info for the user."""
    wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0, "balance": 1})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "up_points": 1})

    # Recent transactions
    txs = await db.transactions.find(
        {"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]},
        {"_id": 0, "type": 1, "amount": 1, "description": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(5)

    return {
        "balance": wallet.get("balance", 0) if wallet else 0,
        "up_points": user.get("up_points", 0) if user else 0,
        "recent_transactions": txs,
    }
