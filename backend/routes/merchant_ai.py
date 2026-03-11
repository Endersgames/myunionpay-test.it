from datetime import datetime, timezone
from typing import Any
import base64
import json
import logging
import os
import re
import unicodedata
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from openai import AsyncOpenAI

from database import db
from services.ai_config import (
    DEFAULT_VISION_MODEL,
    get_ai_runtime_config,
    normalize_vision_model,
)
from services.auth import get_current_user

router = APIRouter(prefix="/merchant/ai", tags=["merchant-ai"])
logger = logging.getLogger("merchant-ai")

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "visure")
os.makedirs(UPLOAD_DIR, exist_ok=True)

LANGUAGES = ("it", "en", "fr", "de", "es")
RESTAURANT_CATEGORIES = (
    "ristorante",
    "ristoranti e pizzerie",
    "bar",
    "bar e caffetterie",
    "alimentari e bevande",
    "alimentari",
)
DEFAULT_MENU_SCAN_PRICE = 0.01

VISURA_PROMPT = """Analizza questa visura camerale e restituisci SOLO un oggetto JSON valido:
{
  "ragione_sociale": "",
  "partita_iva": "",
  "codice_fiscale": "",
  "indirizzo_sede": "",
  "cap": "",
  "citta": "",
  "provincia": "",
  "data_costituzione": "",
  "attivita_principale": "",
  "codice_ateco": "",
  "capitale_sociale": "",
  "rappresentante_legale": ""
}
Non aggiungere testo, markdown o commenti. Se un campo non e leggibile, usa stringa vuota."""

MENU_SCAN_PROMPT = """Analizza questa foto di un menu di ristorante o bar. Estrai TUTTE le voci leggibili.

Per ogni piatto restituisci un oggetto JSON con:
- "name": {"it": "nome italiano", "en": "english", "fr": "francais", "de": "deutsch", "es": "espanol"}
- "description": {"it": "descrizione", "en": "description", "fr": "description", "de": "beschreibung", "es": "descripcion"}
- "price": numero (prezzo in euro, usa 0 se non visibile)
- "category": una tra "antipasti", "primi", "secondi", "dolci", "bevande"
- "calories": stima calorie (numero intero)
- "health": {
    "recommended_for": {"it": "...", "en": "...", "fr": "...", "de": "...", "es": "..."},
    "not_recommended_for": {"it": "...", "en": "...", "fr": "...", "de": "...", "es": "..."}
  }

Per "recommended_for" indica per chi e consigliato.
Per "not_recommended_for" indica per chi e sconsigliato.
Non inventare piatti non presenti nell'immagine.
Restituisci SOLO JSON valido, preferibilmente come array.
Se vuoi usare un wrapper, usa soltanto: {"items": [...]}."""
async def _get_ai_settings() -> tuple[str, str]:
    runtime = await get_ai_runtime_config(default_model=DEFAULT_VISION_MODEL)
    if not runtime["enabled"]:
        raise HTTPException(status_code=503, detail="Funzione AI momentaneamente disabilitata")
    if not runtime["api_key"]:
        raise HTTPException(status_code=500, detail="OpenAI API key non configurata")

    return runtime["api_key"], normalize_vision_model(runtime["model"])


async def _get_price(key: str, default: float) -> float:
    doc = await db.feature_toggles.find_one({"type": "pricing"}, {"_id": 0})
    pricing = doc.get("pricing", {}) if doc else {}
    value = pricing.get(key, {})

    try:
        return float(value.get("price", default))
    except (TypeError, ValueError, AttributeError):
        return default


async def get_merchant_for_user(user: dict) -> dict:
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=403, detail="Non sei un merchant")
    return merchant


async def get_restaurant_merchant_for_user(user: dict) -> dict:
    merchant = await get_merchant_for_user(user)
    category = (merchant.get("category") or "").lower()
    if not any(allowed in category for allowed in RESTAURANT_CATEGORIES):
        raise HTTPException(
            status_code=403,
            detail="La scansione menu e disponibile solo per ristoranti, bar e attivita food",
        )
    return merchant


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def _strip_code_fences(raw: str) -> str:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _candidate_json_snippets(raw: str, expected: str) -> list[str]:
    snippets = []
    cleaned = _strip_code_fences(raw)
    if cleaned:
        snippets.append(cleaned)

    if expected == "object":
        start = cleaned.find("{")
        end = cleaned.rfind("}")
    else:
        start = cleaned.find("[")
        end = cleaned.rfind("]")

    if start != -1 and end != -1 and end > start:
        snippets.append(cleaned[start : end + 1])

    unique = []
    for snippet in snippets:
        if snippet and snippet not in unique:
            unique.append(snippet)
    return unique


def _parse_ai_json(raw: str, expected: str) -> Any:
    for snippet in _candidate_json_snippets(raw, expected):
        try:
            parsed = json.loads(snippet)
        except json.JSONDecodeError:
            continue

        if expected == "object" and isinstance(parsed, dict):
            return parsed

        if expected == "array":
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict):
                for key in ("items", "dishes", "menu_items", "piatti"):
                    if isinstance(parsed.get(key), list):
                        return parsed[key]

    raise ValueError("AI response is not valid JSON")


def _normalize_multilang(value: Any) -> dict[str, str]:
    result = {lang: "" for lang in LANGUAGES}

    if isinstance(value, dict):
        source = {str(key).lower(): _clean_text(val) for key, val in value.items()}
        italian = (
            source.get("it")
            or source.get("italiano")
            or source.get("name")
            or source.get("text")
            or next((val for val in source.values() if val), "")
        )
        result["it"] = italian
        result["en"] = source.get("en") or source.get("english") or italian
        result["fr"] = source.get("fr") or source.get("francais") or source.get("français") or italian
        result["de"] = source.get("de") or source.get("deutsch") or italian
        result["es"] = source.get("es") or source.get("espanol") or source.get("español") or italian
        return result

    italian = _clean_text(value)
    for lang in LANGUAGES:
        result[lang] = italian
    return result


def _normalize_price(value: Any) -> float:
    if isinstance(value, (int, float)):
        return round(float(value), 2)

    text = _clean_text(value).replace(",", ".")
    match = re.search(r"\d+(?:\.\d{1,2})?", text)
    if not match:
        return 0.0

    try:
        return round(float(match.group(0)), 2)
    except ValueError:
        return 0.0


def _normalize_calories(value: Any) -> int | None:
    if value in (None, "", 0):
        return None
    if isinstance(value, (int, float)):
        return int(value)

    match = re.search(r"\d+", _clean_text(value))
    if not match:
        return None
    return int(match.group(0))


def _normalize_category(value: Any, italian_name: str) -> str:
    text = f"{_clean_text(value)} {_clean_text(italian_name)}".lower()

    if any(token in text for token in ("bevand", "drink", "bibit", "vino", "birra", "cocktail", "acqua", "caffe", "caff", "tea", "tisana")):
        return "bevande"
    if any(token in text for token in ("dolc", "dessert", "tiramisu", "gelato", "cake", "panna cotta")):
        return "dolci"
    if any(token in text for token in ("antipast", "starter", "bruschetta", "tagliere", "fritti", "appetizer")):
        return "antipasti"
    if any(token in text for token in ("primo", "primi", "pasta", "risotto", "gnocchi", "lasagna", "soup", "zuppa")):
        return "primi"
    if any(token in text for token in ("second", "main", "carne", "pesce", "burger", "pollo", "beef", "steak")):
        return "secondi"

    return "primi"


def _normalize_health(value: Any) -> dict[str, dict[str, str]] | None:
    if not isinstance(value, dict):
        return None

    recommended = _normalize_multilang(
        value.get("recommended_for") or value.get("good_for") or value.get("indicato_per")
    )
    not_recommended = _normalize_multilang(
        value.get("not_recommended_for")
        or value.get("avoid_for")
        or value.get("sconsigliato_per")
    )

    if not any(recommended.values()) and not any(not_recommended.values()):
        return None

    return {
        "recommended_for": recommended,
        "not_recommended_for": not_recommended,
    }


def _normalize_menu_item(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None

    name = _normalize_multilang(item.get("name") or item.get("title") or item.get("dish_name"))
    if not any(name.values()):
        return None

    description = _normalize_multilang(item.get("description") or item.get("desc"))
    health = _normalize_health(item.get("health"))

    return {
        "category": _normalize_category(item.get("category"), name["it"]),
        "name": name,
        "description": description if any(description.values()) else None,
        "price": _normalize_price(item.get("price")),
        "origin": _clean_text(item.get("origin")) or None,
        "calories": _normalize_calories(item.get("calories")),
        "health": health,
    }


def _normalize_name_key(value: Any) -> str:
    text = _clean_text(value).lower()
    if not text:
        return ""

    normalized = unicodedata.normalize("NFKD", text)
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _extract_name_keys(value: Any) -> set[str]:
    if isinstance(value, dict):
        values = value.values()
    else:
        values = (value,)

    keys = set()
    for raw_value in values:
        key = _normalize_name_key(raw_value)
        if key:
            keys.add(key)
    return keys


@router.post("/upload-visura")
async def upload_visura(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    merchant = await get_merchant_for_user(user)

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo immagini sono accettate")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File troppo grande (max 10MB)")

    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{merchant['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as output_file:
        output_file.write(content)

    img_b64 = base64.b64encode(content).decode("utf-8")
    mime = file.content_type or "image/jpeg"

    api_key, model = await _get_ai_settings()
    client = AsyncOpenAI(api_key=api_key)

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "Sei un esperto di documenti aziendali italiani. Rispondi solo con JSON valido.",
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": VISURA_PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{img_b64}"}},
                    ],
                },
            ],
            max_tokens=1200,
            temperature=0.1,
        )
        raw = response.choices[0].message.content or ""
        extracted = _parse_ai_json(raw, expected="object")
    except ValueError:
        logger.error("JSON parse error from visura extraction: %s", (raw or "")[:300])
        raise HTTPException(
            status_code=422,
            detail="Impossibile estrarre dati dalla visura. Riprova con un'immagine piu chiara.",
        )
    except Exception as exc:
        logger.error("OpenAI error on visura extraction: %s", exc)
        raise HTTPException(status_code=500, detail=f"Errore AI: {str(exc)}")

    await db.merchants.update_one(
        {"id": merchant["id"]},
        {
            "$set": {
                "visura_data": extracted,
                "visura_file": f"/api/uploads/visure/{filename}",
                "visura_uploaded_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    return {"extracted": extracted, "visura_file": f"/api/uploads/visure/{filename}"}


@router.post("/scan-menu")
async def scan_menu(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    merchant = await get_restaurant_merchant_for_user(user)

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo immagini sono accettate")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File troppo grande (max 10MB)")

    wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    price_per_item = await _get_price("menu_scan_per_item", DEFAULT_MENU_SCAN_PRICE)
    if not wallet or wallet.get("balance", 0) < price_per_item:
        raise HTTPException(
            status_code=402,
            detail=f"Saldo UP insufficiente. Serve almeno {price_per_item:.2f} UP per avviare la scansione.",
        )

    img_b64 = base64.b64encode(content).decode("utf-8")
    mime = file.content_type or "image/jpeg"

    api_key, model = await _get_ai_settings()
    client = AsyncOpenAI(api_key=api_key)

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Sei un esperto di ristorazione italiana. "
                        "Estrai i piatti dal menu, traduci in 5 lingue, stima calorie e informazioni salute. "
                        "Rispondi solo con JSON valido."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": MENU_SCAN_PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{img_b64}"}},
                    ],
                },
            ],
            max_tokens=4000,
            temperature=0.2,
        )
        raw = response.choices[0].message.content or ""
        parsed_items = _parse_ai_json(raw, expected="array")
    except ValueError:
        logger.error("JSON parse error from menu scan: %s", (raw or "")[:500])
        raise HTTPException(
            status_code=422,
            detail="Impossibile estrarre piatti dal menu. Riprova con una foto piu nitida e ben inquadrata.",
        )
    except Exception as exc:
        logger.error("OpenAI error on menu scan: %s", exc)
        raise HTTPException(status_code=500, detail=f"Errore AI: {str(exc)}")

    items = []
    for raw_item in parsed_items:
        normalized = _normalize_menu_item(raw_item)
        if normalized:
            items.append(normalized)

    if not items:
        raise HTTPException(status_code=422, detail="Nessun piatto trovato nell'immagine.")

    existing_menu_items = await db.menu_items.find(
        {"merchant_id": merchant["id"]},
        {"_id": 0, "name": 1, "order": 1},
    ).to_list(1000)
    existing_name_keys = set()
    max_order = -1
    for existing_item in existing_menu_items:
        existing_name_keys.update(_extract_name_keys(existing_item.get("name")))
        try:
            max_order = max(max_order, int(existing_item.get("order", -1)))
        except (TypeError, ValueError):
            continue

    unique_items = []
    duplicate_count = 0
    for item in items:
        item_name_keys = _extract_name_keys(item.get("name"))
        if item_name_keys and item_name_keys & existing_name_keys:
            duplicate_count += 1
            continue
        existing_name_keys.update(item_name_keys)
        unique_items.append(item)

    if not unique_items:
        return {
            "items_count": 0,
            "duplicate_count": duplicate_count,
            "cost_up": 0.0,
            "items": [],
            "message": "Tutti i piatti estratti sono gia presenti nel menu. Nessun addebito.",
        }

    total_cost = round(len(unique_items) * price_per_item, 2)
    current_balance = float(wallet.get("balance", 0))
    if current_balance < total_cost:
        raise HTTPException(
            status_code=402,
            detail=(
                f"Saldo insufficiente. Trovati {len(unique_items)} nuovi piatti, servono {total_cost:.2f} UP. "
                f"Saldo attuale: {current_balance:.2f} UP."
            ),
        )

    created_items = []
    now = datetime.now(timezone.utc).isoformat()
    starting_order = max_order + 1
    for index, item in enumerate(unique_items):
        item_doc = {
            "id": str(uuid.uuid4()),
            "merchant_id": merchant["id"],
            "category": item["category"],
            "name": item["name"],
            "description": item["description"],
            "price": item["price"],
            "image_url": None,
            "origin": item["origin"],
            "calories": item["calories"],
            "health": item["health"],
            "active": True,
            "order": starting_order + index,
            "ai_generated": True,
            "created_at": now,
        }
        await db.menu_items.insert_one(item_doc)
        item_doc.pop("_id", None)
        created_items.append(item_doc)

    await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": -total_cost}})
    await db.wallets.update_one(
        {"user_id": user["id"]},
        {
            "$push": {
                "transactions": {
                    "type": "menu_scan",
                    "amount": -total_cost,
                    "description": f"Scansione menu: {len(created_items)} nuovi piatti aggiunti",
                    "created_at": now,
                }
            }
        },
    )

    if duplicate_count:
        message = (
            f"{len(created_items)} nuovi piatti aggiunti al menu digitale, "
            f"{duplicate_count} gia presenti saltati. Addebito: {total_cost:.2f} UP."
        )
    else:
        message = (
            f"{len(created_items)} piatti estratti e aggiunti al menu digitale. "
            f"Addebito: {total_cost:.2f} UP."
        )

    return {
        "items_count": len(created_items),
        "duplicate_count": duplicate_count,
        "cost_up": total_cost,
        "items": created_items,
        "message": message,
    }
