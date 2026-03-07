"""MYU Tool Router - Routes intents to appropriate tools."""
import logging
from myu.tools import merchant_finder, cinema_finder, restaurant_finder, weather, wallet, tasks, notifications

logger = logging.getLogger("myu.tools.router")

TOOL_MAP = {
    "merchant_finder": merchant_finder.execute,
    "cinema_finder": cinema_finder.execute,
    "restaurant_finder": restaurant_finder.execute,
    "weather": weather.execute,
    "wallet": wallet.execute,
    "tasks": tasks.execute,
    "notifications": notifications.execute,
}


async def route_tool(tool_name: str, user_id: str, city: str = None, geohash4: str = None, query: str = "", intent: str = "") -> dict:
    """Execute a single tool and return result.
    Returns: {tool: str, data: dict, cost: float}
    """
    handler = TOOL_MAP.get(tool_name)
    if not handler:
        logger.warning(f"Unknown tool: {tool_name}")
        return {"tool": tool_name, "data": {}, "cost": 0.0, "error": "Tool non disponibile"}

    try:
        result = await handler(user_id=user_id, city=city, geohash4=geohash4, query=query, intent=intent)
        return {"tool": tool_name, "data": result, "cost": 0.0, "error": None}
    except Exception as e:
        logger.error(f"Tool {tool_name} error: {e}")
        return {"tool": tool_name, "data": {}, "cost": 0.0, "error": str(e)}
