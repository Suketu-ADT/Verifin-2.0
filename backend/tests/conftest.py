import pytest

from app.security.rate_limit import limiter


@pytest.fixture(autouse=True)
def _fresh_rate_limiter():
    """Each test starts with an empty rate-limit window."""
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture(autouse=True)
def _no_email_codes_by_default(monkeypatch):
    """Most tests create accounts through /auth/register with a password only. Emailed codes (which registration then
    requires) are switched on explicitly by the tests that exercise them (tests/test_signin_methods.py)."""
    from app.config import settings

    monkeypatch.setattr(settings, "email_otp_enabled", False)
