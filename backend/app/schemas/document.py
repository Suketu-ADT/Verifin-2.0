"""
Document API schemas matching frontend DocumentResponse contract.
"""

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    filename: str
    file_type: str
    size: int
    page_count: int
    status: str


class ExtractedFactItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    claim_text: str
    claim_type: str = "numerical"
    entity: str | None = None
    metric: str | None = None
    value: float | None = None
    unit: str | None = None
    reporting_period: str | None = None


class DocumentExtractFactsResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    document_id: str
    summary_text: str
    facts: list[ExtractedFactItem]
    total_facts: int
    provider_used: str
