from fastapi import APIRouter, Depends, HTTPException
from database import db
from services.auth import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os
from openai import AsyncOpenAI

router = APIRouter(prefix="/admin/openai", tags=["admin-openai"])


def _normalize_openai_model(raw_model: str) -> str:
    model = (raw_model or "").strip()
    if not model:
        return "gpt-4o-mini"
    if "gemini" in model.lower() or "emergent" in model.lower():
        return "gpt-4o-mini"
    return model


async def require_admin(user=Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Accesso riservato agli admin")
    return user


class OpenAIConfig(BaseModel):
    api_key: str
    model: str = "gpt-4o-mini"  # Updated default model
    enabled: bool = True
    max_tokens: int = 150
    temperature: float = 0.7


@router.get("/config")
async def get_openai_config(admin=Depends(require_admin)):
    """Get current OpenAI configuration."""
    config = await db.app_config.find_one({"key": "openai"}, {"_id": 0})
    env_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY")
    
    if not config:
        return {
            "api_key_set": bool(env_key),
            "api_key_preview": "****" + env_key[-4:] if env_key else "",
            "model": "gpt-4o-mini",
            "enabled": True,
            "max_tokens": 150,
            "temperature": 0.7,
            "source": "env",
        }
    
    # Check if we have a real key in config or should use env
    config_key = config.get("api_key", "")
    has_real_key = config_key and config_key != "KEEP_EXISTING"
    
    if has_real_key:
        preview = "****" + config_key[-4:]
        key_set = True
    elif env_key:
        preview = "****" + env_key[-4:]
        key_set = True
    else:
        preview = ""
        key_set = False

    return {
        "api_key_set": key_set,
        "api_key_preview": preview,
        "model": _normalize_openai_model(config.get("model", "gpt-4o-mini")),
        "enabled": config.get("enabled", True),
        "max_tokens": config.get("max_tokens", 150),
        "temperature": config.get("temperature", 0.7),
        "source": "db" if has_real_key else "env",
        "updated_at": config.get("updated_at", ""),
    }


@router.post("/config")
async def save_openai_config(data: OpenAIConfig, admin=Depends(require_admin)):
    """Save OpenAI configuration."""
    now = datetime.now(timezone.utc).isoformat()
    
    # Build update document
    update_doc = {
        "key": "openai",
        "model": data.model,
        "enabled": data.enabled,
        "max_tokens": data.max_tokens,
        "temperature": data.temperature,
        "updated_at": now,
        "updated_by": admin["id"],
    }
    
    # Only update api_key if a real new key is provided (not "KEEP_EXISTING")
    if data.api_key and data.api_key != "KEEP_EXISTING":
        update_doc["api_key"] = data.api_key
    
    await db.app_config.update_one(
        {"key": "openai"},
        {"$set": update_doc},
        upsert=True
    )
    return {"success": True, "message": "Configurazione salvata"}


@router.post("/test")
async def test_openai_connection(admin=Depends(require_admin)):
    """Test OpenAI API connection."""
    config = await db.app_config.find_one({"key": "openai"}, {"_id": 0})
    
    # Get API key from config, but fall back to env if not set or if it's the placeholder
    api_key = None
    if config and config.get("api_key") and config.get("api_key") != "KEEP_EXISTING":
        api_key = config.get("api_key")
    if not api_key:
        api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY")

    model = _normalize_openai_model(config.get("model", "gpt-4o-mini") if config else "gpt-4o-mini")

    if not api_key:
        return {"success": False, "error": "Nessuna API key configurata"}

    try:
        client = AsyncOpenAI(api_key=api_key)
        response = await client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": "Rispondi solo 'OK' in una parola."},
                {"role": "user", "content": "Test connessione"},
            ],
            max_output_tokens=20,
        )
        text = (getattr(response, "output_text", "") or "").strip()
        if not text:
            text = "OK"
        return {
            "success": True,
            "model": model,
            "response": text[:200],
            "message": "Connessione riuscita!"
        }
    except Exception as e:
        return {"success": False, "error": str(e), "model": model}
