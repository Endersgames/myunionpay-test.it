"""Reprocess extraction + KB sync for MYU training documents needing backfill."""

from __future__ import annotations

import asyncio
from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from database import db
from routes.admin_myu_training import TRAINING_DOC_UPLOAD_DIR, _run_training_document_extraction


async def run() -> None:
    rows = await db.myu_training_documents.find(
        {
            "is_deleted": {"$ne": True},
            "$or": [
                {"extraction_status": {"$exists": False}},
                {"extraction_status": {"$in": ["pending", "failed", "processing"]}},
                {"kb_sync_status": {"$exists": False}},
                {"kb_sync_status": {"$in": ["pending", "failed", "skipped", "processing"]}},
            ],
        },
        {"_id": 0},
    ).to_list(2000)

    processed = 0
    skipped_missing_file = 0
    for row in rows:
        doc_id = row.get("id", "")
        stored_name = row.get("stored_name", "")
        original_name = row.get("original_name") or stored_name
        if not doc_id or not stored_name:
            continue

        file_path = TRAINING_DOC_UPLOAD_DIR / Path(stored_name).name
        if not file_path.exists():
            skipped_missing_file += 1
            continue

        await _run_training_document_extraction(
            document_id=doc_id,
            original_name=original_name,
            file_path=str(file_path),
            admin_id="migration-reprocess-training",
        )
        processed += 1

    print(
        {
            "candidates": len(rows),
            "processed": processed,
            "skipped_missing_file": skipped_missing_file,
        }
    )


if __name__ == "__main__":
    asyncio.run(run())
