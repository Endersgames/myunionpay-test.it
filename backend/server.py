from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import jwt
import bcrypt
import secrets
import json
from pywebpush import webpush, WebPushException

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config - Must use environment variable for multi-replica deployment
JWT_SECRET = os.environ.get('JWT_SECRET', 'uppay-default-secret-change-in-production-2024')
JWT_ALGORITHM = "HS256"

# VAPID Config for Push Notifications
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_EMAIL = os.environ.get('VAPID_EMAIL', 'mailto:noreply@uppay.app')

# Create the main app
app = FastAPI(title="UpPay API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# ========================
# MODELS
# ========================

class UserBase(BaseModel):
    email: EmailStr
    phone: str
    full_name: str

class UserCreate(UserBase):
    password: str
    referral_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    phone: str
    full_name: str
    qr_code: str
    referral_code: str
    up_points: int
    is_merchant: bool
    created_at: str

class WalletResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    balance: float
    currency: str = "EUR"

class TransactionCreate(BaseModel):
    recipient_qr: str
    amount: float
    note: Optional[str] = None

class TransactionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    sender_id: str
    sender_name: str
    recipient_id: str
    recipient_name: str
    amount: float
    note: Optional[str]
    transaction_type: str
    created_at: str

class MerchantCreate(BaseModel):
    business_name: str
    description: str
    category: str
    address: str
    image_url: Optional[str] = None

class MerchantResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    business_name: str
    description: str
    category: str
    address: str
    image_url: Optional[str]
    qr_code: str
    created_at: str

class NotificationCreate(BaseModel):
    title: str
    message: str
    target_tags: List[str]
    reward_amount: float  # 0.01 to 3.00
    target_cap: Optional[str] = None  # CAP for location filtering
    target_all_italy: bool = True  # If true, send to all Italy

class NotificationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    merchant_id: str
    merchant_name: str
    title: str
    message: str
    target_tags: List[str]
    reward_amount: float
    total_recipients: int
    total_cost: float
    created_at: str

class UserNotificationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    notification_id: str
    merchant_name: str
    title: str
    message: str
    reward_amount: float
    is_read: bool
    created_at: str

class ProfileTagsUpdate(BaseModel):
    tags: List[str]

class DepositRequest(BaseModel):
    amount: float

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict

# ========================
# SIM MODELS
# ========================

class SimActivationRequest(BaseModel):
    plan_type: str = "SMART_240"  # Piano da 15.99€
    portability: bool = True
    current_operator: Optional[str] = None
    phone_to_port: Optional[str] = None
    # Dati personali
    fiscal_code: str
    birth_date: str
    birth_place: str
    address: str
    cap: str
    city: str
    document_type: str  # "carta_identita", "patente", "passaporto"
    document_number: str

class SimResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    phone_number: str
    plan_name: str
    plan_price: float
    minutes_total: int  # -1 = unlimited
    minutes_used: int
    sms_total: int
    sms_used: int
    gb_total: float
    gb_used: float
    activation_date: str
    expiry_date: str
    status: str  # "active", "pending", "suspended"
    portability_status: Optional[str] = None

# ========================
# AUTH HELPERS
# ========================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def generate_qr_code() -> str:
    """Generate QR code in format: MYU + 12 digits + 2 letters + 3 digits"""
    import random
    import string
    digits_12 = ''.join(random.choices(string.digits, k=12))
    letters_2 = ''.join(random.choices(string.ascii_uppercase, k=2))
    digits_3 = ''.join(random.choices(string.digits, k=3))
    return f"MYU{digits_12}{letters_2}{digits_3}"

def generate_referral_code(qr_code: str) -> str:
    """Referral code is the same as QR code"""
    return qr_code

# Common profile tags
PROFILE_TAGS = [
    "tech", "fashion", "food", "fitness", "travel", 
    "music", "sports", "gaming", "beauty", "health",
    "shopping", "entertainment", "finance", "education", "art"
]

MERCHANT_CATEGORIES = [
    "Ristorante", "Bar/Caffetteria", "Abbigliamento", "Elettronica",
    "Palestra/Fitness", "Bellezza/Spa", "Alimentari", "Farmacia",
    "Servizi", "Intrattenimento", "Altro"
]

# ========================
# AUTH ROUTES
# ========================

@api_router.post("/auth/register", response_model=dict)
async def register(data: UserCreate):
    # Check existing user - only need to know if exists
    existing = await db.users.find_one(
        {"$or": [{"email": data.email}, {"phone": data.phone}]},
        {"_id": 0, "id": 1}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email o telefono già registrati")
    
    user_id = str(uuid.uuid4())
    qr_code = generate_qr_code()
    referral_code = qr_code  # Referral code is the same as QR code
    
    user_doc = {
        "id": user_id,
        "email": data.email,
        "phone": data.phone,
        "full_name": data.full_name,
        "password_hash": hash_password(data.password),
        "qr_code": qr_code,
        "referral_code": referral_code,
        "up_points": 0,
        "profile_tags": [],
        "is_merchant": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Create wallet
    wallet_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "balance": 100.0,  # Demo starting balance
        "currency": "EUR",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    await db.wallets.insert_one(wallet_doc)
    
    # Handle referral
    if data.referral_code:
        referrer = await db.users.find_one(
            {"referral_code": data.referral_code}, 
            {"_id": 0, "id": 1}
        )
        if referrer:
            # Give 1 UP to both wallets
            await db.wallets.update_one({"user_id": referrer["id"]}, {"$inc": {"balance": 1}})
            await db.wallets.update_one({"user_id": user_id}, {"$inc": {"balance": 1}})
            
            # Also track UP points for stats
            await db.users.update_one({"id": referrer["id"]}, {"$inc": {"up_points": 1}})
            await db.users.update_one({"id": user_id}, {"$inc": {"up_points": 1}})
            
            # Record referral
            referral_doc = {
                "id": str(uuid.uuid4()),
                "referrer_id": referrer["id"],
                "referred_id": user_id,
                "bonus_amount": 1,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.referrals.insert_one(referral_doc)
    
    token = create_token(user_id)
    return {"token": token, "user_id": user_id}

@api_router.post("/auth/login", response_model=dict)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    
    token = create_token(user["id"])
    return {"token": token, "user_id": user["id"]}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(**user)

# ========================
# WALLET ROUTES
# ========================

@api_router.get("/wallet", response_model=WalletResponse)
async def get_wallet(user: dict = Depends(get_current_user)):
    wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet non trovato")
    return WalletResponse(**wallet)

@api_router.post("/wallet/deposit", response_model=WalletResponse)
async def deposit_to_wallet(data: DepositRequest, user: dict = Depends(get_current_user)):
    if data.amount <= 0 or data.amount > 1000:
        raise HTTPException(status_code=400, detail="Importo non valido (max 1000€)")
    
    await db.wallets.update_one(
        {"user_id": user["id"]},
        {"$inc": {"balance": data.amount}}
    )
    
    # Record transaction
    tx_doc = {
        "id": str(uuid.uuid4()),
        "sender_id": "SYSTEM",
        "sender_name": "Deposito",
        "recipient_id": user["id"],
        "recipient_name": user["full_name"],
        "amount": data.amount,
        "note": "Ricarica wallet",
        "transaction_type": "deposit",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(tx_doc)
    
    wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    return WalletResponse(**wallet)

# ========================
# PAYMENT ROUTES
# ========================

@api_router.post("/payments/send", response_model=TransactionResponse)
async def send_payment(data: TransactionCreate, user: dict = Depends(get_current_user)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Importo non valido")
    
    # Find recipient by QR code
    recipient = await db.users.find_one({"qr_code": data.recipient_qr}, {"_id": 0})
    if not recipient:
        # Try merchant QR
        merchant = await db.merchants.find_one({"qr_code": data.recipient_qr}, {"_id": 0})
        if merchant:
            recipient = await db.users.find_one({"id": merchant["user_id"]}, {"_id": 0})
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Destinatario non trovato")
    
    if recipient["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Non puoi pagare te stesso")
    
    # Check balance
    sender_wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    if sender_wallet["balance"] < data.amount:
        raise HTTPException(status_code=400, detail="Saldo insufficiente")
    
    # Execute transfer
    await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": -data.amount}})
    await db.wallets.update_one({"user_id": recipient["id"]}, {"$inc": {"balance": data.amount}})
    
    # Record transaction
    tx_doc = {
        "id": str(uuid.uuid4()),
        "sender_id": user["id"],
        "sender_name": user["full_name"],
        "recipient_id": recipient["id"],
        "recipient_name": recipient["full_name"],
        "amount": data.amount,
        "note": data.note,
        "transaction_type": "payment",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(tx_doc)
    
    return TransactionResponse(**tx_doc)

@api_router.get("/payments/history", response_model=List[TransactionResponse])
async def get_payment_history(user: dict = Depends(get_current_user)):
    transactions = await db.transactions.find(
        {"$or": [{"sender_id": user["id"]}, {"recipient_id": user["id"]}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return [TransactionResponse(**tx) for tx in transactions]

@api_router.get("/payments/user/{qr_code}", response_model=dict)
async def get_user_by_qr(qr_code: str):
    user = await db.users.find_one({"qr_code": qr_code}, {"_id": 0, "password_hash": 0})
    if not user:
        merchant = await db.merchants.find_one({"qr_code": qr_code}, {"_id": 0})
        if merchant:
            user = await db.users.find_one({"id": merchant["user_id"]}, {"_id": 0, "password_hash": 0})
            if user:
                return {"type": "merchant", "name": merchant["business_name"], "qr_code": qr_code, "user_id": user["id"], "referral_code": user.get("referral_code", "")}
    
    if not user:
        raise HTTPException(status_code=404, detail="QR code non valido")
    
    return {"type": "user", "name": user["full_name"], "qr_code": qr_code, "user_id": user["id"], "referral_code": user.get("referral_code", "")}

# Get referral code from QR code (for non-logged users)
@api_router.get("/qr/referral/{qr_code}", response_model=dict)
async def get_referral_from_qr(qr_code: str):
    """Get referral code from a user's QR code - used when non-logged user scans QR"""
    user = await db.users.find_one({"qr_code": qr_code}, {"_id": 0, "password_hash": 0})
    if not user:
        # Try merchant QR
        merchant = await db.merchants.find_one({"qr_code": qr_code}, {"_id": 0})
        if merchant:
            user = await db.users.find_one({"id": merchant["user_id"]}, {"_id": 0, "password_hash": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="QR code non valido")
    
    return {
        "referral_code": user.get("referral_code", ""),
        "name": user.get("full_name", ""),
        "qr_code": qr_code
    }

# ========================
# MERCHANT ROUTES
# ========================

@api_router.post("/merchants", response_model=MerchantResponse)
async def create_merchant(data: MerchantCreate, user: dict = Depends(get_current_user)):
    existing = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Sei già registrato come merchant")
    
    merchant_id = str(uuid.uuid4())
    qr_code = generate_qr_code()
    
    merchant_doc = {
        "id": merchant_id,
        "user_id": user["id"],
        "business_name": data.business_name,
        "description": data.description,
        "category": data.category,
        "address": data.address,
        "image_url": data.image_url,
        "qr_code": qr_code,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.merchants.insert_one(merchant_doc)
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_merchant": True}})
    
    return MerchantResponse(**merchant_doc)

@api_router.get("/merchants", response_model=List[MerchantResponse])
async def get_merchants(category: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    
    merchants = await db.merchants.find(query, {"_id": 0}).to_list(100)
    return [MerchantResponse(**m) for m in merchants]

@api_router.get("/merchants/me", response_model=MerchantResponse)
async def get_my_merchant(user: dict = Depends(get_current_user)):
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Non sei un merchant")
    return MerchantResponse(**merchant)

@api_router.get("/merchants/{merchant_id}", response_model=MerchantResponse)
async def get_merchant(merchant_id: str):
    merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant non trovato")
    return MerchantResponse(**merchant)

@api_router.get("/merchants/categories/list", response_model=List[str])
async def get_merchant_categories():
    return MERCHANT_CATEGORIES

# ========================
# NOTIFICATION ROUTES
# ========================

class NotificationPreviewRequest(BaseModel):
    target_tags: List[str]
    target_cap: Optional[str] = None
    target_all_italy: bool = True

class NotificationPreviewResponse(BaseModel):
    total_users: int
    users: List[dict]

@api_router.post("/notifications/preview", response_model=NotificationPreviewResponse)
async def preview_notification_targets(data: NotificationPreviewRequest, user: dict = Depends(get_current_user)):
    """Preview users that will receive the notification"""
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=403, detail="Solo i merchant possono inviare notifiche")
    
    # Build query
    query_conditions = [{"id": {"$ne": user["id"]}}]  # Exclude merchant
    
    # Filter by tags if specified
    if data.target_tags and len(data.target_tags) > 0:
        query_conditions.append({"profile_tags": {"$in": data.target_tags}})
    
    # Filter by CAP if not all Italy
    if not data.target_all_italy and data.target_cap:
        query_conditions.append({"cap": data.target_cap})
    
    query = {"$and": query_conditions} if len(query_conditions) > 1 else query_conditions[0]
    
    # Get users with limited info
    target_users = await db.users.find(
        query, 
        {"_id": 0, "id": 1, "full_name": 1, "cap": 1, "profile_tags": 1}
    ).to_list(1000)
    
    return NotificationPreviewResponse(
        total_users=len(target_users),
        users=[{
            "id": u["id"],
            "full_name": u["full_name"],
            "cap": u.get("cap", "N/A"),
            "tags": u.get("profile_tags", [])[:3]  # Limit tags shown
        } for u in target_users[:20]]  # Show max 20 users in preview
    )

@api_router.post("/notifications/send", response_model=NotificationResponse)
async def send_notification(data: NotificationCreate, user: dict = Depends(get_current_user)):
    merchant = await db.merchants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=403, detail="Solo i merchant possono inviare notifiche")
    
    if data.reward_amount < 0.01 or data.reward_amount > 3.00:
        raise HTTPException(status_code=400, detail="Importo reward deve essere tra 0.01 e 3.00 UP")
    
    # Build query
    query_conditions = [{"id": {"$ne": user["id"]}}]  # Exclude merchant
    
    # Filter by tags if specified
    if data.target_tags and len(data.target_tags) > 0:
        query_conditions.append({"profile_tags": {"$in": data.target_tags}})
    
    # Filter by CAP if not all Italy
    if not data.target_all_italy and data.target_cap:
        query_conditions.append({"cap": data.target_cap})
    
    query = {"$and": query_conditions} if len(query_conditions) > 1 else query_conditions[0]
    
    target_users = await db.users.find(query, {"_id": 0, "id": 1}).to_list(10000)
    
    total_recipients = len(target_users)
    total_cost = total_recipients * data.reward_amount
    
    # Check merchant balance
    merchant_wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    if merchant_wallet["balance"] < total_cost:
        raise HTTPException(status_code=400, detail=f"Saldo insufficiente. Costo totale: €{total_cost:.2f}")
    
    # Deduct from merchant
    await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": -total_cost}})
    
    notification_id = str(uuid.uuid4())
    notification_doc = {
        "id": notification_id,
        "merchant_id": merchant["id"],
        "merchant_name": merchant["business_name"],
        "title": data.title,
        "message": data.message,
        "target_tags": data.target_tags,
        "reward_amount": data.reward_amount,
        "total_recipients": total_recipients,
        "total_cost": total_cost,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.notifications.insert_one(notification_doc)
    
    # Create user notifications, credit rewards, and send push notifications
    for target_user in target_users:
        user_notif_doc = {
            "id": str(uuid.uuid4()),
            "notification_id": notification_id,
            "user_id": target_user["id"],
            "merchant_name": merchant["business_name"],
            "title": data.title,
            "message": data.message,
            "reward_amount": data.reward_amount,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_notifications.insert_one(user_notif_doc)
        await db.wallets.update_one({"user_id": target_user["id"]}, {"$inc": {"balance": data.reward_amount}})
        
        # Send push notification (async, don't wait)
        try:
            await send_push_notification(
                user_id=target_user["id"],
                title=f"💰 {merchant['business_name']}",
                body=f"{data.title} - Hai guadagnato €{data.reward_amount:.2f}!",
                data={
                    "type": "merchant_notification",
                    "notification_id": notification_id,
                    "reward": data.reward_amount,
                    "url": "/notifications"
                }
            )
        except Exception as e:
            logging.error(f"Failed to send push to user {target_user['id']}: {e}")
    
    return NotificationResponse(**notification_doc)

@api_router.get("/notifications/me", response_model=List[UserNotificationResponse])
async def get_my_notifications(user: dict = Depends(get_current_user)):
    notifications = await db.user_notifications.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return [UserNotificationResponse(**n) for n in notifications]

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    result = await db.user_notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"is_read": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notifica non trovata")
    return {"success": True}

@api_router.get("/notifications/unread-count", response_model=dict)
async def get_unread_count(user: dict = Depends(get_current_user)):
    count = await db.user_notifications.count_documents({"user_id": user["id"], "is_read": False})
    return {"count": count}

# ========================
# PROFILE ROUTES
# ========================

@api_router.get("/profile/tags", response_model=List[str])
async def get_profile_tags():
    return PROFILE_TAGS

@api_router.put("/profile/tags", response_model=dict)
async def update_my_tags(data: ProfileTagsUpdate, user: dict = Depends(get_current_user)):
    # Validate tags
    valid_tags = [t for t in data.tags if t in PROFILE_TAGS]
    await db.users.update_one({"id": user["id"]}, {"$set": {"profile_tags": valid_tags}})
    return {"tags": valid_tags}

@api_router.get("/profile/my-tags", response_model=dict)
async def get_my_tags(user: dict = Depends(get_current_user)):
    return {"tags": user.get("profile_tags", [])}

# ========================
# PUSH NOTIFICATION ROUTES
# ========================

@api_router.get("/push/vapid-key")
async def get_vapid_key():
    """Get the VAPID public key for push subscription"""
    return {"publicKey": VAPID_PUBLIC_KEY}

@api_router.post("/push/subscribe")
async def subscribe_push(subscription: PushSubscription, user: dict = Depends(get_current_user)):
    """Register a push subscription for a user"""
    # Store subscription in database
    sub_doc = {
        "user_id": user["id"],
        "endpoint": subscription.endpoint,
        "keys": subscription.keys,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert - update if exists, insert if not
    await db.push_subscriptions.update_one(
        {"user_id": user["id"], "endpoint": subscription.endpoint},
        {"$set": sub_doc},
        upsert=True
    )
    
    return {"success": True, "message": "Push subscription registered"}

@api_router.delete("/push/unsubscribe")
async def unsubscribe_push(user: dict = Depends(get_current_user)):
    """Remove all push subscriptions for a user"""
    await db.push_subscriptions.delete_many({"user_id": user["id"]})
    return {"success": True, "message": "Push subscriptions removed"}

async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Send push notification to a user"""
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        logging.warning("VAPID keys not configured, skipping push notification")
        return False
    
    # Get user's push subscriptions
    subscriptions = await db.push_subscriptions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(10)
    
    if not subscriptions:
        return False
    
    payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/icon.svg",
        "badge": "/icon.svg",
        "data": data or {},
        "tag": f"uppay-{datetime.now().timestamp()}"
    })
    
    success = False
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"]
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={
                    "sub": VAPID_EMAIL
                }
            )
            success = True
        except WebPushException as e:
            logging.error(f"Push notification failed: {e}")
            # Remove invalid subscription
            if e.response and e.response.status_code in [404, 410]:
                await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
        except Exception as e:
            logging.error(f"Push notification error: {e}")
    
    return success

# ========================
# REFERRAL ROUTES
# ========================

@api_router.get("/referrals/stats", response_model=dict)
async def get_referral_stats(user: dict = Depends(get_current_user)):
    # Use count_documents for better performance
    total_referrals = await db.referrals.count_documents({"referrer_id": user["id"]})
    return {
        "referral_code": user["referral_code"],
        "total_referrals": total_referrals,
        "up_points": user["up_points"]
    }

# ========================
# SIM ROUTES
# ========================

@api_router.get("/sim/my-sim")
async def get_my_sim(user: dict = Depends(get_current_user)):
    """Get user's SIM card info"""
    sim = await db.sims.find_one({"user_id": user["id"]}, {"_id": 0})
    if not sim:
        return None
    return sim

@api_router.post("/sim/activate")
async def activate_sim(data: SimActivationRequest, user: dict = Depends(get_current_user)):
    """Activate a new SIM card"""
    # Check if user already has a SIM
    existing_sim = await db.sims.find_one({"user_id": user["id"]})
    if existing_sim:
        raise HTTPException(status_code=400, detail="Hai già una SIM attiva")
    
    # Check wallet balance for activation cost (15.99 UP)
    wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    activation_cost = 15.99
    if wallet["balance"] < activation_cost:
        raise HTTPException(status_code=400, detail=f"Saldo insufficiente. Servono {activation_cost} UP")
    
    # Deduct activation cost
    await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": -activation_cost}})
    
    # Generate phone number (or use ported number)
    if data.portability and data.phone_to_port:
        phone_number = data.phone_to_port
        portability_status = "in_corso"
    else:
        # Generate new number starting with 35341 (like Tiscali)
        import random
        phone_number = f"35341{random.randint(10000, 99999)}{random.randint(0, 9)}"
        portability_status = None
    
    # Calculate expiry (30 days from now)
    from datetime import timedelta
    activation_date = datetime.now(timezone.utc)
    expiry_date = activation_date + timedelta(days=30)
    
    sim_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "phone_number": phone_number,
        "plan_name": "SMART X TE 240 TOP",
        "plan_price": 15.99,
        "minutes_total": -1,  # -1 = unlimited
        "minutes_used": 0,
        "sms_total": 100,
        "sms_used": 0,
        "gb_total": 240.0,
        "gb_used": 0.0,
        "activation_date": activation_date.isoformat(),
        "expiry_date": expiry_date.isoformat(),
        "status": "active",
        "portability_status": portability_status,
        # Personal data
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
    
    # Update user's phone if portability
    if data.portability and data.phone_to_port:
        await db.users.update_one({"id": user["id"]}, {"$set": {"phone": phone_number}})
    
    return {
        "success": True,
        "message": "SIM attivata con successo!",
        "sim": {k: v for k, v in sim_doc.items() if k != "_id"}
    }

@api_router.post("/sim/use-data")
async def use_sim_data(user: dict = Depends(get_current_user)):
    """Simulate data usage (for demo)"""
    sim = await db.sims.find_one({"user_id": user["id"]})
    if not sim:
        raise HTTPException(status_code=404, detail="Nessuna SIM trovata")
    
    import random
    # Simulate random usage
    gb_used = min(sim["gb_used"] + random.uniform(0.1, 2.0), sim["gb_total"])
    sms_used = min(sim["sms_used"] + random.randint(0, 3), sim["sms_total"])
    
    await db.sims.update_one(
        {"user_id": user["id"]},
        {"$set": {"gb_used": round(gb_used, 2), "sms_used": sms_used}}
    )
    
    return {"gb_used": round(gb_used, 2), "sms_used": sms_used}

# ========================
# STATUS ROUTES
# ========================

@api_router.get("/")
async def root():
    return {"message": "UpPay API v1.0", "status": "online"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Root level health check for Kubernetes probes
@app.get("/health")
async def root_health():
    return {"status": "healthy"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
