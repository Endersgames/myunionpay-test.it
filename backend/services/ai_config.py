import os
from pathlib import Path
from typing import Any

from database import db

AI_CONFIG_DOC_KEY = "openai"
DEFAULT_CHAT_MODEL = "gpt-4.1-nano"
DEFAULT_VISION_MODEL = "gpt-4o-mini"
KEEP_EXISTING = "KEEP_EXISTING"
OPENAI_CHAT_MODELS = {"gpt-4.1-nano", "gpt-4.1-mini", "gpt-4o-mini", "gpt-4o"}
OPENAI_VISION_MODELS = {"gpt-4.1-mini", "gpt-4o-mini", "gpt-4o"}


def sanitize_api_key(value: Any) -> str:
    if not isinstance(value, str):
        return ""

    cleaned = value.strip()
    if not cleaned or cleaned == KEEP_EXISTING:
        return ""

    # Reject masked placeholders copied back from the UI.
    if set(cleaned) == {"*"}:
        return ""

    return cleaned


def mask_api_key(value: Any) -> str:
    cleaned = sanitize_api_key(value)
    if not cleaned:
        return ""
    return "****" + cleaned[-4:]


def resolve_provider(model: str) -> str:
    return "openai"


def normalize_chat_model(model: str) -> str:
    cleaned = (model or "").strip()
    if cleaned in OPENAI_CHAT_MODELS:
        return cleaned
    return DEFAULT_CHAT_MODEL


def normalize_vision_model(model: str) -> str:
    cleaned = (model or "").strip()
    if cleaned in OPENAI_VISION_MODELS:
        return cleaned
    if not cleaned:
        return DEFAULT_VISION_MODEL
    return cleaned


def _read_key_from_dotenv() -> str:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return ""

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key == "OPENAI_API_KEY":
            candidate = sanitize_api_key(value)
            if candidate:
                return candidate

    return ""


def get_env_ai_key() -> str:
    candidate = sanitize_api_key(os.environ.get("OPENAI_API_KEY"))
    if candidate:
        return candidate
    return _read_key_from_dotenv()


async def get_ai_config_doc() -> dict:
    return await db.app_config.find_one({"key": AI_CONFIG_DOC_KEY}, {"_id": 0}) or {}


async def get_ai_runtime_config(default_model: str = DEFAULT_CHAT_MODEL) -> dict:
    config = await get_ai_config_doc()
    stored_key = sanitize_api_key(config.get("api_key"))
    fallback_key = get_env_ai_key()
    api_key = stored_key or fallback_key
    raw_model = (config.get("model") or default_model).strip() or default_model
    model = normalize_vision_model(raw_model) if default_model == DEFAULT_VISION_MODEL else normalize_chat_model(raw_model)

    return {
        "api_key": api_key,
        "api_key_preview": mask_api_key(api_key),
        "api_key_set": bool(api_key),
        "provider": resolve_provider(model),
        "model": model,
        "enabled": config.get("enabled", True),
        "max_tokens": config.get("max_tokens", 150),
        "temperature": config.get("temperature", 0.7),
        "source": "db" if stored_key else ("env" if fallback_key else "missing"),
        "updated_at": config.get("updated_at", ""),
    }
