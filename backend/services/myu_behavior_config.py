"""MYU behavior configuration defaults and migration helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from database import db

MYU_BEHAVIOR_VERSION = 2

DEFAULT_RESPONSE_RULES = (
    "Rispondi in modo umano, chiaro e utile. "
    "Adatta profondita e lunghezza alla persona e al contesto: puoi essere sintetico o espansivo quando serve. "
    "Quando utile, usa esempi pratici, mini-storie e confronto fra opzioni. "
    "Mantieni tono empatico, positivo e mai aggressivo."
)

LEGACY_RESPONSE_RULE_TOKENS = (
    "breve",
    "brevi",
    "conciso",
    "concis",
    "sintetic",
    "poche frasi",
    "max 2",
    "max 3",
    "solo obiettivo",
    "puramente orientate all'obiettivo",
    "poco espansive",
    "no esempi",
    "senza esempi",
    "non espansivo",
    "non espansive",
    "risposte corte",
    "risposte molto corte",
)

DEFAULT_FOLLOW_RULES = (
    "Sii empatico, umano, positivo e curioso verso la persona. "
    "Adatta lo stile all'utente: diretto->concreto, curioso->spiegazioni ampie, motivazionale->energia equilibrata, "
    "stanco/stressato->tono leggero e supportivo. "
    "Puoi usare ironia leggera e rispettosa se coerente col contesto. "
    "Proponi follow-up, check-in e azioni utili in modo gentile e non invadente. "
    "Usa le fonti Knowledge MYU come base quando presenti."
)

DEFAULT_AVOID_RULES = (
    "Evita aggressivita, pressione, colpevolizzazione e manipolazione. "
    "Non promettere risultati economici certi. "
    "Non essere freddo o puramente meccanico. "
    "Non ripetere risposte minimaliste quando l'utente richiede approfondimento."
)


def default_behavior_config() -> dict:
    return {
        "assistant_name": "MYU",
        "voice_tone": "umano_empatico_positivo",
        "formality_level": "adattiva",
        "response_style": "conversazionale_adattivo",
        "average_length": "adattiva_al_contesto",
        "commercial_approach": "consulenziale_empatico",
        "educational_approach": "storytelling_pratico",
        "empathy": "alta",
        "emoji_enabled": True,
        "follow_rules": DEFAULT_FOLLOW_RULES,
        "avoid_rules": DEFAULT_AVOID_RULES,
        "human_mode_enabled": True,
        "adaptive_style_enabled": True,
        "curiosity_level": "alta",
        "humor_style": "leggera_irriverenza",
        "surprise_insights_enabled": True,
        "proactive_enabled": True,
        "proactive_followups_enabled": True,
        "proactive_checkins_enabled": True,
        "proactivity_boundaries": "gentile_non_invadente",
        "behavior_version": MYU_BEHAVIOR_VERSION,
    }


def default_myu_config() -> dict:
    return {
        "personality": "umano_empatico_proattivo",
        "default_language": "it",
        "response_max_sentences": 8,
        "allow_action_suggestions": True,
        "behavior_version": MYU_BEHAVIOR_VERSION,
        "base_behavior": default_behavior_config(),
    }


def default_coaching_engine() -> dict:
    return {
        "enabled": True,
        "coaching_prompt": "",
        "objective_notes": "",
        "escalation_policy": "balanced",
        "auto_suggestions": True,
    }


def merge_myu_config(raw: dict | None = None) -> dict:
    source = raw or {}
    merged = {
        **default_myu_config(),
        **source,
    }
    merged["base_behavior"] = {
        **default_behavior_config(),
        **(source.get("base_behavior") or {}),
    }

    if not (merged["base_behavior"].get("assistant_name") or "").strip():
        merged["base_behavior"]["assistant_name"] = "MYU"
    if not (merged["base_behavior"].get("voice_tone") or "").strip():
        merged["base_behavior"]["voice_tone"] = "umano_empatico_positivo"
    if not (merged.get("personality") or "").strip():
        merged["personality"] = "umano_empatico_proattivo"

    try:
        response_cap = int(merged.get("response_max_sentences") or 8)
    except (TypeError, ValueError):
        response_cap = 8
    merged["response_max_sentences"] = min(max(response_cap, 3), 16)
    merged["behavior_version"] = max(
        int(merged.get("behavior_version") or 0),
        int(merged["base_behavior"].get("behavior_version") or 0),
    )
    merged["base_behavior"]["emoji_enabled"] = bool(merged["base_behavior"].get("emoji_enabled", True))
    return merged


def _looks_minimal_legacy(myu_config: dict[str, Any]) -> bool:
    base = myu_config.get("base_behavior") or {}
    version = int(myu_config.get("behavior_version") or base.get("behavior_version") or 0)
    if int(myu_config.get("response_max_sentences") or 0) <= 3:
        return True
    if not bool(base.get("human_mode_enabled", False)):
        return True
    if not bool(base.get("adaptive_style_enabled", False)):
        return True
    if not bool(base.get("proactive_enabled", False)):
        return True
    if version < MYU_BEHAVIOR_VERSION:
        return True

    if (base.get("response_style") or "").strip().lower() in {"breve", "bilanciato", "conciso"}:
        return True
    if (base.get("average_length") or "").strip().lower() in {"breve", "media"}:
        return True
    return False


def _looks_legacy_response_rules(raw: Any) -> bool:
    rules = " ".join(str(raw or "").strip().lower().split())
    if not rules:
        return True
    if rules in {"regole test", "test", "todo", "bozza"}:
        return True
    return any(token in rules for token in LEGACY_RESPONSE_RULE_TOKENS)


def _upgrade_behavior_values(myu_config: dict[str, Any]) -> dict[str, Any]:
    merged = merge_myu_config(myu_config)
    base = merged["base_behavior"]

    if (base.get("voice_tone") or "").strip().lower() in {"amichevole", "bilanciato", ""}:
        base["voice_tone"] = "umano_empatico_positivo"
    if (base.get("formality_level") or "").strip().lower() in {"bilanciato", ""}:
        base["formality_level"] = "adattiva"
    if (base.get("response_style") or "").strip().lower() in {"bilanciato", "conciso", "breve", ""}:
        base["response_style"] = "conversazionale_adattivo"
    if (base.get("average_length") or "").strip().lower() in {"media", "breve", ""}:
        base["average_length"] = "adattiva_al_contesto"
    if (base.get("commercial_approach") or "").strip().lower() in {"soft", "standard", ""}:
        base["commercial_approach"] = "consulenziale_empatico"
    if (base.get("educational_approach") or "").strip().lower() in {"pratico", "standard", ""}:
        base["educational_approach"] = "storytelling_pratico"
    if (base.get("empathy") or "").strip().lower() in {"alta", ""}:
        base["empathy"] = "alta"

    base["human_mode_enabled"] = True
    base["adaptive_style_enabled"] = True
    base["curiosity_level"] = base.get("curiosity_level") or "alta"
    base["humor_style"] = base.get("humor_style") or "leggera_irriverenza"
    base["surprise_insights_enabled"] = True
    base["proactive_enabled"] = True
    base["proactive_followups_enabled"] = True
    base["proactive_checkins_enabled"] = True
    base["proactivity_boundaries"] = base.get("proactivity_boundaries") or "gentile_non_invadente"
    if not (base.get("follow_rules") or "").strip():
        base["follow_rules"] = DEFAULT_FOLLOW_RULES
    if not (base.get("avoid_rules") or "").strip():
        base["avoid_rules"] = DEFAULT_AVOID_RULES
    base["emoji_enabled"] = bool(base.get("emoji_enabled", True))
    base["behavior_version"] = MYU_BEHAVIOR_VERSION

    personality = (merged.get("personality") or "").strip().lower()
    if not personality or personality in {"amichevole", "assistente", "minimalista", "expert"}:
        merged["personality"] = "umano_empatico_proattivo"
    merged["response_max_sentences"] = max(int(merged.get("response_max_sentences") or 8), 8)
    merged["behavior_version"] = MYU_BEHAVIOR_VERSION
    return merged


async def ensure_myu_behavior_config_persisted(
    config_doc: dict | None = None,
    *,
    updated_by: str = "system",
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    current = config_doc
    if current is None:
        current = await db.app_config.find_one({"key": "myu_training"}, {"_id": 0})

    if not current:
        payload = {
            "key": "myu_training",
            "training_prompt": "",
            "response_rules": DEFAULT_RESPONSE_RULES,
            "coaching_engine": default_coaching_engine(),
            "myu_config": default_myu_config(),
            "created_at": now,
            "updated_at": now,
            "updated_by": updated_by,
        }
        await db.app_config.update_one(
            {"key": "myu_training"},
            {"$set": payload, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        return payload

    myu_config = current.get("myu_config") or {}
    should_upgrade = _looks_minimal_legacy(myu_config)
    merged_config = _upgrade_behavior_values(myu_config) if should_upgrade else merge_myu_config(myu_config)

    response_rules = (current.get("response_rules") or "").strip()
    if _looks_legacy_response_rules(response_rules):
        response_rules = DEFAULT_RESPONSE_RULES
        should_upgrade = True

    if should_upgrade:
        await db.app_config.update_one(
            {"key": "myu_training"},
            {
                "$set": {
                    "key": "myu_training",
                    "training_prompt": current.get("training_prompt", ""),
                    "response_rules": response_rules,
                    "coaching_engine": {
                        **default_coaching_engine(),
                        **(current.get("coaching_engine") or {}),
                    },
                    "myu_config": merged_config,
                    "updated_at": now,
                    "updated_by": updated_by,
                },
                "$setOnInsert": {"created_at": current.get("created_at") or now},
            },
            upsert=True,
        )
        current = {
            **current,
            "response_rules": response_rules,
            "myu_config": merged_config,
            "updated_at": now,
            "updated_by": updated_by,
        }
    else:
        current = {
            **current,
            "response_rules": response_rules,
            "myu_config": merged_config,
        }
    return current
