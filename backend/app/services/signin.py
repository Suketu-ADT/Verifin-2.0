"""
Helpers for signing in without a password: email one-time codes and Google ID tokens.

Codes are random digits, stored only as an HMAC keyed by the server secret and bound to the address, so a database leak does not
reveal pending codes and a code cannot be replayed for a different address. Google tokens are verified here (signature against
Google's published keys, issuer, audience, expiry, verified email), never trusted as sent by the browser.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Any, Dict

import jwt

from app.config import settings

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"]

_jwks_client = jwt.PyJWKClient(GOOGLE_JWKS_URL, cache_keys=True, lifespan=3600, timeout=10)


class GoogleTokenError(ValueError):
    """The Google credential is not valid for this application."""


def new_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(settings.otp_length))


def hash_code(email: str, code: str) -> str:
    return hmac.new(settings.jwt_secret.encode(), f"otp:{email}:{code}".encode(), hashlib.sha256).hexdigest()


def code_matches(email: str, code: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_code(email, code), stored_hash)


def _google_signing_key(credential: str):
    """Google's public key for this token. Fetched (and cached) from Google; a separate function so tests can replace it."""
    return _jwks_client.get_signing_key_from_jwt(credential).key


def verify_google_credential(credential: str) -> Dict[str, Any]:
    """Return the verified claims of a Google ID token, or raise GoogleTokenError."""
    if not settings.google_client_id:
        raise GoogleTokenError("Google sign-in is not configured.")
    try:
        claims = jwt.decode(
            credential,
            _google_signing_key(credential),
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=GOOGLE_ISSUERS,
            leeway=10,  # seconds of clock difference tolerated
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
    except (jwt.PyJWTError, OSError) as exc:
        raise GoogleTokenError("The Google credential could not be verified.") from exc
    if not claims.get("email") or claims.get("email_verified") is not True:
        raise GoogleTokenError("Your Google account has no verified email address.")
    return claims
