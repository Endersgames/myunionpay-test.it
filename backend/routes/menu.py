from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
import uuid
import os
import logging
from datetime import datetime, timezone
from database import db
from services.auth import get_current_user

router = APIRouter(prefix="/menu", tags=["menu"])
logger = logging.getLogger("menu")

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "menu")
COVER_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "covers")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(COVER_DIR, exist_ok=True)

LANGUAGES = ["it", "en", "fr", "de", "es"]
MENU_CATEGORIES = ["antipasti", "primi", "secondi", "dolci", "bevande"]


# ========================
# MODELS
# ========================

class MultiLangText(BaseModel):
    it: str = ""
    en: Optional[str] = ""
    fr: Optional[str] = ""
    de: Optional[str] = ""
    es: Optional[str] = ""


class HealthInfo(BaseModel):
    recommended_for: Optional[MultiLangText] = None
    not_recommended_for: Optional[MultiLangText] = None


class MenuItemCreate(BaseModel):
    category: str
    name: MultiLangText
    description: Optional[MultiLangText] = None
    price: float
    origin: Optional[str] = None
    calories: Optional[int] = None
    health: Optional[HealthInfo] = None
    order: Optional[int] = 0


class MenuItemUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[MultiLangText] = None
    description: Optional[MultiLangText] = None
    price: Optional[float] = None
    origin: Optional[str] = None
    calories: Optional[int] = None
    health: Optional[HealthInfo] = None
    active: Optional[bool] = None
    order: Optional[int] = None


class MenuItemResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    merchant_id: str
    category: str
    name: dict
    description: Optional[dict] = None
    price: float
    image_url: Optional[str] = None
    origin: Optional[str] = None
    calories: Optional[int] = None
    health: Optional[dict] = None
    active: bool
    order: int
    created_at: str


# ========================
# HELPERS
# ========================

async def get_merchant_for_user(user: dict):
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=403, detail="Non sei un merchant")
    cat = merchant.get("category", "").lower()
    allowed = ["ristorante", "ristoranti e pizzerie", "bar", "bar e caffetterie", "alimentari e bevande", "alimentari"]
    if not any(a in cat for a in allowed):
        raise HTTPException(status_code=403, detail="Il menu e disponibile solo per ristoranti e bar")
    return merchant


# ========================
# MERCHANT COVER IMAGE
# ========================

@router.post("/cover-image")
async def upload_cover_image(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=403, detail="Non sei un merchant")

    allowed = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Formato non supportato. Usa JPG, PNG o WebP")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File troppo grande (max 5MB)")

    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{merchant['id']}{ext}"
    filepath = os.path.join(COVER_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(content)

    cover_url = f"/api/menu/cover/{filename}"
    await db.merchants.update_one({"id": merchant["id"]}, {"$set": {"cover_image_url": cover_url}})

    return {"success": True, "cover_image_url": cover_url}


@router.get("/cover/{filename}")
async def get_cover_image(filename: str):
    from fastapi.responses import FileResponse
    filepath = os.path.join(COVER_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Immagine non trovata")
    return FileResponse(filepath)


# ========================
# MENU CRUD (MERCHANT)
# ========================

@router.get("/my-items", response_model=List[MenuItemResponse])
async def get_my_menu(user: dict = Depends(get_current_user)):
    merchant = await get_merchant_for_user(user)
    items = await db.menu_items.find(
        {"merchant_id": merchant["id"]}, {"_id": 0}
    ).sort("order", 1).to_list(500)
    return [MenuItemResponse(**i) for i in items]


@router.post("/items", response_model=MenuItemResponse)
async def create_menu_item(data: MenuItemCreate, user: dict = Depends(get_current_user)):
    merchant = await get_merchant_for_user(user)

    if data.category not in MENU_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Categoria non valida. Scegli tra: {', '.join(MENU_CATEGORIES)}")

    if data.price < 0:
        raise HTTPException(status_code=400, detail="Prezzo non valido")

    item_doc = {
        "id": str(uuid.uuid4()),
        "merchant_id": merchant["id"],
        "category": data.category,
        "name": data.name.model_dump(),
        "description": data.description.model_dump() if data.description else None,
        "price": data.price,
        "image_url": None,
        "origin": data.origin,
        "calories": data.calories,
        "health": data.health.model_dump() if data.health else None,
        "active": True,
        "order": data.order or 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.menu_items.insert_one(item_doc)
    item_doc.pop("_id", None)
    return MenuItemResponse(**item_doc)


@router.put("/items/{item_id}", response_model=MenuItemResponse)
async def update_menu_item(item_id: str, data: MenuItemUpdate, user: dict = Depends(get_current_user)):
    merchant = await get_merchant_for_user(user)
    item = await db.menu_items.find_one({"id": item_id, "merchant_id": merchant["id"]}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Piatto non trovato")

    update = {}
    if data.category is not None:
        update["category"] = data.category
    if data.name is not None:
        update["name"] = data.name.model_dump()
    if data.description is not None:
        update["description"] = data.description.model_dump()
    if data.price is not None:
        update["price"] = data.price
    if data.origin is not None:
        update["origin"] = data.origin
    if data.calories is not None:
        update["calories"] = data.calories
    if data.health is not None:
        update["health"] = data.health.model_dump()
    if data.active is not None:
        update["active"] = data.active
    if data.order is not None:
        update["order"] = data.order

    if update:
        await db.menu_items.update_one({"id": item_id}, {"$set": update})

    updated = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    return MenuItemResponse(**updated)


@router.delete("/items/{item_id}")
async def delete_menu_item(item_id: str, user: dict = Depends(get_current_user)):
    merchant = await get_merchant_for_user(user)
    result = await db.menu_items.delete_one({"id": item_id, "merchant_id": merchant["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Piatto non trovato")
    return {"success": True}


@router.post("/items/{item_id}/image")
async def upload_item_image(item_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    merchant = await get_merchant_for_user(user)
    item = await db.menu_items.find_one({"id": item_id, "merchant_id": merchant["id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Piatto non trovato")

    allowed = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Formato non supportato")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File troppo grande (max 5MB)")

    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{item_id}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(content)

    image_url = f"/api/menu/dish-image/{filename}"
    await db.menu_items.update_one({"id": item_id}, {"$set": {"image_url": image_url}})

    return {"success": True, "image_url": image_url}


@router.get("/dish-image/{filename}")
async def get_dish_image(filename: str):
    from fastapi.responses import FileResponse
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Immagine non trovata")
    return FileResponse(filepath)


# ========================
# PUBLIC MENU (NO AUTH)
# ========================

@router.get("/public/{merchant_id}")
async def get_public_menu(merchant_id: str):
    merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Ristorante non trovato")

    items = await db.menu_items.find(
        {"merchant_id": merchant_id, "active": True}, {"_id": 0}
    ).sort("order", 1).to_list(500)

    return {
        "merchant": {
            "id": merchant["id"],
            "business_name": merchant["business_name"],
            "description": merchant.get("description", ""),
            "category": merchant.get("category", ""),
            "address": merchant.get("address", ""),
            "cover_image_url": merchant.get("cover_image_url"),
            "qr_code": merchant.get("qr_code", ""),
        },
        "categories": MENU_CATEGORIES,
        "items": items,
        "languages": LANGUAGES,
    }
