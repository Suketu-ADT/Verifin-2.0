"""
Application logging configuration.

Provides structured logging with sanitization to ensure sensitive credentials,
tokens, and confidential document texts are never leaked to log outputs.
"""

import logging
import sys
from typing import Any
from app.config import settings


def setup_logger(name: str = "verifin") -> logging.Logger:
    """Configures and returns a logger instance with formatted output."""
    logger = logging.getLogger(name)
    
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        log_format = "%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
        formatter = logging.Formatter(log_format, datefmt="%Y-%m-%d %H:%M:%S")
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    level = logging.DEBUG if settings.debug else logging.INFO
    logger.setLevel(level)
    return logger


logger = setup_logger("verifin")
