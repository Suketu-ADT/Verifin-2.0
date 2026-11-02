"""
Small on-disk cache for structured LLM responses.

Fact extraction sends the same document text to the same model with the same instructions every time a document is re-verified or
re-extracted, and each call costs seconds and provider credits. The cache keys a response by everything that determines it
(provider, model, instructions, prompt text, response schema), so any change to one of them is a miss. Entries live as one small
JSON file each, are dropped after a time limit and the oldest are removed past a count limit, so memory use stays at one response
at a time and the disk use is bounded. If the directory cannot be written the cache turns itself off and extraction carries on.
"""

from __future__ import annotations

import hashlib
import os
import threading
import time
from pathlib import Path
from typing import Optional

from app.utils.logging import logger


class ResponseCache:
    def __init__(self, directory: Path, max_entries: int = 256, ttl_seconds: int = 7 * 24 * 3600):
        self.directory = Path(directory)
        self.max_entries = max(1, max_entries)
        self.ttl_seconds = ttl_seconds
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0
        try:
            self.directory.mkdir(parents=True, exist_ok=True)
            self.enabled = True
        except OSError as exc:
            logger.warning(f"LLM response cache disabled: cannot use {self.directory} ({exc}).")
            self.enabled = False

    @staticmethod
    def make_key(provider: str, model: str, system: Optional[str], prompt: str, schema: str) -> str:
        digest = hashlib.sha256()
        for part in (provider, model, system or "", schema, prompt):
            digest.update(part.encode("utf-8"))
            digest.update(b"\x1f")  # separator, so ("ab", "c") and ("a", "bc") differ
        return digest.hexdigest()

    def _path(self, key: str) -> Path:
        return self.directory / f"{key}.json"

    def get(self, key: str) -> Optional[str]:
        if not self.enabled:
            return None
        path = self._path(key)
        try:
            if time.time() - path.stat().st_mtime > self.ttl_seconds:
                path.unlink(missing_ok=True)
                self.misses += 1
                return None
            text = path.read_text(encoding="utf-8")
        except OSError:
            self.misses += 1
            return None
        self.hits += 1
        return text

    def put(self, key: str, value: str) -> None:
        if not self.enabled:
            return
        path = self._path(key)
        tmp = path.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
        try:
            tmp.write_text(value, encoding="utf-8")
            os.replace(tmp, path)  # readers never see a half-written entry
            self._trim()
        except OSError as exc:
            logger.warning(f"LLM response cache write failed ({exc}).")
            tmp.unlink(missing_ok=True)

    def _trim(self) -> None:
        with self._lock:
            files = sorted(self.directory.glob("*.json"), key=lambda p: p.stat().st_mtime)
            for stale in files[: max(0, len(files) - self.max_entries)]:
                stale.unlink(missing_ok=True)

    def stats(self) -> dict:
        return {"enabled": self.enabled, "hits": self.hits, "misses": self.misses}


_instance: Optional[ResponseCache] = None
_instance_lock = threading.Lock()


def get_response_cache() -> Optional[ResponseCache]:
    """The shared cache, or None when caching is switched off in the settings."""
    from app.config import settings

    if not settings.llm_cache_enabled:
        return None
    global _instance
    with _instance_lock:
        if _instance is None or _instance.directory != Path(settings.llm_cache_dir or settings.data_dir / "cache" / "llm"):
            _instance = ResponseCache(
                Path(settings.llm_cache_dir or settings.data_dir / "cache" / "llm"),
                max_entries=settings.llm_cache_max_entries,
                ttl_seconds=settings.llm_cache_ttl_seconds,
            )
        return _instance
