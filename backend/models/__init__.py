from pydantic import BaseModel, ConfigDict, EmailStr
from typing import List, Optional


# ========================
# USER MODELS
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
    is_admin: Optional[bool] = False
    created_at: str
    address: Optional[str] = ""
    profile_picture: Optional[str] = ""
    google_auth: Optional[bool] = False


# ========================
# WALLET MODELS
# ========================

class WalletResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    balance: float
    currency: str = "EUR"

class DepositRequest(BaseModel):
    amount: float


# ========================
# TRANSACTION MODELS
# ========================

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


# ========================
# MERCHANT MODELS
# ========================

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
    image_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    qr_code: str
    created_at: str


# ========================
# NOTIFICATION MODELS
# ========================

class NotificationCreate(BaseModel):
    title: str
    message: str
    target_tags: List[str]
    reward_amount: float
    target_cap: Optional[str] = None
    target_all_italy: bool = True

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

class NotificationPreviewRequest(BaseModel):
    target_tags: List[str]
    target_cap: Optional[str] = None
    target_all_italy: bool = True

class NotificationPreviewResponse(BaseModel):
    total_users: int
    users: List[dict]


# ========================
# PROFILE MODELS
# ========================

class ProfileTagsUpdate(BaseModel):
    tags: List[str]


# ========================
# PUSH MODELS
# ========================

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict


# ========================
# SIM / CONTO UP MODELS
# ========================

class SimActivationRequest(BaseModel):
    plan_type: str = "SMART_240"
    portability: bool = True
    current_operator: Optional[str] = None
    phone_to_port: Optional[str] = None
    fiscal_code: str
    birth_date: str
    birth_place: str
    address: str
    cap: str
    city: str
    document_type: str
    document_number: str

class SimResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    phone_number: str
    plan_name: str
    plan_price: float
    minutes_total: int
    minutes_used: int
    sms_total: int
    sms_used: int
    gb_total: float
    gb_used: float
    activation_date: str
    expiry_date: str
    status: str
    portability_status: Optional[str] = None

class BonificoRequest(BaseModel):
    recipient_iban: str
    recipient_name: str
    amount: float
    description: str

class ConvertToUPRequest(BaseModel):
    eur_amount: float
