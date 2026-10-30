"""
Authentication, user management and API keys.

* ``POST /auth/register`` creates a new organisation (tenant) with its first admin, when registration is open.
* ``POST /auth/login`` exchanges email and password for a short-lived access token.
* Admins manage the users of their own tenant; analysts and admins manage API keys.
"""

from __future__ import annotations

import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, field_validator

from app.config import settings
from app.models.api_key import ApiKeyModel
from app.models.user import UserModel
from app.repositories.api_key_repository import ApiKeyRepository
from app.repositories.user_repository import UserRepository
from app.services.audit_service import audit
from app.security.passwords import DUMMY_HASH, hash_password, verify_password
from app.security.principal import ANONYMOUS, ROLE_RANK, Principal, get_principal, hash_api_key, require_role
from app.security.tokens import create_access_token
from app.utils.logging import logger

router = APIRouter(prefix="/auth", tags=["Authentication"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_PASSWORD_LENGTH = 128  # bounds the cost of hashing attacker-supplied input


# ── Schemas ──────────────────────────────────────────────────────────────────


class Credentials(BaseModel):
    email: str
    password: str = Field(..., max_length=MAX_PASSWORD_LENGTH)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v) or len(v) > 254:
            raise ValueError("A valid email address is required.")
        return v


class RegisterRequest(Credentials):
    name: Optional[str] = Field(default=None, max_length=120)


class CreateUserRequest(Credentials):
    name: Optional[str] = Field(default=None, max_length=120)
    role: str = "analyst"


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    tenant_id: str
    role: str
    is_active: bool
    created_at: datetime

    @classmethod
    def of(cls, user: UserModel) -> "UserResponse":
        return cls(id=user.id, email=user.email, name=user.name, tenant_id=user.tenant_id,
                   role=user.role, is_active=user.is_active, created_at=user.created_at)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class CreateApiKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    role: str = "analyst"
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=3650)


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    prefix: str
    role: str
    is_active: bool
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    created_at: datetime


class CreatedApiKeyResponse(ApiKeyResponse):
    key: str = Field(..., description="Shown once. Store it securely; it cannot be retrieved again.")


# ── Helpers ──────────────────────────────────────────────────────────────────


def _check_password_strength(password: str) -> None:
    if len(password) < settings.min_password_length:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Password must be at least {settings.min_password_length} characters.",
        )


def _check_role(role: str) -> None:
    if role not in ROLE_RANK:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Role must be one of: {', '.join(ROLE_RANK)}.",
        )


def _require_real_account(principal: Principal) -> None:
    if principal is ANONYMOUS or principal.auth_method == "none":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication is disabled on this server (AUTH_ENABLED=false).",
        )


def _key_response(k: ApiKeyModel) -> ApiKeyResponse:
    return ApiKeyResponse(id=k.id, name=k.name, prefix=k.prefix, role=k.role, is_active=k.is_active,
                          expires_at=k.expires_at, last_used_at=k.last_used_at, created_at=k.created_at)


async def _new_user(email: str, password: str, name: Optional[str], tenant_id: str, role: str) -> UserModel:
    repo = UserRepository()
    if await repo.get_user_by_email(email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    password_hash = await run_in_threadpool(hash_password, password)
    user = UserModel(id=str(uuid.uuid4()), email=email, name=name, tenant_id=tenant_id, role=role,
                     password_hash=password_hash)
    await repo.create_user(user)
    return user


def _token_response(user: UserModel) -> TokenResponse:
    token = create_access_token(user.id, user.tenant_id, user.role)
    return TokenResponse(access_token=token, expires_in=settings.access_token_ttl_minutes * 60,
                         user=UserResponse.of(user))


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> TokenResponse:
    """Creates a new organisation and its first admin. Disabled when ``ALLOW_REGISTRATION=false``."""
    if not settings.allow_registration:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Self-service registration is disabled.")
    _check_password_strength(body.password)
    user = await _new_user(body.email, body.password, body.name, tenant_id=str(uuid.uuid4()), role="admin")
    logger.info(f"Registered new tenant {user.tenant_id} with admin {user.id}")
    await audit.record("auth.register", tenant_id=user.tenant_id, actor_id=user.id, actor_email=user.email,
                       actor_role=user.role, resource_type="user", resource_id=user.id)
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
async def login(body: Credentials) -> TokenResponse:
    repo = UserRepository()
    user = await repo.get_user_by_email(body.email)
    stored = user.password_hash if user and user.password_hash else DUMMY_HASH
    valid = await run_in_threadpool(verify_password, body.password, stored)
    if not (user and valid and user.is_active):
        await audit.record(
            "auth.login", tenant_id=user.tenant_id if user else "_unscoped", outcome="denied",
            actor_id=user.id if user else "unknown", actor_email=user.email if user else None,
            details={"reason": "inactive" if user and valid else "bad_credentials"},
        )
        # same response for unknown email, wrong password and disabled account
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    await repo.update_user(user.id, {"last_login_at": datetime.now(timezone.utc)})
    await audit.record("auth.login", tenant_id=user.tenant_id, actor_id=user.id, actor_email=user.email,
                       actor_role=user.role, resource_type="user", resource_id=user.id)
    return _token_response(user)


@router.get("/me", response_model=UserResponse)
async def me(principal: Principal = Depends(get_principal)) -> UserResponse:
    if principal.auth_method == "none":
        return UserResponse(id=principal.user_id, email="anonymous@local", name="Anonymous (auth disabled)",
                            tenant_id=principal.tenant_id, role=principal.role, is_active=True,
                            created_at=datetime.now(timezone.utc))
    user = await UserRepository().get_user_by_id(principal.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return UserResponse.of(user)


@router.get("/users", response_model=List[UserResponse])
async def list_users(principal: Principal = Depends(require_role("admin"))) -> List[UserResponse]:
    _require_real_account(principal)
    return [UserResponse.of(u) for u in await UserRepository().list_users_by_tenant(principal.tenant_id)]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(body: CreateUserRequest, principal: Principal = Depends(require_role("admin"))) -> UserResponse:
    """An admin adds a user to their own organisation."""
    _require_real_account(principal)
    _check_role(body.role)
    _check_password_strength(body.password)
    user = await _new_user(body.email, body.password, body.name, tenant_id=principal.tenant_id, role=body.role)
    logger.info(f"Admin {principal.user_id} created user {user.id} ({user.role}) in tenant {principal.tenant_id}")
    await audit.record_for(principal, "user.create", resource_type="user", resource_id=user.id,
                           details={"role": user.role, "email": user.email})
    return UserResponse.of(user)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str, body: UpdateUserRequest, principal: Principal = Depends(require_role("admin"))
) -> UserResponse:
    _require_real_account(principal)
    repo = UserRepository()
    user = await repo.get_user_by_id(user_id)
    if user is None or user.tenant_id != principal.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if user.id == principal.user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Admins cannot change their own role or deactivate themselves.")
    fields = {}
    if body.role is not None:
        _check_role(body.role)
        fields["role"] = body.role
    if body.is_active is not None:
        fields["is_active"] = body.is_active
    if fields:
        await repo.update_user(user.id, fields)
        logger.info(f"Admin {principal.user_id} updated user {user.id}: {sorted(fields)}")
        await audit.record_for(principal, "user.update", resource_type="user", resource_id=user.id,
                               details={"changed": {k: v for k, v in fields.items()}})
    return UserResponse.of(await repo.get_user_by_id(user.id))


@router.get("/api-keys", response_model=List[ApiKeyResponse])
async def list_api_keys(principal: Principal = Depends(require_role("analyst"))) -> List[ApiKeyResponse]:
    """Admins see every key of the tenant; others see their own."""
    _require_real_account(principal)
    owner = None if principal.has_role("admin") else principal.user_id
    return [_key_response(k) for k in await ApiKeyRepository().list_for_tenant(principal.tenant_id, owner)]


@router.post("/api-keys", response_model=CreatedApiKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    body: CreateApiKeyRequest, principal: Principal = Depends(require_role("analyst"))
) -> CreatedApiKeyResponse:
    _require_real_account(principal)
    _check_role(body.role)
    if ROLE_RANK[body.role] > ROLE_RANK[principal.role]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="A key cannot have more access than its creator.")
    raw = "vfn_" + secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=body.expires_in_days) if body.expires_in_days else None
    record = ApiKeyModel(id=str(uuid.uuid4()), tenant_id=principal.tenant_id, user_id=principal.user_id,
                         name=body.name, prefix=raw[:8], key_hash=hash_api_key(raw), role=body.role, expires_at=expires)
    await ApiKeyRepository().create(record)
    logger.info(f"User {principal.user_id} created API key {record.id} ({record.role})")
    await audit.record_for(principal, "api_key.create", resource_type="api_key", resource_id=record.id,
                           details={"name": record.name, "role": record.role, "prefix": record.prefix})
    return CreatedApiKeyResponse(**_key_response(record).model_dump(), key=raw)


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(key_id: str, principal: Principal = Depends(require_role("analyst"))) -> None:
    _require_real_account(principal)
    repo = ApiKeyRepository()
    key = await repo.get(key_id)
    allowed = key is not None and key.tenant_id == principal.tenant_id and (
        principal.has_role("admin") or key.user_id == principal.user_id
    )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found.")
    await repo.revoke(key_id)
    logger.info(f"User {principal.user_id} revoked API key {key_id}")
    await audit.record_for(principal, "api_key.revoke", resource_type="api_key", resource_id=key_id)
