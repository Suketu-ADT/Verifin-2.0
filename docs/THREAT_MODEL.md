# VERIFIN 2.0 threat model

Scope: the API, the frontend and their free-tier deployment ([DEPLOY.md](DEPLOY.md)). The method is asset, trust boundary,
threat, control, then the risk that remains. The controls named below exist in the code and most have automated tests; the
"Residual risk" column is what is not covered, stated so a reviewer does not have to find it.

This is a design-level assessment by the authors. It is not an independent penetration test, and none has been done.

## Assets

| Asset | Why it matters |
|---|---|
| Uploaded financial documents | may be confidential; verdicts depend on them |
| Verdicts, claims, reports | used to decide whether an LLM answer can be trusted; a forged verdict is worse than none |
| Accounts, API keys, JWT secret | a stolen credential acts as the user; the JWT secret signs every session |
| Audit trail | the record of who did what; its value is that it cannot be quietly changed |
| Availability | verification is CPU-heavy, so exhausting the instance is cheap for an attacker |

## Trust boundaries

1. Internet to the API (every request is untrusted).
2. Browser to API: the frontend is public code and holds no secret.
3. API to MongoDB Atlas (TLS; reachable from any address, protected by credentials).
4. API to SEC EDGAR and, optionally, Hugging Face (outbound only).
5. Uploaded PDF content: untrusted input parsed by third-party libraries.

## Threats and controls

| # | Threat | Control | Residual risk |
|---|---|---|---|
| 1 | Reading or changing another organisation's data | `tenant_id` on every record; repositories filter on it; cross-tenant access returns `404`; tests cover documents, sessions, batches, history, audit and admin | one code path that forgets the filter would leak; no automated check enforces the filter structurally |
| 2 | Privilege escalation | roles `viewer < analyst < admin`, enforced by a dependency on each route; roles read from the database on every request; an API key can never exceed its owner's current role | none known; role checks are per route, not generated |
| 3 | Forged or stolen tokens | HS256 JWT with `exp`, `iat`, `iss`, `sub` required and the algorithm fixed server-side; production refuses a secret under 32 characters or the default | one shared secret: leaking it forges any user; tokens cannot be revoked individually before `exp` (default 60 min), though disabling the account takes effect at once |
| 4 | Credential guessing | scrypt password hashing (n=2^14), minimum length 10, a dummy hash is verified for unknown emails so timing does not reveal accounts, auth endpoints limited to 10 requests per minute per address | limits are per process and per address; behind NAT many users share one |
| 5 | API-key theft | keys are stored as SHA-256 hashes, shown once, can expire and be revoked, and stop working when the owner is deactivated | a leaked key works until revoked; there is no IP binding |
| 6 | Malicious upload | `.pdf` extension, PDF MIME type, `%PDF-` magic bytes and a 25 MB limit are checked; the file is stored under a generated ID, never the client's name | parsers (pdfplumber, pypdf, PyMuPDF, Tesseract) process the file; a parser vulnerability is mitigated only by dependency scanning and a non-root container |
| 7 | Server-side request forgery through EDGAR import | only `www.sec.gov` and `data.sec.gov` are contacted; URLs are assembled from validated parts (digits, accession pattern, plain file name); redirects are not followed; responses are size-capped | none known for the fixed hosts |
| 8 | Prompt injection through a document | the verification path uses no LLM: a document's text is only scored by NLI and rules, so instructions inside it cannot change behaviour | the optional fact-extraction endpoint does send document text to an LLM; its output is returned as data and is not acted on by the server, but a hostile document could skew the extracted facts. It is off without `HF_TOKEN` |
| 9 | Tampering with the audit trail | per-tenant SHA-256 hash chain verified by `/audit/verify`; unique `(tenant_id, seq)` prevents forks; secrets are stripped from event details | a database administrator can rewrite the whole chain consistently; only tampering by someone without that access is detected. Writes are best effort, so an outage can drop an event (counted in a metric) |
| 10 | Denial of service | sliding-window rate limits per address and per user, a stricter limit on uploads and verification, a bounded job queue returning `429` when full, a 25 MB upload limit | limits are in memory and per instance; a distributed attacker or a flood below the limit can still exhaust two CPUs. Cloud Run scaling is capped at one instance, which bounds cost but also capacity |
| 11 | Cross-site scripting and CORS abuse | React escapes output; CORS allows only the configured frontend origin and a fixed header list; token in `sessionStorage` | `sessionStorage` is readable by any script on the origin, so an XSS bug would expose the token. No Content-Security-Policy header is set by the API or by GitHub Pages |
| 12 | Secrets in the repository or image | secrets come from environment or Secret Manager; the image contains no credentials; CI runs gitleaks, bandit and a vulnerable-dependency scan; the image is scanned with Trivy | scans catch known patterns and advisories only |
| 13 | Public sign-up abuse | `ALLOW_REGISTRATION=false` in the deployed configuration; auth rate limit | while sign-up is on, anyone can create a tenant and consume the free quota |
| 14 | Exposure of operational data | `/metrics` is hidden in production unless `METRICS_TOKEN` is set; API docs are off outside debug; error responses omit internals when `DEBUG=false` and carry a request ID | logs include request paths and user IDs; they are only as private as the log destination |
| 15 | Database exposure | TLS; credentials in Secret Manager; the application user has no admin role if created as documented | the Atlas free tier cannot use private networking, so the allowlist is `0.0.0.0/0` and the password is the only barrier |
| 16 | Guessing or abusing emailed sign-in codes, or forged Google logins | codes are 6 random digits, stored only as an HMAC bound to the address, single use, expire in 10 minutes, destroyed after 5 wrong guesses, limited to one per 45 s and 6 per hour per address, and requested through an endpoint that answers identically for known and unknown addresses; Google ID tokens are verified server-side (RS256 signature against Google's keys, issuer, audience = this app's client ID, expiry, verified email) and an account linked to one Google ID refuses another | the guess counter lives in the database, but the one-per-45-s and per-hour send limits are in memory per instance, so several instances would each allow them; a mailbox takeover is a sign-in takeover; the dev-only fallback logs codes, and is disabled when `ENVIRONMENT=production` without SMTP |

## Known gaps

Items to disclose rather than discover:

- No independent penetration test, no formal review of the dependency tree beyond automated scans.
- No Content-Security-Policy, no token revocation list, no multi-factor authentication, no account lockout beyond rate
  limits, no password reset (an emailed code or Google sign-in reaches the same account, so it serves as recovery).
- Registering with a password does not verify the email address. Someone could register a victim's address with a password
  they know before the victim ever signs in; the victim's later Google or code sign-in would land in that account. Close
  sign-up (`ALLOW_REGISTRATION=false`) or require the code route for new accounts if that matters for your deployment.
- The rate limiter, job queue and audit-chain writer assume a single process. Running more than one instance weakens limits
  and can fork a tenant's audit chain (the unique index then rejects the second writer, which is logged and counted).
- Uploaded files live on ephemeral disk; there is no malware scanning of uploads.
- The Atlas allowlist is open to the internet by necessity of the free tiers.

## What to verify first in a review

1. Read `app/security/principal.py` and `app/repositories/` together: every query should carry `tenant_id`.
2. Run `python scripts/smoke_test.py <url>` against a deployment: it checks that unauthenticated calls and `/metrics` are
   refused and that CORS admits only the frontend.
3. Run `GET /api/v1/audit/verify`, change a stored event in the database, run it again, and see the first broken sequence.
