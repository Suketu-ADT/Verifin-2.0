"""
Log formatting: plain text for development, one JSON object per line for production.

Every record carries the request, trace, tenant and user identifiers of the request being served, and
credentials that reach a log message are masked.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone

from app.observability.context import request_id_var, tenant_id_var, trace_id_var, user_id_var

_SECRET_PATTERNS = (
    (re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._~+/=-]{8,}"), r"\1[redacted]"),
    (re.compile(r"\bvfn_[A-Za-z0-9_-]{8,}"), "vfn_[redacted]"),
    (re.compile(r"(?i)((?:password|secret|token|api[_-]?key|authorization)[\"']?\s*[:=]\s*[\"']?)[^\s\"',}]{4,}"),
     r"\1[redacted]"),
    (re.compile(r"(mongodb(?:\+srv)?://[^:/\s]+:)[^@\s]+@"), r"\1[redacted]@"),
)


def redact(text: str) -> str:
    for pattern, replacement in _SECRET_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


class ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        record.trace_id = trace_id_var.get()
        record.tenant_id = tenant_id_var.get()
        record.user_id = user_id_var.get()
        record.msg = redact(record.getMessage())
        record.args = ()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": datetime.fromtimestamp(record.created, timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
            "trace_id": getattr(record, "trace_id", "-"),
            "tenant_id": getattr(record, "tenant_id", "-"),
            "user_id": getattr(record, "user_id", "-"),
        }
        extra = getattr(record, "fields", None)
        if extra:
            entry.update(extra)
        if record.exc_info:
            entry["exception"] = redact(self.formatException(record.exc_info))
        return json.dumps(entry, ensure_ascii=False, default=str)


TEXT_FORMAT = "%(asctime)s [%(levelname)s] [%(name)s] [%(request_id)s] %(message)s"


def make_formatter(style: str) -> logging.Formatter:
    if style == "json":
        return JsonFormatter()
    return logging.Formatter(TEXT_FORMAT, datefmt="%Y-%m-%d %H:%M:%S")
