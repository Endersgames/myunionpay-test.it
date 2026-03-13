from fastapi import APIRouter, Depends, HTTPException
from database import db
from services.auth import get_current_user
from services.ai_config import (
    KEEP_EXISTING,
    DEFAULT_CHAT_MODEL,
    get_ai_runtime_config,
    mask_api_key,
    normalize_chat_model,
    sanitize_api_key,
)
from pydantic import BaseModel
from datetime import datetime, timezone
from openai import AsyncOpenAI

router = APIRouter(prefix="/admin/openai", tags=["admin-openai"])


async def require_admin(user=Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Accesso riservato agli admin")
    return user


class OpenAIConfig(BaseModel):
    api_key: str = ""
    model: str = DEFAULT_CHAT_MODEL
    enabled: bool = True
    max_tokens: int = 150
    temperature: float = 0.7


@router.get("/config")
async def get_openai_config(admin=Depends(require_admin)):
    """Get current OpenAI configuration."""
    runtime = await get_ai_runtime_config()
    return {
        "api_key_set": runtime["api_key_set"],
        "api_key_preview": runtime["api_key_preview"],
        "model": runtime["model"],
        "enabled": runtime["enabled"],
        "max_tokens": runtime["max_tokens"],
        "temperature": runtime["temperature"],
        "source": runtime["source"],
        "updated_at": runtime["updated_at"],
    }


@router.post("/config")
async def save_openai_config(data: OpenAIConfig, admin=Depends(require_admin)):
    """Save OpenAI configuration."""
    now = datetime.now(timezone.utc).isoformat()
    submitted_key = sanitize_api_key(data.api_key)

    if data.api_key and data.api_key != KEEP_EXISTING and not submitted_key:
        raise HTTPException(status_code=400, detail="API key non valida")
    
    # Build update document
    update_doc = {
        "key": "openai",
        "model": normalize_chat_model(data.model),
        "enabled": data.enabled,
        "max_tokens": data.max_tokens,
        "temperature": data.temperature,
        "updated_at": now,
        "updated_by": admin["id"],
    }
    
    # Only update api_key if a real new key is provided.
    if submitted_key:
        update_doc["api_key"] = submitted_key
    
    await db.app_config.update_one(
        {"key": "openai"},
        {"$set": update_doc},
        upsert=True
    )
    return {"success": True, "message": "Configurazione salvata"}


@router.post("/test")
async def test_openai_connection(admin=Depends(require_admin)):
    """Test OpenAI API connection."""
    runtime = await get_ai_runtime_config()
    api_key = runtime["api_key"]
    model = runtime["model"]
    provider = runtime["provider"]

    if not api_key:
        return {"success": False, "error": "Nessuna API key configurata"}

    if not runtime["enabled"]:
        return {"success": False, "error": "AI disabilitata dal pannello admin", "model": model}

    try:
        client = AsyncOpenAI(api_key=api_key)
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Rispondi solo con la parola OK."},
                {"role": "user", "content": "Test connessione"},
            ],
            max_tokens=10,
            temperature=0,
        )
        content = response.choices[0].message.content or ""
        return {
            "success": True,
            "model": model,
            "provider": provider,
            "source": runtime["source"],
            "api_key_preview": mask_api_key(api_key),
            "response": content[:100],
            "message": "Connessione riuscita!"
        }
    except Exception as e:
        return {"success": False, "error": str(e), "model": model}
