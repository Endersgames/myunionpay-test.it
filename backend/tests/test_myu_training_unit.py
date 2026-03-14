import asyncio
import re
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from myu.context_builder import build_myu_context
from routes.admin_myu_training import _resolve_safe_file_path, _validate_training_pdf_file
from services.document_text_extractor import _is_quality_text
from services import myu_behavior_config as behavior_mod
from services import myu_knowledge_retrieval as retrieval_mod


class _FakeAppConfigCollection:
    def __init__(self):
        self.last_update = None

    async def update_one(self, query, update, upsert=False):
        self.last_update = {
            "query": query,
            "update": update,
            "upsert": upsert,
        }
        return SimpleNamespace(modified_count=1)


class _FakeCursor:
    def __init__(self, rows):
        self._rows = rows

    def sort(self, *args, **kwargs):
        return self

    async def to_list(self, size):
        return self._rows[:size]


class _FakeCollection:
    def __init__(self, rows):
        self.rows = list(rows)
        self.indexes = []

    async def create_index(self, *args, **kwargs):
        self.indexes.append((args, kwargs))
        return "ok"

    def find(self, query=None, projection=None):
        query = query or {}
        matched = [
            _apply_projection(row, projection)
            for row in self.rows
            if _matches_query(row, query)
        ]
        return _FakeCursor(matched)


def _apply_projection(row, projection):
    if not projection:
        return dict(row)
    include = [key for key, value in projection.items() if value and key != "_id"]
    if not include:
        data = dict(row)
        data.pop("_id", None)
        return data
    return {key: row.get(key) for key in include}


def _matches_query(row, query):
    if not query:
        return True

    for key, condition in query.items():
        if key == "$or":
            if not any(_matches_query(row, clause) for clause in condition):
                return False
            continue

        value = row.get(key)
        if isinstance(condition, dict):
            if "$in" in condition:
                expected = condition["$in"]
                if isinstance(value, list):
                    if not any(item in expected for item in value):
                        return False
                elif value not in expected:
                    return False
            elif "$regex" in condition:
                flags = re.IGNORECASE if "i" in str(condition.get("$options", "")) else 0
                pattern = str(condition["$regex"])
                if not re.search(pattern, str(value or ""), flags):
                    return False
            elif "$ne" in condition:
                if value == condition["$ne"]:
                    return False
            else:
                return False
            continue

        if value != condition:
            return False

    return True


def test_behavior_config_migrates_legacy_profile(monkeypatch):
    fake_collection = _FakeAppConfigCollection()
    monkeypatch.setattr(behavior_mod, "db", SimpleNamespace(app_config=fake_collection))

    legacy = {
        "key": "myu_training",
        "training_prompt": "",
        "response_rules": "Regole test",
        "myu_config": {
            "personality": "minimalista",
            "response_max_sentences": 2,
            "base_behavior": {
                "response_style": "breve",
                "average_length": "breve",
                "human_mode_enabled": False,
                "adaptive_style_enabled": False,
                "proactive_enabled": False,
            },
        },
    }

    updated = asyncio.run(
        behavior_mod.ensure_myu_behavior_config_persisted(
            config_doc=legacy,
            updated_by="pytest",
        )
    )

    assert updated["myu_config"]["personality"] == "umano_empatico_proattivo"
    assert updated["myu_config"]["response_max_sentences"] >= 8
    behavior = updated["myu_config"]["base_behavior"]
    assert behavior["human_mode_enabled"] is True
    assert behavior["adaptive_style_enabled"] is True
    assert behavior["proactive_enabled"] is True
    assert "Adatta profondita" in updated["response_rules"]
    assert fake_collection.last_update is not None


def test_retrieval_filters_active_documents_and_category(monkeypatch):
    docs = _FakeCollection(
        [
            {
                "id": "doc-kb-comp",
                "source_document_id": "doc-comp",
                "source_document_key": "piano_compensi",
                "source_display_name": "Piano Compensi",
                "source_version_tag": "v2",
                "category": "compensation_plan",
                "is_active": True,
            },
            {
                "id": "doc-kb-values",
                "source_document_id": "doc-values",
                "source_document_key": "valori_aziendali",
                "source_display_name": "Valori Aziendali",
                "source_version_tag": "v1",
                "category": "company_values",
                "is_active": True,
            },
            {
                "id": "doc-kb-old",
                "source_document_id": "doc-old",
                "source_document_key": "piano_compensi",
                "source_display_name": "Piano Compensi Old",
                "source_version_tag": "v0",
                "category": "compensation_plan",
                "is_active": False,
            },
        ]
    )
    chunks = _FakeCollection(
        [
                {
                    "id": "chunk-1",
                "knowledge_document_id": "doc-kb-comp",
                "source_document_id": "doc-comp",
                "source_document_key": "piano_compensi",
                    "category": "compensation_plan",
                    "chunk_order": 1,
                    "title": "Bonus piano compensi",
                    "text": (
                        "Il piano compensi prevede bonus mensili, commissioni progressive e livelli di "
                        "premialita in base ai risultati. La guida descrive esempi pratici, requisiti e "
                        "regole di calcolo per un percorso sostenibile."
                    ),
                    "keyword_terms": ["piano", "compensi", "bonus", "commissioni"],
                    "is_active": True,
                },
            {
                "id": "chunk-2",
                "knowledge_document_id": "doc-kb-values",
                "source_document_id": "doc-values",
                "source_document_key": "valori_aziendali",
                "category": "company_values",
                "chunk_order": 1,
                "title": "Mission",
                "text": "I valori aziendali sono trasparenza e supporto.",
                "keyword_terms": ["valori", "mission"],
                "is_active": True,
            },
            {
                "id": "chunk-3",
                "knowledge_document_id": "doc-kb-old",
                "source_document_id": "doc-old",
                "source_document_key": "piano_compensi",
                "category": "compensation_plan",
                "chunk_order": 1,
                "title": "Archivio",
                "text": "Contenuto non attivo",
                "keyword_terms": ["piano", "compensi"],
                "is_active": True,
            },
        ]
    )

    fake_db = SimpleNamespace(
        myu_knowledge_documents=docs,
        myu_knowledge_chunks=chunks,
    )
    monkeypatch.setattr(retrieval_mod, "db", fake_db)
    retrieval_mod.invalidate_knowledge_retrieval_cache()
    monkeypatch.setattr(retrieval_mod, "_RETRIEVAL_INDEXES_READY", False)

    result = asyncio.run(
        retrieval_mod.get_relevant_knowledge_for_myu(
            query="come funziona il piano compensi con bonus?",
            user_context={
                "category_filter": ["compensation_plan"],
                "max_chunks": 3,
                "min_score": 1.0,
            },
        )
    )

    assert result["found"] is True
    assert result["chunks"]
    assert all(chunk["category"] == "compensation_plan" for chunk in result["chunks"])
    assert {source["source_document_id"] for source in result["sources"]} == {"doc-comp"}


def test_retrieval_category_seed_fallback_returns_chunks_when_lexical_match_is_low(monkeypatch):
    docs = _FakeCollection(
        [
            {
                "id": "doc-kb-comp",
                "source_document_id": "doc-comp",
                "source_document_key": "piano_compensi",
                "source_display_name": "Piano Compensi",
                "source_version_tag": "v1",
                "category": "compensation_plan",
                "is_active": True,
            }
        ]
    )
    chunks = _FakeCollection(
        [
            {
                "id": "chunk-low-lexical",
                "knowledge_document_id": "doc-kb-comp",
                "source_document_id": "doc-comp",
                "source_document_key": "piano_compensi",
                "category": "compensation_plan",
                "chunk_order": 1,
                "title": "Tabella livelli",
                "text": (
                    "0 50 100 1 15 30 2 5 10 3 3 6 4 2,50 5 5 2,50 5 "
                    "Compenso UNA TANTUM per attivazione di ogni utenza business"
                ),
                "keyword_terms": [],
                "is_active": True,
            }
        ]
    )

    fake_db = SimpleNamespace(
        myu_knowledge_documents=docs,
        myu_knowledge_chunks=chunks,
    )
    monkeypatch.setattr(retrieval_mod, "db", fake_db)
    retrieval_mod.invalidate_knowledge_retrieval_cache()
    monkeypatch.setattr(retrieval_mod, "_RETRIEVAL_INDEXES_READY", False)

    result = asyncio.run(
        retrieval_mod.get_relevant_knowledge_for_myu(
            query="ok pianifichiamo cosa serve in base a piano compensi",
            user_context={
                "category_filter": ["compensation_plan"],
                "max_chunks": 3,
                "min_score": 1.0,
            },
        )
    )

    assert result["found"] is True
    assert result["fallback_reason"] == "category_seed_fallback"
    assert result["chunks"]
    assert result["chunks"][0]["category"] == "compensation_plan"


def test_context_builder_contains_proactive_and_knowledge_layers():
    context = build_myu_context(
        user={"name": "Mario"},
        message="Mi sento stanco ma voglio capire meglio il piano compensi",
        options={
            "behavior_profile": {
                "behavior": {
                    "assistant_name": "MYU",
                    "voice_tone": "umano_empatico_positivo",
                    "proactive_enabled": True,
                    "proactive_followups_enabled": True,
                    "proactive_checkins_enabled": True,
                },
                "coaching_engine": {"enabled": True, "escalation_policy": "balanced"},
            },
            "proactive_signals": [
                {
                    "type": "task_due_soon",
                    "title": "Task in scadenza",
                    "detail": "Task coaching entro 24h",
                    "priority": "medium",
                    "suggested_opening": "Vuoi un mini piano?",
                }
            ],
            "knowledge_context": {
                "found": True,
                "sources": [
                    {
                        "source_document_id": "doc-comp",
                        "source_document_key": "piano_compensi",
                        "source_display_name": "Piano Compensi",
                        "source_version_tag": "v2",
                        "category": "compensation_plan",
                    }
                ],
                "chunks": [
                    {
                        "id": "chunk-1",
                        "category": "compensation_plan",
                        "title": "Bonus",
                        "text": "Bonus progressivo in base alle attivita.",
                    }
                ],
                "context_text": "[KB1] categoria=compensation_plan fonte=Piano Compensi v2",
            },
            "recent_history": [
                {"role": "user", "text": "voglio dettagli"},
                {"role": "assistant", "text": "ok"},
            ],
        },
    )

    assert "proactive_signals" in context["applied_layer_order"]
    assert "knowledge_documents" in context["applied_layer_order"]
    assert "Trigger Proattivi" in context["final_context"]
    assert "Knowledge MYU" in context["final_context"]


def test_training_pdf_validation_and_safe_path(tmp_path):
    valid_pdf = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n"
    extension, size = _validate_training_pdf_file(
        original_name="test.pdf",
        content_type="application/pdf",
        content=valid_pdf,
    )
    assert extension == ".pdf"
    assert size == len(valid_pdf)

    with pytest.raises(HTTPException):
        _validate_training_pdf_file(
            original_name="bad.pdf",
            content_type="application/pdf",
            content=b"not-a-pdf",
        )

    safe_dir = tmp_path / "uploads"
    safe_dir.mkdir(parents=True)
    safe_path = _resolve_safe_file_path(safe_dir, "doc.pdf")
    assert Path(safe_path).name == "doc.pdf"

    sanitized = _resolve_safe_file_path(safe_dir, "../secret.txt")
    assert str(sanitized).startswith(str(safe_dir.resolve()))
    assert sanitized.name == "secret.txt"


def test_pdf_extracted_text_quality_guard():
    readable = (
        "Questo e un testo leggibile del company profile. "
        "Spiega missione, valori, prodotti e supporto commerciale. "
        "Contiene frasi complete, spazi e una struttura naturale utile al retrieval.\n"
        "Inoltre descrive processi, onboarding e linee guida operative."
    )
    gibberish = (
        "àiôù×?³£?Í¡%SÙ6Î>Eßr1Á3UÔj|A1µÖÁMÓÅ!%¡Â"
        "j$|Åg£Ûj'ójíSí¼ÃÃò×=2ôÎFöØ©)"
    )
    assert _is_quality_text(readable) is True
    assert _is_quality_text(gibberish) is False


def test_pdf_extracted_text_quality_guard_rejects_gid_and_accepts_partial_linguistic_text():
    gid_noise = "/gid00054/gid00077/gid00072/gid00078/gid00077/gid00001 " * 30
    assert _is_quality_text(gid_noise) is False

    partial_but_useful = (
        "11x livello compenso mensile per utenza family pro union energia bonus commissioni rete "
        "fornitura wallet sponsor rank manager team business ricorrente condizione contratto "
        "contribuzione personale euro commissioni bonus ogni mese livello fornitura utenza "
    ) * 20
    assert _is_quality_text(partial_but_useful) is True
