from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from database import db
from services.auth import get_current_user

router = APIRouter(prefix="/admin/content", tags=["admin-content"])


async def require_admin(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Accesso riservato agli admin")
    return user


@router.get("", response_model=dict)
async def get_all_content(user: dict = Depends(require_admin)):
    """Get all admin-managed content."""
    items = await db.app_content.find({}, {"_id": 0}).to_list(50)
    return {"items": items}


@router.get("/{key}", response_model=dict)
async def get_content(key: str, user: dict = Depends(require_admin)):
    """Get specific content by key."""
    item = await db.app_content.find_one({"key": key}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Contenuto non trovato")
    return item


@router.put("/{key}", response_model=dict)
async def update_content(key: str, data: dict, user: dict = Depends(require_admin)):
    """Update content by key."""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if "title" in data:
        update_data["title"] = data["title"]
    if "content" in data:
        update_data["content"] = data["content"]
    result = await db.app_content.update_one(
        {"key": key},
        {"$set": update_data},
        upsert=True
    )
    updated = await db.app_content.find_one({"key": key}, {"_id": 0})
    return {"message": "Contenuto aggiornato", "item": updated}


@router.get("/public/{key}", response_model=dict)
async def get_public_content(key: str):
    """Public endpoint to get content (no auth required)."""
    item = await db.app_content.find_one({"key": key}, {"_id": 0})
    if not item:
        return {"key": key, "title": "", "content": ""}
    return item
