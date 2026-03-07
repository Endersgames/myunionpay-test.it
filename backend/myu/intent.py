"""MYU Intent Classification Layer - Keyword-based, no LLM needed."""
import re
import logging

logger = logging.getLogger("myu.intent")

# Domain/Intent/Subintent classification with keyword patterns
INTENT_MAP = [
    # WALLET
    {"domain": "wallet", "intent": "check_balance", "subintent": None,
     "patterns": [r"\bsaldo\b", r"\bbalance\b", r"quanti? up\b", r"\bwallet\b", r"quanto ho"],
     "needs_tool": "wallet", "needs_llm": True, "is_location_based": False},
    {"domain": "wallet", "intent": "send_money", "subintent": None,
     "patterns": [r"\binvia\b.*\bup\b", r"\bmanda\b.*\bup\b", r"\btrasferis", r"\bpaga\b"],
     "needs_tool": None, "needs_llm": True, "is_location_based": False},
    {"domain": "wallet", "intent": "transaction_history", "subintent": None,
     "patterns": [r"\btransazion", r"\bstorico\b", r"\bmoviment", r"\bultim[ei]\b.*\bpagament"],
     "needs_tool": "wallet", "needs_llm": True, "is_location_based": False},

    # MARKETPLACE / MERCHANTS
    {"domain": "marketplace", "intent": "discover_merchants", "subintent": None,
     "patterns": [r"\bnegozi", r"\bmerchant", r"\battivit", r"\bshop", r"\bcommerci"],
     "needs_tool": "merchant_finder", "needs_llm": True, "is_location_based": True},
    {"domain": "marketplace", "intent": "merchant_nearby", "subintent": None,
     "patterns": [r"\bvicino\b", r"\bqui intorno\b", r"\bnella zona\b", r"\bnearby\b", r"\bdintorni\b"],
     "needs_tool": "merchant_finder", "needs_llm": True, "is_location_based": True},
    {"domain": "marketplace", "intent": "gift_card", "subintent": None,
     "patterns": [r"\bgift\s*card", r"\bcarta\s*regalo", r"\bbuono\b"],
     "needs_tool": None, "needs_llm": True, "is_location_based": False},

    # LOCATION-BASED EXTERNAL
    {"domain": "marketplace", "intent": "cinema_lookup", "subintent": None,
     "patterns": [r"\bcinema\b", r"\bfilm\b", r"\borari.*film", r"\bprogrammazione\b", r"\bspettacol"],
     "needs_tool": "cinema_finder", "needs_llm": True, "is_location_based": True},
    {"domain": "marketplace", "intent": "restaurant_lookup", "subintent": None,
     "patterns": [r"\bristorant", r"\bdove\s+mangi", r"\bpizzer", r"\btrattori", r"\bcena\b", r"\bpranzo\b", r"\bbar\b.*\bvicin"],
     "needs_tool": "restaurant_finder", "needs_llm": True, "is_location_based": True},
    {"domain": "marketplace", "intent": "event_lookup", "subintent": None,
     "patterns": [r"\bevent", r"\bconcert", r"\bmostr", r"\bfier", r"\bfestival"],
     "needs_tool": "cinema_finder", "needs_llm": True, "is_location_based": True},
    {"domain": "general", "intent": "weather_lookup", "subintent": None,
     "patterns": [r"\bmeteo\b", r"\btempo\b.*\boggi", r"\bpiov", r"\btemperatura\b", r"\bche tempo\b", r"\bweather\b"],
     "needs_tool": "weather", "needs_llm": True, "is_location_based": True},

    # COMPANION / TASKS
    {"domain": "companion", "intent": "task_creation", "subintent": None,
     "patterns": [r"\bricordami\b", r"\bcrea.*task", r"\baggiungi.*task", r"\bpromemoria\b", r"\bnota\b.*\bcrea", r"\bto.?do\b"],
     "needs_tool": "tasks", "needs_llm": True, "is_location_based": False},
    {"domain": "companion", "intent": "task_list", "subintent": None,
     "patterns": [r"\bmiei task\b", r"\btask attiv", r"\bcosa devo\b", r"\bimpegni\b", r"\bda fare\b"],
     "needs_tool": "tasks", "needs_llm": True, "is_location_based": False},
    {"domain": "companion", "intent": "greeting", "subintent": None,
     "patterns": [r"^ciao\b", r"^hey\b", r"^buongiorn", r"^buonaser", r"^salve\b", r"^ehi\b", r"^hello\b"],
     "needs_tool": None, "needs_llm": False, "is_location_based": False},

    # SUPPORT
    {"domain": "support", "intent": "qr_help", "subintent": None,
     "patterns": [r"\bqr\b.*\bcome\b", r"\bscansion", r"\bcome.*pag"],
     "needs_tool": None, "needs_llm": True, "is_location_based": False},
    {"domain": "support", "intent": "profile_help", "subintent": None,
     "patterns": [r"\bprofilo\b", r"\bimpostazion", r"\baccount\b"],
     "needs_tool": None, "needs_llm": True, "is_location_based": False},
    {"domain": "support", "intent": "notification_help", "subintent": None,
     "patterns": [r"\bnotific", r"\bavvis"],
     "needs_tool": "notifications", "needs_llm": True, "is_location_based": False},

    # GROWTH
    {"domain": "growth", "intent": "referral_info", "subintent": None,
     "patterns": [r"\breferral\b", r"\binvita\b", r"\bcodice\b.*\bamico", r"\bpresenta\b"],
     "needs_tool": None, "needs_llm": True, "is_location_based": False},
]

# Static responses (no LLM needed)
STATIC_RESPONSES = {
    ("companion", "greeting"): [
        "Ciao! Come posso aiutarti oggi?",
        "Ehi! Dimmi tutto, sono qui.",
        "Ciao! Che mi racconti?",
    ],
}


def classify_intent(text: str) -> dict:
    """Classify user message into domain/intent/subintent using keyword matching.
    Returns: {domain, intent, subintent, needs_tool, needs_llm, is_location_based, static_response, confidence}
    """
    text_lower = text.lower().strip()

    for entry in INTENT_MAP:
        for pattern in entry["patterns"]:
            if re.search(pattern, text_lower):
                key = (entry["domain"], entry["intent"])
                static = None
                if key in STATIC_RESPONSES:
                    import random
                    static = random.choice(STATIC_RESPONSES[key])

                return {
                    "domain": entry["domain"],
                    "intent": entry["intent"],
                    "subintent": entry.get("subintent"),
                    "needs_tool": entry["needs_tool"],
                    "needs_llm": entry["needs_llm"],
                    "is_location_based": entry["is_location_based"],
                    "static_response": static,
                    "confidence": 0.85,
                }

    # Fallback: general intent, needs LLM
    return {
        "domain": "general",
        "intent": "fallback",
        "subintent": None,
        "needs_tool": None,
        "needs_llm": True,
        "is_location_based": False,
        "static_response": None,
        "confidence": 0.3,
    }
