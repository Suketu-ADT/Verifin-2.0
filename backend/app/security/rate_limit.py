"""
Rate limiting with an in-memory sliding window.

State is per process: behind several instances each applies its own limit, so the effective limit grows with
the instance count. For a shared limit, put the same rules in the gateway or back this class with Redis.

* ``RateLimitMiddleware`` limits every client address, with a stricter limit on login and registration.
* ``limit_heavy`` is a dependency for expensive endpoints (uploads, verification, LLM calls), keyed by the
  authenticated principal so one user cannot use up the whole instance.
"""

from __future__ import annotations

import math
import time
from collections import deque
from typing import Deque, Dict, Optional, Tuple

from fastapi import Depends, HTTPException, Request, status
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings
from app.observability import metrics
from app.security.principal import Principal, get_principal

WINDOW_SECONDS = 60.0
MAX_TRACKED_KEYS = 50_000


class SlidingWindowLimiter:
    def __init__(self, window: float = WINDOW_SECONDS):
        self.window = window
        self._hits: Dict[str, Deque[float]] = {}

    def check(self, key: str, limit: int, now: Optional[float] = None) -> Tuple[bool, int, float]:
        """Record a hit. Returns (allowed, remaining, seconds until a slot frees up)."""
        now = time.monotonic() if now is None else now
        hits = self._hits.setdefault(key, deque())
        cutoff = now - self.window
        while hits and hits[0] <= cutoff:
            hits.popleft()
        if len(hits) >= limit:
            return False, 0, max(0.0, hits[0] + self.window - now)
        hits.append(now)
        if len(self._hits) > MAX_TRACKED_KEYS:
            self._evict(cutoff)
        return True, limit - len(hits), 0.0

    def _evict(self, cutoff: float) -> None:
        for key in [k for k, h in self._hits.items() if not h or h[-1] <= cutoff]:
            del self._hits[key]

    def reset(self) -> None:
        self._hits.clear()


limiter = SlidingWindowLimiter()


def client_address(scope: Scope) -> str:
    """Peer address. Forwarded headers are only believed when the deployment sits behind a trusted proxy."""
    if settings.trust_proxy_headers:
        for name, value in scope.get("headers", []):
            if name == b"x-forwarded-for":
                return value.decode("latin-1").split(",")[0].strip()
    client = scope.get("client")
    return client[0] if client else "unknown"


def _too_many(scope_name: str, limit: int, retry_after: float) -> Tuple[int, Dict[str, str], Dict[str, str]]:
    metrics.RATE_LIMITED.labels(scope_name).inc()
    seconds = max(1, math.ceil(retry_after))
    headers = {"Retry-After": str(seconds), "X-RateLimit-Limit": str(limit), "X-RateLimit-Remaining": "0"}
    return seconds, headers, {"error": "Too Many Requests", "detail": f"Rate limit exceeded. Retry in {seconds}s."}


class RateLimitMiddleware:
    EXEMPT_SUFFIXES = ("/system/live", "/system/ready")
    EXEMPT_PATHS = ("/metrics",)

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not settings.rate_limit_enabled or scope["method"] == "OPTIONS":
            await self.app(scope, receive, send)
            return
        path = scope["path"]
        if path in self.EXEMPT_PATHS or path.endswith(self.EXEMPT_SUFFIXES):
            await self.app(scope, receive, send)
            return

        address = client_address(scope)
        if path.endswith(("/auth/login", "/auth/register")):
            name, limit = "auth", settings.rate_limit_auth_per_minute
        else:
            name, limit = "client", settings.rate_limit_per_minute
        allowed, remaining, retry = limiter.check(f"{name}:{address}", limit)
        if not allowed:
            _, headers, body = _too_many(name, limit, retry)
            await JSONResponse(body, status_code=status.HTTP_429_TOO_MANY_REQUESTS, headers=headers)(scope, receive, send)
            return

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-ratelimit-limit", str(limit).encode()))
                headers.append((b"x-ratelimit-remaining", str(remaining).encode()))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)


async def limit_heavy(request: Request, principal: Principal = Depends(get_principal)) -> None:
    """Dependency for expensive endpoints: limits each principal (user, or the anonymous caller) separately."""
    if not settings.rate_limit_enabled:
        return
    limit = settings.rate_limit_heavy_per_minute
    allowed, _, retry = limiter.check(f"heavy:{principal.tenant_id}:{principal.user_id}", limit)
    if not allowed:
        seconds, headers, body = _too_many("heavy", limit, retry)
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=body["detail"], headers=headers)
