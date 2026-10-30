"""
Application logging configuration.

Structured logging (text or JSON) with request context, and masking of credentials so tokens, API keys
and database passwords are never written to log outputs.
"""

import logging
import sys

from app.config import settings
from app.observability.logging_setup import ContextFilter, make_formatter


def setup_logger(name: str = "verifin") -> logging.Logger:
    """Configures and returns a logger instance with formatted output."""
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(make_formatter(settings.log_format))
        handler.addFilter(ContextFilter())
        logger.addHandler(handler)
        logger.propagate = False

    level = logging.DEBUG if settings.debug else logging.INFO
    logger.setLevel(level)
    return logger


logger = setup_logger("verifin")
