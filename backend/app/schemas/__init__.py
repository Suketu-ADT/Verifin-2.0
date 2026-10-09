"""
Pydantic API schemas matching frontend/src/lib/api.ts contract.
"""

from app.schemas.system import HealthResponse, ServicesHealth
from app.schemas.document import DocumentResponse
from app.schemas.verification import (
    StartVerificationRequest,
    VerificationResultResponse,
    ClaimResponse,
    Evidence,
    NLIResult,
)
from app.schemas.demo import DemoRunResponse
from app.schemas.retrieval import (
    EvidenceChunkResponse,
    EvidenceRetrievalRequest,
    EvidenceRetrievalResponse,
    DocumentChunksResponse,
)

__all__ = [
    "HealthResponse",
    "ServicesHealth",
    "DocumentResponse",
    "StartVerificationRequest",
    "VerificationResultResponse",
    "ClaimResponse",
    "Evidence",
    "NLIResult",
    "DemoRunResponse",
    "EvidenceChunkResponse",
    "EvidenceRetrievalRequest",
    "EvidenceRetrievalResponse",
    "DocumentChunksResponse",
]

