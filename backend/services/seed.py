import uuid
import random
import logging
from datetime import datetime, timezone
from services.auth import hash_password, generate_qr_code
from database import db

logger = logging.getLogger("seed")


SEED_EMAILS = [
    "test@test.com", "luca.bianchi@test.com", "giulia.rossi@test.com",
    "marco.ferrari@test.com", "sofia.esposito@test.com", "alessandro.romano@test.com",
    "francesca.colombo@test.com", "lorenzo.ricci@test.com", "elena.marino@test.com",
    "andrea.greco@test.com", "valentina.conti@test.com", "matteo.gallo@test.com",
    "chiara.mancini@test.com", "davide.costa@test.com", "sara.fontana@test.com",
    "fernando.tozzi@test.com", "fernando.tozzi84@gmail.com", "pascoli.gio@test.com",
    "admin@test.com",
]


async def seed_test_data():
    """Seed test data if empty, or fix seed user passwords on startup"""
    try:
        user_count = await db.users.count_documents({})
        logger.info(f"Seed check: {user_count} users found in database")

        if user_count > 0:
            # Only fix passwords for SEED users, not all users
            new_hash = hash_password("test123")
            result = await db.users.update_many(
                {"email": {"$in": SEED_EMAILS}},
                {"$set": {"password_hash": new_hash}}
            )
            logger.info(f"Seed password fix: updated {result.modified_count} seed users")
            await seed_giftcards()
            await seed_admin_user()
            return

        logger.info("Database is empty. Seeding test data...")
        password_hash = hash_password("test123")

        test_users = [
            {"full_name": "Mario Rossi", "email": "test@test.com", "phone": "+393331234567"},
            {"full_name": "Luca Bianchi", "email": "luca.bianchi@test.com", "phone": "+393332234567"},
            {"full_name": "Giulia Rossi", "email": "giulia.rossi@test.com", "phone": "+393333234567"},
            {"full_name": "Marco Ferrari", "email": "marco.ferrari@test.com", "phone": "+393334234567"},
            {"full_name": "Sofia Esposito", "email": "sofia.esposito@test.com", "phone": "+393335234567"},
            {"full_name": "Alessandro Romano", "email": "alessandro.romano@test.com", "phone": "+393336234567"},
            {"full_name": "Francesca Colombo", "email": "francesca.colombo@test.com", "phone": "+393337234567"},
            {"full_name": "Lorenzo Ricci", "email": "lorenzo.ricci@test.com", "phone": "+393338234567"},
            {"full_name": "Elena Marino", "email": "elena.marino@test.com", "phone": "+393339234567"},
            {"full_name": "Andrea Greco", "email": "andrea.greco@test.com", "phone": "+393340234567"},
            {"full_name": "Valentina Conti", "email": "valentina.conti@test.com", "phone": "+393341234567"},
            {"full_name": "Matteo Gallo", "email": "matteo.gallo@test.com", "phone": "+393342234567"},
            {"full_name": "Chiara Mancini", "email": "chiara.mancini@test.com", "phone": "+393343234567"},
            {"full_name": "Davide Costa", "email": "davide.costa@test.com", "phone": "+393344234567"},
            {"full_name": "Sara Fontana", "email": "sara.fontana@test.com", "phone": "+393345234567"},
            {"full_name": "Fernando Tozzi", "email": "fernando.tozzi@test.com", "phone": "+393346234567"},
            {"full_name": "Fernando Tozzi", "email": "fernando.tozzi84@gmail.com", "phone": "+393933649510"},
            {"full_name": "Giovanni Pascoli", "email": "pascoli.gio@test.com", "phone": "+393770475123"},
        ]

        tags_pool = ["tech", "fashion", "food", "fitness", "travel", "music", "sports", "gaming", "beauty", "health"]
        caps = ["00100", "20100", "10100", "40100", "50100", "80100", "30100", "35100", "90100", "60100"]

        user_docs = []
        wallet_docs = []
        for u in test_users:
            user_id = str(uuid.uuid4())
            qr_code = generate_qr_code()
            user_tags = random.sample(tags_pool, random.randint(2, 5))
            cap = random.choice(caps)

            user_docs.append({
                "id": user_id,
                "email": u["email"],
                "phone": u["phone"],
                "full_name": u["full_name"],
                "password_hash": password_hash,
                "qr_code": qr_code,
                "referral_code": qr_code,
                "up_points": random.randint(0, 15),
                "profile_tags": user_tags,
                "is_merchant": False,
                "cap": cap,
                "created_at": datetime.now(timezone.utc).isoformat()
            })

            wallet_docs.append({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "balance": 100.0,
                "currency": "EUR",
                "created_at": datetime.now(timezone.utc).isoformat()
            })

        await db.users.insert_many(user_docs)
        await db.wallets.insert_many(wallet_docs)
        logger.info(f"Inserted {len(user_docs)} users and {len(wallet_docs)} wallets")

        merchants_data = [
            {"business_name": "Trattoria da Mario", "description": "Cucina tradizionale romana", "category": "Ristorante", "address": "Via del Corso 45, Roma"},
            {"business_name": "Caffe Bianchi", "description": "Il miglior espresso di Milano", "category": "Bar/Caffetteria", "address": "Corso Buenos Aires 12, Milano"},
            {"business_name": "Boutique Rossi", "description": "Moda italiana artigianale", "category": "Abbigliamento", "address": "Via Tornabuoni 8, Firenze"},
            {"business_name": "Tech Ferrari", "description": "Elettronica e riparazioni", "category": "Elettronica", "address": "Via Roma 23, Bologna"},
            {"business_name": "Fitness Life Gym", "description": "Palestra e benessere", "category": "Palestra/Fitness", "address": "Viale dei Colli Portuensi 100, Roma"},
        ]

        for i, m in enumerate(merchants_data):
            merchant_id = str(uuid.uuid4())
            merchant_qr = generate_qr_code()
            await db.merchants.insert_one({
                "id": merchant_id,
                "user_id": user_docs[i]["id"],
                "business_name": m["business_name"],
                "description": m["description"],
                "category": m["category"],
                "address": m["address"],
                "image_url": None,
                "qr_code": merchant_qr,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            await db.users.update_one({"id": user_docs[i]["id"]}, {"$set": {"is_merchant": True}})

        logger.info(f"Seed complete: {len(user_docs)} users, {len(wallet_docs)} wallets, {len(merchants_data)} merchants")

        # Seed gift cards
        await seed_giftcards()
        # Seed admin user
        await seed_admin_user()

    except Exception as e:
        logger.error(f"Seed failed: {e}")
        import traceback
        traceback.print_exc()


async def seed_admin_user():
    """Create admin user if not exists"""
    existing = await db.users.find_one({"email": "admin@test.com"})
    if existing:
        return
    admin_id = str(uuid.uuid4())
    qr_code = generate_qr_code()
    password_hash = hash_password("test123")
    await db.users.insert_one({
        "id": admin_id,
        "email": "admin@test.com",
        "phone": "+390000000000",
        "full_name": "Admin",
        "password_hash": password_hash,
        "qr_code": qr_code,
        "referral_code": qr_code,
        "up_points": 0,
        "profile_tags": [],
        "is_merchant": False,
        "is_admin": True,
        "cap": "00100",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    await db.wallets.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": admin_id,
        "balance": 10000.0,
        "currency": "EUR",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    logger.info("Admin user created: admin@test.com / test123")


async def seed_giftcards():
    """Seed default gift cards if none exist"""
    count = await db.giftcards.count_documents({})
    if count > 0:
        return

    giftcards = [
        {"brand": "Amazon.it", "category": "Shopping online", "cashback_percent": 1.87, "logo_color": "#232F3E", "available_amounts": [25, 50, 100, 200]},
        {"brand": "Tamoil", "category": "Auto e moto", "cashback_percent": 1.88, "logo_color": "#003399", "available_amounts": [25, 50, 100]},
        {"brand": "Q8", "category": "Auto e moto", "cashback_percent": 1.88, "logo_color": "#003DA5", "available_amounts": [25, 50, 100]},
        {"brand": "Conad", "category": "Alimentari e bevande", "cashback_percent": 1.69, "logo_color": "#D9D9D9", "available_amounts": [25, 50, 100]},
        {"brand": "MD", "category": "Alimentari e bevande", "cashback_percent": 1.95, "logo_color": "#0047AB", "available_amounts": [25, 50, 100]},
        {"brand": "IP", "category": "Auto e moto", "cashback_percent": 1.88, "logo_color": "#F27B20", "available_amounts": [25, 50, 100]},
        {"brand": "Esselunga", "category": "Alimentari e bevande", "cashback_percent": 1.75, "logo_color": "#E30613", "available_amounts": [25, 50, 100, 200]},
        {"brand": "MediaWorld", "category": "Elettronica", "cashback_percent": 2.10, "logo_color": "#E4002B", "available_amounts": [50, 100, 200, 500]},
        {"brand": "Zalando", "category": "Abbigliamento", "cashback_percent": 2.25, "logo_color": "#FF6900", "available_amounts": [25, 50, 100]},
        {"brand": "IKEA", "category": "Casa e arredo", "cashback_percent": 1.50, "logo_color": "#0058A3", "available_amounts": [25, 50, 100, 200]},
        {"brand": "Netflix", "category": "Intrattenimento", "cashback_percent": 1.30, "logo_color": "#E50914", "available_amounts": [25, 50]},
        {"brand": "Spotify", "category": "Intrattenimento", "cashback_percent": 1.45, "logo_color": "#1DB954", "available_amounts": [10, 30, 60]},
    ]

    for gc in giftcards:
        gc["id"] = str(uuid.uuid4())
        gc["active"] = True
        gc["created_at"] = datetime.now(timezone.utc).isoformat()

    await db.giftcards.insert_many(giftcards)
    logger.info(f"Seeded {len(giftcards)} gift cards")
