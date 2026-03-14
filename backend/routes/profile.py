from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List
import os
import uuid
from datetime import datetime, timezone
from database import db, PROFILE_TAGS
from models import ProfileTagsUpdate
from services.auth import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "profiles")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/tags", response_model=List[str])
async def get_profile_tags():
    return PROFILE_TAGS


@router.put("/tags", response_model=dict)
async def update_my_tags(data: ProfileTagsUpdate, user: dict = Depends(get_current_user)):
    valid_tags = [t for t in data.tags if t in PROFILE_TAGS]
    await db.users.update_one({"id": user["id"]}, {"$set": {"profile_tags": valid_tags}})
    return {"tags": valid_tags}


@router.get("/my-tags", response_model=dict)
async def get_my_tags(user: dict = Depends(get_current_user)):
    return {"tags": user.get("profile_tags", [])}


@router.put("/personal", response_model=dict)
async def update_personal_data(data: dict, user: dict = Depends(get_current_user)):
    """Update personal data: full_name, email, phone, address."""
    allowed = {}
    if "full_name" in data and data["full_name"].strip():
        allowed["full_name"] = data["full_name"].strip()
    if "phone" in data and data["phone"].strip():
        allowed["phone"] = data["phone"].strip()
    if "address" in data:
        allowed["address"] = data["address"].strip()
    if not allowed:
        raise HTTPException(status_code=400, detail="Nessun dato da aggiornare")
    allowed["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"id": user["id"]}, {"$set": allowed})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"message": "Dati aggiornati", "user": {
        "full_name": updated.get("full_name", ""),
        "email": updated.get("email", ""),
        "phone": updated.get("phone", ""),
        "address": updated.get("address", ""),
    }}


@router.post("/picture", response_model=dict)
async def upload_profile_picture(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Upload profile picture."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo immagini sono accettate")
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Immagine troppo grande (max 5MB)")
    with open(filepath, "wb") as f:
        f.write(content)
    picture_url = f"/api/uploads/profiles/{filename}"
    await db.users.update_one({"id": user["id"]}, {"$set": {"profile_picture": picture_url}})
    return {"picture_url": picture_url}


@router.get("/data-treatment", response_model=dict)
async def get_data_treatment(user: dict = Depends(get_current_user)):
    """Get user's data treatment preferences."""
    prefs = user.get("data_treatment", {
        "section_1": False, "section_2": False,
        "section_3": False, "section_4": False
    })
    sections = await db.app_content.find(
        {"key": {"$regex": "^data_treatment_"}},
        {"_id": 0}
    ).to_list(10)
    section_map = {s["key"]: s for s in sections}
    result = []
    for i in range(1, 5):
        key = f"data_treatment_{i}"
        sec = section_map.get(key, {"title": f"Sezione {i}", "content": ""})
        result.append({
            "key": key,
            "title": sec.get("title", f"Sezione {i}"),
            "content": sec.get("content", ""),
            "authorized": prefs.get(f"section_{i}", False)
        })
    any_active = any(prefs.get(f"section_{i}", False) for i in range(1, 5))
    return {"sections": result, "status": "Attivo" if any_active else "Non attivo"}


@router.put("/data-treatment", response_model=dict)
async def update_data_treatment(data: dict, user: dict = Depends(get_current_user)):
    """Update data treatment switches."""
    prefs = {}
    for i in range(1, 5):
        key = f"section_{i}"
        if key in data:
            prefs[key] = bool(data[key])
    if not prefs:
        raise HTTPException(status_code=400, detail="Nessun dato da aggiornare")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {f"data_treatment.{k}": v for k, v in prefs.items()}}
    )
    return {"message": "Preferenze aggiornate", "data_treatment": prefs}
