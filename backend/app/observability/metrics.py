"""Prometheus metrics. Labels are route templates and fixed vocabularies, never raw paths or ids."""

from __future__ import annotations

from prometheus_client import CONTENT_TYPE_LATEST, CollectorRegistry, Counter, Gauge, Histogram, generate_latest

registry = CollectorRegistry()

HTTP_REQUESTS = Counter(
    "verifin_http_requests_total", "HTTP requests handled", ["method", "route", "status"], registry=registry
)
HTTP_LATENCY = Histogram(
    "verifin_http_request_duration_seconds", "HTTP request latency", ["method", "route"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60), registry=registry,
)
HTTP_IN_FLIGHT = Gauge("verifin_http_requests_in_flight", "Requests currently being served", registry=registry)
RATE_LIMITED = Counter("verifin_rate_limited_total", "Requests refused by the rate limiter", ["scope"], registry=registry)
AUTH_FAILURES = Counter("verifin_auth_failures_total", "Rejected credentials", ["reason"], registry=registry)
VERIFICATIONS = Counter("verifin_verifications_total", "Completed verification sessions", ["risk"], registry=registry)
CLAIMS = Counter("verifin_claims_total", "Claims verified, by final verdict", ["verdict"], registry=registry)
VERIFICATION_SECONDS = Histogram(
    "verifin_verification_duration_seconds", "Time to verify one statement",
    buckets=(0.5, 1, 2, 5, 10, 30, 60, 120, 300), registry=registry,
)
JOBS = Counter("verifin_jobs_total", "Background verification jobs by outcome", ["outcome"], registry=registry)
JOBS_QUEUED = Gauge("verifin_jobs_queued", "Jobs waiting for a worker slot", registry=registry)
JOBS_RUNNING = Gauge("verifin_jobs_running", "Jobs currently running", registry=registry)


def render() -> tuple[bytes, str]:
    return generate_latest(registry), CONTENT_TYPE_LATEST
