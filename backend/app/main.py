"""
VERIFIN 2.0 — FastAPI Application Entrypoint.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (
    demo_router,
    documents_router,
    evidence_router,
    review_router,
    system_router,
    verification_router,
)
from app.config import settings
from app.database.mongodb import close_mongo_connection, connect_to_mongo
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

    # ── CORS Middleware ──────────────────────────────────────────────────────
    logger.info(f"Configuring CORS with allowed origins: {settings.cors_origins}")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
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
            },
        )

    # ── Register API Routers ─────────────────────────────────────────────────
    app.include_router(system_router)
    app.include_router(documents_router)
    app.include_router(verification_router)
    app.include_router(demo_router)
    app.include_router(evidence_router)
    app.include_router(review_router)

    return app


app = create_app()
