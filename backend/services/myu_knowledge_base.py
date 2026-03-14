from __future__ import annotations

from collections import Counter
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

from models.myu_knowledge_base import (
    KnowledgeCategory,
    KnowledgeChunkRecord,
    KnowledgeDocumentRecord,
)


SOURCE_CATEGORY_MAP: dict[str, KnowledgeCategory] = {
    "valori_aziendali": KnowledgeCategory.company_values,
    "piano_compensi": KnowledgeCategory.compensation_plan,
    "company_profile": KnowledgeCategory.company_profile,
    "ruoli_union_holidays": KnowledgeCategory.union_roles,
    "vademecum_otp": KnowledgeCategory.otp_guide,
    "firma_digitale": KnowledgeCategory.digital_signature,
    "offerte_energia": KnowledgeCategory.energy_offers,
    "company_values": KnowledgeCategory.company_values,
    "compensation_plan": KnowledgeCategory.compensation_plan,
    "union_roles": KnowledgeCategory.union_roles,
    "otp_guide": KnowledgeCategory.otp_guide,
    "digital_signature": KnowledgeCategory.digital_signature,
    "energy_offers": KnowledgeCategory.energy_offers,
}

CATEGORY_SEED_TERMS: dict[KnowledgeCategory, list[str]] = {
    KnowledgeCategory.company_values: ["valori", "mission", "vision", "cultura", "azienda", "union", "energia"],
    KnowledgeCategory.compensation_plan: [
        "piano",
        "compensi",
        "compenso",
        "bonus",
        "commissioni",
        "provvigioni",
        "livelli",
        "fornitura",
        "utenza",
        "rete",
        "wallet",
    ],
    KnowledgeCategory.company_profile: ["company", "profile", "azienda", "presentazione", "union", "energia"],
    KnowledgeCategory.union_roles: ["ruoli", "responsabilita", "mansioni", "union", "holidays"],
    KnowledgeCategory.otp_guide: ["otp", "codice", "verifica", "sicurezza", "vademecum"],
    KnowledgeCategory.digital_signature: ["firma", "digitale", "elettronica", "procedura"],
    KnowledgeCategory.energy_offers: ["offerte", "energia", "tariffe", "luce", "gas"],
}

KEYWORD_STOPWORDS = {
    "alla",
    "allo",
    "agli",
    "alle",
    "della",
    "dello",
    "delle",
    "degli",
    "dalla",
    "dallo",
    "dalle",
    "dagli",
    "sono",
    "dove",
    "come",
    "quale",
    "quali",
    "dopo",
    "prima",
    "anche",
    "quindi",
    "perche",
    "perché",
    "sulla",
    "sullo",
    "sulle",
    "sugli",
    "dentro",
    "fuori",
    "delle",
    "dalla",
    "questo",
    "questa",
    "quello",
    "quella",
    "loro",
    "solo",
    "sono",
    "stato",
    "stati",
    "essere",
    "avere",
    "delle",
    "della",
    "piano",
    "guida",
    "vademecum",
    "documento",
    "myu",
}


class EmbeddingProvider(Protocol):
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        ...


@dataclass
class TextSection:
    title: str
    content: str


class KnowledgeChunkingService:
    def __init__(
        self,
        *,
        target_chunk_chars: int = 1100,
        min_chunk_chars: int = 260,
        max_chunks_per_document: int = 250,
        embedding_provider: EmbeddingProvider | None = None,
    ):
        self.target_chunk_chars = target_chunk_chars
        self.min_chunk_chars = min_chunk_chars
        self.max_chunks_per_document = max_chunks_per_document
        # Placeholder for future embedding pipeline integration.
        self.embedding_provider = embedding_provider

    def resolve_category(self, source_document_key: str) -> KnowledgeCategory:
        key = (source_document_key or "").strip().lower()
        return SOURCE_CATEGORY_MAP.get(key, KnowledgeCategory.company_profile)

    def chunk_document(
        self,
        *,
        source_document: dict,
        extracted_text: str,
        now_iso: str | None = None,
    ) -> tuple[KnowledgeDocumentRecord, list[KnowledgeChunkRecord]]:
        normalized_text = _normalize_text(extracted_text)
        current_time = now_iso or datetime.now(timezone.utc).isoformat()
        category = self.resolve_category(source_document.get("document_key", ""))
        document_title = (
            source_document.get("display_name")
            or source_document.get("original_name")
            or source_document.get("document_key")
            or "Documento MYU"
        )
        source_document_label = source_document.get("document_label") or source_document.get("document_key", "")
        knowledge_document_id = str(uuid.uuid4())

        sections = _split_sections(normalized_text, fallback_title=document_title)

        chunks: list[KnowledgeChunkRecord] = []
        chunk_order = 1
        for section in sections:
            section_chunks = _split_section_into_chunks(
                section.content,
                target_chars=self.target_chunk_chars,
                min_chars=self.min_chunk_chars,
            )
            if not section_chunks:
                continue
            for chunk_text in section_chunks:
                if len(chunks) >= self.max_chunks_per_document:
                    break
                chunk = KnowledgeChunkRecord(
                    id=str(uuid.uuid4()),
                    knowledge_document_id=knowledge_document_id,
                    source_document_id=source_document.get("id", ""),
                    source_document_key=source_document.get("document_key", ""),
                    category=category,
                    chunk_order=chunk_order,
                    title=(section.title or document_title)[:160] if (section.title or document_title) else None,
                    text=chunk_text,
                    text_char_count=len(chunk_text),
                    keyword_terms=_extract_keyword_terms(
                        title=(section.title or document_title),
                        text=chunk_text,
                        category=category,
                    ),
                    is_active=bool(source_document.get("is_active", True)),
                    embedding_status="pending",
                    embedding_model="",
                    created_at=current_time,
                    updated_at=current_time,
                )
                chunks.append(chunk)
                chunk_order += 1
            if len(chunks) >= self.max_chunks_per_document:
                break

        document_record = KnowledgeDocumentRecord(
            id=knowledge_document_id,
            source_document_id=source_document.get("id", ""),
            source_document_key=source_document.get("document_key", ""),
            source_document_label=source_document_label,
            source_display_name=document_title,
            source_original_name=source_document.get("original_name", ""),
            source_version_number=int(source_document.get("version_number") or 1),
            source_version_tag=source_document.get("version_tag") or "v1",
            category=category,
            is_active=bool(source_document.get("is_active", True)),
            extraction_status=source_document.get("extraction_status") or "success",
            text_char_count=len(normalized_text),
            chunk_count=len(chunks),
            created_at=current_time,
            updated_at=current_time,
        )
        return document_record, chunks


DEFAULT_KB_CHUNKING_SERVICE = KnowledgeChunkingService()


def _normalize_text(text: str) -> str:
    normalized = (text or "").replace("\x00", " ")
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    normalized = _compact_semantic_noise(normalized)
    normalized = re.sub(r"[ \t]+\n", "\n", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    normalized = re.sub(r"[ \t]{2,}", " ", normalized)
    return normalized.strip()


def _compact_semantic_noise(text: str) -> str:
    lines = text.split("\n")
    normalized_for_count = [
        re.sub(r"\s+", " ", line.strip().lower())
        for line in lines
        if line.strip()
    ]
    frequency = Counter(normalized_for_count)

    kept = []
    for raw in lines:
        line = raw.strip()
        if not line:
            kept.append("")
            continue

        compact = re.sub(r"\s+", " ", line.lower())
        token_count = len(re.findall(r"[a-zA-Z0-9_]{2,}", compact))
        is_repeated_noise = (
            frequency.get(compact, 0) >= 4
            and 1 <= token_count <= 12
            and len(line) <= 90
        )
        if is_repeated_noise:
            continue
        kept.append(raw)
    return "\n".join(kept)


def _extract_keyword_terms(*, title: str, text: str, category: KnowledgeCategory, max_terms: int = 36) -> list[str]:
    raw = f"{title or ''} {text or ''}".lower()
    tokens = re.findall(r"[a-zA-Z0-9_]{3,}", raw)
    filtered = [
        token
        for token in tokens
        if token not in KEYWORD_STOPWORDS and not token.isdigit()
    ]
    freq = Counter(filtered)
    ranked = sorted(freq.items(), key=lambda item: (-item[1], item[0]))
    ranked_terms = [token for token, _ in ranked[:max_terms]]

    merged = []
    seen = set()
    for token in CATEGORY_SEED_TERMS.get(category, []):
        normalized = token.strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        merged.append(normalized)
    for token in ranked_terms:
        normalized = token.strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        merged.append(normalized)
        if len(merged) >= max_terms:
            break

    return merged


def _split_sections(text: str, *, fallback_title: str) -> list[TextSection]:
    if not text.strip():
        return []

    lines = text.split("\n")
    sections: list[TextSection] = []
    current_title = fallback_title
    current_content: list[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            current_content.append("")
            continue

        if _is_heading(stripped):
            if _has_meaningful_content(current_content):
                sections.append(
                    TextSection(
                        title=current_title,
                        content=_normalize_text("\n".join(current_content)),
                    )
                )
                current_content = []
            current_title = _clean_heading(stripped) or fallback_title
            continue

        current_content.append(stripped)

    if _has_meaningful_content(current_content):
        sections.append(
            TextSection(
                title=current_title,
                content=_normalize_text("\n".join(current_content)),
            )
        )

    if not sections:
        sections.append(TextSection(title=fallback_title, content=text))
    return sections


def _split_section_into_chunks(text: str, *, target_chars: int, min_chars: int) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text or "") if p.strip()]
    if not paragraphs:
        return []

    chunks: list[str] = []
    current_parts: list[str] = []
    current_len = 0

    for paragraph in paragraphs:
        for piece in _split_long_paragraph(paragraph, target_chars=target_chars):
            piece_len = len(piece)
            if current_parts and current_len + piece_len + 1 > target_chars:
                chunk = _normalize_text("\n\n".join(current_parts))
                if chunk:
                    chunks.append(chunk)
                current_parts = []
                current_len = 0

            current_parts.append(piece)
            current_len += piece_len + 1

    if current_parts:
        chunk = _normalize_text("\n\n".join(current_parts))
        if chunk:
            chunks.append(chunk)

    if len(chunks) >= 2 and len(chunks[-1]) < min_chars:
        chunks[-2] = _normalize_text(chunks[-2] + "\n\n" + chunks[-1])
        chunks.pop()

    return chunks


def _split_long_paragraph(paragraph: str, *, target_chars: int) -> list[str]:
    if len(paragraph) <= target_chars:
        return [paragraph]

    sentences = [s.strip() for s in re.split(r"(?<=[\.\!\?\:\;])\s+", paragraph) if s.strip()]
    if len(sentences) <= 1:
        return _split_by_length(paragraph, target_chars)

    result: list[str] = []
    current = []
    current_len = 0
    for sentence in sentences:
        sentence_len = len(sentence)
        if current and current_len + sentence_len + 1 > target_chars:
            result.append(" ".join(current).strip())
            current = []
            current_len = 0
        current.append(sentence)
        current_len += sentence_len + 1

    if current:
        result.append(" ".join(current).strip())
    return [r for r in result if r]


def _split_by_length(text: str, size: int) -> list[str]:
    pieces: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            split_at = text.rfind(" ", start, end)
            if split_at > start + int(size * 0.55):
                end = split_at
        pieces.append(text[start:end].strip())
        start = end
    return [p for p in pieces if p]


def _is_heading(line: str) -> bool:
    if line.startswith("#"):
        return True
    if len(line) < 3 or len(line) > 90:
        return False
    if re.match(r"^\d+(\.\d+)*[\)\.\-:]\s+", line):
        return True
    if re.match(r"^[IVXLCDM]+[\)\.\-:]\s+", line):
        return True
    if line.endswith(":"):
        return True

    alpha_chars = [ch for ch in line if ch.isalpha()]
    if not alpha_chars:
        return False
    uppercase_ratio = sum(1 for ch in alpha_chars if ch.isupper()) / len(alpha_chars)
    if uppercase_ratio > 0.72:
        return True
    return False


def _clean_heading(line: str) -> str:
    heading = line.strip().lstrip("#").strip()
    heading = re.sub(r"^\d+(\.\d+)*[\)\.\-:]\s*", "", heading)
    heading = re.sub(r"^[IVXLCDM]+[\)\.\-:]\s*", "", heading)
    return heading[:160]


def _has_meaningful_content(lines: list[str]) -> bool:
    return bool(_normalize_text("\n".join(lines)))
