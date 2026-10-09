"""
VERIFIN 2.0 — Standalone MongoDB Atlas Diagnostic Script.

Tests database connectivity, DNS SRV resolution, TLS handshake,
and ping command execution without exposing credentials or modifying data.

Usage:
    python scripts/test_mongodb_connection.py
"""

from __future__ import annotations

import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# Add backend directory to sys.path if not present
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent if current_dir.name == "scripts" else current_dir
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# ── 1. Load Environment Variables ─────────────────────────────────────────────
from dotenv import load_dotenv

env_paths = [
    backend_dir / ".env",
    backend_dir.parent / ".env",
    Path(".env"),
]

loaded_env_path = None
for p in env_paths:
    if p.exists() and p.is_file():
        load_dotenv(p, override=True)
        loaded_env_path = p
        break

print("=" * 70)
print("VERIFIN 2.0 — MongoDB Atlas Connection Diagnostic")
print("=" * 70)

if loaded_env_path:
    print(f"[*] Loaded environment file: {loaded_env_path}")
else:
    print("[!] No .env file found in standard locations.")

mongodb_uri = os.getenv("MONGODB_URI")

if not mongodb_uri:
    print("\n[FAIL] MONGODB_URI is not set in environment or .env file.")
    print("       Please define MONGODB_URI in backend/.env")
    sys.exit(1)

# ── 2. Safely Inspect URI Structure ──────────────────────────────────────────
try:
    parsed = urllib.parse.urlsplit(mongodb_uri)
    masked_netloc = parsed.netloc
    if parsed.username and parsed.password:
        masked_netloc = f"{parsed.username}:***@{parsed.hostname}"
        if parsed.port:
            masked_netloc += f":{parsed.port}"
    elif parsed.username:
        masked_netloc = f"{parsed.username}@{parsed.hostname}"
    
    masked_uri = urllib.parse.urlunsplit((parsed.scheme, masked_netloc, parsed.path, parsed.query, parsed.fragment))
    print(f"[*] Target URI structure: {masked_uri}")
    print(f"[*] Scheme: {parsed.scheme} | Cluster Host: {parsed.hostname}")
except Exception as e:
    print(f"[!] Error parsing URI structure: {e}")

# ── 3. Detect Public IP Address ──────────────────────────────────────────────
public_ip = None
try:
    req = urllib.request.Request("https://api.ipify.org", headers={"User-Agent": "verifin-diagnostic"})
    with urllib.request.urlopen(req, timeout=4) as response:
        public_ip = response.read().decode("utf-8").strip()
    print(f"[*] Current Client Public IP: {public_ip}")
except Exception:
    print("[*] Could not determine public IP automatically (check network/internet).")

# ── 4. Verify Driver & Certifi ────────────────────────────────────────────────
import certifi
from pymongo import MongoClient
from pymongo.errors import (
    ConfigurationError,
    ConnectionFailure,
    OperationFailure,
    ServerSelectionTimeoutError,
)

print(f"[*] Certifi CA bundle path: {certifi.where()}")

# ── 5. Attempt Connection and Ping ────────────────────────────────────────────
print("[*] Initiating connection test to MongoDB (timeout: 5000ms)...")

client = None
try:
    client = MongoClient(
        mongodb_uri,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        tlsCAFile=certifi.where(),
    )

    # Execute lightweight admin ping
    ping_result = client.admin.command("ping")
    
    print("\n" + "=" * 70)
    print("[SUCCESS] MongoDB connection established successfully!")
    print(f"[*] Cluster Ping Response: {ping_result}")
    print("=" * 70)
    sys.exit(0)

except ServerSelectionTimeoutError as exc:
    err_str = str(exc)
    print("\n" + "=" * 70)
    print("[FAIL] Connection Failed: ServerSelectionTimeoutError")
    print("=" * 70)

    if "TLSV1_ALERT_INTERNAL_ERROR" in err_str or "tlsv1 alert internal error" in err_str:
        print("\n[DIAGNOSIS: TLS Handshake Rejection / Atlas IP Whitelist]")
        print("MongoDB Atlas terminated the TLS handshake with 'TLSV1_ALERT_INTERNAL_ERROR'.")
        print("This is the standard response sent by MongoDB Atlas when:")
        print("  1. Network Access / IP Whitelist Restriction:")
        if public_ip:
            print(f"     Your current public IP ({public_ip}) is NOT in the Atlas IP Access List.")
        else:
            print("     Your current public IP is not in the Atlas IP Access List.")
        print("     Because home Wi-Fi and mobile networks frequently assign dynamic IPs,")
        print("     Atlas rejects new IP addresses before completing the TLS handshake.")
        print("  2. Cluster Inactive / Paused:")
        print("     Atlas Free Tier (M0) clusters are automatically paused after periods")
        print("     of inactivity.")
        print("\n[ACTION REQUIRED IN MONGODB ATLAS CONSOLE]:")
        print("  Step 1: Go to https://cloud.mongodb.com and open your project.")
        print("  Step 2: Under 'Security', click 'Network Access'.")
        if public_ip:
            print(f"  Step 3: Click 'Add IP Address' -> 'Add Current IP Address' ({public_ip}).")
        else:
            print("  Step 3: Click 'Add IP Address' -> 'Add Current IP Address'.")
        print("  Step 4: If your cluster shows 'PAUSED', click 'Resume'.")
        print("  Step 5: Wait ~60 seconds for Atlas to apply the firewall rule, then rerun this script.")

    else:
        print("\n[DIAGNOSIS: Network or Firewall Issue]")
        print(f"Details: {err_str[:300]}")
        print("Ensure outbound TCP traffic on port 27017 is allowed by your network/firewall.")

    sys.exit(2)

except OperationFailure as exc:
    print("\n" + "=" * 70)
    print(f"[FAIL] MongoDB Operation / Authentication Failed: {exc}")
    print("=" * 70)
    if "auth" in str(exc).lower() or getattr(exc, "code", None) == 18:
        print("The cluster was reached, but authentication credentials were rejected.")
        print("Please verify the username and password in MONGODB_URI in backend/.env.")
    sys.exit(3)

except ConfigurationError as exc:
    print("\n" + "=" * 70)
    print("[FAIL] Configuration Error")
    print("=" * 70)
    print(f"Details: {exc}")
    print("Verify the MONGODB_URI formatting, SRV parameters, and DNS resolver.")
    sys.exit(4)

except Exception as exc:
    print("\n" + "=" * 70)
    print(f"[FAIL] Unexpected Error: {type(exc).__name__}")
    print("=" * 70)
    print(f"Details: {exc}")
    sys.exit(5)

finally:
    if client is not None:
        client.close()
