from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'uppay-default-secret-change-in-production-2024')
JWT_ALGORITHM = "HS256"

VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_EMAIL = os.environ.get('VAPID_EMAIL', 'mailto:noreply@uppay.app')

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
