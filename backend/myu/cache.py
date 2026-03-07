"""MYU Cache Layer - Tool result caching with TTL."""
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from database import db

logger = logging.getLogger("myu.cache")

# TTL in minutes per tool type
TTL_CONFIG = {
    "cinema_finder": 30,
    "restaurant_finder": 30,
    "weather": 15,
    "merchant_finder": 30,
    "event_finder": 30,
    "wallet": 2,
    "tasks": 2,
    "notifications": 5,
    "default": 60,
}


def build_cache_key(tool_type: str, geohash4: str = "", query: str = "") -> str:
    """Build a deterministic cache key."""
    raw = f"{tool_type}:{geohash4}:{query.lower().strip()}"
    return hashlib.md5(raw.encode()).hexdigest()


async def get_cached(cache_key: str) -> dict | None:
    """Get cached tool result if not expired."""
    now = datetime.now(timezone.utc)
    result = await db.tool_cache.find_one(
        {"cache_key": cache_key, "expires_at": {"$gt": now.isoformat()}},
        {"_id": 0, "payload": 1},
    )
    if result:
        logger.info(f"Cache HIT: {cache_key}")
        return result["payload"]
    return None


async def set_cached(
    cache_key: str,
    tool_type: str,
    geohash4: str,
    city: str,
    query_type: str,
    payload: dict,
) -> None:
    """Store tool result in cache with TTL."""
    ttl = TTL_CONFIG.get(tool_type, TTL_CONFIG["default"])
    expires = datetime.now(timezone.utc) + timedelta(minutes=ttl)

    await db.tool_cache.update_one(
        {"cache_key": cache_key},
        {"$set": {
            "cache_key": cache_key,
            "tool_type": tool_type,
            "geohash_4": geohash4,
            "city": city,
            "query_type": query_type,
            "payload": payload,
            "expires_at": expires.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    logger.info(f"Cache SET: {cache_key} TTL={ttl}min")


async def cleanup_expired():
    """Remove expired cache entries."""
    now = datetime.now(timezone.utc).isoformat()
    result = await db.tool_cache.delete_many({"expires_at": {"$lt": now}})
    if result.deleted_count:
        logger.info(f"Cache cleanup: removed {result.deleted_count} expired entries")
