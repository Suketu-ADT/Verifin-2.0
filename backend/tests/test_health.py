"""
Tests for system health endpoint (/api/system/health) with Phase 3 NLI status reporting.
"""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint_healthy():
    """Verify health endpoint returns healthy status when database, embedding, and NLI are healthy."""
    with patch("app.api.system.ping_database", new_callable=AsyncMock) as mock_ping, \
         patch("app.api.system.get_embedding_service") as mock_get_emb, \
         patch("app.api.system.get_nli_service") as mock_get_nli:
        mock_ping.return_value = True

        mock_emb = MagicMock()
        mock_emb.is_healthy.return_value = True
        mock_get_emb.return_value = mock_emb

        mock_nli = MagicMock()
        mock_nli.is_healthy.return_value = True
        mock_get_nli.return_value = mock_nli

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/system/health")

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "healthy"
        assert "services" in data
        services = data["services"]
        assert services["backend"] == "healthy"
        assert services["database"] == "healthy"
        assert services["embedding"] == "healthy"
        assert services["nli"] == "healthy"


@pytest.mark.asyncio
async def test_health_endpoint_degraded_db():
    """Verify health endpoint dynamically reflects database downtime."""
    with patch("app.api.system.ping_database", new_callable=AsyncMock) as mock_ping, \
         patch("app.api.system.get_embedding_service") as mock_get_emb, \
         patch("app.api.system.get_nli_service") as mock_get_nli:
        mock_ping.return_value = False

        mock_emb = MagicMock()
        mock_emb.is_healthy.return_value = True
        mock_get_emb.return_value = mock_emb

        mock_nli = MagicMock()
        mock_nli.is_healthy.return_value = True
        mock_get_nli.return_value = mock_nli

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/system/health")

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "degraded"
        assert data["services"]["database"] == "unhealthy"
        assert data["services"]["backend"] == "healthy"
        assert data["services"]["embedding"] == "healthy"
        assert data["services"]["nli"] == "healthy"


@pytest.mark.asyncio
async def test_health_endpoint_unavailable_embedding():
    """Verify health endpoint distinguishes an unavailable embedding service."""
    with patch("app.api.system.ping_database", new_callable=AsyncMock) as mock_ping, \
         patch("app.api.system.get_embedding_service") as mock_get_emb, \
         patch("app.api.system.get_nli_service") as mock_get_nli:
        mock_ping.return_value = True

        mock_emb = MagicMock()
        mock_emb.is_healthy.return_value = False
        mock_get_emb.return_value = mock_emb

        mock_nli = MagicMock()
        mock_nli.is_healthy.return_value = True
        mock_get_nli.return_value = mock_nli

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/system/health")

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "degraded"
        assert data["services"]["database"] == "healthy"
        assert data["services"]["embedding"] == "unavailable"
        assert data["services"]["nli"] == "healthy"


@pytest.mark.asyncio
async def test_health_endpoint_unavailable_nli():
    """Verify health endpoint distinguishes an unavailable NLI service."""
    with patch("app.api.system.ping_database", new_callable=AsyncMock) as mock_ping, \
         patch("app.api.system.get_embedding_service") as mock_get_emb, \
         patch("app.api.system.get_nli_service") as mock_get_nli:
        mock_ping.return_value = True

        mock_emb = MagicMock()
        mock_emb.is_healthy.return_value = True
        mock_get_emb.return_value = mock_emb

        mock_nli = MagicMock()
        mock_nli.is_healthy.return_value = False
        mock_get_nli.return_value = mock_nli

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/system/health")

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "degraded"
        assert data["services"]["database"] == "healthy"
        assert data["services"]["embedding"] == "healthy"
        assert data["services"]["nli"] == "unavailable"


@pytest.mark.asyncio
async def test_health_reports_in_memory_fallback_as_such(monkeypatch):
    """The in-memory fallback must not be reported as a healthy database cluster."""
    from app.database import mongodb

    monkeypatch.setattr(mongodb.manager, "is_fallback", True)
    with patch("app.api.system.get_embedding_service") as mock_get_emb, \
         patch("app.api.system.get_nli_service") as mock_get_nli:
        mock_get_emb.return_value = MagicMock(is_healthy=MagicMock(return_value=True))
        mock_get_nli.return_value = MagicMock(is_healthy=MagicMock(return_value=True))
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/system/health")

    data = response.json()
    assert data["services"]["database"] == "fallback"
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_engine_config_reports_the_running_policy():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/system/config")
    assert response.status_code == 200
    body = response.json()
    assert body["pipeline_version"].startswith("verifin-pipeline/")
    assert body["policy"]["nli_support_threshold"] == 0.5
    assert body["retrieval"]["fusion"] in {"rrf", "weighted"}
