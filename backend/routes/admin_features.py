from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from database import db
from services.auth import get_current_user

router = APIRouter(prefix="/admin/features", tags=["admin-features"])

# Default feature toggles
DEFAULT_FEATURES = {
    "conto_up": {"label": "Conto UP", "category": "fintech", "enabled": True},
    "card_fisica": {"label": "Card Fisica", "category": "fintech", "enabled": True},
    "sim_100gb": {"label": "SIM 100GB", "category": "telefonia", "enabled": True},
    "invita_amici": {"label": "Invita Amici", "category": "generale", "enabled": True},
    "tasks": {"label": "Task", "category": "generale", "enabled": True},
    "interessi": {"label": "I Miei Interessi", "category": "generale", "enabled": True},
    "merchant": {"label": "Sezione Merchant", "category": "generale", "enabled": True},
    "gift_cards": {"label": "Gift Cards", "category": "fintech", "enabled": True},
    "myu_chat": {"label": "MYU Chat", "category": "generale", "enabled": True},
    "qr_payments": {"label": "Pagamenti QR", "category": "fintech", "enabled": True},
}

# Default API configs
DEFAULT_API_CONFIGS = {
    "telefonia": {
        "label": "API Telefonia",
        "provider": "",
        "api_key": "",
        "api_secret": "",
        "endpoint": "",
        "enabled": False,
        "notes": ""
    },
    "fintech": {
        "label": "Funzioni Fintech",
        "provider": "",
        "api_key": "",
        "api_secret": "",
        "endpoint": "",
        "enabled": False,
        "notes": ""
    }
}


async def require_admin(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Accesso riservato agli admin")
    return user


async def ensure_defaults():
    """Ensure default feature toggles and API configs exist."""
    existing = await db.feature_toggles.find_one({"type": "features"}, {"_id": 0})
    if not existing:
        await db.feature_toggles.insert_one({
            "type": "features",
            "toggles": DEFAULT_FEATURES,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    existing_api = await db.feature_toggles.find_one({"type": "api_configs"}, {"_id": 0})
    if not existing_api:
        await db.feature_toggles.insert_one({
            "type": "api_configs",
            "configs": DEFAULT_API_CONFIGS,
            "created_at": datetime.now(timezone.utc).isoformat()
        })


# ========================
# PUBLIC ENDPOINTS
# ========================

@router.get("/public", response_model=dict)
async def get_public_features():
    """Public endpoint - returns which features are enabled."""
    await ensure_defaults()
    doc = await db.feature_toggles.find_one({"type": "features"}, {"_id": 0})
    toggles = doc.get("toggles", DEFAULT_FEATURES) if doc else DEFAULT_FEATURES
    return {k: v["enabled"] for k, v in toggles.items()}


# ========================
# ADMIN ENDPOINTS
# ========================

@router.get("", response_model=dict)
async def get_features(user: dict = Depends(require_admin)):
    """Get all feature toggles."""
    await ensure_defaults()
    doc = await db.feature_toggles.find_one({"type": "features"}, {"_id": 0})
    return {"toggles": doc.get("toggles", DEFAULT_FEATURES) if doc else DEFAULT_FEATURES}


@router.put("", response_model=dict)
async def update_features(data: dict, user: dict = Depends(require_admin)):
    """Update feature toggles."""
    await ensure_defaults()
    doc = await db.feature_toggles.find_one({"type": "features"}, {"_id": 0})
    toggles = doc.get("toggles", DEFAULT_FEATURES) if doc else DEFAULT_FEATURES

    for key, value in data.items():
        if key in toggles and isinstance(value, bool):
            toggles[key]["enabled"] = value

    await db.feature_toggles.update_one(
        {"type": "features"},
        {"$set": {"toggles": toggles, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Feature aggiornate", "toggles": toggles}


@router.get("/api-config", response_model=dict)
async def get_api_configs(user: dict = Depends(require_admin)):
    """Get API configurations."""
    await ensure_defaults()
    doc = await db.feature_toggles.find_one({"type": "api_configs"}, {"_id": 0})
    return {"configs": doc.get("configs", DEFAULT_API_CONFIGS) if doc else DEFAULT_API_CONFIGS}


@router.put("/api-config/{section}", response_model=dict)
async def update_api_config(section: str, data: dict, user: dict = Depends(require_admin)):
    """Update API config for a section (telefonia/fintech)."""
    await ensure_defaults()
    doc = await db.feature_toggles.find_one({"type": "api_configs"}, {"_id": 0})
    configs = doc.get("configs", DEFAULT_API_CONFIGS) if doc else DEFAULT_API_CONFIGS

    if section not in configs:
        raise HTTPException(status_code=404, detail=f"Sezione '{section}' non trovata")

    for field in ["provider", "api_key", "api_secret", "endpoint", "enabled", "notes"]:
        if field in data:
            configs[section][field] = data[field]

    await db.feature_toggles.update_one(
        {"type": "api_configs"},
        {"$set": {"configs": configs, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": f"Configurazione {section} aggiornata", "config": configs[section]}
