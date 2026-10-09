"""
API routers package.
"""

from app.api.system import router as system_router
from app.api.documents import router as documents_router
from app.api.verification import router as verification_router
from app.api.demo import router as demo_router
from app.api.evidence import router as evidence_router
from app.api.review import router as review_router

__all__ = [
    "system_router",
    "documents_router",
    "verification_router",
    "demo_router",
    "evidence_router",
    "review_router",
]

