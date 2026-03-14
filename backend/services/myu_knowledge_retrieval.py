"""MYU Knowledge Retrieval - retrieve relevant active training chunks for chat context."""
from __future__ import annotations

import copy
import logging
import os
import re
import string
import time
from collections import defaultdict
from typing import Any

from database import db
from myu.cost_control import cap_tokens


SUPPORTED_KNOWLEDGE_CATEGORIES = {
    "company_values",
    "compensation_plan",
    "company_profile",
    "union_roles",
    "otp_guide",
    "digital_signature",
    "energy_offers",
}

logger = logging.getLogger("services.myu_knowledge_retrieval")

DEFAULT_MAX_SCAN_DOCUMENTS = min(max(int(os.environ.get("MYU_RETRIEVAL_MAX_SCAN_DOCUMENTS", "220")), 20), 2500)
DEFAULT_MAX_SCAN_CHUNKS = min(max(int(os.environ.get("MYU_RETRIEVAL_MAX_SCAN_CHUNKS", "2200")), 50), 8000)
DEFAULT_MIN_SCORE = float(os.environ.get("MYU_RETRIEVAL_MIN_SCORE", "1.6"))
RETRIEVAL_CACHE_TTL_SECONDS = min(max(int(os.environ.get("MYU_RETRIEVAL_CACHE_TTL_SECONDS", "45")), 5), 300)
RETRIEVAL_CACHE_MAX_ITEMS = min(max(int(os.environ.get("MYU_RETRIEVAL_CACHE_MAX_ITEMS", "350")), 20), 2000)

_RETRIEVAL_INDEXES_READY = False
_RETRIEVAL_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}

INTENT_CATEGORY_HINTS = {
    "qr_help": ["otp_guide", "digital_signature"],
    "profile_help": ["company_profile"],
    "notification_help": ["company_profile"],
    "referral_info": ["compensation_plan", "company_profile"],
}

CATEGORY_KEYWORD_HINTS = {
    "company_values": [
        "valori aziendali",
        "valori",
        "mission",
        "vision",
        "cultura aziendale",
    ],
    "compensation_plan": [
        "piano compensi",
        "compensi",
        "commissioni",
        "provvigioni",
        "bonus",
    ],
    "company_profile": [
        "company profile",
        "profilo aziendale",
        "azienda",
        "chi siete",
        "presentazione azienda",
    ],
    "union_roles": [
        "ruoli union holidays",
        "union holidays",
        "ruoli",
        "responsabilita",
        "mansioni",
    ],
    "otp_guide": [
        "otp",
        "one time password",
        "codice otp",
        "verifica otp",
        "vademecum otp",
    ],
    "digital_signature": [
        "firma digitale",
        "firma elettronica",
        "firmare",
        "sign",
    ],
    "energy_offers": [
        "offerte energia",
        "offerta energia",
        "tariffe energia",
        "luce",
        "gas",
    ],
}

ITALIAN_STOPWORDS = {
    "a",
    "ad",
    "al",
    "alla",
    "allo",
    "ai",
    "agli",
    "all",
    "da",
    "dal",
    "dalla",
    "dello",
    "dei",
    "degli",
    "di",
    "e",
    "ed",
    "il",
    "la",
    "le",
    "lo",
    "i",
    "gli",
    "in",
    "nel",
    "nella",
    "nello",
    "nei",
    "nelle",
    "su",
    "sul",
    "sulla",
    "sulle",
    "per",
    "tra",
    "fra",
    "con",
    "come",
    "dove",
    "quando",
    "quale",
    "quali",
    "che",
    "chi",
    "cosa",
    "quanto",
    "quanti",
    "mi",
    "ti",
    "ci",
    "vi",
    "si",
    "sì",
    "un",
    "una",
    "uno",
    "del",
    "della",
    "delle",
    "ma",
    "o",
}


def _normalize_category(raw: str) -> str:
    normalized = (raw or "").strip().lower().replace("-", "_").replace(" ", "_")
    return normalized


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip()).lower()


def _tokenize(text: str) -> list[str]:
    if not text:
        return []
    tokens = re.findall(r"[a-zA-Z0-9_]{3,}", _normalize_text(text))
    return [token for token in tokens if token not in ITALIAN_STOPWORDS]


def _chunk_quality_metrics(value: str) -> dict[str, float]:
    total_len = max(1, len(value))
    tokens = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ0-9]{2,}", value)
    normalized_tokens = [token.lower() for token in tokens]
    unique_tokens = set(normalized_tokens)
    stopword_hits = sum(1 for token in normalized_tokens if token in ITALIAN_STOPWORDS)

    max_run = 1
    current_run = 1
    for idx in range(1, len(value)):
        if value[idx] == value[idx - 1]:
            current_run += 1
            if current_run > max_run:
                max_run = current_run
        else:
            current_run = 1

    punctuation_chars = set(string.punctuation) | {"€", "£", "°", "«", "»", "…", "–", "—", "’", "“", "”"}
    punctuation_ratio = sum(1 for ch in value if ch in punctuation_chars) / total_len
    control_ratio = sum(
        1 for ch in value if ord(ch) < 32 and ch not in "\n\r\t"
    ) / total_len
    non_ascii_ratio = sum(1 for ch in value if ord(ch) > 126) / total_len
    printable_ascii_ratio = sum(
        1 for ch in value if (32 <= ord(ch) <= 126) or ch in "\n\r\t"
    ) / total_len

    return {
        "whitespace_ratio": sum(1 for ch in value if ch.isspace()) / total_len,
        "alpha_ratio": sum(1 for ch in value if ch.isalpha()) / total_len,
        "token_count": float(len(tokens)),
        "unique_token_count": float(len(unique_tokens)),
        "stopword_ratio": stopword_hits / max(1, len(tokens)),
        "token_char_ratio": sum(len(token) for token in tokens) / total_len,
        "gid_marker_count": float(value.lower().count("/gid")),
        "max_run": float(max_run),
        "punctuation_ratio": punctuation_ratio,
        "control_ratio": control_ratio,
        "non_ascii_ratio": non_ascii_ratio,
        "printable_ascii_ratio": printable_ascii_ratio,
    }


def _is_chunk_text_quality_ok(text: str) -> bool:
    value = str(text or "")
    if len(value) < 40:
        return False

    metrics = _chunk_quality_metrics(value)
    if metrics["gid_marker_count"] > 2:
        return False
    if metrics["control_ratio"] > 0.03:
        return False
    if metrics["non_ascii_ratio"] > 0.36:
        return False
    if metrics["max_run"] > 26:
        return False

    standard_readable = (
        metrics["whitespace_ratio"] >= 0.04
        and metrics["alpha_ratio"] >= 0.18
        and metrics["token_count"] >= 10
        and metrics["unique_token_count"] >= 6
        and metrics["token_char_ratio"] >= 0.22
        and metrics["stopword_ratio"] >= 0.03
        and metrics["punctuation_ratio"] <= 0.62
    )
    if standard_readable:
        return True

    salvage_readable = (
        len(value) >= 120
        and metrics["printable_ascii_ratio"] >= 0.95
        and metrics["token_count"] >= 30
        and metrics["unique_token_count"] >= 12
        and metrics["stopword_ratio"] >= 0.06
    )
    if salvage_readable:
        return True

    return False


def is_chunk_text_quality_ok(text: str) -> bool:
    return _is_chunk_text_quality_ok(text)


def _unique_tokens(tokens: list[str], *, max_items: int = 14) -> list[str]:
    ordered = []
    seen = set()
    for token in tokens:
        cleaned = (token or "").strip().lower()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        ordered.append(cleaned)
        if len(ordered) >= max_items:
            break
    return ordered


def _build_cache_key(
    *,
    normalized_query: str,
    category_filter: list[str],
    max_chunks: int,
    min_score: float,
) -> str:
    categories = ",".join(sorted(category_filter))
    return f"{normalized_query}|{categories}|{max_chunks}|{min_score:.3f}"


def _cache_get(cache_key: str) -> dict[str, Any] | None:
    row = _RETRIEVAL_CACHE.get(cache_key)
    if not row:
        return None
    created_at, payload = row
    if (time.monotonic() - created_at) > RETRIEVAL_CACHE_TTL_SECONDS:
        _RETRIEVAL_CACHE.pop(cache_key, None)
        return None
    return copy.deepcopy(payload)


def _cache_set(cache_key: str, payload: dict[str, Any]) -> None:
    _RETRIEVAL_CACHE[cache_key] = (time.monotonic(), copy.deepcopy(payload))
    if len(_RETRIEVAL_CACHE) <= RETRIEVAL_CACHE_MAX_ITEMS:
        return
    oldest_key = min(_RETRIEVAL_CACHE.items(), key=lambda item: item[1][0])[0]
    _RETRIEVAL_CACHE.pop(oldest_key, None)


def invalidate_knowledge_retrieval_cache() -> None:
    _RETRIEVAL_CACHE.clear()


async def _ensure_retrieval_indexes() -> None:
    global _RETRIEVAL_INDEXES_READY
    if _RETRIEVAL_INDEXES_READY:
        return
    await db.myu_knowledge_documents.create_index([("is_active", 1), ("category", 1)])
    await db.myu_knowledge_documents.create_index([("is_active", 1), ("source_document_id", 1)])
    await db.myu_knowledge_chunks.create_index([("is_active", 1), ("source_document_id", 1), ("chunk_order", 1)])
    await db.myu_knowledge_chunks.create_index([("is_active", 1), ("category", 1), ("chunk_order", 1)])
    await db.myu_knowledge_chunks.create_index([("is_active", 1), ("keyword_terms", 1), ("category", 1)])
    _RETRIEVAL_INDEXES_READY = True


def _extract_explicit_category_filters(user_context: dict[str, Any]) -> list[str]:
    raw_categories = (
        user_context.get("category_filter")
        or user_context.get("categories")
        or user_context.get("knowledge_categories")
        or []
    )
    if isinstance(raw_categories, str):
        raw_categories = [raw_categories]

    resolved: list[str] = []
    for raw in raw_categories:
        normalized = _normalize_category(str(raw))
        if normalized in SUPPORTED_KNOWLEDGE_CATEGORIES:
            resolved.append(normalized)
    return sorted(set(resolved))


def _infer_categories_from_context(query: str, user_context: dict[str, Any]) -> list[str]:
    resolved: list[str] = []

    classification = user_context.get("classification") or {}
    intent = (classification.get("intent") or "").strip().lower()
    resolved.extend(INTENT_CATEGORY_HINTS.get(intent, []))

    query_lower = _normalize_text(query)
    for category, keywords in CATEGORY_KEYWORD_HINTS.items():
        if any(keyword in query_lower for keyword in keywords):
            resolved.append(category)

    return sorted(set(resolved))


def _resolve_category_filters(query: str, user_context: dict[str, Any]) -> tuple[list[str], bool]:
    explicit = _extract_explicit_category_filters(user_context)
    if explicit:
        return explicit, True
    return _infer_categories_from_context(query, user_context), False


def _score_chunk(
    *,
    query_tokens: list[str],
    query_text: str,
    chunk_text: str,
    chunk_title: str,
    keyword_terms: list[str] | None = None,
) -> float:
    if not chunk_text:
        return 0.0

    text_lower = chunk_text.lower()
    title_lower = (chunk_title or "").lower()
    token_set = set(query_tokens)
    if not token_set and not query_text:
        return 0.0

    token_hits = sum(1 for token in token_set if token in text_lower)
    title_hits = sum(1 for token in token_set if token in title_lower)
    keyword_hits = 0
    if keyword_terms:
        keyword_set = {str(term).strip().lower() for term in keyword_terms if str(term).strip()}
        keyword_hits = sum(1 for token in token_set if token in keyword_set)
    phrase_bonus = 2.8 if query_text and query_text in text_lower else 0.0
    coverage_bonus = (token_hits / max(1, len(token_set))) if token_set else 0.0

    return (
        (token_hits * 2.0)
        + (title_hits * 1.25)
        + (keyword_hits * 1.8)
        + phrase_bonus
        + coverage_bonus
    )


def _seed_tokens_for_categories(categories: list[str]) -> set[str]:
    seeds: set[str] = set()
    for category in categories:
        for hint in CATEGORY_KEYWORD_HINTS.get(category, []):
            for token in _tokenize(hint):
                seeds.add(token)
    return seeds


def _fallback_category_chunk_score(
    *,
    row: dict[str, Any],
    category_filter: list[str],
    category_seed_tokens: set[str],
) -> float:
    category = str(row.get("category") or "")
    text_lower = (row.get("text") or "").lower()
    title_lower = (row.get("title") or "").lower()
    keyword_terms = {str(term).strip().lower() for term in (row.get("keyword_terms") or []) if str(term).strip()}

    score = 0.2
    if category in category_filter:
        score += 1.1

    hint_hits = sum(1 for token in category_seed_tokens if token and token in text_lower)
    score += min(2.0, hint_hits * 0.2)

    keyword_hits = sum(1 for token in category_seed_tokens if token in keyword_terms)
    score += min(1.2, keyword_hits * 0.25)

    if any(token in title_lower for token in category_seed_tokens):
        score += 0.35
    if re.search(r"\d", text_lower):
        score += 0.25

    text_len = len(text_lower)
    if 100 <= text_len <= 1800:
        score += 0.25
    return score


def _empty_retrieval_result(query: str, category_filter: list[str], reason: str) -> dict[str, Any]:
    return {
        "query": query,
        "found": False,
        "category_filter": category_filter,
        "chunks": [],
        "sources": [],
        "context_text": "",
        "fallback_reason": reason,
    }


async def get_relevant_knowledge_for_myu(
    query: str,
    user_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Retrieve most relevant active knowledge chunks for MYU.

    Returns a safe fallback payload with `found=False` when no usable chunk is available.
    """
    normalized_query = (query or "").strip()
    if not normalized_query:
        return _empty_retrieval_result("", [], "empty_query")

    await _ensure_retrieval_indexes()
    t0 = time.perf_counter()
    context = user_context or {}
    category_filter, explicit_filter = _resolve_category_filters(normalized_query, context)

    max_chunks = int(context.get("max_chunks") or 4)
    max_chunks = min(max(1, max_chunks), 8)
    max_scan_documents = int(context.get("max_scan_documents") or DEFAULT_MAX_SCAN_DOCUMENTS)
    max_scan_documents = min(max(20, max_scan_documents), 1200)
    max_scan_chunks = int(context.get("max_scan_chunks") or DEFAULT_MAX_SCAN_CHUNKS)
    max_scan_chunks = min(max(50, max_scan_chunks), 4000)
    min_score = float(context.get("min_score") or DEFAULT_MIN_SCORE)
    query_tokens = _unique_tokens(_tokenize(normalized_query), max_items=16)

    cache_key = _build_cache_key(
        normalized_query=normalized_query.lower(),
        category_filter=category_filter,
        max_chunks=max_chunks,
        min_score=min_score,
    )
    cached = _cache_get(cache_key)
    if cached:
        return cached

    doc_match: dict[str, Any] = {"is_active": True}
    if category_filter:
        doc_match["category"] = {"$in": category_filter}

    active_docs = await db.myu_knowledge_documents.find(
        doc_match,
        {
            "_id": 0,
            "id": 1,
            "source_document_id": 1,
            "source_document_key": 1,
            "source_display_name": 1,
            "source_version_tag": 1,
            "category": 1,
        },
    ).to_list(max_scan_documents)

    if not active_docs and category_filter and not explicit_filter:
        active_docs = await db.myu_knowledge_documents.find(
            {"is_active": True},
            {
                "_id": 0,
                "id": 1,
                "source_document_id": 1,
                "source_document_key": 1,
                "source_display_name": 1,
                "source_version_tag": 1,
                "category": 1,
            },
        ).to_list(max_scan_documents)
        category_filter = []

    if not active_docs:
        result = _empty_retrieval_result(normalized_query, category_filter, "no_active_documents")
        _cache_set(cache_key, result)
        return result

    doc_by_source_id = {doc.get("source_document_id", ""): doc for doc in active_docs if doc.get("source_document_id")}
    if not doc_by_source_id:
        result = _empty_retrieval_result(normalized_query, category_filter, "no_active_document_ids")
        _cache_set(cache_key, result)
        return result

    active_source_ids = list(doc_by_source_id.keys())
    chunk_projection = {
        "_id": 0,
        "id": 1,
        "knowledge_document_id": 1,
        "source_document_id": 1,
        "source_document_key": 1,
        "category": 1,
        "chunk_order": 1,
        "title": 1,
        "text": 1,
        "text_char_count": 1,
        "keyword_terms": 1,
    }
    chunk_base_match = {
        "is_active": True,
        "source_document_id": {"$in": active_source_ids},
    }

    chunk_rows: list[dict[str, Any]] = []
    if query_tokens:
        keyword_candidates = query_tokens[:12]
        regex_tokens = keyword_candidates[:5]
        regex_pattern = "|".join(re.escape(token) for token in regex_tokens)
        prefilter_match = {
            **chunk_base_match,
            "$or": [
                {"keyword_terms": {"$in": keyword_candidates}},
                {"title": {"$regex": regex_pattern, "$options": "i"}},
            ],
        }
        chunk_rows = await db.myu_knowledge_chunks.find(prefilter_match, chunk_projection).to_list(
            min(max_scan_chunks, max(max_chunks * 20, 600))
        )

    if not chunk_rows:
        chunk_rows = await db.myu_knowledge_chunks.find(
            chunk_base_match,
            chunk_projection,
        ).to_list(max_scan_chunks)

    if not chunk_rows:
        result = _empty_retrieval_result(normalized_query, category_filter, "no_active_chunks")
        _cache_set(cache_key, result)
        return result

    query_text = _normalize_text(normalized_query)

    def _collect_scored(rows: list[dict[str, Any]]) -> tuple[list[tuple[float, dict[str, Any]]], list[dict[str, Any]], int]:
        local_scored: list[tuple[float, dict[str, Any]]] = []
        local_usable: list[dict[str, Any]] = []
        local_skipped = 0
        for row in rows:
            chunk_text = row.get("text", "")
            if not _is_chunk_text_quality_ok(chunk_text):
                local_skipped += 1
                continue
            local_usable.append(row)
            score = _score_chunk(
                query_tokens=query_tokens,
                query_text=query_text,
                chunk_text=chunk_text,
                chunk_title=row.get("title", ""),
                keyword_terms=row.get("keyword_terms") or [],
            )
            if score >= min_score:
                local_scored.append((score, row))
        return local_scored, local_usable, local_skipped

    scored_chunks, usable_rows, skipped_low_quality = _collect_scored(chunk_rows)
    used_category_fallback = False

    if not usable_rows and query_tokens:
        full_scan_rows = await db.myu_knowledge_chunks.find(
            chunk_base_match,
            chunk_projection,
        ).to_list(max_scan_chunks)
        if full_scan_rows:
            chunk_rows = full_scan_rows
            rescored, reusable, skipped_retry = _collect_scored(full_scan_rows)
            scored_chunks = rescored
            usable_rows = reusable
            skipped_low_quality += skipped_retry

    if not scored_chunks:
        if category_filter:
            category_seed_tokens = _seed_tokens_for_categories(category_filter)
            for row in usable_rows:
                if str(row.get("category") or "") not in category_filter:
                    continue
                used_category_fallback = True
                fallback_score = _fallback_category_chunk_score(
                    row=row,
                    category_filter=category_filter,
                    category_seed_tokens=category_seed_tokens,
                )
                scored_chunks.append((fallback_score, row))

        if not scored_chunks:
            result = _empty_retrieval_result(normalized_query, category_filter, "no_relevant_chunks")
            _cache_set(cache_key, result)
            return result

    scored_chunks.sort(
        key=lambda item: (
            item[0],
            -int(item[1].get("chunk_order") or 0),
        ),
        reverse=True,
    )

    selected_chunks: list[dict[str, Any]] = []
    selected_chunk_ids: set[str] = set()
    for score, row in scored_chunks:
        chunk_id = row.get("id", "")
        if not chunk_id or chunk_id in selected_chunk_ids:
            continue

        doc_meta = doc_by_source_id.get(row.get("source_document_id", ""), {})
        chunk_text = (row.get("text") or "").strip()
        selected_chunks.append(
            {
                "id": chunk_id,
                "knowledge_document_id": row.get("knowledge_document_id", ""),
                "source_document_id": row.get("source_document_id", ""),
                "source_document_key": row.get("source_document_key", ""),
                "source_display_name": doc_meta.get("source_display_name") or row.get("source_document_key", ""),
                "source_version_tag": doc_meta.get("source_version_tag", ""),
                "category": row.get("category", ""),
                "chunk_order": int(row.get("chunk_order") or 0),
                "title": row.get("title") or "",
                "text": chunk_text,
                "text_preview": cap_tokens(chunk_text, 150),
                "score": round(score, 4),
            }
        )
        selected_chunk_ids.add(chunk_id)
        if len(selected_chunks) >= max_chunks:
            break

    if not selected_chunks:
        result = _empty_retrieval_result(normalized_query, category_filter, "empty_selection")
        _cache_set(cache_key, result)
        return result

    sources_by_id: dict[str, dict[str, Any]] = {}
    chunk_count_by_source = defaultdict(int)
    for chunk in selected_chunks:
        source_document_id = chunk.get("source_document_id", "")
        if not source_document_id:
            continue
        chunk_count_by_source[source_document_id] += 1
        if source_document_id not in sources_by_id:
            sources_by_id[source_document_id] = {
                "source_document_id": source_document_id,
                "source_document_key": chunk.get("source_document_key", ""),
                "source_display_name": chunk.get("source_display_name", ""),
                "source_version_tag": chunk.get("source_version_tag", ""),
                "category": chunk.get("category", ""),
                "chunk_count_used": 0,
            }

    sources = []
    for source_document_id, source in sources_by_id.items():
        source["chunk_count_used"] = chunk_count_by_source[source_document_id]
        sources.append(source)
    sources.sort(key=lambda item: item["chunk_count_used"], reverse=True)

    context_parts = []
    for index, chunk in enumerate(selected_chunks, start=1):
        source_label = chunk.get("source_display_name", "")
        source_version = chunk.get("source_version_tag", "")
        source_tag = f"{source_label} {source_version}".strip()
        title = chunk.get("title") or source_label or "Chunk"
        excerpt = cap_tokens(chunk.get("text", ""), 120)
        context_parts.append(
            (
                f"[KB{index}] categoria={chunk.get('category', '')} fonte={source_tag} "
                f"ordine={chunk.get('chunk_order', 0)} titolo={title}\n{excerpt}"
            ).strip()
        )

    result = {
        "query": normalized_query,
        "found": True,
        "category_filter": category_filter,
        "chunks": selected_chunks,
        "sources": sources,
        "context_text": "\n\n".join(context_parts),
        "fallback_reason": "category_seed_fallback" if used_category_fallback else "",
    }
    _cache_set(cache_key, result)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "MYU retrieval ok query='%s' categories=%s docs=%s chunks_scanned=%s low_quality_skipped=%s selected=%s elapsed_ms=%.2f",
        normalized_query[:120],
        ",".join(category_filter) if category_filter else "-",
        len(active_docs),
        len(chunk_rows),
        skipped_low_quality,
        len(selected_chunks),
        elapsed_ms,
    )
    return result


async def getRelevantKnowledgeForMYU(query: str, userContext: dict[str, Any] | None = None) -> dict[str, Any]:
    """Camel-case alias kept for external integration compatibility."""
    return await get_relevant_knowledge_for_myu(query=query, user_context=userContext)
