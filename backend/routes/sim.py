from fastapi import APIRouter, Depends, HTTPException
import uuid
import random
from datetime import datetime, timezone, timedelta
from database import db
from models import SimActivationRequest, DepositRequest, BonificoRequest, ConvertToUPRequest
from services.auth import get_current_user

router = APIRouter(prefix="/sim", tags=["sim"])


@router.get("/my-sim")
async def get_my_sim(user: dict = Depends(get_current_user)):
    sim = await db.sims.find_one({"user_id": user["id"]}, {"_id": 0})
    if not sim:
        return None
    return sim


@router.post("/activate")
async def activate_sim(data: SimActivationRequest, user: dict = Depends(get_current_user)):
    existing_sim = await db.sims.find_one({"user_id": user["id"]})
    if existing_sim:
        raise HTTPException(status_code=400, detail="Hai già una SIM attiva")

    wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    activation_cost = 15.99
    if wallet["balance"] < activation_cost:
        raise HTTPException(status_code=400, detail=f"Saldo insufficiente. Servono {activation_cost} UP")

    await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": -activation_cost}})

    if data.portability and data.phone_to_port:
        phone_number = data.phone_to_port
        portability_status = "in_corso"
    else:
        phone_number = f"35341{random.randint(10000, 99999)}{random.randint(0, 9)}"
        portability_status = None

    activation_date = datetime.now(timezone.utc)
    expiry_date = activation_date + timedelta(days=30)

    iban_code = f"IT{random.randint(10,99)}X{random.randint(10000,99999)}{random.randint(10000,99999)}{random.randint(100000000000,999999999999)}"

    sim_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "phone_number": phone_number,
        "iban": iban_code,
        "eur_balance": 0.0,
        "plan_name": "SMART X TE 100 TOP",
        "plan_price": 15.99,
        "minutes_total": -1,
        "minutes_used": 0,
        "sms_total": 100,
        "sms_used": 0,
        "gb_total": 100.0,
        "gb_used": 0.0,
        "activation_date": activation_date.isoformat(),
        "expiry_date": expiry_date.isoformat(),
        "status": "active",
        "portability_status": portability_status,
        "fiscal_code": data.fiscal_code,
        "birth_date": data.birth_date,
        "birth_place": data.birth_place,
        "address": data.address,
        "cap": data.cap,
        "city": data.city,
        "document_type": data.document_type,
        "document_number": data.document_number,
        "current_operator": data.current_operator,
        "created_at": activation_date.isoformat()
    }

    await db.sims.insert_one(sim_doc)

    if data.portability and data.phone_to_port:
        await db.users.update_one({"id": user["id"]}, {"$set": {"phone": phone_number}})

    return {
        "success": True,
        "message": "SIM attivata con successo!",
        "sim": {k: v for k, v in sim_doc.items() if k != "_id"}
    }


@router.post("/use-data")
async def use_sim_data(user: dict = Depends(get_current_user)):
    sim = await db.sims.find_one({"user_id": user["id"]})
    if not sim:
        raise HTTPException(status_code=404, detail="Nessuna SIM trovata")

    gb_used = min(sim["gb_used"] + random.uniform(0.1, 2.0), sim["gb_total"])
    sms_used = min(sim["sms_used"] + random.randint(0, 3), sim["sms_total"])

    await db.sims.update_one(
        {"user_id": user["id"]},
        {"$set": {"gb_used": round(gb_used, 2), "sms_used": sms_used}}
    )

    return {"gb_used": round(gb_used, 2), "sms_used": sms_used}


@router.post("/deposit-eur")
async def deposit_eur(data: DepositRequest, user: dict = Depends(get_current_user)):
    sim = await db.sims.find_one({"user_id": user["id"]})
    if not sim:
        raise HTTPException(status_code=404, detail="Nessun Conto UP trovato")

    if data.amount <= 0 or data.amount > 10000:
        raise HTTPException(status_code=400, detail="Importo non valido (1-10000)")

    new_balance = sim.get("eur_balance", 0) + data.amount
    await db.sims.update_one({"user_id": user["id"]}, {"$set": {"eur_balance": new_balance}})

    tx_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "deposit",
        "amount": data.amount,
        "currency": "EUR",
        "description": "Ricarica Conto UP",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.conto_transactions.insert_one(tx_doc)

    return {"success": True, "new_balance": new_balance}


@router.post("/bonifico")
async def create_bonifico(data: BonificoRequest, user: dict = Depends(get_current_user)):
    sim = await db.sims.find_one({"user_id": user["id"]})
    if not sim:
        raise HTTPException(status_code=404, detail="Nessun Conto UP trovato")

    eur_balance = sim.get("eur_balance", 0)
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Importo non valido")
    if data.amount > eur_balance:
        raise HTTPException(status_code=400, detail=f"Saldo insufficiente. Disponibile: {eur_balance:.2f}")

    new_balance = eur_balance - data.amount
    await db.sims.update_one({"user_id": user["id"]}, {"$set": {"eur_balance": new_balance}})

    tx_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "bonifico",
        "amount": -data.amount,
        "currency": "EUR",
        "recipient_iban": data.recipient_iban,
        "recipient_name": data.recipient_name,
        "description": data.description,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.conto_transactions.insert_one(tx_doc)

    return {
        "success": True,
        "message": f"Bonifico di {data.amount:.2f} a {data.recipient_name} completato",
        "new_balance": new_balance,
        "transaction_id": tx_doc["id"]
    }


@router.post("/convert-to-up")
async def convert_eur_to_up(data: ConvertToUPRequest, user: dict = Depends(get_current_user)):
    sim = await db.sims.find_one({"user_id": user["id"]})
    if not sim:
        raise HTTPException(status_code=404, detail="Nessun Conto UP trovato")

    eur_balance = sim.get("eur_balance", 0)
    if data.eur_amount <= 0:
        raise HTTPException(status_code=400, detail="Importo non valido")
    if data.eur_amount > eur_balance:
        raise HTTPException(status_code=400, detail=f"Saldo EUR insufficiente. Disponibile: {eur_balance:.2f}")

    up_amount = data.eur_amount

    new_eur_balance = eur_balance - data.eur_amount
    await db.sims.update_one({"user_id": user["id"]}, {"$set": {"eur_balance": new_eur_balance}})

    await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": up_amount}})
    wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})

    tx_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "conversion",
        "eur_amount": -data.eur_amount,
        "up_amount": up_amount,
        "description": f"Conversione {data.eur_amount:.2f} EUR -> {up_amount:.2f} UP",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.conto_transactions.insert_one(tx_doc)

    return {
        "success": True,
        "message": f"Convertiti {data.eur_amount:.2f} in {up_amount:.2f} UP",
        "new_eur_balance": new_eur_balance,
        "new_up_balance": wallet["balance"]
    }


@router.get("/transactions")
async def get_conto_transactions(user: dict = Depends(get_current_user)):
    transactions = await db.conto_transactions.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return transactions
