"""Smoke test for a deployed VERIFIN API. Standard library only.

    python scripts/smoke_test.py https://verifin-api-xxxx-uc.a.run.app --origin https://<user>.github.io

Credentials come from SMOKE_EMAIL and SMOKE_PASSWORD. If the account does not exist and the API allows sign-up, set
SMOKE_REGISTER=1 to create it. Exit code 0 means every check passed.
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

SAMPLE = Path(__file__).resolve().parent.parent / "data" / "VERIFIN_sample_financial_report.pdf"
STATEMENT = "Apple reported total net sales of $999 billion in fiscal 2025. Cash and cash equivalents were $35 billion."

results = []


def call(base, method, path, *, body=None, headers=None, raw=None, timeout=60):
    """Return (status, headers, body bytes); HTTP errors are returned, not raised."""
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(base + path, data=data, method=method, headers=headers or {})
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()


def check(name, ok, detail=""):
    results.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f"  ({detail})" if detail and not ok else ""))
    return ok


def multipart(filename, content):
    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
        "Content-Type: application/pdf\r\n\r\n"
    ).encode() + content + f"\r\n--{boundary}--\r\n".encode()
    return body, {"Content-Type": f"multipart/form-data; boundary={boundary}"}


def wait_until_up(base, patience):
    """A scale-to-zero service needs a cold start (container start plus model loading) before it answers."""
    deadline = time.time() + patience
    while time.time() < deadline:
        try:
            status, _, _ = call(base, "GET", "/api/v1/system/live", timeout=30)
            if status == 200:
                return True
        except OSError:
            pass
        time.sleep(5)
    return False


def main():
    p = argparse.ArgumentParser()
    p.add_argument("base_url")
    p.add_argument("--origin", help="frontend origin to test CORS against, e.g. https://user.github.io")
    p.add_argument("--cold-start-seconds", type=int, default=240)
    args = p.parse_args()
    base = args.base_url.rstrip("/")

    print(f"Smoke test against {base}")
    started = time.time()
    if not check("service answers /system/live (cold start allowed)", wait_until_up(base, args.cold_start_seconds)):
        sys.exit(1)
    print(f"      cold start took {time.time() - started:.0f}s")

    status, _, body = call(base, "GET", "/api/v1/system/ready")
    check("/system/ready reports database and models ready", status == 200, f"{status} {body[:120]!r}")

    status, _, _ = call(base, "GET", "/api/v1/verification")
    check("unauthenticated requests are refused", status == 401, str(status))
    status, _, _ = call(base, "GET", "/metrics")
    check("/metrics is not public", status in (401, 404), str(status))

    if args.origin:
        status, headers, _ = call(base, "OPTIONS", "/api/v1/verification", headers={
            "Origin": args.origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"})
        check("CORS allows the frontend origin", headers.get("access-control-allow-origin") == args.origin,
              f"{status} allow-origin={headers.get('access-control-allow-origin')}")

    email, password = os.environ.get("SMOKE_EMAIL"), os.environ.get("SMOKE_PASSWORD")
    if not (email and password):
        print("  set SMOKE_EMAIL and SMOKE_PASSWORD to run the authenticated checks")
        sys.exit(0 if all(results) else 1)
    if os.environ.get("SMOKE_REGISTER") == "1":
        call(base, "POST", "/api/v1/auth/register", body={"email": email, "password": password, "name": "Smoke Test"})
    status, _, body = call(base, "POST", "/api/v1/auth/login", body={"email": email, "password": password})
    if not check("login succeeds", status == 200, f"{status} {body[:120]!r}"):
        sys.exit(1)
    auth = {"Authorization": "Bearer " + json.loads(body)["access_token"]}

    payload, mp_headers = multipart("smoke_sample.pdf", SAMPLE.read_bytes())
    status, _, body = call(base, "POST", "/api/v1/documents/upload", raw=payload, headers={**auth, **mp_headers})
    if not check("PDF upload is accepted", status == 200, f"{status} {body[:160]!r}"):
        sys.exit(1)
    document_id = json.loads(body)["id"]

    status, _, body = call(base, "POST", "/api/v1/verification/jobs", body={"document_id": document_id, "llm_output": STATEMENT}, headers=auth)
    if not check("verification job is queued (202)", status == 202, f"{status} {body[:160]!r}"):
        sys.exit(1)
    session_id = json.loads(body)["id"]

    state = "queued"
    for _ in range(90):
        _, _, body = call(base, "GET", f"/api/v1/verification/{session_id}/status", headers=auth)
        state = json.loads(body)["status"]
        if state in ("completed", "failed"):
            break
        time.sleep(2)
    if not check("job completes", state == "completed", state):
        sys.exit(1)

    _, _, body = call(base, "GET", f"/api/v1/verification/{session_id}/results", headers=auth)
    result = json.loads(body)
    flagged = [c for c in result["claims"] if c["status"] != "SUPPORTED"]
    check("the fabricated figure is flagged", bool(flagged) and result["risk_level"] == "HIGH",
          f"risk={result['risk_level']} claims={[c['status'] for c in result['claims']]}")
    check("verdicts carry provenance", bool(result.get("provenance")) and all(c.get("decided_by") for c in result["claims"]))

    status, _, body = call(base, "GET", f"/api/v1/verification/{session_id}/export?format=pdf", headers=auth)
    check("PDF report downloads", status == 200 and body.startswith(b"%PDF"), str(status))
    status, _, body = call(base, "GET", f"/api/v1/verification/{session_id}/export?format=csv", headers=auth)
    check("CSV report downloads", status == 200 and b"claim_id" in body[:80], str(status))

    _, _, body = call(base, "GET", "/api/v1/verification?limit=5", headers=auth)
    check("run appears in the history", session_id in [r["id"] for r in json.loads(body)])
    status, _, body = call(base, "GET", "/api/v1/audit/verify", headers=auth)
    check("audit hash chain verifies", status == 200 and json.loads(body).get("valid") is True, f"{status} {body[:120]!r}")

    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
