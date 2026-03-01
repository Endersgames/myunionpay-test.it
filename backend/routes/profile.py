from fastapi import APIRouter, Depends
from typing import List
from database import db, PROFILE_TAGS
from models import ProfileTagsUpdate
from services.auth import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])


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
