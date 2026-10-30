"""Per-request identifiers, carried with context variables so every log line can include them."""

from __future__ import annotations

from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
trace_id_var: ContextVar[str] = ContextVar("trace_id", default="-")
tenant_id_var: ContextVar[str] = ContextVar("tenant_id", default="-")
user_id_var: ContextVar[str] = ContextVar("user_id", default="-")
