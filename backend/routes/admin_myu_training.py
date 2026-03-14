import asyncio
import logging
import os
import re
import uuid
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from database import db
from services.document_text_extractor import extract_training_document_text
from services.myu_knowledge_base import DEFAULT_KB_CHUNKING_SERVICE
from services.myu_knowledge_retrieval import (
    invalidate_knowledge_retrieval_cache,
    is_chunk_text_quality_ok,
)
from services.myu_behavior_config import (
    default_behavior_config,
    default_coaching_engine,
    default_myu_config,
    ensure_myu_behavior_config_persisted,
    merge_myu_config,
)
from services.auth import get_current_user

router = APIRouter(prefix="/admin/myu-training", tags=["admin-myu-training"])
logger = logging.getLogger("routes.admin_myu_training")

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "myu-knowledge"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".txt", ".md", ".pdf", ".csv", ".json", ".doc", ".docx"}
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024

TRAINING_DOC_UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "myu-training-documents"
TRAINING_DOC_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

TRAINING_DOCUMENT_TYPES = [
    {
        "key": "valori_aziendali",
        "label": "Valori Aziendali",
        "description": "Mission, valori e cultura aziendale.",
    },
    {
        "key": "piano_compensi",
        "label": "Piano Compensi",
        "description": "Regole compensi, premi e commissioni.",
    },
    {
        "key": "company_profile",
        "label": "Company Profile",
        "description": "Presentazione ufficiale dell'azienda.",
    },
    {
        "key": "ruoli_union_holidays",
        "label": "Ruoli Union Holidays",
        "description": "Ruoli, responsabilita e perimetro operativo.",
    },
    {
        "key": "vademecum_otp",
        "label": "Vademecum OTP",
        "description": "Procedure OTP e linee guida operative.",
    },
    {
        "key": "firma_digitale",
        "label": "Firma Digitale",
        "description": "Flussi e conformita per firma digitale.",
    },
    {
        "key": "offerte_energia",
        "label": "Offerte Energia",
        "description": "Catalogo offerte energia aggiornato.",
    },
]
TRAINING_DOCUMENT_TYPE_MAP = {item["key"]: item for item in TRAINING_DOCUMENT_TYPES}
TRAINING_DOCUMENT_ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/x-pdf",
    "application/acrobat",
    "applications/vnd.pdf",
    "text/pdf",
    "text/x-pdf",
}
TRAINING_DOCUMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024
_KB_INDEXES_READY = False
_TRAINING_INDEXES_READY = False
EXPECTED_KNOWLEDGE_CATEGORIES = [
    "company_values",
    "compensation_plan",
    "company_profile",
    "union_roles",
    "otp_guide",
    "digital_signature",
    "energy_offers",
]

RESOURCE_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{8,80}$")


async def require_admin(user=Depends(get_current_user)):
    is_admin = user.get("is_admin")
    if not (is_admin is True or is_admin == 1):
        raise HTTPException(status_code=403, detail="Accesso riservato agli admin")
    if user.get("is_blocked") is True or user.get("is_deleted") is True:
        raise HTTPException(status_code=403, detail="Account admin non abilitato")
    return user


class TrainingConfigUpdate(BaseModel):
    training_prompt: str = Field(default="", max_length=20000)
    response_rules: str = Field(default="", max_length=20000)
    personality: str = Field(default="umano_empatico_proattivo", max_length=100)
    default_language: str = Field(default="it", max_length=10)
    response_max_sentences: int = Field(default=8, ge=3, le=16)
    allow_action_suggestions: bool = True
    assistant_name: str = Field(default="MYU", max_length=120)
    voice_tone: str = Field(default="umano_empatico_positivo", max_length=80)
    formality_level: str = Field(default="adattiva", max_length=80)
    response_style: str = Field(default="conversazionale_adattivo", max_length=80)
    average_length: str = Field(default="adattiva_al_contesto", max_length=80)
    commercial_approach: str = Field(default="consulenziale_empatico", max_length=80)
    educational_approach: str = Field(default="storytelling_pratico", max_length=80)
    empathy: str = Field(default="alta", max_length=80)
    emoji_enabled: bool = True
    follow_rules: str = Field(default="", max_length=12000)
    avoid_rules: str = Field(default="", max_length=12000)
    human_mode_enabled: bool = True
    adaptive_style_enabled: bool = True
    curiosity_level: str = Field(default="alta", max_length=80)
    humor_style: str = Field(default="leggera_irriverenza", max_length=80)
    surprise_insights_enabled: bool = True
    proactive_enabled: bool = True
    proactive_followups_enabled: bool = True
    proactive_checkins_enabled: bool = True
    proactivity_boundaries: str = Field(default="gentile_non_invadente", max_length=120)


class CoachingEngineUpdate(BaseModel):
    enabled: bool = True
    coaching_prompt: str = Field(default="", max_length=20000)
    objective_notes: str = Field(default="", max_length=20000)
    escalation_policy: str = Field(default="balanced", max_length=100)
    auto_suggestions: bool = True


class TrainingDocumentUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=180)
    notes: Optional[str] = Field(default=None, max_length=2000)


class TrainingDocumentStatusUpdate(BaseModel):
    is_active: bool


def _default_coaching_engine() -> dict:
    return default_coaching_engine()


def _default_myu_config() -> dict:
    return default_myu_config()


def _default_behavior_config() -> dict:
    return default_behavior_config()


def _merge_myu_config(raw: Optional[dict] = None) -> dict:
    return merge_myu_config(raw or {})


def _sanitize_name(filename: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in filename)
    return safe.strip("._") or "knowledge_file"


def _parse_bool_flag(raw: Optional[str], default: bool = False) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on", "si"}


def _validate_resource_id(resource_id: str, *, field_name: str) -> str:
    value = (resource_id or "").strip()
    if not RESOURCE_ID_RE.match(value):
        raise HTTPException(status_code=400, detail=f"{field_name} non valido")
    return value


def _resolve_safe_file_path(base_dir: Path, stored_name: str) -> Path:
    normalized_name = os.path.basename((stored_name or "").strip())
    if not normalized_name:
        raise HTTPException(status_code=404, detail="File non disponibile")
    base = base_dir.resolve()
    candidate = (base / normalized_name).resolve()
    try:
        candidate.relative_to(base)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Percorso file non valido") from exc
    return candidate


def _normalize_training_document_key(raw: str) -> str:
    normalized = (raw or "").strip().lower().replace("-", "_").replace(" ", "_")
    if normalized not in TRAINING_DOCUMENT_TYPE_MAP:
        allowed = ", ".join(item["key"] for item in TRAINING_DOCUMENT_TYPES)
        raise HTTPException(status_code=400, detail=f"Categoria documento non valida. Usa: {allowed}")
    return normalized


def _validate_training_pdf_file(
    *,
    original_name: str,
    content_type: Optional[str],
    content: bytes,
) -> tuple[str, int]:
    extension = Path(original_name).suffix.lower()
    if extension != ".pdf":
        raise HTTPException(status_code=400, detail="Formato non supportato. Carica solo file PDF")

    if content_type and content_type.lower() not in TRAINING_DOCUMENT_ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="MIME type non valido. Carica un PDF valido")

    file_size = len(content)
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Il file e vuoto")
    if file_size > TRAINING_DOCUMENT_MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File troppo grande (max 20MB)")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Il contenuto caricato non risulta un PDF valido")

    return extension, file_size


def _serialize_training_document(record: dict) -> dict:
    data = {**record}
    data.pop("_id", None)
    document_meta = TRAINING_DOCUMENT_TYPE_MAP.get(data.get("document_key"), {})
    data["document_label"] = document_meta.get("label") or data.get("document_key", "")
    data["document_description"] = document_meta.get("description") or ""
    doc_id = str(data.get("id") or "").strip()
    if doc_id:
        data["download_url"] = f"/api/admin/myu-training/training-documents/{doc_id}/download"
    data["file_url"] = ""
    return data


async def _ensure_training_indexes() -> None:
    global _TRAINING_INDEXES_READY
    if _TRAINING_INDEXES_READY:
        return

    await db.myu_training_documents.create_index("id", unique=True)
    await db.myu_training_documents.create_index(
        [("document_key", 1), ("is_deleted", 1), ("version_number", -1)]
    )
    await db.myu_training_documents.create_index(
        [("document_key", 1), ("is_deleted", 1), ("is_active", 1)]
    )
    await db.myu_training_documents.create_index(
        [("document_key", 1), ("is_deleted", 1), ("checksum_sha256", 1)]
    )
    await db.myu_training_documents.create_index("uploaded_at")
    await db.myu_training_documents.create_index("updated_at")

    await db.myu_training_document_logs.create_index("id", unique=True)
    await db.myu_training_document_logs.create_index([("action", 1), ("created_at", -1)])
    await db.myu_training_document_logs.create_index([("performed_by", 1), ("created_at", -1)])

    await db.myu_knowledge_files.create_index("id", unique=True)
    await db.myu_knowledge_files.create_index("uploaded_at")
    await db.myu_knowledge_files.create_index("uploaded_by")

    _TRAINING_INDEXES_READY = True


async def _get_training_documents_workspace() -> dict:
    await _ensure_training_indexes()
    rows = (
        await db.myu_training_documents.find(
            {"is_deleted": {"$ne": True}},
            {"_id": 0},
        )
        .sort([("document_key", 1), ("version_number", -1), ("uploaded_at", -1)])
        .to_list(1000)
    )

    grouped: dict[str, list[dict]] = {}
    for row in rows:
        doc = _serialize_training_document(row)
        grouped.setdefault(doc.get("document_key", ""), []).append(doc)

    categories = []
    total_versions = 0
    for item in TRAINING_DOCUMENT_TYPES:
        versions = grouped.get(item["key"], [])
        active_document = next((doc for doc in versions if doc.get("is_active")), None)
        total_versions += len(versions)
        categories.append(
            {
                "key": item["key"],
                "label": item["label"],
                "description": item.get("description", ""),
                "total_versions": len(versions),
                "has_active_document": bool(active_document),
                "active_document": active_document,
                "versions": versions,
            }
        )

    latest_upload_at = max((row.get("uploaded_at") or "" for row in rows), default="")

    return {
        "categories": categories,
        "expected_categories": len(TRAINING_DOCUMENT_TYPES),
        "categories_with_active_document": sum(1 for item in categories if item["has_active_document"]),
        "total_versions": total_versions,
        "updated_at": latest_upload_at or None,
    }


async def _build_knowledge_readiness() -> dict:
    await _ensure_kb_indexes()
    active_docs = await db.myu_knowledge_documents.find(
        {"is_active": True},
        {"_id": 0, "source_document_id": 1, "source_document_key": 1, "category": 1, "chunk_count": 1},
    ).to_list(500)
    active_chunks_rows = await db.myu_knowledge_chunks.find(
        {"is_active": True},
        {"_id": 0, "source_document_id": 1, "category": 1, "text": 1},
    ).to_list(8000)

    usable_chunks_rows = [row for row in active_chunks_rows if is_chunk_text_quality_ok(row.get("text", ""))]
    usable_source_ids = {
        str(row.get("source_document_id") or "")
        for row in usable_chunks_rows
        if row.get("source_document_id")
    }
    usable_docs = [
        row for row in active_docs if str(row.get("source_document_id") or "") in usable_source_ids
    ]

    active_categories = sorted({str(row.get("category") or "") for row in active_docs if row.get("category")})
    usable_categories = sorted({str(row.get("category") or "") for row in usable_docs if row.get("category")})
    missing_categories = [cat for cat in EXPECTED_KNOWLEDGE_CATEGORIES if cat not in usable_categories]
    return {
        "active_documents": len(active_docs),
        "active_chunks": len(active_chunks_rows),
        "usable_documents": len(usable_docs),
        "usable_chunks": len(usable_chunks_rows),
        "active_categories": active_categories,
        "usable_categories": usable_categories,
        "missing_categories": missing_categories,
        "is_ready": bool(usable_chunks_rows),
        "has_compensation_plan": "compensation_plan" in usable_categories,
    }


async def _get_training_config() -> dict:
    config = await ensure_myu_behavior_config_persisted(updated_by="system")

    coaching_engine = config.get("coaching_engine") or {}
    myu_config = _merge_myu_config(config.get("myu_config") or {})
    return {
        "training_prompt": config.get("training_prompt", ""),
        "response_rules": config.get("response_rules", ""),
        "coaching_engine": {
            **_default_coaching_engine(),
            **coaching_engine,
        },
        "myu_config": myu_config,
        "base_behavior": myu_config.get("base_behavior", _default_behavior_config()),
        "updated_at": config.get("updated_at"),
        "updated_by": config.get("updated_by"),
    }


async def _log_document_event(
    *,
    action: str,
    admin_id: str,
    file_id: str = "",
    file_name: str = "",
    detail: str = "",
) -> dict:
    await _ensure_training_indexes()
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "id": str(uuid.uuid4()),
        "action": action,
        "file_id": file_id,
        "file_name": file_name,
        "detail": detail,
        "performed_by": admin_id,
        "created_at": now,
    }
    await db.myu_training_document_logs.insert_one(payload)
    payload.pop("_id", None)
    return payload


async def _ensure_kb_indexes() -> None:
    global _KB_INDEXES_READY
    if _KB_INDEXES_READY:
        return

    await db.myu_knowledge_documents.create_index("id", unique=True)
    await db.myu_knowledge_documents.create_index("source_document_id", unique=True)
    await db.myu_knowledge_documents.create_index([("source_document_key", 1), ("is_active", 1)])
    await db.myu_knowledge_documents.create_index([("category", 1), ("is_active", 1)])

    await db.myu_knowledge_chunks.create_index("id", unique=True)
    await db.myu_knowledge_chunks.create_index("source_document_id")
    await db.myu_knowledge_chunks.create_index([("knowledge_document_id", 1), ("chunk_order", 1)], unique=True)
    await db.myu_knowledge_chunks.create_index([("source_document_key", 1), ("is_active", 1), ("chunk_order", 1)])
    await db.myu_knowledge_chunks.create_index([("category", 1), ("is_active", 1)])
    await db.myu_knowledge_chunks.create_index([("is_active", 1), ("keyword_terms", 1), ("category", 1)])

    _KB_INDEXES_READY = True


async def _set_kb_active_by_document_key(document_key: str, *, is_active: bool, now_iso: str) -> None:
    if not document_key:
        return

    await db.myu_knowledge_documents.update_many(
        {"source_document_key": document_key},
        {"$set": {"is_active": is_active, "updated_at": now_iso}},
    )
    await db.myu_knowledge_chunks.update_many(
        {"source_document_key": document_key},
        {"$set": {"is_active": is_active, "updated_at": now_iso}},
    )
    invalidate_knowledge_retrieval_cache()


async def _set_kb_active_by_source_document(source_document_id: str, *, is_active: bool, now_iso: str) -> None:
    if not source_document_id:
        return

    await db.myu_knowledge_documents.update_many(
        {"source_document_id": source_document_id},
        {"$set": {"is_active": is_active, "updated_at": now_iso}},
    )
    await db.myu_knowledge_chunks.update_many(
        {"source_document_id": source_document_id},
        {"$set": {"is_active": is_active, "updated_at": now_iso}},
    )
    invalidate_knowledge_retrieval_cache()


async def _delete_kb_for_source_document(source_document_id: str) -> None:
    if not source_document_id:
        return
    await db.myu_knowledge_chunks.delete_many({"source_document_id": source_document_id})
    await db.myu_knowledge_documents.delete_many({"source_document_id": source_document_id})
    invalidate_knowledge_retrieval_cache()


async def _restore_previous_active_version_if_needed(
    *,
    failed_document_id: str,
    admin_id: str,
    original_name: str,
) -> str:
    failed_doc = await db.myu_training_documents.find_one(
        {"id": failed_document_id, "is_deleted": {"$ne": True}},
        {"_id": 0},
    )
    if not failed_doc or not failed_doc.get("is_active"):
        return ""

    document_key = failed_doc.get("document_key", "")
    if not document_key:
        return ""

    fallback = await db.myu_training_documents.find_one(
        {
            "document_key": document_key,
            "id": {"$ne": failed_document_id},
            "is_deleted": {"$ne": True},
            "extraction_status": "success",
            "kb_sync_status": "synced",
        },
        {"_id": 0},
        sort=[("version_number", -1), ("uploaded_at", -1)],
    )
    if not fallback:
        return ""

    now = datetime.now(timezone.utc).isoformat()
    fallback_id = fallback.get("id", "")
    if not fallback_id:
        return ""

    await db.myu_training_documents.update_one(
        {"id": failed_document_id},
        {"$set": {"is_active": False, "updated_at": now, "updated_by": admin_id}},
    )
    await db.myu_training_documents.update_one(
        {"id": fallback_id},
        {"$set": {"is_active": True, "updated_at": now, "updated_by": admin_id}},
    )
    await _set_kb_active_by_document_key(document_key, is_active=False, now_iso=now)
    await _set_kb_active_by_source_document(fallback_id, is_active=True, now_iso=now)
    await _log_document_event(
        action="training_document_fallback_reactivated",
        admin_id=admin_id,
        file_id=failed_document_id,
        file_name=original_name,
        detail=f"Riattivata versione precedente {fallback.get('version_tag', '')}",
    )
    return fallback_id


async def _sync_training_document_knowledge_base(*, source_document: dict, extracted_text: str) -> dict:
    source_document_id = source_document.get("id", "")
    if not source_document_id:
        raise ValueError("source_document.id mancante")

    await _ensure_kb_indexes()
    existing = await db.myu_knowledge_documents.find_one(
        {"source_document_id": source_document_id},
        {"_id": 0, "id": 1, "created_at": 1},
    )

    synced_at = datetime.now(timezone.utc).isoformat()
    knowledge_document, chunks = DEFAULT_KB_CHUNKING_SERVICE.chunk_document(
        source_document=source_document,
        extracted_text=extracted_text,
        now_iso=synced_at,
    )

    document_payload = knowledge_document.model_dump()
    chunk_payloads = [chunk.model_dump() for chunk in chunks]

    if existing and existing.get("id"):
        persisted_document_id = existing["id"]
        document_payload["id"] = persisted_document_id
        if existing.get("created_at"):
            document_payload["created_at"] = existing["created_at"]
        for chunk_payload in chunk_payloads:
            chunk_payload["knowledge_document_id"] = persisted_document_id

    await db.myu_knowledge_documents.replace_one(
        {"source_document_id": source_document_id},
        document_payload,
        upsert=True,
    )
    await db.myu_knowledge_chunks.delete_many({"source_document_id": source_document_id})
    if chunk_payloads:
        await db.myu_knowledge_chunks.insert_many(chunk_payloads)

    if source_document.get("is_active"):
        await _set_kb_active_by_document_key(
            source_document.get("document_key", ""),
            is_active=False,
            now_iso=synced_at,
        )
        await _set_kb_active_by_source_document(
            source_document_id,
            is_active=True,
            now_iso=synced_at,
        )
    else:
        await _set_kb_active_by_source_document(
            source_document_id,
            is_active=False,
            now_iso=synced_at,
        )

    invalidate_knowledge_retrieval_cache()
    return {
        "knowledge_document_id": document_payload.get("id", ""),
        "chunk_count": len(chunk_payloads),
        "category": document_payload.get("category", ""),
    }


async def _run_training_document_extraction(
    *,
    document_id: str,
    original_name: str,
    file_path: str,
    admin_id: str,
):
    processing_at = datetime.now(timezone.utc).isoformat()
    await db.myu_training_documents.update_one(
        {"id": document_id},
        {
            "$set": {
                "extraction_status": "processing",
                "extraction_error": "",
                "kb_sync_status": "pending",
                "kb_sync_error": "",
                "kb_synced_at": None,
                "kb_document_id": "",
                "knowledge_chunk_count": 0,
                "updated_at": processing_at,
                "updated_by": admin_id,
            }
        },
    )

    try:
        target_path = Path(file_path)
        if not target_path.exists():
            raise FileNotFoundError("File PDF non trovato sul server")

        outcome = await asyncio.to_thread(extract_training_document_text, target_path)
        completed_at = datetime.now(timezone.utc).isoformat()

        if outcome.status == "success":
            await db.myu_training_documents.update_one(
                {"id": document_id},
                {
                    "$set": {
                        "extracted_text": outcome.extracted_text,
                        "extraction_status": "success",
                        "extraction_error": "",
                        "extraction_backend": outcome.backend,
                        "extracted_at": completed_at,
                        "kb_sync_status": "processing",
                        "kb_sync_error": "",
                        "kb_synced_at": None,
                        "kb_document_id": "",
                        "knowledge_chunk_count": 0,
                        "updated_at": completed_at,
                        "updated_by": admin_id,
                    }
                },
            )
            await _log_document_event(
                action="training_document_extracted",
                admin_id=admin_id,
                file_id=document_id,
                file_name=original_name,
                detail=f"Estrazione testo completata ({outcome.backend or 'default'})",
            )

            source_document = await db.myu_training_documents.find_one(
                {"id": document_id, "is_deleted": {"$ne": True}},
                {"_id": 0},
            )
            if not source_document:
                raise ValueError("Documento sorgente non trovato per sync knowledge base")

            try:
                kb_result = await _sync_training_document_knowledge_base(
                    source_document=source_document,
                    extracted_text=outcome.extracted_text,
                )
                kb_synced_at = datetime.now(timezone.utc).isoformat()
                await db.myu_training_documents.update_one(
                    {"id": document_id},
                    {
                        "$set": {
                            "kb_sync_status": "synced",
                            "kb_sync_error": "",
                            "kb_synced_at": kb_synced_at,
                            "kb_document_id": kb_result.get("knowledge_document_id", ""),
                            "knowledge_chunk_count": kb_result.get("chunk_count", 0),
                            "updated_at": kb_synced_at,
                            "updated_by": admin_id,
                        }
                    },
                )
                await _log_document_event(
                    action="training_kb_synced",
                    admin_id=admin_id,
                    file_id=document_id,
                    file_name=original_name,
                    detail=(
                        f"Knowledge base aggiornata: {kb_result.get('chunk_count', 0)} chunk "
                        f"[{kb_result.get('category', 'n/a')}]"
                    ),
                )
            except Exception as sync_exc:
                logger.exception(
                    "MYU KB sync failed for document_id=%s file=%s: %s",
                    document_id,
                    original_name,
                    sync_exc,
                )
                kb_failed_at = datetime.now(timezone.utc).isoformat()
                await _delete_kb_for_source_document(document_id)
                await db.myu_training_documents.update_one(
                    {"id": document_id},
                    {
                        "$set": {
                            "kb_sync_status": "failed",
                            "kb_sync_error": f"Sync KB fallito: {sync_exc}"[:900],
                            "kb_synced_at": None,
                            "kb_document_id": "",
                            "knowledge_chunk_count": 0,
                            "updated_at": kb_failed_at,
                            "updated_by": admin_id,
                        }
                    },
                )
                await _log_document_event(
                    action="training_kb_sync_failed",
                    admin_id=admin_id,
                    file_id=document_id,
                    file_name=original_name,
                    detail=f"Sync KB fallito: {sync_exc}"[:240],
                )
            return

        await _delete_kb_for_source_document(document_id)
        await db.myu_training_documents.update_one(
            {"id": document_id},
            {
                "$set": {
                    "extracted_text": "",
                    "extraction_status": "failed",
                    "extraction_error": (outcome.error or "")[:900],
                    "extraction_backend": outcome.backend or "",
                    "extracted_at": completed_at,
                    "kb_sync_status": "skipped",
                    "kb_sync_error": "Estrazione testo fallita, sync knowledge base non eseguito",
                    "kb_synced_at": None,
                    "kb_document_id": "",
                    "knowledge_chunk_count": 0,
                    "updated_at": completed_at,
                    "updated_by": admin_id,
                }
            },
        )
        await _log_document_event(
            action="training_document_extraction_failed",
            admin_id=admin_id,
            file_id=document_id,
            file_name=original_name,
            detail=(outcome.error or "Errore estrazione non specificato")[:240],
        )
        try:
            fallback_id = await _restore_previous_active_version_if_needed(
                failed_document_id=document_id,
                admin_id=admin_id,
                original_name=original_name,
            )
            if fallback_id:
                logger.warning(
                    "Extraction failed for %s. Reactivated fallback document=%s",
                    document_id,
                    fallback_id,
                )
        except Exception as fallback_exc:
            logger.warning(
                "Fallback reactivation failed after extraction error for %s: %s",
                document_id,
                fallback_exc,
            )
    except Exception as exc:
        logger.exception(
            "Training document extraction failed for document_id=%s file=%s: %s",
            document_id,
            original_name,
            exc,
        )
        await _delete_kb_for_source_document(document_id)
        failed_at = datetime.now(timezone.utc).isoformat()
        await db.myu_training_documents.update_one(
            {"id": document_id},
            {
                "$set": {
                    "extracted_text": "",
                    "extraction_status": "failed",
                    "extraction_error": f"Errore runtime estrazione: {exc}"[:900],
                    "extracted_at": failed_at,
                    "kb_sync_status": "skipped",
                    "kb_sync_error": "Estrazione interrotta, sync knowledge base non eseguito",
                    "kb_synced_at": None,
                    "kb_document_id": "",
                    "knowledge_chunk_count": 0,
                    "updated_at": failed_at,
                    "updated_by": admin_id,
                }
            },
        )
        await _log_document_event(
            action="training_document_extraction_failed",
            admin_id=admin_id,
            file_id=document_id,
            file_name=original_name,
            detail=f"Errore runtime estrazione: {exc}"[:240],
        )
        try:
            fallback_id = await _restore_previous_active_version_if_needed(
                failed_document_id=document_id,
                admin_id=admin_id,
                original_name=original_name,
            )
            if fallback_id:
                logger.warning(
                    "Runtime extraction error for %s. Reactivated fallback document=%s",
                    document_id,
                    fallback_id,
                )
        except Exception as fallback_exc:
            logger.warning(
                "Fallback reactivation failed after runtime extraction error for %s: %s",
                document_id,
                fallback_exc,
            )


def _read_text_preview(file_path: Path, extension: str, max_chars: int) -> tuple[str, bool, bool]:
    text_extensions = {".txt", ".md", ".csv", ".json"}
    if extension not in text_extensions:
        return (
            "Anteprima disponibile solo per file testuali (.txt, .md, .csv, .json).",
            False,
            False,
        )

    with file_path.open("r", encoding="utf-8", errors="ignore") as handle:
        content = handle.read(max_chars + 1)
    if len(content) <= max_chars:
        return content, True, False
    return content[:max_chars], True, True


async def _hydrate_document_logs(limit: int = 100) -> list[dict]:
    await _ensure_training_indexes()
    rows = await db.myu_training_document_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    actor_ids = {row.get("performed_by") for row in rows if row.get("performed_by")}
    actor_map = {}
    if actor_ids:
        users = await db.users.find(
            {"id": {"$in": list(actor_ids)}},
            {"_id": 0, "id": 1, "full_name": 1, "email": 1},
        ).to_list(len(actor_ids))
        actor_map = {u["id"]: {"full_name": u.get("full_name", ""), "email": u.get("email", "")} for u in users}

    for row in rows:
        actor = actor_map.get(row.get("performed_by"), {})
        row["performed_by_name"] = actor.get("full_name") or "Admin"
        row["performed_by_email"] = actor.get("email") or ""
    return rows


async def _get_chat_stats() -> dict:
    now = datetime.now(timezone.utc)
    since_24h = (now - timedelta(hours=24)).isoformat()
    since_7d = (now - timedelta(days=7)).isoformat()

    total_messages = await db.myu_conversations.count_documents({})
    user_messages = await db.myu_conversations.count_documents({"role": "user"})
    assistant_messages = await db.myu_conversations.count_documents({"role": "assistant"})
    messages_last_24h = await db.myu_conversations.count_documents({"created_at": {"$gte": since_24h}})
    messages_last_7d = await db.myu_conversations.count_documents({"created_at": {"$gte": since_7d}})

    all_sessions = await db.myu_conversations.distinct("session_id")
    sessions_last_7d = await db.myu_conversations.distinct("session_id", {"created_at": {"$gte": since_7d}})
    active_users_last_7d = await db.myu_conversations.distinct("user_id", {"created_at": {"$gte": since_7d}})

    total_sessions = len(all_sessions)
    avg_messages_per_session = round(total_messages / total_sessions, 2) if total_sessions else 0

    total_tasks = await db.myu_tasks.count_documents({})
    active_tasks = await db.myu_tasks.count_documents({"status": "active"})
    completed_tasks = await db.myu_tasks.count_documents({"status": "completed"})

    requests_last_7d = await db.request_cost_logs.count_documents({"created_at": {"$gte": since_7d}})
    fallbacks_last_7d = await db.request_cost_logs.count_documents(
        {"created_at": {"$gte": since_7d}, "fallback_triggered": True}
    )
    fallback_rate = round((fallbacks_last_7d / requests_last_7d) * 100, 2) if requests_last_7d else 0

    avg_cost_rows = await db.request_cost_logs.aggregate(
        [
            {"$match": {"created_at": {"$gte": since_7d}}},
            {"$group": {"_id": None, "avg_cost": {"$avg": "$total_estimated_cost"}}},
        ]
    ).to_list(1)
    avg_estimated_cost_last_7d = 0.0
    if avg_cost_rows:
        avg_estimated_cost_last_7d = round(float(avg_cost_rows[0].get("avg_cost") or 0.0), 8)

    top_intent_rows = await db.myu_intent_logs.aggregate(
        [
            {"$match": {"created_at": {"$gte": since_7d}}},
            {"$group": {"_id": {"domain": "$domain", "intent": "$intent"}, "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5},
        ]
    ).to_list(5)
    top_intents = [
        {
            "domain": (row.get("_id") or {}).get("domain") or "unknown",
            "intent": (row.get("_id") or {}).get("intent") or "unknown",
            "count": row.get("count", 0),
        }
        for row in top_intent_rows
    ]

    return {
        "generated_at": now.isoformat(),
        "total_messages": total_messages,
        "user_messages": user_messages,
        "assistant_messages": assistant_messages,
        "messages_last_24h": messages_last_24h,
        "messages_last_7d": messages_last_7d,
        "total_sessions": total_sessions,
        "sessions_last_7d": len(sessions_last_7d),
        "active_users_last_7d": len(active_users_last_7d),
        "avg_messages_per_session": avg_messages_per_session,
        "total_tasks": total_tasks,
        "active_tasks": active_tasks,
        "completed_tasks": completed_tasks,
        "requests_last_7d": requests_last_7d,
        "fallback_rate_last_7d": fallback_rate,
        "avg_estimated_cost_last_7d": avg_estimated_cost_last_7d,
        "top_intents_last_7d": top_intents,
    }


@router.get("/overview")
async def get_overview(admin=Depends(require_admin)):
    await _ensure_training_indexes()
    config = await _get_training_config()
    knowledge_files = await db.myu_knowledge_files.find({}, {"_id": 0}).sort("uploaded_at", -1).to_list(200)
    chat_stats = await _get_chat_stats()
    training_documents = await _get_training_documents_workspace()
    knowledge_readiness = await _build_knowledge_readiness()

    return {
        "config": config,
        "coaching_engine": config.get("coaching_engine", _default_coaching_engine()),
        "myu_config": config.get("myu_config", _default_myu_config()),
        "knowledge_files": knowledge_files,
        "chat_stats": chat_stats,
        "training_documents": training_documents,
        "knowledge_readiness": knowledge_readiness,
    }


@router.get("/workspace")
async def get_workspace(admin=Depends(require_admin)):
    await _ensure_training_indexes()
    config = await _get_training_config()
    knowledge_files = await db.myu_knowledge_files.find({}, {"_id": 0}).sort("uploaded_at", -1).to_list(200)
    chat_stats = await _get_chat_stats()
    document_logs = await _hydrate_document_logs(limit=150)
    training_documents = await _get_training_documents_workspace()
    knowledge_readiness = await _build_knowledge_readiness()

    return {
        "config": config,
        "coaching_engine": config.get("coaching_engine", _default_coaching_engine()),
        "myu_config": config.get("myu_config", _default_myu_config()),
        "knowledge_files": knowledge_files,
        "chat_stats": chat_stats,
        "document_logs": document_logs,
        "training_documents": training_documents,
        "knowledge_readiness": knowledge_readiness,
    }


@router.put("/config")
async def update_training_config(data: TrainingConfigUpdate, admin=Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    current = await db.app_config.find_one({"key": "myu_training"}, {"_id": 0}) or {}
    coaching_engine = {
        **_default_coaching_engine(),
        **(current.get("coaching_engine") or {}),
    }
    current_myu_config = _merge_myu_config(current.get("myu_config") or {})
    current_behavior = current_myu_config.get("base_behavior", _default_behavior_config())
    next_behavior = {
        **current_behavior,
        "assistant_name": data.assistant_name.strip()
        or current_behavior.get("assistant_name")
        or "MYU",
        "voice_tone": data.voice_tone.strip()
        or current_behavior.get("voice_tone")
        or "umano_empatico_positivo",
        "formality_level": data.formality_level.strip()
        or current_behavior.get("formality_level")
        or "adattiva",
        "response_style": data.response_style.strip()
        or current_behavior.get("response_style")
        or "conversazionale_adattivo",
        "average_length": data.average_length.strip()
        or current_behavior.get("average_length")
        or "adattiva_al_contesto",
        "commercial_approach": data.commercial_approach.strip()
        or current_behavior.get("commercial_approach")
        or "consulenziale_empatico",
        "educational_approach": data.educational_approach.strip()
        or current_behavior.get("educational_approach")
        or "storytelling_pratico",
        "empathy": data.empathy.strip() or current_behavior.get("empathy") or "alta",
        "emoji_enabled": bool(data.emoji_enabled),
        "follow_rules": (
            data.follow_rules.strip()
            or current_behavior.get("follow_rules")
            or _default_behavior_config().get("follow_rules", "")
        ),
        "avoid_rules": (
            data.avoid_rules.strip()
            or current_behavior.get("avoid_rules")
            or _default_behavior_config().get("avoid_rules", "")
        ),
        "human_mode_enabled": bool(data.human_mode_enabled),
        "adaptive_style_enabled": bool(data.adaptive_style_enabled),
        "curiosity_level": data.curiosity_level.strip() or current_behavior.get("curiosity_level") or "alta",
        "humor_style": data.humor_style.strip() or current_behavior.get("humor_style") or "leggera_irriverenza",
        "surprise_insights_enabled": bool(data.surprise_insights_enabled),
        "proactive_enabled": bool(data.proactive_enabled),
        "proactive_followups_enabled": bool(data.proactive_followups_enabled),
        "proactive_checkins_enabled": bool(data.proactive_checkins_enabled),
        "proactivity_boundaries": (
            data.proactivity_boundaries.strip()
            or current_behavior.get("proactivity_boundaries")
            or "gentile_non_invadente"
        ),
        "behavior_version": 2,
    }
    await db.app_config.update_one(
        {"key": "myu_training"},
        {
            "$set": {
                "key": "myu_training",
                "training_prompt": data.training_prompt.strip(),
                "response_rules": data.response_rules.strip(),
                "coaching_engine": coaching_engine,
                "myu_config": {
                    "personality": data.personality.strip() or "umano_empatico_proattivo",
                    "default_language": data.default_language.strip() or "it",
                    "response_max_sentences": data.response_max_sentences,
                    "allow_action_suggestions": data.allow_action_suggestions,
                    "behavior_version": 2,
                    "base_behavior": next_behavior,
                },
                "updated_at": now,
                "updated_by": admin["id"],
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    await _log_document_event(
        action="config_updated",
        admin_id=admin["id"],
        detail="Aggiornata configurazione MYU",
    )
    config = await _get_training_config()
    return {"success": True, "config": config}


@router.put("/coaching-engine")
async def update_coaching_engine(data: CoachingEngineUpdate, admin=Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    current = await db.app_config.find_one({"key": "myu_training"}, {"_id": 0}) or {}
    myu_config = _merge_myu_config(current.get("myu_config") or {})
    await db.app_config.update_one(
        {"key": "myu_training"},
        {
            "$set": {
                "key": "myu_training",
                "training_prompt": current.get("training_prompt", ""),
                "response_rules": current.get("response_rules", ""),
                "myu_config": myu_config,
                "coaching_engine": {
                    "enabled": data.enabled,
                    "coaching_prompt": data.coaching_prompt.strip(),
                    "objective_notes": data.objective_notes.strip(),
                    "escalation_policy": data.escalation_policy.strip() or "balanced",
                    "auto_suggestions": data.auto_suggestions,
                },
                "updated_at": now,
                "updated_by": admin["id"],
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    await _log_document_event(
        action="coaching_updated",
        admin_id=admin["id"],
        detail="Aggiornata configurazione Coaching Engine",
    )
    config = await _get_training_config()
    return {"success": True, "coaching_engine": config.get("coaching_engine", _default_coaching_engine())}


@router.get("/training-documents")
async def get_training_documents(admin=Depends(require_admin)):
    await _ensure_training_indexes()
    return await _get_training_documents_workspace()


@router.get("/training-documents/{document_id}")
async def get_training_document(document_id: str, admin=Depends(require_admin)):
    await _ensure_training_indexes()
    document_id = _validate_resource_id(document_id, field_name="document_id")
    record = await db.myu_training_documents.find_one(
        {"id": document_id, "is_deleted": {"$ne": True}},
        {"_id": 0},
    )
    if not record:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    return {"document": _serialize_training_document(record)}


@router.post("/training-documents")
async def upload_training_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_key: str = Form(...),
    display_name: str = Form(default=""),
    notes: str = Form(default=""),
    set_active: str = Form(default="true"),
    admin=Depends(require_admin),
):
    await _ensure_training_indexes()
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nome file non valido")

    normalized_key = _normalize_training_document_key(document_key)
    original_name = os.path.basename(file.filename)
    content = await file.read()
    await file.close()
    extension, file_size = _validate_training_pdf_file(
        original_name=original_name,
        content_type=file.content_type,
        content=content,
    )
    checksum_sha256 = hashlib.sha256(content).hexdigest()

    duplicate = await db.myu_training_documents.find_one(
        {
            "document_key": normalized_key,
            "checksum_sha256": checksum_sha256,
            "is_deleted": {"$ne": True},
        },
        {"_id": 0, "id": 1, "version_tag": 1, "display_name": 1},
    )
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Documento gia presente per questa categoria "
                f"({duplicate.get('version_tag', '')})"
            ).strip(),
        )

    latest = await db.myu_training_documents.find_one(
        {"document_key": normalized_key},
        {"_id": 0, "version_number": 1},
        sort=[("version_number", -1)],
    )
    next_version = int((latest or {}).get("version_number") or 0) + 1

    file_id = str(uuid.uuid4())
    reference_name = display_name.strip() or Path(original_name).stem
    stem = _sanitize_name(reference_name)[:80]
    stored_name = f"{normalized_key}_v{next_version}_{file_id}_{stem}{extension}"
    file_path = TRAINING_DOC_UPLOAD_DIR / stored_name

    try:
        with file_path.open("wb") as handle:
            handle.write(content)
    except Exception as exc:
        logger.exception("Failed writing training document file %s: %s", stored_name, exc)
        raise HTTPException(status_code=500, detail="Errore salvataggio file sul server") from exc

    now = datetime.now(timezone.utc).isoformat()
    should_activate = _parse_bool_flag(set_active, default=True)

    payload = {
        "id": file_id,
        "document_key": normalized_key,
        "display_name": reference_name.strip() or TRAINING_DOCUMENT_TYPE_MAP[normalized_key]["label"],
        "notes": notes.strip(),
        "original_name": original_name,
        "stored_name": stored_name,
        "mime_type": "application/pdf",
        "size_bytes": file_size,
        "checksum_sha256": checksum_sha256,
        "file_url": "",
        "version_number": next_version,
        "version_tag": f"v{next_version}",
        "is_active": should_activate,
        "is_deleted": False,
        "extracted_text": "",
        "extraction_status": "pending",
        "extraction_error": "",
        "extracted_at": None,
        "extraction_backend": "",
        "kb_sync_status": "pending",
        "kb_sync_error": "",
        "kb_synced_at": None,
        "kb_document_id": "",
        "knowledge_chunk_count": 0,
        "uploaded_by": admin["id"],
        "uploaded_at": now,
        "updated_by": admin["id"],
        "updated_at": now,
    }
    try:
        await db.myu_training_documents.insert_one(payload)
    except Exception as exc:
        logger.exception(
            "Failed inserting training document metadata document_id=%s file=%s: %s",
            file_id,
            original_name,
            exc,
        )
        try:
            if file_path.exists():
                file_path.unlink()
        except Exception:
            logger.warning("Failed rollback file delete for %s", str(file_path))
        raise HTTPException(status_code=500, detail="Errore persistenza metadata documento") from exc

    if should_activate:
        await db.myu_training_documents.update_many(
            {
                "document_key": normalized_key,
                "is_deleted": {"$ne": True},
                "id": {"$ne": file_id},
            },
            {"$set": {"is_active": False, "updated_at": now, "updated_by": admin["id"]}},
        )

    await _log_document_event(
        action="training_document_uploaded",
        admin_id=admin["id"],
        file_id=file_id,
        file_name=original_name,
        detail=f"Upload {TRAINING_DOCUMENT_TYPE_MAP[normalized_key]['label']} ({payload['version_tag']})",
    )
    background_tasks.add_task(
        _run_training_document_extraction,
        document_id=file_id,
        original_name=original_name,
        file_path=str(file_path),
        admin_id=admin["id"],
    )

    return {
        "success": True,
        "document": _serialize_training_document(payload),
    }


@router.get("/training-documents/{document_id}/download")
async def download_training_document(document_id: str, admin=Depends(require_admin)):
    await _ensure_training_indexes()
    document_id = _validate_resource_id(document_id, field_name="document_id")
    record = await db.myu_training_documents.find_one(
        {"id": document_id, "is_deleted": {"$ne": True}},
        {"_id": 0},
    )
    if not record:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    file_path = _resolve_safe_file_path(
        TRAINING_DOC_UPLOAD_DIR,
        record.get("stored_name", ""),
    )
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File non disponibile sul server")

    download_name = record.get("original_name") or record.get("display_name") or f"{document_id}.pdf"
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=os.path.basename(download_name),
    )


@router.put("/training-documents/{document_id}")
async def update_training_document(document_id: str, data: TrainingDocumentUpdate, admin=Depends(require_admin)):
    await _ensure_training_indexes()
    document_id = _validate_resource_id(document_id, field_name="document_id")
    record = await db.myu_training_documents.find_one(
        {"id": document_id, "is_deleted": {"$ne": True}},
        {"_id": 0},
    )
    if not record:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    update_fields = {}
    if data.display_name is not None:
        next_name = data.display_name.strip()
        if not next_name:
            raise HTTPException(status_code=400, detail="Nome documento non valido")
        update_fields["display_name"] = next_name
    if data.notes is not None:
        update_fields["notes"] = data.notes.strip()
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nessun campo aggiornabile ricevuto")

    now = datetime.now(timezone.utc).isoformat()
    update_fields["updated_at"] = now
    update_fields["updated_by"] = admin["id"]

    await db.myu_training_documents.update_one({"id": document_id}, {"$set": update_fields})
    if "display_name" in update_fields:
        await db.myu_knowledge_documents.update_many(
            {"source_document_id": document_id},
            {
                "$set": {
                    "source_display_name": update_fields["display_name"],
                    "updated_at": now,
                }
            },
        )
    updated = await db.myu_training_documents.find_one({"id": document_id, "is_deleted": {"$ne": True}}, {"_id": 0})

    await _log_document_event(
        action="training_document_updated",
        admin_id=admin["id"],
        file_id=document_id,
        file_name=(updated or {}).get("original_name", ""),
        detail=f"Aggiornati metadati documento {(updated or {}).get('version_tag', '')}",
    )

    return {
        "success": True,
        "document": _serialize_training_document(updated or {}),
    }


@router.patch("/training-documents/{document_id}/status")
async def set_training_document_status(
    document_id: str,
    data: TrainingDocumentStatusUpdate,
    admin=Depends(require_admin),
):
    await _ensure_training_indexes()
    document_id = _validate_resource_id(document_id, field_name="document_id")
    record = await db.myu_training_documents.find_one(
        {"id": document_id, "is_deleted": {"$ne": True}},
        {"_id": 0},
    )
    if not record:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    now = datetime.now(timezone.utc).isoformat()
    if data.is_active:
        await db.myu_training_documents.update_many(
            {"document_key": record["document_key"], "is_deleted": {"$ne": True}},
            {"$set": {"is_active": False, "updated_at": now, "updated_by": admin["id"]}},
        )
        await _set_kb_active_by_document_key(record["document_key"], is_active=False, now_iso=now)

    await db.myu_training_documents.update_one(
        {"id": document_id},
        {
            "$set": {
                "is_active": data.is_active,
                "updated_at": now,
                "updated_by": admin["id"],
            }
        },
    )
    await _set_kb_active_by_source_document(document_id, is_active=data.is_active, now_iso=now)
    updated = await db.myu_training_documents.find_one({"id": document_id, "is_deleted": {"$ne": True}}, {"_id": 0})

    status_label = "attivo" if data.is_active else "disattivo"
    await _log_document_event(
        action="training_document_status_updated",
        admin_id=admin["id"],
        file_id=document_id,
        file_name=(updated or {}).get("original_name", ""),
        detail=f"Impostato stato {status_label} per {(updated or {}).get('version_tag', '')}",
    )

    return {
        "success": True,
        "document": _serialize_training_document(updated or {}),
    }


@router.delete("/training-documents/{document_id}")
async def delete_training_document(document_id: str, admin=Depends(require_admin)):
    await _ensure_training_indexes()
    document_id = _validate_resource_id(document_id, field_name="document_id")
    record = await db.myu_training_documents.find_one(
        {"id": document_id, "is_deleted": {"$ne": True}},
        {"_id": 0},
    )
    if not record:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    try:
        file_path = _resolve_safe_file_path(TRAINING_DOC_UPLOAD_DIR, record.get("stored_name", ""))
        if file_path.exists():
            file_path.unlink()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Delete training file failed for document_id=%s: %s", document_id, exc)
        raise HTTPException(status_code=500, detail="Errore eliminazione file dal server") from exc

    now = datetime.now(timezone.utc).isoformat()
    await db.myu_training_documents.update_one(
        {"id": document_id},
        {
            "$set": {
                "is_deleted": True,
                "is_active": False,
                "deleted_at": now,
                "deleted_by": admin["id"],
                "updated_at": now,
                "updated_by": admin["id"],
            }
        },
    )
    await _delete_kb_for_source_document(document_id)

    reactivated_document = None
    if record.get("is_active"):
        candidate = await db.myu_training_documents.find_one(
            {
                "document_key": record["document_key"],
                "is_deleted": {"$ne": True},
            },
            {"_id": 0},
            sort=[("version_number", -1), ("uploaded_at", -1)],
        )
        if candidate:
            await db.myu_training_documents.update_many(
                {"document_key": record["document_key"], "is_deleted": {"$ne": True}},
                {"$set": {"is_active": False, "updated_at": now, "updated_by": admin["id"]}},
            )
            await db.myu_training_documents.update_one(
                {"id": candidate["id"]},
                {"$set": {"is_active": True, "updated_at": now, "updated_by": admin["id"]}},
            )
            reactivated_document = candidate["id"]
            await _set_kb_active_by_document_key(record["document_key"], is_active=False, now_iso=now)
            await _set_kb_active_by_source_document(reactivated_document, is_active=True, now_iso=now)

    extra_detail = f" · riattivato {reactivated_document}" if reactivated_document else ""
    await _log_document_event(
        action="training_document_deleted",
        admin_id=admin["id"],
        file_id=document_id,
        file_name=record.get("original_name", ""),
        detail=f"Eliminato documento {record.get('version_tag', '')}{extra_detail}",
    )
    return {
        "success": True,
        "reactivated_document_id": reactivated_document,
    }


@router.post("/files")
async def upload_knowledge_file(file: UploadFile = File(...), admin=Depends(require_admin)):
    await _ensure_training_indexes()
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nome file non valido")

    original_name = os.path.basename(file.filename)
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Formato non supportato. Usa: txt, md, pdf, csv, json, doc, docx",
        )

    content = await file.read()
    await file.close()
    file_size = len(content)
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Il file e vuoto")
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File troppo grande (max 15MB)")
    if extension == ".pdf" and not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Il PDF caricato non e valido")
    if extension in {".txt", ".md", ".csv", ".json"} and b"\x00" in content[:4096]:
        raise HTTPException(status_code=400, detail="Il file testuale contiene byte non validi")

    file_id = str(uuid.uuid4())
    stem = _sanitize_name(Path(original_name).stem)[:80]
    stored_name = f"{file_id}_{stem}{extension}"
    file_path = UPLOAD_DIR / stored_name

    try:
        with file_path.open("wb") as handle:
            handle.write(content)
    except Exception as exc:
        logger.exception("Failed writing knowledge file %s: %s", stored_name, exc)
        raise HTTPException(status_code=500, detail="Errore salvataggio file sul server") from exc

    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "id": file_id,
        "original_name": original_name,
        "stored_name": stored_name,
        "mime_type": file.content_type or "application/octet-stream",
        "size_bytes": file_size,
        "file_url": f"/api/uploads/myu-knowledge/{stored_name}",
        "uploaded_by": admin["id"],
        "uploaded_at": now,
    }
    try:
        await db.myu_knowledge_files.insert_one(payload)
    except Exception as exc:
        logger.exception("Failed inserting knowledge file metadata file_id=%s: %s", file_id, exc)
        try:
            if file_path.exists():
                file_path.unlink()
        except Exception:
            logger.warning("Failed rollback knowledge file delete for %s", str(file_path))
        raise HTTPException(status_code=500, detail="Errore persistenza metadata file") from exc
    payload.pop("_id", None)
    await _log_document_event(
        action="file_uploaded",
        admin_id=admin["id"],
        file_id=file_id,
        file_name=original_name,
        detail=f"Caricato file di conoscenza ({extension})",
    )

    return {"success": True, "file": payload}


@router.delete("/files/{file_id}")
async def delete_knowledge_file(file_id: str, admin=Depends(require_admin)):
    await _ensure_training_indexes()
    file_id = _validate_resource_id(file_id, field_name="file_id")
    record = await db.myu_knowledge_files.find_one({"id": file_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File non trovato")

    try:
        file_path = _resolve_safe_file_path(UPLOAD_DIR, record.get("stored_name", ""))
        if file_path.exists():
            file_path.unlink()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Delete knowledge file failed for file_id=%s: %s", file_id, exc)
        raise HTTPException(status_code=500, detail="Errore eliminazione file dal server") from exc

    await db.myu_knowledge_files.delete_one({"id": file_id})
    await _log_document_event(
        action="file_deleted",
        admin_id=admin["id"],
        file_id=file_id,
        file_name=record.get("original_name", ""),
        detail="Rimosso file di conoscenza",
    )
    return {"success": True}


@router.get("/knowledge/preview")
async def get_knowledge_preview(
    file_id: Optional[str] = Query(default=None),
    max_chars: int = Query(default=2500, ge=200, le=10000),
    admin=Depends(require_admin),
):
    await _ensure_training_indexes()
    if file_id:
        query = {"id": _validate_resource_id(file_id, field_name="file_id")}
        file_record = await db.myu_knowledge_files.find_one(query, {"_id": 0})
    else:
        file_record = await db.myu_knowledge_files.find_one(
            {},
            {"_id": 0},
            sort=[("uploaded_at", -1)],
        )
    if not file_record:
        raise HTTPException(status_code=404, detail="File non trovato")

    file_path = _resolve_safe_file_path(UPLOAD_DIR, file_record.get("stored_name", ""))
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File non disponibile sul server")

    extension = file_path.suffix.lower()
    try:
        preview_text, supported, truncated = _read_text_preview(file_path, extension, max_chars)
    except Exception as exc:
        logger.exception("Preview read failed for file_id=%s: %s", file_record.get("id", ""), exc)
        raise HTTPException(status_code=500, detail="Errore lettura anteprima file") from exc

    await _log_document_event(
        action="file_previewed",
        admin_id=admin["id"],
        file_id=file_record.get("id", ""),
        file_name=file_record.get("original_name", ""),
        detail=f"Anteprima richiesta (max_chars={max_chars})",
    )

    return {
        "file": file_record,
        "preview_text": preview_text,
        "supported": supported,
        "truncated": truncated,
        "max_chars": max_chars,
    }


@router.get("/document-logs")
async def get_document_logs(
    limit: int = Query(default=100, ge=10, le=500),
    action: str = Query(default=""),
    admin=Depends(require_admin),
):
    query = {}
    normalized_action = action.strip()
    if normalized_action:
        query["action"] = normalized_action

    rows = await db.myu_training_document_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    actor_ids = {row.get("performed_by") for row in rows if row.get("performed_by")}
    actor_map = {}
    if actor_ids:
        users = await db.users.find(
            {"id": {"$in": list(actor_ids)}},
            {"_id": 0, "id": 1, "full_name": 1, "email": 1},
        ).to_list(len(actor_ids))
        actor_map = {u["id"]: {"full_name": u.get("full_name", ""), "email": u.get("email", "")} for u in users}

    for row in rows:
        actor = actor_map.get(row.get("performed_by"), {})
        row["performed_by_name"] = actor.get("full_name") or "Admin"
        row["performed_by_email"] = actor.get("email") or ""

    return {
        "logs": rows,
        "total": len(rows),
    }
