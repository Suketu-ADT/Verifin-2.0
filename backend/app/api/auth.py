"""
Authentication, user management and API keys.

* ``POST /auth/register`` creates a new organisation (tenant) with its first admin, when registration is open.
* ``POST /auth/login`` exchanges email and password for a short-lived access token.
* ``POST /auth/google`` and ``POST /auth/otp/request`` + ``/otp/verify`` do the same with a Google account or an emailed code.
  Both create the account (a new organisation with the person as its admin) when registration is open and the address is new.
* Admins manage the users of their own tenant; analysts and admins manage API keys.
"""

from __future__ import annotations

import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, field_validator

from app.config import settings
from app.models.api_key import ApiKeyModel
from app.models.user import UserModel
from app.repositories.api_key_repository import ApiKeyRepository
from app.repositories.otp_repository import OtpRepository
from app.repositories.user_repository import UserRepository
from app.services.audit_service import audit
from app.services.mailer import send_email, smtp_configured
from app.services.signin import GoogleTokenError, code_matches, hash_code, new_code, verify_google_credential
from app.security.passwords import DUMMY_HASH, hash_password, verify_password
from app.security.principal import ANONYMOUS, ROLE_RANK, Principal, get_principal, hash_api_key, require_role
from app.security.rate_limit import SlidingWindowLimiter
from app.security.tokens import create_access_token
from app.utils.logging import logger

router = APIRouter(prefix="/auth", tags=["Authentication"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_PASSWORD_LENGTH = 128  # bounds the cost of hashing attacker-supplied input


# ── Schemas ──────────────────────────────────────────────────────────────────


class EmailRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v) or len(v) > 254:
            raise ValueError("A valid email address is required.")
        return v


class Credentials(EmailRequest):
    password: str = Field(..., max_length=MAX_PASSWORD_LENGTH)


class OtpVerifyRequest(EmailRequest):
    code: str = Field(..., min_length=4, max_length=12)
    name: Optional[str] = Field(default=None, max_length=120)  # used only when the code creates a new account


class GoogleLoginRequest(BaseModel):
    credential: str = Field(..., min_length=20, max_length=4096)  # the ID token from Google Identity Services


class AuthOptions(BaseModel):
    """What the sign-in page may offer on this server."""

    password: bool = True
    google_client_id: Optional[str] = None
    email_otp: bool = False
    registration: bool = True


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


def _otp_available() -> bool:
    """Codes need a way to reach the person. Without SMTP they only go to the log, which is never acceptable in production."""
    return settings.email_otp_enabled and (smtp_configured() or settings.environment.lower() != "production")


# Per-address limits on codes. Shared across all addresses on purpose, known or not, so they say nothing about who has an account.
_otp_gap = SlidingWindowLimiter()
_otp_hourly = SlidingWindowLimiter(window=3600.0)


def reset_otp_limits() -> None:
    _otp_gap.reset()
    _otp_hourly.reset()


def _deliver_code(email: str, code: str) -> None:
    subject = "Your VERIFIN sign-in code"
    body = (f"Your VERIFIN sign-in code is {code}.\n\nIt works once and expires in {settings.otp_ttl_minutes} minutes. "
            "If you did not ask for it, you can ignore this email.")
    if smtp_configured():
        send_email(email, subject, body)
    else:  # development only: _otp_available() refuses this branch in production
        logger.warning(f"[development] sign-in code for {email}: {code} (SMTP is not configured, so nothing was emailed)")


def _as_utc(value) -> datetime:
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def _sign_in_verified_email(email: str, name: Optional[str], method: str, google_id: Optional[str] = None) -> UserModel:
    """Log in (or, when registration is open, create) the account for an address whose owner just proved it."""
    repo = UserRepository()
    user = await repo.get_user_by_email(email)
    if user is None:
        if not settings.allow_registration:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Self-service registration is disabled.")
        user = UserModel(id=str(uuid.uuid4()), email=email, name=name or email.split("@")[0], tenant_id=str(uuid.uuid4()),
                         role="admin", google_id=google_id, email_verified=True, last_login_at=datetime.now(timezone.utc))
        await repo.create_user(user)
        logger.info(f"Registered new tenant {user.tenant_id} with admin {user.id} via {method}")
        await audit.record("auth.register", tenant_id=user.tenant_id, actor_id=user.id, actor_email=user.email,
                           actor_role=user.role, resource_type="user", resource_id=user.id, details={"method": method})
        return user
    if not user.is_active or (google_id and user.google_id and user.google_id != google_id):
        await audit.record("auth.login", tenant_id=user.tenant_id, outcome="denied", actor_id=user.id, actor_email=user.email,
                           details={"method": method, "reason": "inactive" if not user.is_active else "google_account_mismatch"})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="This account cannot sign in.")
    fields = {"last_login_at": datetime.now(timezone.utc), "email_verified": True}
    if google_id and not user.google_id:
        fields["google_id"] = google_id
    await repo.update_user(user.id, fields)
    await audit.record("auth.login", tenant_id=user.tenant_id, actor_id=user.id, actor_email=user.email,
                       actor_role=user.role, resource_type="user", resource_id=user.id, details={"method": method})
    return await repo.get_user_by_id(user.id)


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


@router.get("/options", response_model=AuthOptions)
async def auth_options() -> AuthOptions:
    """Public: which sign-in methods this server offers, so the page shows only the working ones."""
    return AuthOptions(google_client_id=settings.google_client_id or None, email_otp=_otp_available(),
                       registration=settings.allow_registration)


@router.post("/otp/request", status_code=status.HTTP_202_ACCEPTED)
async def otp_request(body: EmailRequest, background: BackgroundTasks) -> dict:
    """Emails a one-time code. The answer is the same whether or not the address has an account."""
    if not _otp_available():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Email codes are not available on this server.")
    _otp_gap.window = float(settings.otp_resend_seconds)
    for limiter, limit in ((_otp_gap, 1), (_otp_hourly, settings.otp_max_per_hour)):
        allowed, _, retry = limiter.check(body.email, limit)
        if not allowed:
            seconds = max(1, int(retry) + 1)
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=f"A code was sent recently. Try again in {seconds}s.",
                                headers={"Retry-After": str(seconds)})
    user = await UserRepository().get_user_by_email(body.email)
    if (user and user.is_active) or (user is None and settings.allow_registration):
        code = new_code()
        expires = datetime.now(timezone.utc) + timedelta(minutes=settings.otp_ttl_minutes)
        await OtpRepository().save(body.email, hash_code(body.email, code), expires)
        background.add_task(_deliver_code, body.email, code)
    return {"detail": "If this address can sign in, a code is on its way.", "resend_after_seconds": settings.otp_resend_seconds}


@router.post("/otp/verify", response_model=TokenResponse)
async def otp_verify(body: OtpVerifyRequest) -> TokenResponse:
    repo = OtpRepository()
    rejected = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="That code is not valid or has expired.")
    challenge = await repo.get(body.email)
    if challenge is None:
        raise rejected
    if _as_utc(challenge["expires_at"]) <= datetime.now(timezone.utc) or int(challenge.get("attempts", 0)) >= settings.otp_max_attempts:
        await repo.delete(body.email)
        raise rejected
    if not code_matches(body.email, body.code.strip(), challenge["code_hash"]):
        if await repo.record_failure(body.email) >= settings.otp_max_attempts:
            await repo.delete(body.email)  # too many wrong guesses: the code is gone, ask for a new one
        await audit.record("auth.login", tenant_id="_unscoped", outcome="denied", actor_id="unknown", actor_email=body.email,
                           details={"method": "otp", "reason": "bad_code"})
        raise rejected
    await repo.delete(body.email)  # a code works once
    return _token_response(await _sign_in_verified_email(body.email, body.name, "otp"))


@router.post("/google", response_model=TokenResponse)
async def google_login(body: GoogleLoginRequest) -> TokenResponse:
    """Signs in with the ID token Google gave the browser. The token is verified here before anything is trusted."""
    if not settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google sign-in is not configured on this server.")
    try:
        claims = await run_in_threadpool(verify_google_credential, body.credential)
    except GoogleTokenError as exc:
        await audit.record("auth.login", tenant_id="_unscoped", outcome="denied", actor_id="unknown",
                           details={"method": "google", "reason": "invalid_token"})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = await _sign_in_verified_email(str(claims["email"]).strip().lower(), claims.get("name"), "google", google_id=str(claims["sub"]))
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
