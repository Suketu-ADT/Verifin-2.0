"""
System health and status endpoints.
"""

from fastapi import APIRouter
from app.database.mongodb import ping_database
from app.schemas.system import HealthResponse, ServicesHealth
from app.services.embedding_service import get_embedding_service
from app.services.nli_service import get_nli_service

router = APIRouter(prefix="/api/system", tags=["System"])


@router.get("/health", response_model=HealthResponse)
async def get_system_health() -> HealthResponse:
    """
    Returns system health status for backend services.
    Reports real embedding service status and NLI model readiness for Phase 3.
    """
    db_healthy = await ping_database()
    db_status = "healthy" if db_healthy else "unhealthy"

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
async def get_llm_health():
    """Returns safe detailed configuration status for LLM provider without exposing credentials."""
    from app.services.llm.factory import get_llm_provider
    provider = get_llm_provider()
    return await provider.health_check()


@router.post("/llm/readiness")
async def test_llm_readiness():
    """
    Performs an explicit, bounded live readiness probe against the configured provider.
    Separated from ordinary /health to prevent unwanted inference costs or latency.
    """
    from app.services.llm.factory import get_llm_provider
    provider = get_llm_provider()
    return await provider.test_readiness()


