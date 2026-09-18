from pydantic import BaseModel
from typing import List, Optional

class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    size: int
    page_count: int
    status: str

class VerificationStartRequest(BaseModel):
    document_id: str
    llm_output: str

class ClaimResponse(BaseModel):
    id: str
    claim_text: str
    claim_type: str
    status: str
    confidence: Optional[float] = None
    risk_level: Optional[str] = None
    source_sentence: Optional[str] = None
    evidence: Optional[dict] = None
    nli: Optional[dict] = None

class EvidenceResponse(BaseModel):
    id: str
    text: str
    page_number: int
    similarity_score: float

class VerificationResultResponse(BaseModel):
    id: str
    document_id: str
    overall_score: float
    risk_level: str
    status: str
    claims: List[ClaimResponse]
