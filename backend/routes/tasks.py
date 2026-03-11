from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
import uuid
import os
from datetime import datetime, timezone
from database import db
from services.auth import get_current_user

router = APIRouter(prefix="/tasks", tags=["tasks"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class TaskResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    task_type: str
    title: str
    description: str
    reward_up: float
    status: str  # "pending", "uploaded", "verified", "rejected"
    file_name: Optional[str] = None
    submitted_at: Optional[str] = None
    verified_at: Optional[str] = None
    created_at: str


@router.get("", response_model=List[TaskResponse])
async def get_my_tasks(user: dict = Depends(get_current_user)):
    """Get all tasks for current user, create default ones if none exist"""
    tasks = await db.tasks.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)

    if not tasks:
        # Create the default residence verification task
        task_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "task_type": "residence_verification",
            "title": "Verifica residenza",
            "description": "Se carichi un'utenza MYU ti fara un'offerta :) e riceverai subito 5 UP",
            "reward_up": 5.0,
            "status": "pending",
            "file_name": None,
            "submitted_at": None,
            "verified_at": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.tasks.insert_one(task_doc)
        tasks = [task_doc]

    return [TaskResponse(**{k: v for k, v in t.items() if k != "_id"}) for t in tasks]


@router.post("/{task_id}/upload")
async def upload_task_document(
    task_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Upload a document for a task (energy/gas bill for residence verification)"""
    task = await db.tasks.find_one({"id": task_id, "user_id": user["id"]}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task non trovato")

    if task["status"] == "verified":
        raise HTTPException(status_code=400, detail="Task già completato e verificato")

    # Validate file type
    allowed_types = [
        "image/jpeg", "image/png", "image/webp",
        "application/pdf"
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Formato file non supportato. Usa JPG, PNG, WebP o PDF"
        )

    # Validate file size (max 10MB)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File troppo grande (max 10MB)")

    # Save file
    ext = os.path.splitext(file.filename)[1] if file.filename else ".bin"
    safe_name = f"{task_id}_{user['id'][:8]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(file_path, "wb") as f:
        f.write(content)

    now = datetime.now(timezone.utc).isoformat()

    # Update task status to uploaded -> auto-verify for demo and credit UP
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {
            "status": "verified",
            "file_name": file.filename,
            "submitted_at": now,
            "verified_at": now,
        }}
    )

    # Credit reward UP to wallet
    reward = task["reward_up"]
    await db.wallets.update_one(
        {"user_id": user["id"]},
        {"$inc": {"balance": reward}}
    )
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"up_points": int(reward)}}
    )

    return {
        "success": True,
        "message": f"Documento caricato e verificato! Hai ricevuto {int(reward)} UP",
        "reward_up": reward,
        "status": "verified"
    }
