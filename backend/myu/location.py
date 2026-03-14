"""MYU Location Layer - Geohash-4 encoding, city normalization, confirmation."""
import math
import logging
from datetime import datetime, timezone
from database import db

logger = logging.getLogger("myu.location")

# Geohash base32 alphabet
_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"
_DECODEMAP = {c: i for i, c in enumerate(_BASE32)}


def encode_geohash(lat: float, lng: float, precision: int = 4) -> str:
    """Encode lat/lng to geohash string."""
    lat_range = [-90.0, 90.0]
    lng_range = [-180.0, 180.0]
    bits = [16, 8, 4, 2, 1]
    result = []
    ch = 0
    bit = 0
    is_lng = True
    while len(result) < precision:
        if is_lng:
            mid = (lng_range[0] + lng_range[1]) / 2
            if lng >= mid:
                ch |= bits[bit]
                lng_range[0] = mid
            else:
                lng_range[1] = mid
        else:
            mid = (lat_range[0] + lat_range[1]) / 2
            if lat >= mid:
                ch |= bits[bit]
                lat_range[0] = mid
            else:
                lat_range[1] = mid
        is_lng = not is_lng
        bit += 1
        if bit == 5:
            result.append(_BASE32[ch])
            ch = 0
            bit = 0
    return "".join(result)


def decode_geohash(gh: str) -> tuple:
    """Decode geohash to (lat, lng) center point."""
    lat_range = [-90.0, 90.0]
    lng_range = [-180.0, 180.0]
    is_lng = True
    for c in gh:
        val = _DECODEMAP.get(c, 0)
        for bit in [16, 8, 4, 2, 1]:
            if is_lng:
                mid = (lng_range[0] + lng_range[1]) / 2
                if val & bit:
                    lng_range[0] = mid
                else:
                    lng_range[1] = mid
            else:
                mid = (lat_range[0] + lat_range[1]) / 2
                if val & bit:
                    lat_range[0] = mid
                else:
                    lat_range[1] = mid
            is_lng = not is_lng
    return (lat_range[0] + lat_range[1]) / 2, (lng_range[0] + lng_range[1]) / 2


# Major Italian cities with lat/lng
ITALIAN_CITIES = [
    ("Roma", 41.9028, 12.4964),
    ("Milano", 45.4642, 9.1900),
    ("Napoli", 40.8518, 14.2681),
    ("Torino", 45.0703, 7.6869),
    ("Firenze", 43.7696, 11.2558),
    ("Bologna", 44.4949, 11.3426),
    ("Palermo", 38.1157, 13.3615),
    ("Genova", 44.4056, 8.9463),
    ("Bari", 41.1171, 16.8719),
    ("Venezia", 45.4408, 12.3155),
    ("Verona", 45.4384, 10.9916),
    ("Catania", 37.5079, 15.0830),
    ("Cagliari", 39.2238, 9.1217),
    ("Padova", 45.4064, 11.8768),
    ("Trieste", 45.6495, 13.7768),
    ("Brescia", 45.5416, 10.2118),
    ("Parma", 44.8015, 10.3279),
    ("Modena", 44.6471, 10.9252),
    ("Reggio Calabria", 38.1113, 15.6474),
    ("Perugia", 43.1107, 12.3908),
    ("Livorno", 43.5485, 10.3106),
    ("Ravenna", 44.4184, 12.2035),
    ("Rimini", 44.0678, 12.5695),
    ("Salerno", 40.6824, 14.7681),
    ("Lecce", 40.3516, 18.1750),
    ("Pescara", 42.4618, 14.2139),
    ("Bergamo", 45.6983, 9.6773),
    ("Como", 45.8081, 9.0852),
    ("Siena", 43.3188, 11.3308),
    ("Pisa", 43.7228, 10.4017),
]

# City name aliases (lowercase -> canonical)
CITY_ALIASES = {
    "roma": "Roma", "rome": "Roma",
    "milano": "Milano", "milan": "Milano",
    "napoli": "Napoli", "naples": "Napoli",
    "torino": "Torino", "turin": "Torino",
    "firenze": "Firenze", "florence": "Firenze",
    "bologna": "Bologna",
    "palermo": "Palermo",
    "genova": "Genova", "genoa": "Genova",
    "bari": "Bari",
    "venezia": "Venezia", "venice": "Venezia",
    "verona": "Verona",
    "catania": "Catania",
    "cagliari": "Cagliari",
    "padova": "Padova",
    "trieste": "Trieste",
    "brescia": "Brescia",
    "parma": "Parma",
    "modena": "Modena",
    "perugia": "Perugia",
    "livorno": "Livorno",
    "ravenna": "Ravenna",
    "rimini": "Rimini",
    "salerno": "Salerno",
    "lecce": "Lecce",
    "pescara": "Pescara",
    "bergamo": "Bergamo",
    "como": "Como",
    "siena": "Siena",
    "pisa": "Pisa",
}


def _haversine(lat1, lng1, lat2, lng2) -> float:
    """Distance in km between two lat/lng points."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_city_from_geohash4(gh4: str) -> str | None:
    """Find nearest Italian city from a geohash-4."""
    if not gh4:
        return None
    lat, lng = decode_geohash(gh4)
    best_city = None
    best_dist = float("inf")
    for name, clat, clng in ITALIAN_CITIES:
        d = _haversine(lat, lng, clat, clng)
        if d < best_dist:
            best_dist = d
            best_city = name
    return best_city if best_dist < 80 else None  # within 80km


def normalize_city_name(text: str) -> str | None:
    """Normalize a city name to canonical form."""
    return CITY_ALIASES.get(text.strip().lower())


def extract_city_from_text(text: str) -> str | None:
    """Try to extract an Italian city name from user text."""
    text_lower = text.lower()
    for alias, canonical in sorted(CITY_ALIASES.items(), key=lambda x: -len(x[0])):
        if alias in text_lower:
            return canonical
    return None


async def get_location_state(user_id: str) -> dict | None:
    """Get stored location state for user."""
    return await db.user_location_state.find_one({"user_id": user_id}, {"_id": 0})


async def save_location(user_id: str, lat: float, lng: float) -> dict:
    """Save/update user location with geohash-4 and inferred city."""
    gh4 = encode_geohash(lat, lng, 4)
    city = get_city_from_geohash4(gh4)
    now = datetime.now(timezone.utc).isoformat()
    state = {
        "user_id": user_id,
        "latitude": lat,
        "longitude": lng,
        "geohash_4": gh4,
        "inferred_city": city,
        "city_confirmed": False,
        "last_updated_at": now,
    }
    await db.user_location_state.update_one(
        {"user_id": user_id}, {"$set": state}, upsert=True
    )
    return state


async def confirm_city(user_id: str, city: str) -> dict:
    """Mark city as confirmed by user."""
    canonical = normalize_city_name(city) or city
    now = datetime.now(timezone.utc).isoformat()
    await db.user_location_state.update_one(
        {"user_id": user_id},
        {"$set": {"inferred_city": canonical, "city_confirmed": True, "last_updated_at": now}},
        upsert=True,
    )
    return await get_location_state(user_id)


def needs_city_confirmation(location_state: dict | None, mentioned_city: str | None) -> dict:
    """Determine if we need to ask user to confirm city.
    Returns: {need_confirm: bool, message: str | None, resolved_city: str | None}
    """
    geo_city = location_state.get("inferred_city") if location_state else None
    confirmed = location_state.get("city_confirmed", False) if location_state else False

    # Case 1: No location at all, no city mentioned
    if not geo_city and not mentioned_city:
        return {"need_confirm": True, "message": "Dimmi in che citta vuoi che controlli.", "resolved_city": None}

    # Case 2: User mentioned a city, matches geo
    if mentioned_city and geo_city and mentioned_city.lower() == geo_city.lower():
        return {"need_confirm": False, "resolved_city": geo_city}

    # Case 3: User mentioned a city, no geo or different from geo
    if mentioned_city and not geo_city:
        return {"need_confirm": False, "resolved_city": mentioned_city}

    # Case 4: User mentioned a city that differs from geo
    if mentioned_city and geo_city and mentioned_city.lower() != geo_city.lower():
        return {
            "need_confirm": True,
            "message": f"Hai scritto {mentioned_city}, ma la tua zona attuale sembra {geo_city}. Dove vuoi che controlli?",
            "resolved_city": None,
            "options": [mentioned_city, geo_city],
        }

    # Case 5: Geo city available but not confirmed, no mention
    if geo_city and not confirmed:
        return {
            "need_confirm": True,
            "message": f"Sei a {geo_city}, giusto? Posso controllare li.",
            "resolved_city": geo_city,
        }

    # Case 6: Geo city confirmed
    if geo_city and confirmed:
        return {"need_confirm": False, "resolved_city": geo_city}

    return {"need_confirm": True, "message": "In che citta vuoi che cerchi?", "resolved_city": None}
