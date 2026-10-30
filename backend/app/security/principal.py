"""
Who is calling, and what they may do.

Credentials are a Bearer access token or an ``X-API-Key`` header. When ``AUTH_ENABLED`` is false (local
development only) every caller is the anonymous admin of the shared ``public`` tenant.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Optional

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.observability import metrics
from app.repositories.api_key_repository import ApiKeyRepository
from app.repositories.user_repository import UserRepository
from app.security.tokens import decode_access_token

ROLE_RANK = {"viewer": 1, "analyst": 2, "admin": 3}
ROLES = tuple(ROLE_RANK)

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    user_id: str
    tenant_id: str
    role: str
    auth_method: str  # "jwt", "api_key" or "none"
    email: Optional[str] = None

    def has_role(self, minimum: str) -> bool:
        return ROLE_RANK.get(self.role, 0) >= ROLE_RANK[minimum]


ANONYMOUS = Principal(user_id="anonymous", tenant_id="public", role="admin", auth_method="none")


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def _unauthorized(detail: str = "Authentication required.") -> HTTPException:
    metrics.AUTH_FAILURES.labels("missing" if detail == "Authentication required." else "invalid").inc()
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def _principal_from_api_key(raw_key: str) -> Principal:
    repo = ApiKeyRepository()
    record = await repo.get_by_hash(hash_api_key(raw_key))
    if record is None or not record.is_active:
        raise _unauthorized("Invalid API key.")
    if record.expires_at is not None:
        expires = record.expires_at if record.expires_at.tzinfo else record.expires_at.replace(tzinfo=timezone.utc)
        if expires <= datetime.now(timezone.utc):
            raise _unauthorized("API key has expired.")
    owner = await UserRepository().get_user_by_id(record.user_id)
    if owner is None or not owner.is_active or owner.tenant_id != record.tenant_id:
        raise _unauthorized("Invalid API key.")  # the key's owner was removed or deactivated
    try:
        await repo.touch(record.id)
    except Exception:  # usage tracking must never fail a request
        pass
    # a key can never exceed its owner's current role
    role = record.role if ROLE_RANK[record.role] <= ROLE_RANK[owner.role] else owner.role
    return Principal(user_id=owner.id, tenant_id=record.tenant_id, role=role, auth_method="api_key", email=owner.email)


async def _principal_from_token(token: str) -> Principal:
    try:
        claims = decode_access_token(token)
    except jwt.PyJWTError:
        raise _unauthorized("Invalid or expired token.")
    user = await UserRepository().get_user_by_id(claims["sub"])
    if user is None or not user.is_active:
        raise _unauthorized("Account is disabled or no longer exists.")
    # role and tenant come from the database, so a role change or deactivation applies immediately
    return Principal(user_id=user.id, tenant_id=user.tenant_id, role=user.role, auth_method="jwt", email=user.email)


async def get_principal(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Principal:
    if not settings.auth_enabled:
        principal = ANONYMOUS
    else:
        api_key = request.headers.get("x-api-key")
        if api_key:
            principal = await _principal_from_api_key(api_key.strip())
        elif credentials is not None and credentials.scheme.lower() == "bearer":
            principal = await _principal_from_token(credentials.credentials)
        else:
            raise _unauthorized()
    request.state.principal = principal
    return principal


def require_role(minimum: str) -> Callable[..., Principal]:
    """Dependency factory: the caller must hold at least ``minimum`` (viewer < analyst < admin)."""
    if minimum not in ROLE_RANK:
        raise ValueError(f"unknown role '{minimum}'")

    async def dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if not principal.has_role(minimum):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires the '{minimum}' role.",
            )
        return principal

    return dependency
