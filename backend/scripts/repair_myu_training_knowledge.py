"""Repair MYU Training extraction + knowledge sync for existing documents.

Usage:
  cd backend
  source venv/bin/activate
  python scripts/repair_myu_training_knowledge.py
  python scripts/repair_myu_training_knowledge.py --document-key valori_aziendali --document-key piano_compensi
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
import os
from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from database import db
from routes.admin_myu_training import (  # noqa: E402
    TRAINING_DOC_UPLOAD_DIR,
    _delete_kb_for_source_document,
    _run_training_document_extraction,
)
from services.myu_knowledge_retrieval import (  # noqa: E402
    invalidate_knowledge_retrieval_cache,
    is_chunk_text_quality_ok,
)


DEFAULT_LEGACY_UPLOAD_DIR = "/var/www/myuup-prod/backend/uploads/myu-training-documents"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Repair MYU training knowledge base data")
    parser.add_argument(
        "--document-key",
        action="append",
        default=[],
        help="Filter by document_key (repeatable)",
    )
    parser.add_argument(
        "--admin-id",
        default="maintenance-repair-training",
        help="Audit actor id used in metadata updates",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=200,
        help="Max documents to process",
    )
    return parser.parse_args()


def _resolve_file_path(stored_name: str, extra_dirs: list[Path]) -> Path | None:
    filename = Path(stored_name or "").name
    if not filename:
        return None
    for base in extra_dirs:
        candidate = (base / filename).resolve()
        if candidate.exists():
            return candidate
    return None


async def _mark_document_missing_file(document_id: str, admin_id: str, reason: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    await db.myu_training_documents.update_one(
        {"id": document_id},
        {
            "$set": {
                "extraction_status": "failed",
                "extraction_error": reason[:900],
                "extracted_text": "",
                "extracted_at": now,
                "kb_sync_status": "failed",
                "kb_sync_error": "Sync KB annullato: file sorgente non disponibile",
                "kb_synced_at": None,
                "kb_document_id": "",
                "knowledge_chunk_count": 0,
                "updated_at": now,
                "updated_by": admin_id,
            }
        },
    )
    await _delete_kb_for_source_document(document_id)


async def _cleanup_unusable_kb_documents(admin_id: str) -> dict[str, int]:
    docs = await db.myu_training_documents.find(
        {
            "is_deleted": {"$ne": True},
            "kb_sync_status": "synced",
        },
        {"_id": 0, "id": 1},
    ).to_list(2000)

    fixed = 0
    for row in docs:
        document_id = row.get("id", "")
        if not document_id:
            continue
        chunks = await db.myu_knowledge_chunks.find(
            {"source_document_id": document_id, "is_active": True},
            {"_id": 0, "text": 1},
        ).to_list(6000)
        usable = [chunk for chunk in chunks if is_chunk_text_quality_ok(chunk.get("text", ""))]
        if usable:
            continue

        await _delete_kb_for_source_document(document_id)
        now = datetime.now(timezone.utc).isoformat()
        await db.myu_training_documents.update_one(
            {"id": document_id},
            {
                "$set": {
                    "kb_sync_status": "failed",
                    "kb_sync_error": "Nessun chunk leggibile disponibile dopo validazione quality",
                    "kb_synced_at": None,
                    "kb_document_id": "",
                    "knowledge_chunk_count": 0,
                    "updated_at": now,
                    "updated_by": admin_id,
                }
            },
        )
        fixed += 1
    return {"kb_documents_marked_failed": fixed}


async def run() -> None:
    args = _parse_args()
    legacy_dir = Path(os.environ.get("MYU_TRAINING_LEGACY_UPLOAD_DIR", DEFAULT_LEGACY_UPLOAD_DIR)).resolve()
    search_dirs = [TRAINING_DOC_UPLOAD_DIR.resolve(), legacy_dir]

    query: dict = {"is_deleted": {"$ne": True}}
    if args.document_key:
        query["document_key"] = {"$in": [item.strip() for item in args.document_key if item.strip()]}

    rows = (
        await db.myu_training_documents.find(
            query,
            {"_id": 0},
        )
        .sort([("document_key", 1), ("version_number", -1), ("uploaded_at", -1)])
        .to_list(max(1, min(args.limit, 2000)))
    )

    processed = 0
    missing_file = 0
    for row in rows:
        document_id = row.get("id", "")
        stored_name = row.get("stored_name", "")
        original_name = row.get("original_name") or stored_name
        if not document_id or not stored_name:
            continue

        file_path = _resolve_file_path(stored_name, search_dirs)
        if not file_path:
            missing_file += 1
            await _mark_document_missing_file(
                document_id=document_id,
                admin_id=args.admin_id,
                reason=(
                    "File PDF non trovato nel server (ricerca eseguita su: "
                    + ", ".join(str(path) for path in search_dirs)
                    + ")"
                ),
            )
            continue

        await _run_training_document_extraction(
            document_id=document_id,
            original_name=original_name,
            file_path=str(file_path),
            admin_id=args.admin_id,
        )
        processed += 1

    cleanup_stats = await _cleanup_unusable_kb_documents(admin_id=args.admin_id)
    invalidate_knowledge_retrieval_cache()

    print(
        {
            "documents_found": len(rows),
            "processed": processed,
            "missing_file": missing_file,
            **cleanup_stats,
            "search_dirs": [str(path) for path in search_dirs],
        }
    )


if __name__ == "__main__":
    asyncio.run(run())
