"""
System health and status endpoints.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from app.config import settings
from app.security import Principal, require_role
from app.security.rate_limit import limit_heavy
from app.database.mongodb import manager, ping_database
from app.schemas.system import HealthResponse, ServicesHealth
from app.services.embedding_service import get_embedding_service
from app.services.nli_service import get_nli_service
from app.services.provenance import PIPELINE_VERSION
from app.services.verdict_policy import GROUNDED_SUPPORT_MIN_OVERLAP, MULTI_FIGURE_SUPPORT_MIN_OVERLAP

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/live")
async def liveness() -> dict:
    """Process is up. Orchestrators restart the container when this fails."""
    return {"status": "alive"}


@router.get("/ready")
async def readiness() -> JSONResponse:
    """Dependencies are usable. Orchestrators stop routing traffic here (503) until they are."""
    db_ok = await ping_database()
    emb_ok = get_embedding_service().is_healthy()
    nli_ok = get_nli_service().is_healthy()
    ready = db_ok and emb_ok and nli_ok
    return JSONResponse(
        status_code=200 if ready else 503,
        content={"status": "ready" if ready else "not_ready",
                 "database": db_ok, "embedding": emb_ok, "nli": nli_ok},
    )


@router.get("/health", response_model=HealthResponse)
async def get_system_health() -> HealthResponse:
    """
    Returns system health status for backend services.
    Reports real embedding service status and NLI model readiness for Phase 3.
    """
    db_healthy = await ping_database()
    # An in-memory fallback answers pings, but it is not the real database: say so instead of reporting a cluster.
    db_status = "fallback" if manager.is_fallback else ("healthy" if db_healthy else "unhealthy")

    embedding_service = get_embedding_service()
    embedding_healthy = embedding_service.is_healthy()
    embedding_status = "healthy" if embedding_healthy else "unavailable"

    nli_service = get_nli_service()
    nli_healthy = nli_service.is_healthy()
    nli_status = "healthy" if nli_healthy else "unavailable"

    from app.services.llm.factory import get_llm_provider
    llm_provider = get_llm_provider()
    llm_status = "ready" if llm_provider.is_configured else "unconfigured"

    services = ServicesHealth(
        backend="healthy",
        database=db_status,
        embedding=embedding_status,
        nli=nli_status,
        llm=llm_status,
    )

    overall_status = (
        "healthy"
        if (db_healthy and embedding_healthy and nli_healthy)
        else "degraded"
    )

    return HealthResponse(
        status=overall_status,
        services=services,
    )


@router.get("/llm/health")
async def get_llm_health(_: Principal = Depends(require_role("admin"))):
    """Returns safe detailed configuration status for LLM provider without exposing credentials."""
    from app.services.llm.factory import get_llm_provider
    provider = get_llm_provider()
    return await provider.health_check()


@router.post("/llm/readiness", dependencies=[Depends(limit_heavy)])
async def test_llm_readiness(_: Principal = Depends(require_role("admin"))):
    """
    Performs an explicit, bounded live readiness probe against the configured provider.
    Separated from ordinary /health to prevent unwanted inference costs or latency.
    """
    from app.services.llm.factory import get_llm_provider
    provider = get_llm_provider()
    return await provider.test_readiness()




@router.get("/config")
async def get_engine_config(_: Principal = Depends(require_role("viewer"))) -> dict:
    """The values the engine is running with. Read-only: they are set by the server's environment."""
    return {
        "pipeline_version": PIPELINE_VERSION,
        "models": {
            "embedding": settings.embedding_model_name,
            "nli": settings.nli_model_name,
            "reranker": settings.reranker_model if settings.reranker_enabled else None,
        },
        "retrieval": {
            "mode": settings.retrieval_mode,
            "fusion": settings.retrieval_fusion_method,
            "top_k": settings.retrieval_top_k,
        },
        "policy": {
            "aggregation": settings.nli_aggregation,
            "nli_contradiction_threshold": settings.nli_contradiction_threshold,
            "nli_support_threshold": settings.nli_support_threshold,
            "grounded_support_min_overlap": GROUNDED_SUPPORT_MIN_OVERLAP,
            "multi_figure_support_min_overlap": MULTI_FIGURE_SUPPORT_MIN_OVERLAP,
            "disabled_checks": [c.strip() for c in settings.disabled_checks.split(",") if c.strip()],
        },
        "ocr": {"confidence_threshold": settings.ocr_confidence_threshold},
        "llm": {"provider": settings.llm_provider, "model": settings.llm_model},
    }
