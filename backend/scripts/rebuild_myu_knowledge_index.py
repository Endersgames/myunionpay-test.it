"""Rebuild MYU knowledge documents/chunks from extracted training documents.

Use after retrieval/chunking schema upgrades (e.g. keyword_terms updates).
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from database import db
from services.document_text_extractor import _is_quality_text
from services.myu_knowledge_base import DEFAULT_KB_CHUNKING_SERVICE


async def ensure_indexes() -> None:
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


async def rebuild() -> None:
    await ensure_indexes()

    cursor = db.myu_training_documents.find(
        {
            "is_deleted": {"$ne": True},
            "extraction_status": "success",
            "extracted_text": {"$type": "string", "$ne": ""},
        },
        {"_id": 0},
    )
    source_docs = await cursor.sort([("uploaded_at", 1)]).to_list(5000)

    rebuilt = 0
    failed = 0
    skipped_low_quality = 0
    total_chunks = 0

    for source_document in source_docs:
        source_document_id = source_document.get("id", "")
        if not source_document_id:
            failed += 1
            continue

        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            extracted_text = source_document.get("extracted_text", "")
            if not _is_quality_text(extracted_text):
                skipped_low_quality += 1
                continue

            existing = await db.myu_knowledge_documents.find_one(
                {"source_document_id": source_document_id},
                {"_id": 0, "id": 1, "created_at": 1},
            )

            knowledge_document, chunks = DEFAULT_KB_CHUNKING_SERVICE.chunk_document(
                source_document=source_document,
                extracted_text=extracted_text,
                now_iso=now_iso,
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

            await db.myu_training_documents.update_one(
                {"id": source_document_id},
                {
                    "$set": {
                        "kb_sync_status": "synced",
                        "kb_sync_error": "",
                        "kb_synced_at": now_iso,
                        "kb_document_id": document_payload.get("id", ""),
                        "knowledge_chunk_count": len(chunk_payloads),
                        "updated_at": now_iso,
                        "updated_by": "migration-rebuild-kb",
                    }
                },
            )

            rebuilt += 1
            total_chunks += len(chunk_payloads)
        except Exception as exc:  # pragma: no cover - defensive migration path
            failed += 1
            await db.myu_training_documents.update_one(
                {"id": source_document_id},
                {
                    "$set": {
                        "kb_sync_status": "failed",
                        "kb_sync_error": f"Migration rebuild failed: {exc}"[:900],
                        "kb_synced_at": None,
                        "kb_document_id": "",
                        "knowledge_chunk_count": 0,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "updated_by": "migration-rebuild-kb",
                    }
                },
            )

    print(
        {
            "documents_found": len(source_docs),
            "documents_rebuilt": rebuilt,
            "documents_failed": failed,
            "documents_skipped_low_quality": skipped_low_quality,
            "total_chunks": total_chunks,
        }
    )


if __name__ == "__main__":
    asyncio.run(rebuild())
