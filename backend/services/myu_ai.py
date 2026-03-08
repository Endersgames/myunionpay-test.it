import os
import json
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env')

from emergentintegrations.llm.chat import LlmChat, UserMessage
from database import db

logger = logging.getLogger("myu_ai")

MYU_COST_PER_MSG = 0.01

SYSTEM_PROMPT = """Sei MYU, il compagno digitale dell'app myUup.
NON sei un chatbot generico. Sei un amico pratico e calmo.

REGOLE ASSOLUTE:
- Rispondi SEMPRE in italiano naturale
- Massimo 2 frasi per risposta
- Una domanda alla volta
- Mai entusiasmo artificiale
- Mai tono da call center o venditore
- Proponi, non spingere
- Aiuta a decidere, non decidere per l'utente
- Per curiosità generiche rispondi brevissimo

CONTESTO APP:
L'utente ha un wallet UP, può pagare con QR, inviare/ricevere UP, comprare gift card, visitare merchant affiliati, creare task personali.

FORMATO RISPOSTA (JSON):
{
  "message": "la tua risposta breve",
  "intent": {"domain": "...", "intent": "...", "confidence": 0.9},
  "actions": []
}

DOMAINS: companion, wallet, marketplace, growth, support, general
INTENTS: check_balance, understand_transaction, qr_payment_help, send_money_help, discover_merchants, gift_card_choice, task_creation, task_followup, goal_clarification, study_help, business_first_steps, profile_help, greeting, fallback

ACTIONS possibili (array di oggetti):
- {"type": "navigate", "path": "/dashboard", "label": "Vai al wallet"}
- {"type": "navigate", "path": "/marketplace", "label": "Vedi negozi"}
- {"type": "navigate", "path": "/scan", "label": "Scansiona QR"}
- {"type": "create_task", "title": "...", "due": "..."}
- {"type": "suggest_merchant", "merchant_id": "...", "name": "..."}

Se l'utente vuole creare un task, rispondi con action type "create_task".
Se l'utente chiede del saldo, usa i dati nel contesto.
Se l'utente chiede di merchant, suggerisci dal contesto."""


async def get_user_context(user_id: str) -> str:
    """Fetch minimal user context for the AI prompt."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "full_name": 1, "up_points": 1, "profile_tags": 1})
    wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0, "balance": 1})
    
    active_tasks = await db.myu_tasks.find(
        {"user_id": user_id, "status": "active"},
        {"_id": 0, "title": 1, "due_date": 1}
    ).to_list(3)
    
    merchants = await db.merchants.find(
        {"is_active": True},
        {"_id": 0, "business_name": 1, "category": 1, "id": 1}
    ).to_list(5)
    
    conv_state = await db.myu_conversation_state.find_one(
        {"user_id": user_id}, {"_id": 0, "summary": 1}
    )

    ctx_parts = []
    if user:
        ctx_parts.append(f"Nome: {user.get('full_name', 'Utente')}")
        ctx_parts.append(f"UP: {user.get('up_points', 0)}")
    if wallet:
        ctx_parts.append(f"Saldo wallet: {wallet.get('balance', 0):.2f} UP")
    if active_tasks:
        tasks_str = ", ".join(t["title"] for t in active_tasks)
        ctx_parts.append(f"Task attivi: {tasks_str}")
    if merchants:
        m_str = ", ".join(f"{m['business_name']} ({m['category']})" for m in merchants)
        ctx_parts.append(f"Merchant: {m_str}")
    if conv_state and conv_state.get("summary"):
        ctx_parts.append(f"Contesto precedente: {conv_state['summary']}")

    return "\n".join(ctx_parts)


async def deduct_up_cost(user_id: str) -> float:
    """Deduct 0.01 UP from wallet balance only. Returns new balance."""
    result = await db.wallets.find_one_and_update(
        {"user_id": user_id},
        {"$inc": {"balance": -MYU_COST_PER_MSG}},
        return_document=True,
        projection={"_id": 0, "balance": 1}
    )
    return result.get("balance", 0) if result else 0


async def check_balance(user_id: str) -> float:
    """Check if user has enough balance for MYU."""
    wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0, "balance": 1})
    return wallet.get("balance", 0) if wallet else 0


async def send_message(user_id: str, user_text: str, session_id: str) -> dict:
    """Send a message to MYU and get a response."""
    
    context = await get_user_context(user_id)
    
    prompt_text = f"CONTESTO UTENTE:\n{context}\n\nMESSAGGIO: {user_text}"

    chat = LlmChat(
        api_key=os.environ.get("EMERGENT_LLM_KEY"),
        session_id=f"myu_{session_id}",
        system_message=SYSTEM_PROMPT
    )
    chat.with_model("openai", "gpt-4o-mini")

    user_message = UserMessage(text=prompt_text)
    
    try:
        raw_response = await chat.send_message(user_message)
        
        try:
            clean = raw_response.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
                if clean.endswith("```"):
                    clean = clean[:-3]
                clean = clean.strip()
            parsed = json.loads(clean)
        except (json.JSONDecodeError, IndexError):
            parsed = {
                "message": raw_response.strip(),
                "intent": {"domain": "general", "intent": "fallback", "confidence": 0.5},
                "actions": []
            }
        
        new_balance = await deduct_up_cost(user_id)
        
        now = datetime.now(timezone.utc).isoformat()
        await db.myu_conversations.insert_one({
            "user_id": user_id,
            "session_id": session_id,
            "role": "user",
            "text": user_text,
            "created_at": now
        })
        await db.myu_conversations.insert_one({
            "user_id": user_id,
            "session_id": session_id,
            "role": "assistant",
            "text": parsed.get("message", ""),
            "intent": parsed.get("intent"),
            "actions": parsed.get("actions", []),
            "created_at": now
        })

        intent = parsed.get("intent", {})
        if intent:
            await db.myu_intent_logs.insert_one({
                "user_id": user_id,
                "session_id": session_id,
                "domain": intent.get("domain", "general"),
                "intent": intent.get("intent", "fallback"),
                "confidence": intent.get("confidence", 0),
                "user_text": user_text[:100],
                "created_at": now
            })

        await update_conversation_state(user_id, user_text, parsed.get("message", ""))

        actions = parsed.get("actions", [])
        if actions:
            for action in actions:
                if action.get("type") == "create_task" and action.get("title"):
                    await create_task(user_id, action["title"], action.get("due"))
        
        return {
            "message": parsed.get("message", ""),
            "intent": parsed.get("intent"),
            "actions": parsed.get("actions", []),
            "cost": MYU_COST_PER_MSG,
            "balance_after": round(new_balance, 2)
        }
        
    except Exception as e:
        logger.error(f"MYU AI error: {e}")
        return {
            "message": "Scusa, ho avuto un problema. Riprova tra un momento.",
            "intent": {"domain": "support", "intent": "fallback", "confidence": 0},
            "actions": [],
            "cost": 0,
            "balance_after": await check_balance(user_id)
        }


async def update_conversation_state(user_id: str, user_msg: str, assistant_msg: str):
    """Update short conversation state (not full history)."""
    summary = f"Utente: {user_msg[:80]} | MYU: {assistant_msg[:80]}"
    await db.myu_conversation_state.update_one(
        {"user_id": user_id},
        {"$set": {"summary": summary, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )


async def create_task(user_id: str, title: str, due_date: str = None) -> dict:
    """Create a task for the user."""
    import uuid
    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    task = {
        "id": task_id,
        "user_id": user_id,
        "title": title,
        "status": "active",
        "due_date": due_date,
        "created_at": now,
        "reminder_sent": False,
        "checkin_sent": False
    }
    await db.myu_tasks.insert_one(task)
    return task


async def get_merchant_suggestions(user_id: str) -> list:
    """Get merchant suggestions based on user profile."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "profile_tags": 1})
    tags = user.get("profile_tags", []) if user else []
    
    merchants = await db.merchants.find(
        {"is_active": True},
        {"_id": 0, "id": 1, "business_name": 1, "category": 1, "description": 1, "address": 1}
    ).to_list(10)
    
    return merchants
