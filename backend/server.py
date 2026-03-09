from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import os
import logging

from database import client
from services.seed import seed_test_data

# Import all route modules
from routes.auth import router as auth_router
from routes.wallet import router as wallet_router
from routes.payments import router as payments_router
from routes.merchants import router as merchants_router
from routes.notifications import router as notifications_router
from routes.profile import router as profile_router
from routes.push import router as push_router
from routes.referrals import router as referrals_router
from routes.sim import router as sim_router
from routes.qr import router as qr_router
from routes.tasks import router as tasks_router
from routes.giftcards import router as giftcards_router
from routes.gestpay import router as gestpay_router
from routes.menu import router as menu_router
from routes.myu import router as myu_router
from routes.merchant_users import router as merchant_users_router
from routes.admin_users import router as admin_users_router
from routes.admin_openai import router as admin_openai_router

# Create the main app
app = FastAPI(title="myUup.com API", version="2.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Include all sub-routers
api_router.include_router(auth_router)
api_router.include_router(wallet_router)
api_router.include_router(payments_router)
api_router.include_router(merchants_router)
api_router.include_router(notifications_router)
api_router.include_router(profile_router)
api_router.include_router(push_router)
api_router.include_router(referrals_router)
api_router.include_router(sim_router)
api_router.include_router(qr_router)
api_router.include_router(tasks_router)
api_router.include_router(giftcards_router)
api_router.include_router(gestpay_router)
api_router.include_router(menu_router)
api_router.include_router(myu_router)
api_router.include_router(merchant_users_router)
api_router.include_router(admin_users_router)
api_router.include_router(admin_openai_router)


# ========================
# STATUS ROUTES
# ========================

@api_router.get("/")
async def root():
    return {"message": "myUup.com API v2.0", "status": "online"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Root level health check for Kubernetes probes
@app.get("/health")
async def root_health():
    return {"status": "healthy"}

# Include the router
app.include_router(api_router)

def _get_cors_origins() -> list[str]:
    raw_origins = os.environ.get(
        "CORS_ORIGINS",
        "https://dev.myuup.com,http://localhost:3000,http://127.0.0.1:3000"
    )
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    if not origins:
        return ["https://dev.myuup.com"]
    return origins

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_get_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add MYU specific logger
myu_logger = logging.getLogger("myu")
debug_enabled = os.environ.get("DEBUG", "").lower() == "true"
myu_logger.setLevel(logging.DEBUG if debug_enabled else logging.INFO)

@app.on_event("startup")
async def startup_event():
    await seed_test_data()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
