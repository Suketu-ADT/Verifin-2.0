"""
Verification endpoints for initiating verification sessions and polling results.
"""

import uuid
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, Response, status
from starlette.concurrency import run_in_threadpool
from app.config import settings
from app.models.batch import BatchItemModel, BatchModel
from app.repositories.batch_repository import BatchRepository
from app.repositories.verification_repository import VerificationRepository
from app.schemas.verification import (
    BatchItemStatus,
    BatchRequest,
    BatchResponse,
    StartVerificationRequest,
    VerificationJobResponse,
    VerificationResultResponse,
    VerificationStatusResponse,
    VerificationSummary,
)
from app.repositories.document_repository import DocumentRepository
from app.security import Principal, require_role
from app.security.access import authorize_document
from app.security.rate_limit import limit_heavy
from app.services.audit_service import audit
from app.services.export_service import build_csv, build_pdf
from app.services.job_runner import QueueFull, job_runner
from app.services.verification_service import VerificationService

router = APIRouter(prefix="/verification", tags=["Verification"])


def get_verification_service() -> VerificationService:
    return VerificationService()


@router.get("", response_model=List[VerificationSummary])
async def list_verifications(
    limit: int = Query(50, ge=1, le=100),
    status_filter: Optional[Literal["queued", "running", "completed", "failed"]] = Query(None, alias="status"),
    principal: Principal = Depends(require_role("viewer")),
) -> List[VerificationSummary]:
    """The caller's organisation's verifications, newest first."""
    sessions = await VerificationRepository().list_for_tenant(principal.tenant_id, limit=limit, status=status_filter)
    names = {}
    documents = DocumentRepository()
    for doc_id in {s.document_id for s in sessions}:
        document = await documents.get_document_by_id(doc_id)
        names[doc_id] = document.filename if document else None
    return [
        VerificationSummary(
            id=s.id, document_id=s.document_id, document_name=names.get(s.document_id),
            statement_preview=(s.llm_output[:157] + "...") if len(s.llm_output) > 160 else s.llm_output,
            status=s.status, risk_level=s.risk_level, overall_score=s.overall_score,
            claim_counts=s.claim_counts, created_at=s.created_at,
        )
        for s in sessions
    ]


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
    result = await service.start_verification_session(
        request=request, user_id=principal.user_id, tenant_id=principal.tenant_id
    )
    await audit.record_for(principal, "verification.run", resource_type="verification", resource_id=result.id,
                           details={"document_id": result.document_id, "mode": "sync", "risk": result.risk_level,
                                    "score": result.overall_score})
    return result


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
    await audit.record_for(principal, "verification.queue", resource_type="verification", resource_id=session.id,
                           details={"document_id": session.document_id, "mode": "job"})
    base = str(http_request.url).rsplit("/jobs", 1)[0]
    response.headers["Location"] = f"{base}/{session.id}/status"
    return VerificationJobResponse(
        id=session.id,
        status=session.status,
        status_url=f"{base}/{session.id}/status",
        results_url=f"{base}/{session.id}/results",
    )


@router.post(
    "/batches",
    response_model=BatchResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(limit_heavy)],
)
async def start_verification_batch(
    body: BatchRequest,
    http_request: Request,
    response: Response,
    principal: Principal = Depends(require_role("analyst")),
    service: VerificationService = Depends(get_verification_service),
) -> BatchResponse:
    """
    Queues several statements at once, each as its own job. Meant for programmatic use with an API key.
    The whole batch is checked first: one unknown document or empty statement rejects it and queues nothing.
    """
    if len(body.items) > settings.batch_max_items:
        raise HTTPException(
            status_code=413,
            detail=f"A batch holds at most {settings.batch_max_items} items.",
        )
    for number, item in enumerate(body.items):
        if not item.llm_output.strip():
            raise HTTPException(status_code=422, detail=f"Item {number}: llm_output is empty.")
        await authorize_document(item.document_id.strip(), principal)
    if job_runner.waiting + len(body.items) > settings.job_queue_limit:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The verification queue cannot take this batch right now. Retry shortly.",
            headers={"Retry-After": "30"},
        )

    items, requests = [], []
    for number, item in enumerate(body.items):
        request = StartVerificationRequest(document_id=item.document_id, llm_output=item.llm_output)
        session = await service.create_queued_session(request, user_id=principal.user_id, tenant_id=principal.tenant_id)
        items.append(BatchItemModel(index=number, document_id=session.document_id, session_id=session.id, reference=item.reference))
        requests.append((session.id, request))
    batch = await BatchRepository().create(
        BatchModel(id=str(uuid.uuid4()), tenant_id=principal.tenant_id, user_id=principal.user_id, items=items)
    )
    for session_id, request in requests:
        try:
            job_runner.submit(session_id, request, principal.user_id, principal.tenant_id)
        except QueueFull:  # raced with other callers between the check above and now
            await service.verification_repo.set_status(session_id, "failed", "Rejected: the job queue is full.")
    await audit.record_for(principal, "verification.batch", resource_type="batch", resource_id=batch.id,
                           details={"items": len(items)})
    base = str(http_request.url).rsplit("/batches", 1)[0]
    response.headers["Location"] = f"{base}/batches/{batch.id}"
    return await _batch_response(batch, base)


@router.get("/batches/{batch_id}", response_model=BatchResponse)
async def get_verification_batch(
    batch_id: str,
    http_request: Request,
    principal: Principal = Depends(require_role("viewer")),
) -> BatchResponse:
    """Progress of every item in a batch, with each finished item's score and risk."""
    batch = await BatchRepository().get(batch_id)
    if batch is None or batch.tenant_id != principal.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Batch '{batch_id}' not found.")
    base = str(http_request.url).rsplit("/batches", 1)[0]
    return await _batch_response(batch, base)


async def _batch_response(batch: BatchModel, base: str) -> BatchResponse:
    repo = VerificationRepository()
    statuses, counts = [], {"queued": 0, "running": 0, "completed": 0, "failed": 0}
    for item in batch.items:
        session = await repo.get_session_by_id(item.session_id)
        state = session.status if session else "failed"
        counts[state] = counts.get(state, 0) + 1
        statuses.append(BatchItemStatus(
            index=item.index, reference=item.reference, document_id=item.document_id, session_id=item.session_id,
            status=state, error=session.error if session else "Session record is missing.",
            overall_score=session.overall_score if session and state == "completed" else None,
            risk_level=session.risk_level if session and state == "completed" else None,
            results_url=f"{base}/{item.session_id}/results",
        ))
    done = counts["completed"] + counts["failed"]
    if done < len(batch.items):
        overall = "running" if counts["running"] or done else "queued"
    else:
        overall = "completed" if not counts["failed"] else "completed_with_failures"
    return BatchResponse(id=batch.id, status=overall, total=len(batch.items), counts=counts,
                         status_url=f"{base}/batches/{batch.id}", items=statuses, created_at=batch.created_at)


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


@router.get("/{id}/export")
async def export_verification(
    id: str = Path(..., description="Verification session ID"),
    format: Literal["csv", "pdf"] = Query("pdf", description="csv for analysis, pdf for filing"),
    principal: Principal = Depends(require_role("viewer")),
    service: VerificationService = Depends(get_verification_service),
) -> Response:
    """Downloads a finished verification as a PDF report or a CSV of its claims."""
    result = await service.get_results(session_id=id, tenant_id=principal.tenant_id)
    if result.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"Verification is {result.status}; nothing to export yet."
        )
    document = await DocumentRepository().get_document_by_id(result.document_id)
    name = f"verifin-report-{id[:8]}"
    if format == "csv":
        body, media = build_csv(result).encode("utf-8-sig"), "text/csv; charset=utf-8"  # BOM: Excel reads UTF-8 correctly
    else:
        who = principal.email or principal.user_id
        body = await run_in_threadpool(
            build_pdf, result, document_name=document.filename if document else None, generated_by=who
        )
        media = "application/pdf"
    await audit.record_for(principal, "verification.export", resource_type="verification", resource_id=id,
                           details={"format": format, "bytes": len(body)})
    return Response(
        content=body, media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{name}.{format}"', "Cache-Control": "no-store"},
    )
