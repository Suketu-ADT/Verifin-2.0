"""
VERIFIN 2.0 — FastAPI Application Entrypoint.
"""

import secrets
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app.api import (
    auth_router,
    demo_router,
    documents_router,
    evidence_router,
    review_router,
    system_router,
    verification_router,
)
from app.config import settings
from app.database.mongodb import close_mongo_connection, connect_to_mongo
from app.observability import metrics
from app.observability.context import request_id_var
from app.observability.middleware import ObservabilityMiddleware
from app.security.rate_limit import RateLimitMiddleware
from app.utils.logging import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager: handles startup and shutdown tasks.
    """
    logger.info("Starting VERIFIN 2.0 backend application...")
    logger.info(f"Environment: {settings.environment}, Debug: {settings.debug}")
    
    # Connect to MongoDB
    await connect_to_mongo()
    
    yield
    
    # Graceful shutdown
    logger.info("Shutting down VERIFIN 2.0 backend application...")
    await close_mongo_connection()
    logger.info("Shutdown complete.")


def create_app() -> FastAPI:
    """FastAPI application factory."""
    app = FastAPI(
        title="VERIFIN 2.0 API",
        description="Interpretable Hallucination Detection for Financial LLMs",
        version="2.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    # ── Middleware (the last one added is the outermost) ────────────────────
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(ObservabilityMiddleware)
    logger.info(f"Configuring CORS with allowed origins: {settings.cors_origins}")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Request-ID", "traceparent"],
        expose_headers=["X-Request-ID", "traceparent", "Retry-After", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    )

    # ── Exception Handlers ───────────────────────────────────────────────────
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.warning(f"Validation error on {request.method} {request.url.path}: {exc.errors()}")
        return JSONResponse(
            status_code=422,
            content={
                "error": "Validation Error",
                "detail": exc.errors(),
                "request_id": request_id_var.get(),
            },
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(
            f"Unhandled server error on {request.method} {request.url.path}: {str(exc)}",
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal Server Error",
                "detail": "An unexpected error occurred. Please contact system administrator."
                if not settings.debug
                else str(exc),
                "request_id": request_id_var.get(),
            },
        )

    # ── Register API Routers ─────────────────────────────────────────────────
    # Current API: /api/v1. The unversioned /api paths are kept so existing clients keep working,
    # and are marked deprecated.
    resource_routers = (
        system_router, documents_router, verification_router, demo_router, evidence_router, review_router,
    )
    app.include_router(auth_router, prefix="/api/v1")
    for router in resource_routers:
        app.include_router(router, prefix="/api/v1")
        app.include_router(router, prefix="/api", deprecated=True)

    @app.get("/metrics", include_in_schema=False)
    async def prometheus_metrics(request: Request):
        """Prometheus scrape endpoint. Off unless enabled; needs the bearer token when one is configured."""
        if not settings.metrics_enabled:
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        if settings.metrics_token:
            supplied = request.headers.get("authorization", "")
            if not secrets.compare_digest(supplied, f"Bearer {settings.metrics_token}"):
                return JSONResponse(status_code=401, content={"detail": "Invalid metrics token."})
        elif settings.environment.lower() == "production":
            return JSONResponse(status_code=404, content={"detail": "Not found"})  # never expose metrics unprotected
        body, content_type = metrics.render()
        return Response(content=body, media_type=content_type)

    return app


app = create_app()
