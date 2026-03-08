"""MYU Cost Control Layer - Budget enforcement, estimation, and logging."""
import logging
import uuid
from datetime import datetime, timezone
from database import db

logger = logging.getLogger("myu.cost")

MAX_COST_PER_REQUEST = 0.0035  # USD
MAX_LLM_CALLS_PER_MSG = 1
MAX_TOOL_CALLS_PER_MSG = 1
MAX_OUTPUT_TOKENS = 150
MAX_CONTEXT_TOKENS = 500

# Cost per 1M tokens (USD) - updated for supported models
TOKEN_COSTS = {
    "gpt-4.1-nano": {"input": 0.10, "output": 0.40},
    "gpt-4.1-mini": {"input": 0.40, "output": 1.60},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gemini-2.0-flash-lite": {"input": 0.075, "output": 0.30},
}

DEFAULT_MODEL = "gpt-4o-mini"

# Tool costs (estimated per call, USD)
TOOL_COSTS = {
    "merchant_finder": 0.0,
    "wallet": 0.0,
    "tasks": 0.0,
    "notifications": 0.0,
    "cinema_finder": 0.0005,
    "restaurant_finder": 0.0005,
    "weather": 0.0003,
    "map_lookup": 0.0005,
}


def count_tokens(text: str) -> int:
    """Rough token estimation: ~4 chars per token."""
    return max(1, len(text) // 4)


def estimate_request_cost(
    model: str,
    context_tokens: int,
    output_tokens: int,
    tool_name: str = None,
) -> float:
    """Estimate total request cost in USD."""
    costs = TOKEN_COSTS.get(model, TOKEN_COSTS[DEFAULT_MODEL])
    llm_cost = (context_tokens * costs["input"] / 1_000_000) + (output_tokens * costs["output"] / 1_000_000)
    tool_cost = TOOL_COSTS.get(tool_name, 0.0) if tool_name else 0.0
    return llm_cost + tool_cost


def check_budget(estimated_cost: float) -> dict:
    """Check if estimated cost is within budget. Returns decision."""
    if estimated_cost <= MAX_COST_PER_REQUEST:
        return {"allowed": True, "cost": estimated_cost}
    return {
        "allowed": False,
        "cost": estimated_cost,
        "reason": f"Costo stimato {estimated_cost:.6f} USD supera il limite di {MAX_COST_PER_REQUEST} USD",
    }


def cap_tokens(text: str, max_tokens: int) -> str:
    """Truncate text to fit within token budget."""
    max_chars = max_tokens * 4
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "..."


async def log_request_cost(
    request_id: str,
    user_id: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    tool_name: str = None,
    tool_cost: float = 0.0,
    fallback_triggered: bool = False,
) -> None:
    """Log cost details for a single request."""
    costs = TOKEN_COSTS.get(model, TOKEN_COSTS[DEFAULT_MODEL])
    llm_cost = (input_tokens * costs["input"] / 1_000_000) + (output_tokens * costs["output"] / 1_000_000)

    await db.request_cost_logs.insert_one({
        "request_id": request_id,
        "user_id": user_id,
        "llm_model": model,
        "estimated_input_tokens": input_tokens,
        "estimated_output_tokens": output_tokens,
        "estimated_llm_cost": round(llm_cost, 8),
        "tool_name": tool_name,
        "estimated_tool_cost": round(tool_cost, 8),
        "total_estimated_cost": round(llm_cost + tool_cost, 8),
        "fallback_triggered": fallback_triggered,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


def generate_request_id() -> str:
    return str(uuid.uuid4())
