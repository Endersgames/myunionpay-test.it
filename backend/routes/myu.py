"""MYU API Routes - Chat, location, tools, costs."""
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import uuid
import logging
from datetime import datetime, timezone
from database import db
from services.auth import get_current_user
from myu.orchestrator import handle_chat, MYU_COST_PER_MSG
from myu.location import save_location, get_location_state, confirm_city
from myu.tools.router import route_tool
from myu.cost_control import generate_request_id

router = APIRouter(prefix="/myu", tags=["myu"])
logger = logging.getLogger("myu.routes")


# --- Models ---

class ChatMessage(BaseModel):
    text: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

class CityConfirm(BaseModel):
    city: str

class TaskUpdate(BaseModel):
    status: str

class ToolQuery(BaseModel):
    city: Optional[str] = None
    query: Optional[str] = ""


# --- Chat ---

@router.post("/chat")
async def chat(data: ChatMessage, user=Depends(get_current_user)):
    """Main MYU chat endpoint - orchestrated response."""
    logger.info(f"MYU chat request from user {user['id']}: {data.text[:100]}...")
    
    # If location provided, update it silently
    if data.latitude and data.longitude:
        await save_location(user["id"], data.latitude, data.longitude)

    # Get or create session
    state = await db.myu_conversation_state.find_one({"user_id": user["id"]}, {"_id": 0, "session_id": 1})
    session_id = state["session_id"] if state and "session_id" in state else str(uuid.uuid4())
    if not state or "session_id" not in state:
        await db.myu_conversation_state.update_one(
            {"user_id": user["id"]}, {"$set": {"session_id": session_id}}, upsert=True
        )

    # Check balance
    wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0, "balance": 1})
    balance = wallet.get("balance", 0) if wallet else 0
    if balance < MYU_COST_PER_MSG:
        logger.warning(f"Insufficient balance for user {user['id']}: {balance} < {MYU_COST_PER_MSG}")
        raise HTTPException(status_code=402, detail=f"Saldo insufficiente. Servono almeno {MYU_COST_PER_MSG} UP.")

    try:
        result = await handle_chat(user["id"], data.text, session_id)
        logger.info(f"MYU chat response for user {user['id']}: {result['message'][:100]}...")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MYU chat error for user {user['id']}: {e}", exc_info=True)
        error_payload = {
            "message": "Errore interno del server. Riprova più tardi.",
            "intent": {"domain": "error", "intent": "server_error", "confidence": 1.0},
            "actions": [],
            "cost": 0,
            "balance_after": balance,
            "request_id": generate_request_id(),
            "error_code": "MYU_CHAT_INTERNAL_ERROR",
        }
        if os.environ.get("ENV") == "development" or os.environ.get("DEBUG") == "true":
            error_payload["error"] = str(e)
        return JSONResponse(status_code=500, content=error_payload)


@router.get("/history")
async def get_history(limit: int = 30, user=Depends(get_current_user)):
    """Get recent chat history."""
    messages = await db.myu_conversations.find(
        {"user_id": user["id"]},
        {"_id": 0, "role": 1, "text": 1, "actions": 1, "created_at": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    messages.reverse()
    return messages


@router.post("/new-session")
async def new_session(user=Depends(get_current_user)):
    """Start a new conversation session."""
    new_id = str(uuid.uuid4())
    await db.myu_conversation_state.update_one(
        {"user_id": user["id"]},
        {"$set": {"session_id": new_id, "summary": None, "awaiting_city_confirm": False}},
        upsert=True,
    )
    return {"session_id": new_id}


# --- Tasks ---

@router.get("/tasks")
async def get_tasks(user=Depends(get_current_user)):
    """Get user tasks."""
    tasks = await db.myu_tasks.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return tasks


@router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, user=Depends(get_current_user)):
    """Update task status."""
    result = await db.myu_tasks.find_one_and_update(
        {"id": task_id, "user_id": user["id"]},
        {"$set": {"status": data.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Task non trovato")
    return result


@router.get("/suggestions")
async def suggestions(user=Depends(get_current_user)):
    """Get merchant suggestions for the user."""
    merchants = await db.merchants.find(
        {"is_active": True},
        {"_id": 0, "id": 1, "business_name": 1, "category": 1, "description": 1, "address": 1}
    ).to_list(10)
    return merchants


# --- Location ---

@router.post("/location")
async def update_location(data: LocationUpdate, user=Depends(get_current_user)):
    """Update user location with geohash-4."""
    state = await save_location(user["id"], data.latitude, data.longitude)
    return {"geohash_4": state["geohash_4"], "inferred_city": state["inferred_city"]}


@router.get("/location")
async def get_location(user=Depends(get_current_user)):
    """Get current location state."""
    state = await get_location_state(user["id"])
    if not state:
        return {"geohash_4": None, "inferred_city": None, "city_confirmed": False}
    return {
        "geohash_4": state.get("geohash_4"),
        "inferred_city": state.get("inferred_city"),
        "city_confirmed": state.get("city_confirmed", False),
    }


@router.post("/location/confirm")
async def confirm_location_city(data: CityConfirm, user=Depends(get_current_user)):
    """Confirm the city for location-based queries."""
    state = await confirm_city(user["id"], data.city)
    return {"inferred_city": state.get("inferred_city"), "city_confirmed": True}


# --- Tool Endpoints (direct access) ---

@router.post("/tool/cinema")
async def tool_cinema(data: ToolQuery, user=Depends(get_current_user)):
    """Direct cinema lookup tool."""
    result = await route_tool("cinema_finder", user["id"], data.city, query=data.query or "")
    return result


@router.post("/tool/restaurants")
async def tool_restaurants(data: ToolQuery, user=Depends(get_current_user)):
    """Direct restaurant lookup tool."""
    result = await route_tool("restaurant_finder", user["id"], data.city, query=data.query or "")
    return result


@router.post("/tool/weather")
async def tool_weather(data: ToolQuery, user=Depends(get_current_user)):
    """Direct weather lookup tool."""
    result = await route_tool("weather", user["id"], data.city, query=data.query or "")
    return result


@router.post("/tool/merchants")
async def tool_merchants(data: ToolQuery, user=Depends(get_current_user)):
    """Direct merchant finder tool."""
    result = await route_tool("merchant_finder", user["id"], data.city, query=data.query or "")
    return result


# --- Cost Tracking ---

@router.get("/costs/{request_id}")
async def get_request_cost(request_id: str, user=Depends(get_current_user)):
    """Get cost details for a specific request."""
    cost = await db.request_cost_logs.find_one(
        {"request_id": request_id, "user_id": user["id"]},
        {"_id": 0},
    )
    if not cost:
        raise HTTPException(status_code=404, detail="Richiesta non trovata")
    return cost
