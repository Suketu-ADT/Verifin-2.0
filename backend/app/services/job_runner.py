"""
In-process runner for verification jobs.

A job is a verification session stored as ``queued`` and executed by a bounded pool of workers, so a long
verification neither holds an HTTP request open nor lets unlimited jobs compete for the CPU. State lives in the
database (queued -> running -> completed | failed); a worker that dies with its process leaves a session that
``recover_orphans`` marks failed at the next start. Scaling beyond one instance means replacing this module
with an external queue; the API contract (202 + status URL) does not change.
"""

from __future__ import annotations

import asyncio
from typing import Callable, Optional, Set

from app.config import settings
from app.observability import metrics
from app.repositories.verification_repository import VerificationRepository
from app.schemas.verification import StartVerificationRequest
from app.services.verification_service import VerificationService
from app.utils.logging import logger


class QueueFull(Exception):
    """The instance already holds ``job_queue_limit`` waiting jobs."""


class JobRunner:
    def __init__(self, service_factory: Callable[[], VerificationService] = VerificationService):
        self._service_factory = service_factory
        self._slots: Optional[asyncio.Semaphore] = None
        self._tasks: Set[asyncio.Task] = set()
        self._waiting = 0

    @property
    def waiting(self) -> int:
        return self._waiting

    @property
    def running(self) -> int:
        return len(self._tasks) - self._waiting

    def _semaphore(self) -> asyncio.Semaphore:
        if self._slots is None:  # created lazily so it binds to the running event loop
            self._slots = asyncio.Semaphore(max(1, settings.max_concurrent_jobs))
        return self._slots

    def submit(self, session_id: str, request: StartVerificationRequest, user_id: Optional[str], tenant_id: str) -> None:
        if self._waiting >= settings.job_queue_limit:
            raise QueueFull()
        self._waiting += 1
        metrics.JOBS_QUEUED.set(self._waiting)
        task = asyncio.create_task(self._run(session_id, request, user_id, tenant_id), name=f"verify-{session_id}")
        self._tasks.add(task)  # a strong reference: the loop only keeps weak ones
        task.add_done_callback(self._tasks.discard)

    async def _run(self, session_id: str, request: StartVerificationRequest, user_id: Optional[str], tenant_id: str) -> None:
        repo = VerificationRepository()
        async with self._semaphore():
            self._waiting -= 1
            metrics.JOBS_QUEUED.set(self._waiting)
            metrics.JOBS_RUNNING.inc()
            try:
                await repo.set_status(session_id, "running")
                await self._service_factory().start_verification_session(
                    request, user_id=user_id, tenant_id=tenant_id, session_id=session_id
                )
                metrics.JOBS.labels("completed").inc()
            except asyncio.CancelledError:
                await self._mark_failed(repo, session_id, "Cancelled: the service was shutting down.")
                metrics.JOBS.labels("cancelled").inc()
                raise
            except Exception as exc:
                logger.error(f"Verification job {session_id} failed: {exc}")
                detail = getattr(exc, "detail", None) or str(exc) or exc.__class__.__name__
                await self._mark_failed(repo, session_id, str(detail)[:500])
                metrics.JOBS.labels("failed").inc()
            finally:
                metrics.JOBS_RUNNING.dec()

    @staticmethod
    async def _mark_failed(repo: VerificationRepository, session_id: str, reason: str) -> None:
        try:
            await repo.set_status(session_id, "failed", reason)
        except Exception as exc:  # the database being down is why we could not record it
            logger.error(f"Could not record failure of job {session_id}: {exc}")

    async def recover_orphans(self) -> int:
        try:
            count = await VerificationRepository().fail_unfinished("Interrupted: the service restarted before this job finished.")
        except Exception as exc:
            logger.warning(f"Skipping job recovery: {exc}")
            return 0
        if count:
            logger.warning(f"Marked {count} interrupted verification job(s) as failed.")
        return count

    async def shutdown(self, grace_seconds: float = 10.0) -> None:
        """Lets running jobs finish for a short grace period, then cancels what is left."""
        if not self._tasks:
            return
        _, pending = await asyncio.wait(set(self._tasks), timeout=grace_seconds)
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)


job_runner = JobRunner()
