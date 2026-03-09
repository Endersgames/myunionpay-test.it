from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import os
import uuid
import json
import base64
import logging
from datetime import datetime, timezone
from openai import AsyncOpenAI
from database import db
from services.auth import get_current_user

router = APIRouter(prefix="/merchant/ai", tags=["merchant-ai"])
logger = logging.getLogger("merchant-ai")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
MODEL = "gpt-5-mini"

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "visure")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_openai_client():
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key non configurata")
    return AsyncOpenAI(api_key=OPENAI_API_KEY)


async def get_merchant_for_user(user: dict):
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=403, detail="Non sei un merchant")
    return merchant


# ========================
# VISURA CAMERALE
# ========================

VISURA_PROMPT = """Analizza questa visura camerale e estrai i seguenti dati in formato JSON:
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
Restituisci SOLO il JSON, senza markdown o altro testo. Se un campo non è leggibile, usa stringa vuota."""


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
    with open(filepath, "wb") as f:
        f.write(content)

    img_b64 = base64.b64encode(content).decode("utf-8")
    mime = file.content_type or "image/jpeg"

    client = get_openai_client()
    try:
        response = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "Sei un esperto di documenti aziendali italiani. Estrai i dati dalla visura camerale."},
                {"role": "user", "content": [
                    {"type": "text", "text": VISURA_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{img_b64}"}}
                ]}
            ],
            max_tokens=1000,
            temperature=0.1
        )
        raw = response.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        extracted = json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"JSON parse error from visura extraction: {raw[:200]}")
        raise HTTPException(status_code=422, detail="Impossibile estrarre dati dalla visura. Riprova con un'immagine più chiara.")
    except Exception as e:
        logger.error(f"OpenAI error: {e}")
        raise HTTPException(status_code=500, detail=f"Errore AI: {str(e)}")

    await db.merchants.update_one(
        {"id": merchant["id"]},
        {"$set": {
            "visura_data": extracted,
            "visura_file": f"/api/uploads/visure/{filename}",
            "visura_uploaded_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    return {"extracted": extracted, "visura_file": f"/api/uploads/visure/{filename}"}


# ========================
# SCAN MENU
# ========================

MENU_SCAN_PROMPT = """Analizza questa foto di un menu di ristorante. Estrai TUTTI i piatti visibili.

Per ogni piatto restituisci un oggetto JSON con:
- "name": {"it": "nome italiano", "en": "english", "fr": "français", "de": "deutsch", "es": "español"}
- "description": {"it": "descrizione", "en": "description", "fr": "description", "de": "beschreibung", "es": "descripción"}
- "price": numero (prezzo in euro, 0 se non visibile)
- "category": uno tra "antipasti", "primi", "secondi", "dolci", "bevande"
- "calories": stima calorie (numero intero)
- "health": {
    "recommended_for": {"it": "...", "en": "...", "fr": "...", "de": "...", "es": "..."},
    "not_recommended_for": {"it": "...", "en": "...", "fr": "...", "de": "...", "es": "..."}
  }

Per "recommended_for" indica per chi è consigliato (es: "Sportivi, diete proteiche").
Per "not_recommended_for" indica per chi è sconsigliato (es: "Celiaci, intolleranti al lattosio").

Restituisci SOLO un array JSON di oggetti, senza markdown o altro testo."""


@router.post("/scan-menu")
async def scan_menu(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    merchant = await get_merchant_for_user(user)

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo immagini sono accettate")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File troppo grande (max 10MB)")

    wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    if not wallet or wallet.get("balance", 0) < 1:
        raise HTTPException(status_code=402, detail="Saldo UP insufficiente. Serve almeno 1 UP per voce del menu.")

    img_b64 = base64.b64encode(content).decode("utf-8")
    mime = file.content_type or "image/jpeg"

    client = get_openai_client()
    try:
        response = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "Sei un esperto di ristorazione italiana. Estrai i piatti dal menu, traduci in 5 lingue, stima calorie e informazioni salute."},
                {"role": "user", "content": [
                    {"type": "text", "text": MENU_SCAN_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{img_b64}"}}
                ]}
            ],
            max_tokens=4000,
            temperature=0.2
        )
        raw = response.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        items = json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"JSON parse error from menu scan: {raw[:300]}")
        raise HTTPException(status_code=422, detail="Impossibile estrarre piatti dal menu. Riprova con un'immagine più chiara.")
    except Exception as e:
        logger.error(f"OpenAI error: {e}")
        raise HTTPException(status_code=500, detail=f"Errore AI: {str(e)}")

    if not isinstance(items, list) or len(items) == 0:
        raise HTTPException(status_code=422, detail="Nessun piatto trovato nell'immagine.")

    total_cost = len(items)
    if wallet.get("balance", 0) < total_cost:
        raise HTTPException(
            status_code=402,
            detail=f"Saldo insufficiente. Trovati {total_cost} piatti, servono {total_cost} UP. Saldo attuale: {wallet['balance']:.0f} UP."
        )

    created_items = []
    for idx, item in enumerate(items):
        item_doc = {
            "id": str(uuid.uuid4()),
            "merchant_id": merchant["id"],
            "category": item.get("category", "primi"),
            "name": item.get("name", {"it": ""}),
            "description": item.get("description"),
            "price": float(item.get("price", 0)),
            "image_url": None,
            "origin": None,
            "calories": item.get("calories"),
            "health": item.get("health"),
            "active": True,
            "order": idx,
            "ai_generated": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.menu_items.insert_one(item_doc)
        item_doc.pop("_id", None)
        created_items.append(item_doc)

    await db.wallets.update_one(
        {"user_id": user["id"]},
        {"$inc": {"balance": -total_cost}}
    )

    await db.wallets.update_one(
        {"user_id": user["id"]},
        {"$push": {"transactions": {
            "type": "menu_scan",
            "amount": -total_cost,
            "description": f"Scansione menu: {total_cost} piatti estratti",
            "created_at": datetime.now(timezone.utc).isoformat()
        }}}
    )

    return {
        "items_count": len(created_items),
        "cost_up": total_cost,
        "items": created_items,
        "message": f"{total_cost} piatti estratti e aggiunti al menu. Addebito: {total_cost} UP."
    }
