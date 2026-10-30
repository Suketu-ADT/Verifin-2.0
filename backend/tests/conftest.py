import pytest

from app.security.rate_limit import limiter


@pytest.fixture(autouse=True)
def _fresh_rate_limiter():
    """Each test starts with an empty rate-limit window."""
    limiter.reset()
    yield
    limiter.reset()
