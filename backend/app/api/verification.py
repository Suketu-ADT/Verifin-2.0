"""
Verification endpoints for initiating verification sessions and polling results.
"""

from fastapi import APIRouter, Depends, Path
from app.schemas.verification import (
    StartVerificationRequest,
    VerificationResultResponse,
)
from app.services.verification_service import VerificationService

router = APIRouter(prefix="/api/verification", tags=["Verification"])


def get_verification_service() -> VerificationService:
    return VerificationService()


@router.post("/start", response_model=VerificationResultResponse)
async def start_verification(
    request: StartVerificationRequest,
    service: VerificationService = Depends(get_verification_service),
) -> VerificationResultResponse:
    """
    Starts a verification session for an LLM text output against a previously uploaded document.
    Creates a queued verification job. ML pipeline execution is scheduled for Phase 2.
    """
    return await service.start_verification_session(request=request)


@router.get("/{id}/results", response_model=VerificationResultResponse)
async def get_verification_results(
    id: str = Path(..., description="Verification session ID"),
    service: VerificationService = Depends(get_verification_service),
) -> VerificationResultResponse:
    """
    Retrieves verification results by session ID.
    """
    return await service.get_results(session_id=id)
