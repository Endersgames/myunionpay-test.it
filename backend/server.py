from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import os
import logging

from database import client

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

# Create the main app
app = FastAPI(title="UpPay API", version="2.0.0")

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


# ========================
# STATUS ROUTES
# ========================

@api_router.get("/")
async def root():
    return {"message": "UpPay API v2.0", "status": "online"}

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
