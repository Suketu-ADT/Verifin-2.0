"""
Request context, access logging, metrics and response headers (pure ASGI, so context variables and
streaming responses behave).

* ``X-Request-ID`` is accepted from the caller when it is well formed, otherwise generated, and echoed back.
* W3C ``traceparent`` is propagated: an incoming trace id is kept and this service answers with its own span,
  so a request can be followed across services. No exporter is bundled; logs and the response header carry
  the identifiers.
"""

from __future__ import annotations

import re
import secrets
import time
import uuid
from typing import Dict, Optional, Tuple

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import settings
from app.observability import metrics
from app.observability.context import request_id_var, tenant_id_var, trace_id_var, user_id_var
from app.utils.logging import logger

_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{8,64}$")
_TRACEPARENT_RE = re.compile(r"^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$")
QUIET_PATHS = ("/metrics", "/system/live", "/system/ready")


def parse_traceparent(value: Optional[str]) -> Optional[Tuple[str, str]]:
    match = _TRACEPARENT_RE.match((value or "").strip().lower())
    if not match or match.group(1) == "0" * 32 or match.group(2) == "0" * 16:
        return None
    return match.group(1), match.group(3)


def route_template(scope: Scope) -> str:
    """The matched route with path parameters shown as {name}, so labels never contain ids."""
    if scope.get("route") is None:
        return "unmatched"
    segments = scope["path"].split("/")
    for name, value in (scope.get("path_params") or {}).items():
        for i in range(len(segments) - 1, -1, -1):  # parameters sit at the end of the path
            if segments[i] == str(value):
                segments[i] = "{" + name + "}"
                break
    return "/".join(segments)


class ObservabilityMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers: Dict[str, str] = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
        request_id = headers.get("x-request-id", "")
        request_id = request_id if _REQUEST_ID_RE.match(request_id) else uuid.uuid4().hex
        incoming = parse_traceparent(headers.get("traceparent"))
        trace_id = incoming[0] if incoming else secrets.token_hex(16)
        flags = incoming[1] if incoming else "01"
        span_id = secrets.token_hex(8)

        tokens = [
            request_id_var.set(request_id), trace_id_var.set(trace_id),
            tenant_id_var.set("-"), user_id_var.set("-"),
        ]
        path = scope["path"]
        legacy = path.startswith("/api/") and not path.startswith("/api/v1/")
        started = time.perf_counter()
        status_code = 500
        metrics.HTTP_IN_FLIGHT.inc()

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                out = list(message.get("headers", []))
                out += [
                    (b"x-request-id", request_id.encode()),
                    (b"traceparent", f"00-{trace_id}-{span_id}-{flags}".encode()),
                    (b"x-api-version", b"1"),
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"no-referrer"),
                ]
                if settings.environment.lower() == "production":
                    out.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
                if legacy:
                    out += [(b"deprecation", b"true"), (b"link", b'</api/v1>; rel="successor-version"')]
                message = {**message, "headers": out}
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            elapsed = time.perf_counter() - started
            template = route_template(scope)
            metrics.HTTP_IN_FLIGHT.dec()
            metrics.HTTP_REQUESTS.labels(scope["method"], template, str(status_code)).inc()
            metrics.HTTP_LATENCY.labels(scope["method"], template).observe(elapsed)

            principal = getattr(scope.get("state", {}), "get", lambda *_: None)("principal")
            if principal is not None:
                tenant_id_var.set(principal.tenant_id)
                user_id_var.set(principal.user_id)
            if not path.endswith(QUIET_PATHS):
                logger.info(
                    f"{scope['method']} {path} -> {status_code} in {elapsed * 1000:.0f} ms",
                    extra={"fields": {"method": scope["method"], "route": template, "status": status_code,
                                      "duration_ms": round(elapsed * 1000, 1)}},
                )
            for var, token in zip((request_id_var, trace_id_var, tenant_id_var, user_id_var), tokens):
                var.reset(token)
