"""Score a running VERIFIN API on the hand-labelled Northstar probe (data/eval/northstar_probe.json). Standard library only.

    SMOKE_EMAIL=... SMOKE_PASSWORD=... python scripts/probe_report.py http://127.0.0.1:8000

Every claim is submitted as its own statement against the same uploaded report. This is a 24-claim sanity probe on one
synthetic, table-heavy report, not a benchmark: it shows where the system is weak on layouts the main evaluation lacks.
"""

import argparse
import json
import os
import sys
import time
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from smoke_test import SAMPLE, call, multipart  # noqa: E402

PROBE = Path(__file__).resolve().parent.parent / "data" / "eval" / "northstar_probe.json"
LABELS = ("SUPPORTED", "CONTRADICTED", "UNVERIFIABLE")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("base_url")
    args = p.parse_args()
    base = args.base_url.rstrip("/")
    email, password = os.environ["SMOKE_EMAIL"], os.environ["SMOKE_PASSWORD"]

    status, _, body = call(base, "POST", "/api/v1/auth/login", body={"email": email, "password": password})
    if status != 200:
        sys.exit(f"login failed: {status}")
    auth = {"Authorization": "Bearer " + json.loads(body)["access_token"]}
    payload, mp = multipart("northstar_probe.pdf", SAMPLE.read_bytes())
    _, _, body = call(base, "POST", "/api/v1/documents/upload", raw=payload, headers={**auth, **mp})
    document_id = json.loads(body)["id"]

    claims = json.loads(PROBE.read_text(encoding="utf-8"))["claims"]
    rows = []
    for c in claims:
        _, _, body = call(base, "POST", "/api/v1/verification/jobs", body={"document_id": document_id, "llm_output": c["text"]}, headers=auth)
        sid = json.loads(body)["id"]
        while json.loads(call(base, "GET", f"/api/v1/verification/{sid}/status", headers=auth)[2])["status"] not in ("completed", "failed"):
            time.sleep(1)
        result = json.loads(call(base, "GET", f"/api/v1/verification/{sid}/results", headers=auth)[2])
        # a statement is as bad as its worst claim
        statuses = [x["status"].replace("UNVERIFIED", "UNVERIFIABLE") for x in result["claims"]]
        got = "CONTRADICTED" if "CONTRADICTED" in statuses else ("UNVERIFIABLE" if "UNVERIFIABLE" in statuses else "SUPPORTED")
        decided = ",".join(sorted({x.get("decided_by") or "-" for x in result["claims"]}))
        rows.append((c, got, decided))
        print(f"{'ok ' if got == c['label'] else 'MISS'} {c['id']:<6} want {c['label']:<12} got {got:<12} [{decided}]")
        sys.stdout.flush()

    right = sum(1 for c, got, _ in rows if got == c["label"])
    print(f"\naccuracy {right}/{len(rows)} = {100 * right / len(rows):.1f}%")
    for group in ("mgmt_summary", "true", "edited"):
        g = [(c, got) for c, got, _ in rows if c["group"] == group]
        print(f"  {group:<13} {sum(1 for c, got in g if got == c['label'])}/{len(g)}")
    print("confusion (rows = truth):")
    counts = Counter((c["label"], got) for c, got, _ in rows)
    for t in LABELS:
        print("  " + f"{t:<13}" + "  ".join(f"{counts[(t, g)]:>3}" for g in LABELS))
    print("  columns: " + ", ".join(LABELS))


if __name__ == "__main__":
    main()
