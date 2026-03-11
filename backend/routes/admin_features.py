from copy import deepcopy
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from database import db
from services.auth import get_current_user

router = APIRouter(prefix="/admin/features", tags=["admin-features"])


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

DEFAULT_API_CONFIGS = {
    "telefonia": {
        "label": "API Telefonia",
        "provider": "",
        "api_key": "",
        "api_secret": "",
        "endpoint": "",
        "enabled": False,
        "notes": "",
    },
    "fintech": {
        "label": "Funzioni Fintech",
        "provider": "",
        "api_key": "",
        "api_secret": "",
        "endpoint": "",
        "enabled": False,
        "notes": "",
    },
}

DEFAULT_PRICING = {
    "myu_chat_per_message": {
        "label": "MYU Chat (per messaggio)",
        "price": 0.01,
        "currency": "UP",
    },
    "menu_scan_per_item": {
        "label": "Scansione Menu (per piatto)",
        "price": 0.01,
        "currency": "UP",
    },
    "visura_scan": {"label": "Scansione Visura", "price": 0.00, "currency": "UP"},
    "conto_up_activation": {
        "label": "Attivazione Conto UP",
        "price": 15.99,
        "currency": "UP",
    },
    "referral_bonus_referrer": {
        "label": "Referral al presentante",
        "price": 1.00,
        "currency": "UP",
    },
    "referral_bonus_referred": {
        "label": "Referral al presentato",
        "price": 1.00,
        "currency": "UP",
    },
}


async def require_admin(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Accesso riservato agli admin")
    return user


def _merge_defaults(existing: dict | None, defaults: dict) -> dict:
    merged = {}
    current = existing or {}

    for key, default_value in defaults.items():
        current_value = current.get(key)
        if isinstance(default_value, dict):
            merged[key] = deepcopy(default_value)
            if isinstance(current_value, dict):
                merged[key].update(current_value)
        elif current_value is not None:
            merged[key] = current_value
        else:
            merged[key] = deepcopy(default_value)

    for key, value in current.items():
        if key not in merged:
            merged[key] = deepcopy(value)

    return merged


async def _ensure_document(doc_type: str, field_name: str, defaults: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    doc = await db.feature_toggles.find_one({"type": doc_type}, {"_id": 0})
    if not doc:
        payload = {
            "type": doc_type,
            field_name: deepcopy(defaults),
            "created_at": now,
        }
        await db.feature_toggles.insert_one(payload)
        return payload[field_name]

    merged = _merge_defaults(doc.get(field_name), defaults)
    if merged != doc.get(field_name):
        await db.feature_toggles.update_one(
            {"type": doc_type},
            {"$set": {field_name: merged, "updated_at": now}},
        )
    return merged


async def ensure_defaults():
    await _ensure_document("features", "toggles", DEFAULT_FEATURES)
    await _ensure_document("api_configs", "configs", DEFAULT_API_CONFIGS)
    await _ensure_document("pricing", "pricing", DEFAULT_PRICING)


async def get_pricing_config() -> dict:
    return await _ensure_document("pricing", "pricing", DEFAULT_PRICING)


async def get_price(key: str) -> float:
    pricing = await get_pricing_config()
    item = pricing.get(key, {})
    return float(item.get("price", 0))


@router.get("/public", response_model=dict)
async def get_public_features():
    toggles = await _ensure_document("features", "toggles", DEFAULT_FEATURES)
    return {key: value.get("enabled", False) for key, value in toggles.items()}


@router.get("/public/pricing", response_model=dict)
async def get_public_pricing():
    pricing = await get_pricing_config()
    return {key: value.get("price", 0) for key, value in pricing.items()}


@router.get("", response_model=dict)
async def get_features(user: dict = Depends(require_admin)):
    toggles = await _ensure_document("features", "toggles", DEFAULT_FEATURES)
    return {"toggles": toggles}


@router.put("", response_model=dict)
async def update_features(data: dict, user: dict = Depends(require_admin)):
    toggles = await _ensure_document("features", "toggles", DEFAULT_FEATURES)

    for key, value in data.items():
        if key in toggles and isinstance(value, bool):
            toggles[key]["enabled"] = value

    await db.feature_toggles.update_one(
        {"type": "features"},
        {"$set": {"toggles": toggles, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"message": "Feature aggiornate", "toggles": toggles}


@router.get("/api-config", response_model=dict)
async def get_api_configs(user: dict = Depends(require_admin)):
    configs = await _ensure_document("api_configs", "configs", DEFAULT_API_CONFIGS)
    return {"configs": configs}


@router.put("/api-config/{section}", response_model=dict)
async def update_api_config(section: str, data: dict, user: dict = Depends(require_admin)):
    configs = await _ensure_document("api_configs", "configs", DEFAULT_API_CONFIGS)

    if section not in configs:
        raise HTTPException(status_code=404, detail=f"Sezione '{section}' non trovata")

    for field in ["provider", "api_key", "api_secret", "endpoint", "enabled", "notes"]:
        if field in data:
            configs[section][field] = data[field]

    await db.feature_toggles.update_one(
        {"type": "api_configs"},
        {"$set": {"configs": configs, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"message": f"Configurazione {section} aggiornata", "config": configs[section]}


@router.get("/pricing", response_model=dict)
async def get_pricing(user: dict = Depends(require_admin)):
    pricing = await get_pricing_config()
    return {"pricing": pricing}


@router.put("/pricing", response_model=dict)
async def update_pricing(data: dict, user: dict = Depends(require_admin)):
    pricing = await get_pricing_config()

    for key, value in data.items():
        if key not in pricing:
            continue
        try:
            pricing[key]["price"] = round(float(value), 2)
        except (TypeError, ValueError):
            continue

    await db.feature_toggles.update_one(
        {"type": "pricing"},
        {"$set": {"pricing": pricing, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"message": "Prezzi aggiornati", "pricing": pricing}
