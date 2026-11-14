"""
VERIFIN 2.0 — FastAPI Application Entrypoint.
"""

import gzip
import mimetypes
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

from app.api import (
    auth_router,
    demo_router,
    documents_router,
    evidence_router,
    review_router,
    audit_router,
    admin_router,
    analytics_router,
    benchmark_router,
    system_router,
    verification_router,
)
from app.config import settings
from app.database.mongodb import close_mongo_connection, connect_to_mongo
from app.observability import metrics
from app.observability.context import request_id_var
from app.observability.middleware import ObservabilityMiddleware
from app.security.rate_limit import RateLimitMiddleware
from app.services.job_runner import job_runner
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
    await job_runner.recover_orphans()

    yield

    # Graceful shutdown
    logger.info("Shutting down VERIFIN 2.0 backend application...")
    await job_runner.shutdown()
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
        # only where and why: the raw error also carries the submitted input (a password, say) and exception objects
        # raised by custom validators, which cannot be serialised
        problems = [{"type": e.get("type"), "loc": list(e.get("loc", ())), "msg": e.get("msg")} for e in exc.errors()]
        logger.warning(f"Validation error on {request.method} {request.url.path}: {problems}")
        return JSONResponse(
            status_code=422,
            content={
                "error": "Validation Error",
                "detail": problems,
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
    app.include_router(audit_router, prefix="/api/v1")  # new in v1: no deprecated unversioned alias
    app.include_router(admin_router, prefix="/api/v1")
    app.include_router(analytics_router, prefix="/api/v1")  # new in v1: no deprecated unversioned alias
    app.include_router(benchmark_router, prefix="/api/v1")
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

    _serve_frontend(app)
    return app


def _serve_frontend(app: FastAPI) -> None:
    """Serve the built web interface from the API process, with index.html as the fallback for client-side routes."""
    if not settings.frontend_dist:
        return
    dist = Path(settings.frontend_dist).resolve()
    if not (dist / "index.html").is_file():
        logger.warning(f"FRONTEND_DIST is set but {dist} has no index.html; the web interface is not served.")
        return

    @app.get("/{path:path}", include_in_schema=False)
    async def web_interface(path: str, request: Request):
        if path.split("/")[0] == "api":
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        candidate = (dist / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(dist):
            return _static_file(candidate, request, hashed=candidate.is_relative_to(dist / "assets"))
        return _static_file(dist / "index.html", request, hashed=False)


# Text formats worth compressing; fonts, images and PDFs are already compact (or must stay byte-exact for range requests).
_COMPRESSIBLE = {".js", ".mjs", ".css", ".html", ".svg", ".json", ".txt", ".xml"}
_gzip_cache: dict[tuple[str, int, int], bytes] = {}
_CACHE_FOREVER = "public, max-age=31536000, immutable"  # Vite puts a content hash in the file name of everything under assets/
_REVALIDATE = "no-cache"  # the shell and other unhashed files: cheap conditional request every time, never stale


def _accepts_gzip(header: str) -> bool:
    """True when an Accept-Encoding header allows gzip: named with a quality above zero, or covered by a wildcard that is not refused."""
    quality: dict[str, float] = {}
    for part in header.lower().split(","):
        token, _, params = part.strip().partition(";")
        token = token.strip()
        if not token:
            continue
        q = 1.0
        for param in params.split(";"):
            name, _, value = param.strip().partition("=")
            if name.strip() == "q":
                try:
                    q = float(value)
                except ValueError:
                    q = 0.0  # a malformed weight is not an invitation
        quality[token] = q
    if "gzip" in quality:
        return quality["gzip"] > 0
    return quality.get("*", 0.0) > 0


def _static_file(file: Path, request: Request, hashed: bool) -> Response:
    """Serve a built interface file with the headers a browser needs: long-lived cache for hashed assets, gzip for text."""
    cache_control = _CACHE_FOREVER if hashed else _REVALIDATE
    if file.suffix.lower() in _COMPRESSIBLE and _accepts_gzip(request.headers.get("accept-encoding", "")):
        stat = file.stat()
        key = (str(file), stat.st_mtime_ns, stat.st_size)
        body = _gzip_cache.get(key)
        if body is None:
            body = gzip.compress(file.read_bytes(), compresslevel=6, mtime=0)
            if len(_gzip_cache) > 256:  # a rebuilt interface leaves old entries behind; start over rather than grow
                _gzip_cache.clear()
            _gzip_cache[key] = body
        media_type = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
        return Response(body, media_type=media_type, headers={"Content-Encoding": "gzip", "Vary": "Accept-Encoding", "Cache-Control": cache_control})
    return FileResponse(file, headers={"Cache-Control": cache_control, "Vary": "Accept-Encoding"})


app = create_app()
