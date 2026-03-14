from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeCategory(str, Enum):
    company_values = "company_values"
    compensation_plan = "compensation_plan"
    company_profile = "company_profile"
    union_roles = "union_roles"
    otp_guide = "otp_guide"
    digital_signature = "digital_signature"
    energy_offers = "energy_offers"


class KnowledgeDocumentRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True, extra="ignore")

    id: str
    source_document_id: str
    source_document_key: str
    source_document_label: str
    source_display_name: str
    source_original_name: str
    source_version_number: int = 1
    source_version_tag: str = "v1"
    category: KnowledgeCategory
    is_active: bool = True
    extraction_status: str = "success"
    text_char_count: int = 0
    chunk_count: int = 0
    created_at: str
    updated_at: str


class KnowledgeChunkRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True, extra="ignore")

    id: str
    knowledge_document_id: str
    source_document_id: str
    source_document_key: str
    category: KnowledgeCategory
    chunk_order: int = Field(ge=1)
    title: Optional[str] = None
    text: str = Field(min_length=1)
    text_char_count: int = Field(ge=1)
    keyword_terms: list[str] = Field(default_factory=list)
    is_active: bool = True
    embedding_status: str = "pending"
    embedding_model: str = ""
    created_at: str
    updated_at: str
