"""MYU Tool - Weather (MOCK - ready for external API)."""
import random

MOCK_WEATHER = {
    "Roma": {"temp": 18, "condition": "Soleggiato", "humidity": 55, "wind": 12},
    "Milano": {"temp": 12, "condition": "Nuvoloso", "humidity": 72, "wind": 8},
    "Napoli": {"temp": 20, "condition": "Parzialmente nuvoloso", "humidity": 60, "wind": 15},
    "Torino": {"temp": 10, "condition": "Pioggia leggera", "humidity": 80, "wind": 6},
    "Firenze": {"temp": 16, "condition": "Soleggiato", "humidity": 50, "wind": 10},
    "Bologna": {"temp": 14, "condition": "Nuvoloso", "humidity": 65, "wind": 9},
    "Venezia": {"temp": 13, "condition": "Nebbia", "humidity": 85, "wind": 5},
    "Palermo": {"temp": 22, "condition": "Soleggiato", "humidity": 45, "wind": 18},
}

DEFAULT_WEATHER = {"temp": 15, "condition": "Variabile", "humidity": 60, "wind": 10}


async def execute(user_id: str, city: str = None, geohash4: str = None, query: str = "", intent: str = "") -> dict:
    """Get weather info. MOCK implementation."""
    base = MOCK_WEATHER.get(city, DEFAULT_WEATHER) if city else DEFAULT_WEATHER
    # Add slight randomness
    weather = {
        "city": city or "zona",
        "temperature": base["temp"] + random.randint(-2, 2),
        "condition": base["condition"],
        "humidity": base["humidity"],
        "wind_kmh": base["wind"],
        "source": "mock",
    }
    return weather
