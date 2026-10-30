"""
Verification endpoints for initiating verification sessions and polling results.
"""

from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response, status
from app.schemas.verification import (
    StartVerificationRequest,
    VerificationJobResponse,
    VerificationResultResponse,
    VerificationStatusResponse,
)
from app.security import Principal, require_role
from app.security.access import authorize_document
from app.security.rate_limit import limit_heavy
from app.services.job_runner import QueueFull, job_runner
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


@router.post(
    "/jobs",
    response_model=VerificationJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(limit_heavy)],
)
async def start_verification_job(
    request: StartVerificationRequest,
    http_request: Request,
    response: Response,
    principal: Principal = Depends(require_role("analyst")),
    service: VerificationService = Depends(get_verification_service),
) -> VerificationJobResponse:
    """
    Queues a verification and returns at once. Poll ``status_url``; fetch ``results_url`` when it is completed.
    """
    await authorize_document(request.document_id.strip(), principal)
    session = await service.create_queued_session(request, user_id=principal.user_id, tenant_id=principal.tenant_id)
    try:
        job_runner.submit(session.id, request, principal.user_id, principal.tenant_id)
    except QueueFull:
        await service.verification_repo.set_status(session.id, "failed", "Rejected: the job queue is full.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The verification queue is full. Retry shortly.",
            headers={"Retry-After": "30"},
        )
    base = str(http_request.url).rsplit("/jobs", 1)[0]
    response.headers["Location"] = f"{base}/{session.id}/status"
    return VerificationJobResponse(
        id=session.id,
        status=session.status,
        status_url=f"{base}/{session.id}/status",
        results_url=f"{base}/{session.id}/results",
    )


@router.get("/{id}/status", response_model=VerificationStatusResponse)
async def get_verification_status(
    id: str = Path(..., description="Verification session ID"),
    principal: Principal = Depends(require_role("viewer")),
    service: VerificationService = Depends(get_verification_service),
) -> VerificationStatusResponse:
    """Progress of a queued verification: queued, running, completed or failed (with the reason)."""
    session = await service.get_session_status(id, tenant_id=principal.tenant_id)
    return VerificationStatusResponse(
        id=session.id, document_id=session.document_id, status=session.status,
        error=session.error, created_at=session.created_at, updated_at=session.updated_at,
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
