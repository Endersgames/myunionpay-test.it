"""MYU Tool - Cinema Finder (MOCK - ready for external API)."""

# Mock cinema data for Italian cities
MOCK_CINEMAS = {
    "Roma": [
        {"name": "Cinema Barberini", "address": "Piazza Barberini 24", "movies": [
            {"title": "Il Gladiatore III", "times": ["15:30", "18:00", "21:00"]},
            {"title": "Oceania 2", "times": ["14:00", "16:30", "19:00"]},
        ]},
        {"name": "The Space Parco de Medici", "address": "Via Salvatore Rebecchini", "movies": [
            {"title": "Il Gladiatore III", "times": ["14:00", "17:00", "20:00", "22:30"]},
            {"title": "Mission Impossible 9", "times": ["16:00", "19:30", "22:00"]},
        ]},
    ],
    "Milano": [
        {"name": "UCI Cinemas Bicocca", "address": "Viale Sarca 336", "movies": [
            {"title": "Il Gladiatore III", "times": ["15:00", "18:00", "21:00"]},
            {"title": "Oceania 2", "times": ["14:30", "17:00"]},
        ]},
        {"name": "Anteo Palazzo del Cinema", "address": "Via Milazzo 9", "movies": [
            {"title": "La Zona d'Interesse", "times": ["16:00", "19:00", "21:30"]},
        ]},
    ],
    "Napoli": [
        {"name": "The Space Cinema", "address": "Via Argine 734", "movies": [
            {"title": "Il Gladiatore III", "times": ["15:00", "18:30", "21:30"]},
            {"title": "Oceania 2", "times": ["14:00", "16:00", "18:00"]},
        ]},
    ],
}

# Default for unknown cities
DEFAULT_CINEMAS = [
    {"name": "Multisala Centrale", "address": "Via Roma 1", "movies": [
        {"title": "Il Gladiatore III", "times": ["16:00", "19:00", "21:30"]},
        {"title": "Oceania 2", "times": ["15:00", "17:30"]},
    ]},
]


async def execute(user_id: str, city: str = None, geohash4: str = None, query: str = "", intent: str = "") -> dict:
    """Find cinema showings. MOCK implementation."""
    cinemas = MOCK_CINEMAS.get(city, DEFAULT_CINEMAS) if city else DEFAULT_CINEMAS

    # Filter by movie title if mentioned in query
    if query:
        q_lower = query.lower()
        filtered = []
        for cinema in cinemas:
            matching = [m for m in cinema["movies"] if q_lower in m["title"].lower()]
            if matching:
                filtered.append({**cinema, "movies": matching})
        if filtered:
            cinemas = filtered

    return {"cinemas": cinemas, "city": city or "zona", "source": "mock"}
