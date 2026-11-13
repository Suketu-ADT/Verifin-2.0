"""
API routers package.
"""

from app.api.auth import router as auth_router
from app.api.system import router as system_router
from app.api.documents import router as documents_router
from app.api.verification import router as verification_router
from app.api.demo import router as demo_router
from app.api.evidence import router as evidence_router
from app.api.review import router as review_router
from app.api.audit import router as audit_router
from app.api.admin import router as admin_router
from app.api.analytics import router as analytics_router

__all__ = [
    "auth_router",
    "system_router",
    "documents_router",
    "verification_router",
    "demo_router",
    "evidence_router",
    "review_router",
    "audit_router",
    "admin_router",
    "analytics_router",
]

