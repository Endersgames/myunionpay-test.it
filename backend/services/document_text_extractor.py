from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import os
from pathlib import Path
import re
import string
import zlib
from typing import Iterable, Protocol


@dataclass
class ExtractionOutcome:
    status: str
    extracted_text: str
    error: str = ""
    backend: str = ""


class PdfTextExtractorBackend(Protocol):
    name: str

    def extract_text(self, pdf_bytes: bytes) -> str:
        ...


class PyPdfTextExtractor:
    name = "pypdf"

    @staticmethod
    def is_available() -> bool:
        try:
            from pypdf import PdfReader  # type: ignore
        except Exception:
            return False
        return PdfReader is not None

    def extract_text(self, pdf_bytes: bytes) -> str:
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(BytesIO(pdf_bytes))
        chunks = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                chunks.append(page_text.strip())
        return "\n\n".join(chunks).strip()


class MuPdfTextExtractor:
    name = "pymupdf"

    @staticmethod
    def is_available() -> bool:
        try:
            import fitz  # type: ignore
        except Exception:
            return False
        return fitz is not None

    def extract_text(self, pdf_bytes: bytes) -> str:
        import fitz  # type: ignore

        chunks = []
        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            for page in document:
                page_text = page.get_text("text") or ""
                if page_text.strip():
                    chunks.append(page_text.strip())
        return "\n\n".join(chunks).strip()


class SimplePdfStreamTextExtractor:
    name = "simple_pdf_stream"

    _stream_pattern = re.compile(rb"stream\r?\n(.*?)\r?\nendstream", re.S)
    _tj_pattern = re.compile(r"\((?:\\.|[^\\])*?\)\s*Tj", re.S)
    _tj_array_pattern = re.compile(r"\[(.*?)\]\s*TJ", re.S)
    _quote_text_pattern = re.compile(r"\((?:\\.|[^\\])*?\)\s*['\"]", re.S)

    def extract_text(self, pdf_bytes: bytes) -> str:
        chunks = []
        for raw_stream in self._stream_pattern.findall(pdf_bytes):
            decoded_stream = self._decode_stream(raw_stream)
            if not decoded_stream:
                continue

            found_literals = []
            for match in self._tj_pattern.finditer(decoded_stream):
                found_literals.extend(_extract_pdf_literals(match.group(0)))
            for match in self._quote_text_pattern.finditer(decoded_stream):
                found_literals.extend(_extract_pdf_literals(match.group(0)))
            for match in self._tj_array_pattern.finditer(decoded_stream):
                found_literals.extend(_extract_pdf_literals(match.group(1)))

            for literal in found_literals:
                text = _decode_pdf_escaped_text(literal).strip()
                if text:
                    chunks.append(text)

        merged = "\n".join(chunks)
        merged = re.sub(r"[ \t]+\n", "\n", merged)
        merged = re.sub(r"\n{3,}", "\n\n", merged)
        return merged.strip()

    @staticmethod
    def _decode_stream(raw_stream: bytes) -> str:
        for candidate in (raw_stream, _try_zlib_decode(raw_stream)):
            if not candidate:
                continue
            text = candidate.decode("latin-1", errors="ignore")
            if "Tj" in text or "TJ" in text or "'" in text or '"' in text:
                return text
        return ""


class OcrPdfPlaceholderExtractor:
    name = "ocr_placeholder"

    def extract_text(self, pdf_bytes: bytes) -> str:  # noqa: ARG002
        raise RuntimeError("OCR backend non configurato")


class PdfTextExtractorPipeline:
    def __init__(self, backends: Iterable[PdfTextExtractorBackend]):
        self.backends = list(backends)

    def extract(self, file_path: Path) -> ExtractionOutcome:
        try:
            pdf_bytes = file_path.read_bytes()
        except Exception as exc:
            return ExtractionOutcome(
                status="failed",
                extracted_text="",
                error=f"Impossibile leggere file: {exc}",
                backend="",
            )

        errors = []
        for backend in self.backends:
            try:
                text = backend.extract_text(pdf_bytes)
                normalized = _normalize_extracted_text(text)
                if normalized:
                    if not _is_quality_text(normalized):
                        errors.append(f"{backend.name}: testo non leggibile")
                        continue
                    return ExtractionOutcome(
                        status="success",
                        extracted_text=normalized,
                        error="",
                        backend=backend.name,
                    )
                errors.append(f"{backend.name}: testo vuoto")
            except Exception as exc:
                errors.append(f"{backend.name}: {exc}")

        error_message = "; ".join(errors) or "Nessun backend di estrazione disponibile"
        return ExtractionOutcome(
            status="failed",
            extracted_text="",
            error=error_message[:900],
            backend="",
        )


def _build_default_pipeline() -> PdfTextExtractorPipeline:
    backends: list[PdfTextExtractorBackend] = []
    if PyPdfTextExtractor.is_available():
        backends.append(PyPdfTextExtractor())
    if MuPdfTextExtractor.is_available():
        backends.append(MuPdfTextExtractor())
    enable_simple_stream = os.environ.get("MYU_ENABLE_SIMPLE_PDF_STREAM_EXTRACTOR", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if not backends or enable_simple_stream:
        backends.append(SimplePdfStreamTextExtractor())
    # OCR backend intentionally left as placeholder to keep architecture extensible.
    return PdfTextExtractorPipeline(backends=backends)


DEFAULT_PDF_TEXT_EXTRACTOR = _build_default_pipeline()


def extract_training_document_text(file_path: Path) -> ExtractionOutcome:
    return DEFAULT_PDF_TEXT_EXTRACTOR.extract(file_path)


def _extract_pdf_literals(text: str) -> list[str]:
    literals = []
    i = 0
    while i < len(text):
        if text[i] != "(":
            i += 1
            continue
        i += 1
        depth = 1
        chunk = []
        while i < len(text) and depth > 0:
            char = text[i]
            if char == "\\":
                if i + 1 < len(text):
                    chunk.append(char)
                    chunk.append(text[i + 1])
                    i += 2
                    continue
                chunk.append(char)
                i += 1
                continue
            if char == "(":
                depth += 1
                chunk.append(char)
                i += 1
                continue
            if char == ")":
                depth -= 1
                if depth == 0:
                    i += 1
                    break
                chunk.append(char)
                i += 1
                continue
            chunk.append(char)
            i += 1
        literal = "".join(chunk)
        if literal:
            literals.append(literal)
    return literals


def _decode_pdf_escaped_text(value: str) -> str:
    mapping = {
        "n": "\n",
        "r": "\r",
        "t": "\t",
        "b": "\b",
        "f": "\f",
        "\\": "\\",
        "(": "(",
        ")": ")",
    }

    out = []
    i = 0
    while i < len(value):
        char = value[i]
        if char != "\\":
            out.append(char)
            i += 1
            continue

        if i + 1 >= len(value):
            i += 1
            continue

        nxt = value[i + 1]
        if nxt in mapping:
            out.append(mapping[nxt])
            i += 2
            continue
        if nxt in ("\n", "\r"):
            i += 2
            continue
        if nxt.isdigit():
            octal_digits = [nxt]
            j = i + 2
            while j < len(value) and len(octal_digits) < 3 and value[j].isdigit():
                octal_digits.append(value[j])
                j += 1
            try:
                out.append(chr(int("".join(octal_digits), 8)))
            except Exception:
                pass
            i = j
            continue

        out.append(nxt)
        i += 2

    return "".join(out)


def _normalize_extracted_text(text: str) -> str:
    cleaned = text.replace("\x00", " ")
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()[:200000]


QUALITY_STOPWORDS = {
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
    "che",
    "non",
    "piu",
    "più",
    "sono",
}

DOMAIN_HINT_TERMS = (
    "union",
    "energia",
    "myu",
    "compenso",
    "compensi",
    "bonus",
    "commissioni",
    "provvigioni",
    "fornitura",
    "cliente",
    "clienti",
    "valori",
    "mission",
    "vision",
    "azienda",
    "wallet",
    "piano",
    "network",
)


def _text_quality_metrics(text: str) -> dict[str, float]:
    total_len = max(1, len(text))
    lower_text = text.lower()
    tokens = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ0-9]{2,}", text)
    normalized_tokens = [token.lower() for token in tokens]
    unique_tokens = set(normalized_tokens)
    stopword_hits = sum(1 for token in normalized_tokens if token in QUALITY_STOPWORDS)

    max_run = 1
    current_run = 1
    for idx in range(1, len(text)):
        if text[idx] == text[idx - 1]:
            current_run += 1
            if current_run > max_run:
                max_run = current_run
        else:
            current_run = 1

    punct_chars = set(string.punctuation) | {"€", "£", "°", "«", "»", "…", "–", "—", "’", "“", "”"}
    punctuation_ratio = sum(1 for ch in text if ch in punct_chars) / total_len
    printable_ascii_ratio = sum(
        1 for ch in text if (32 <= ord(ch) <= 126) or ch in "\n\r\t"
    ) / total_len
    control_ratio = sum(
        1 for ch in text if ord(ch) < 32 and ch not in "\n\r\t"
    ) / total_len
    non_ascii_ratio = sum(1 for ch in text if ord(ch) > 126) / total_len

    domain_hits = 0
    for term in DOMAIN_HINT_TERMS:
        if term in lower_text:
            domain_hits += 1

    return {
        "whitespace_ratio": sum(1 for ch in text if ch.isspace()) / total_len,
        "alpha_ratio": sum(1 for ch in text if ch.isalpha()) / total_len,
        "token_count": float(len(tokens)),
        "unique_token_count": float(len(unique_tokens)),
        "readable_token_ratio": sum(len(token) for token in tokens) / total_len,
        "stopword_ratio": stopword_hits / max(1, len(tokens)),
        "gid_marker_count": float(lower_text.count("/gid")),
        "max_char_run": float(max_run),
        "printable_ascii_ratio": printable_ascii_ratio,
        "control_ratio": control_ratio,
        "non_ascii_ratio": non_ascii_ratio,
        "punctuation_ratio": punctuation_ratio,
        "domain_term_hits": float(domain_hits),
    }


def _is_quality_text(text: str) -> bool:
    if not text:
        return False
    if len(text) < 140:
        return False

    metrics = _text_quality_metrics(text)

    if metrics["gid_marker_count"] > 10:
        return False
    if metrics["control_ratio"] > 0.02:
        return False
    if metrics["non_ascii_ratio"] > 0.36:
        return False
    if metrics["max_char_run"] > 28:
        return False

    standard_readable = (
        metrics["whitespace_ratio"] >= 0.06
        and metrics["alpha_ratio"] >= 0.20
        and metrics["token_count"] >= 24
        and metrics["unique_token_count"] >= 12
        and metrics["readable_token_ratio"] >= 0.30
        and metrics["stopword_ratio"] >= 0.02
        and metrics["punctuation_ratio"] <= 0.55
    )
    if standard_readable:
        return True

    # Accept partially-decoded text only when linguistic signal is strong.
    salvage_readable = (
        metrics["printable_ascii_ratio"] >= 0.96
        and metrics["token_count"] >= 300
        and metrics["unique_token_count"] >= 100
        and metrics["stopword_ratio"] >= 0.06
        and (metrics["domain_term_hits"] >= 2 or metrics["token_count"] >= 700)
    )
    if salvage_readable:
        return True

    return False


def _try_zlib_decode(raw_stream: bytes) -> bytes:
    if not raw_stream:
        return b""
    for wbits in (15, -15):
        try:
            return zlib.decompress(raw_stream, wbits)
        except Exception:
            continue
    return b""
