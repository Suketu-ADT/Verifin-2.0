"""
Verification endpoints for initiating verification sessions and polling results.
"""

from fastapi import APIRouter, Depends, Path
from app.schemas.verification import (
    StartVerificationRequest,
    VerificationResultResponse,
)
from app.security import Principal, require_role
from app.security.access import authorize_document
from app.security.rate_limit import limit_heavy
from app.services.verification_service import VerificationService

router = APIRouter(prefix="/verification", tags=["Verification"])


def get_verification_service() -> VerificationService:
    return VerificationService()


@router.post("/start", response_model=VerificationResultResponse, dependencies=[Depends(limit_heavy)])
async def start_verification(
    request: StartVerificationRequest,
    principal: Principal = Depends(require_role("analyst")),
    service: VerificationService = Depends(get_verification_service),
) -> VerificationResultResponse:
    """
    Verifies an LLM text output against a previously uploaded document and returns the result
    when it is finished (synchronous).
    """
    await authorize_document(request.document_id.strip(), principal)
    return await service.start_verification_session(
        request=request, user_id=principal.user_id, tenant_id=principal.tenant_id
    )


@router.get("/{id}/results", response_model=VerificationResultResponse)
async def get_verification_results(
    id: str = Path(..., description="Verification session ID"),
    principal: Principal = Depends(require_role("viewer")),
    service: VerificationService = Depends(get_verification_service),
) -> VerificationResultResponse:
    """
    Retrieves verification results by session ID.
    """
    return await service.get_results(session_id=id, tenant_id=principal.tenant_id)
