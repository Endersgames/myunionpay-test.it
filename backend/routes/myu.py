from fastapi import APIRouter, Depends, HTTPException
import uuid
import logging
from datetime import datetime, timezone
from database import db
from services.auth import get_current_user
from services.myu_ai import send_message, check_balance, MYU_COST_PER_MSG, get_merchant_suggestions
from models.myu import ChatMessage, TaskUpdate, TaskStatus

router = APIRouter(prefix="/myu", tags=["myu"])
logger = logging.getLogger("myu")


@router.post("/chat")
async def chat(data: ChatMessage, user=Depends(get_current_user)):
    """Send a message to MYU and get a response."""
    balance = await check_balance(user["id"])
    if balance < MYU_COST_PER_MSG:
        raise HTTPException(
            status_code=402,
            detail=f"Saldo insufficiente. Servono almeno {MYU_COST_PER_MSG} UP per chattare con MYU."
        )

    session = await db.myu_conversation_state.find_one(
        {"user_id": user["id"]},
        {"_id": 0, "session_id": 1}
    )
    session_id = session["session_id"] if session and "session_id" in session else str(uuid.uuid4())

    if not session or "session_id" not in session:
        await db.myu_conversation_state.update_one(
            {"user_id": user["id"]},
            {"$set": {"session_id": session_id}},
            upsert=True
        )

    result = await send_message(user["id"], data.text, session_id)
    return result


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
    new_session_id = str(uuid.uuid4())
    await db.myu_conversation_state.update_one(
        {"user_id": user["id"]},
        {"$set": {"session_id": new_session_id, "summary": None}},
        upsert=True
    )
    return {"session_id": new_session_id}


@router.get("/tasks")
async def get_tasks(user=Depends(get_current_user)):
    """Get user tasks."""
    tasks = await db.myu_tasks.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return tasks


@router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, user=Depends(get_current_user)):
    """Update task status."""
    result = await db.myu_tasks.find_one_and_update(
        {"id": task_id, "user_id": user["id"]},
        {"$set": {"status": data.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
        return_document=True,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Task non trovato")
    return result


@router.get("/suggestions")
async def suggestions(user=Depends(get_current_user)):
    """Get merchant suggestions for the user."""
    merchants = await get_merchant_suggestions(user["id"])
    return merchants
