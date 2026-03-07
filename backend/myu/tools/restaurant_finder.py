"""MYU Tool - Restaurant Finder (MOCK - ready for external API)."""

MOCK_RESTAURANTS = {
    "Roma": [
        {"name": "Roscioli", "cuisine": "Romana", "rating": 4.7, "price": "$$", "address": "Via dei Giubbonari 21"},
        {"name": "Da Enzo al 29", "cuisine": "Trattoria", "rating": 4.6, "price": "$", "address": "Via dei Vascellari 29"},
        {"name": "Pizzarium", "cuisine": "Pizza", "rating": 4.8, "price": "$", "address": "Via della Meloria 43"},
    ],
    "Milano": [
        {"name": "Langosteria", "cuisine": "Pesce", "rating": 4.5, "price": "$$$", "address": "Via Savona 10"},
        {"name": "Spontini", "cuisine": "Pizza", "rating": 4.3, "price": "$", "address": "Via Santa Radegonda 11"},
        {"name": "Trattoria Milanese", "cuisine": "Milanese", "rating": 4.4, "price": "$$", "address": "Via Santa Marta 11"},
    ],
    "Napoli": [
        {"name": "L'Antica Pizzeria da Michele", "cuisine": "Pizza", "rating": 4.6, "price": "$", "address": "Via Cesare Sersale 1"},
        {"name": "Tandem Ragù", "cuisine": "Napoletana", "rating": 4.5, "price": "$", "address": "Via Giovanni Paladino 51"},
    ],
}

DEFAULT_RESTAURANTS = [
    {"name": "Trattoria del Centro", "cuisine": "Italiana", "rating": 4.3, "price": "$$", "address": "Piazza Centrale 5"},
    {"name": "Pizzeria Bella Napoli", "cuisine": "Pizza", "rating": 4.5, "price": "$", "address": "Via Roma 12"},
]


async def execute(user_id: str, city: str = None, geohash4: str = None, query: str = "", intent: str = "") -> dict:
    """Find restaurants. MOCK implementation."""
    restaurants = MOCK_RESTAURANTS.get(city, DEFAULT_RESTAURANTS) if city else DEFAULT_RESTAURANTS

    # Filter by cuisine type if mentioned
    if query:
        q_lower = query.lower()
        cuisine_kw = ["pizza", "pesce", "sushi", "cinese", "giappones", "roman", "napolitan"]
        for kw in cuisine_kw:
            if kw in q_lower:
                filtered = [r for r in restaurants if kw in r["cuisine"].lower() or kw in r["name"].lower()]
                if filtered:
                    restaurants = filtered
                break

    return {"restaurants": restaurants, "city": city or "zona", "source": "mock"}
