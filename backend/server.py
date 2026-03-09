from fastapi import FastAPI, APIRouter
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
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
from routes.admin_content import router as admin_content_router
from routes.admin_features import router as admin_features_router

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
api_router.include_router(admin_content_router)
api_router.include_router(admin_features_router)


# ========================
# STATUS ROUTES
# ========================

@api_router.get("/")
async def root():
    return {"message": "myUup.com API v2.0", "status": "online"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

@api_router.get("/content/{key}")
async def get_public_content(key: str):
    """Public endpoint to get app content."""
    from database import db
    item = await db.app_content.find_one({"key": key}, {"_id": 0})
    if not item:
        return {"key": key, "title": "", "content": ""}
    return item

# Root level health check for Kubernetes probes
@app.get("/health")
async def root_health():
    return {"status": "healthy"}

# Include the router
app.include_router(api_router)

# Serve uploaded files
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

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

@app.on_event("startup")
async def startup_event():
    await seed_test_data()
    await seed_app_content()


async def seed_app_content():
    """Seed default app content if not present."""
    from database import db
    defaults = [
        {
            "key": "data_treatment_1",
            "title": "Comunicazioni commerciali",
            "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
        },
        {
            "key": "data_treatment_2",
            "title": "Profilazione utente",
            "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident."
        },
        {
            "key": "data_treatment_3",
            "title": "Condivisione con terze parti",
            "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit."
        },
        {
            "key": "data_treatment_4",
            "title": "Analisi e miglioramento servizi",
            "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error."
        },
        {
            "key": "privacy_policy",
            "title": "Informativa sulla Privacy",
            "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\nSed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo."
        }
    ]
    for item in defaults:
        existing = await db.app_content.find_one({"key": item["key"]})
        if not existing:
            item["created_at"] = datetime.now(timezone.utc).isoformat()
            item["updated_at"] = item["created_at"]
            await db.app_content.insert_one(item)
    logger.info("App content seed complete")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
