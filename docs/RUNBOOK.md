# VERIFIN 2.0 runbook

For whoever operates a deployment (see [DEPLOY.md](DEPLOY.md) for how it is built). Commands assume the Cloud Run service is
`verifin-api` in `us-central1`; change them to match.

## Service map

| Part | Where | Health |
|---|---|---|
| API | Cloud Run `verifin-api` | `GET /api/v1/system/live` (process up), `GET /api/v1/system/ready` (database and both models loaded; `503` otherwise) |
| Data | MongoDB Atlas free cluster | Atlas UI, Metrics tab |
| Frontend | GitHub Pages | open the site; the *Deploy frontend* workflow run |
| Secrets | Secret Manager: `verifin-jwt-secret`, `verifin-mongodb-uri`, `verifin-metrics-token` | |

## Before every demo or review

```bash
SMOKE_EMAIL=<admin email> SMOKE_PASSWORD=<password> \
  python scripts/smoke_test.py https://<service>.run.app --origin https://<user>.github.io
```

It wakes the instance (cold start) and exercises login, upload, a verification job, exports, history and the audit chain.
Fifteen checks should pass. If one fails, find it in the table below.

## Signals

`GET /metrics` with `Authorization: Bearer <METRICS_TOKEN>` (Prometheus format). The ones worth watching:

| Metric | Meaning | Look at it when |
|---|---|---|
| `verifin_http_requests_total{status="5xx"}` | server errors | any sustained rise |
| `verifin_jobs_total{outcome="failed"}`, `verifin_jobs_queued` | failed jobs, backlog | users report jobs stuck in `queued` |
| `verifin_rate_limited_total` | refused by rate limits | a client is hammering, or a limit is too low for a shared address |
| `verifin_auth_failures_total` | rejected credentials | spikes suggest guessing |
| `verifin_audit_write_failures_total` | audit events that were not stored | **any non-zero value**: the chain has a gap or database trouble |
| `verifin_verification_duration_seconds` | time per statement | latency complaints |

Logs are JSON on Cloud Run (`LOG_FORMAT=json`); every line and every error response carries `request_id`, also returned in the
`X-Request-ID` header and in W3C `traceparent`. To follow one request:

```bash
gcloud run services logs read verifin-api --region us-central1 --limit 200 | grep <request-id>
```

## Common problems

| Symptom | Likely cause | Action |
|---|---|---|
| First request takes a long time or times out | scale-to-zero cold start while models load | wait and retry; run the smoke test before a demo; consider `--min-instances 1` (costs free-tier hours) |
| `/system/ready` returns `503` | database unreachable, or models still loading | check Atlas is running and the connection string secret is current; read the start-up log |
| Service will not start, log says `JWT_SECRET must be set` or a database error | production guard working as designed | set a secret of at least 32 characters; fix the Atlas URI or network access; see below |
| Browser shows CORS errors | `FRONTEND_URL` does not equal the site origin | it must be the origin only, e.g. `https://user.github.io`, no path or trailing slash; update with `gcloud run services update` |
| Every user gets `429` | many users behind one address | raise `RATE_LIMIT_PER_MINUTE`, or confirm `TRUST_PROXY_HEADERS=true` so addresses come from `X-Forwarded-For` |
| Job stuck in `queued` | both workers busy, or the instance restarted | wait; a restart marks unfinished jobs `failed` so they can be resubmitted |
| Job `failed` right after a restart | the orphan sweep at start-up | resubmit the statement |
| PDF viewer cannot show an old document | uploads live on ephemeral disk | upload the document again; results are unaffected |
| `403` on an admin page | the user's role is below the page's minimum | an admin changes the role in the Admin page |
| Atlas "storage full" | free cluster limit (0.5 GB) | delete old documents or move to a paid cluster |

## Routine tasks

**Create or disable a user.** Admin page, Users. A disabled account stops working immediately, including its API keys.

**Issue or revoke an API key.** Admin page, API keys. A key is shown once at creation; store it then. Revoke from the same page.

**Turn public sign-up on or off.**

```bash
gcloud run services update verifin-api --region us-central1 --update-env-vars ALLOW_REGISTRATION=false
```

**Rotate the JWT secret.** Every signed-in user is logged out.

```bash
openssl rand -hex 32 | gcloud secrets versions add verifin-jwt-secret --data-file=-
gcloud run services update verifin-api --region us-central1 --update-secrets JWT_SECRET=verifin-jwt-secret:latest
```

**Rotate the Atlas password.** Change the database user's password in Atlas, add the new connection string as a new
`verifin-mongodb-uri` version, then redeploy the service as above with `MONGODB_URI=verifin-mongodb-uri:latest`.

**Roll back a bad release.**

```bash
gcloud run revisions list --service verifin-api --region us-central1
gcloud run services update-traffic verifin-api --region us-central1 --to-revisions <previous-revision>=100
```

**Check the audit trail.** Admin page, Audit, *Verify chain*, or `GET /api/v1/audit/verify` (admin). `valid: true` means no
event was changed, removed or reordered. If `valid` is false the response names the first broken sequence number and why
(sequence gap, link mismatch, content mismatch). Treat that as a security incident: preserve the database, export the events
around the sequence number, and compare with logs by `request_id`.

**Back up data.** Atlas free clusters offer limited backups; export with `mongodump` using the same connection string, run
from a trusted machine. Uploaded files are not part of the database and are not backed up.

## Incidents

**Suspected credential leak.** Disable the user (or revoke the key) in the Admin page first, then rotate the JWT secret if a
token signing key could be involved, then read the audit events for that actor since the suspected time.

**Suspected data exposure between organisations.** Cross-tenant requests must return `404`. Reproduce with two accounts; if
one reads the other's record, disable public sign-up, take the service down (`gcloud run services update --no-traffic` or
delete the public invoker binding), and fix the missing `tenant_id` filter before re-enabling.

**Cost or quota alarm.** Check the Cloud Run request and instance-time graphs, then Atlas data transfer (10 GB in and out per
rolling week on the free tier). Setting `--max-instances 0` stops the service from receiving traffic; it does not delete it.

## What this runbook does not cover

There is no on-call rotation, no alert routing, no automated backup, and no staging environment; the Cloud Run revision list
is the only rollback. These are the first things to add if the service is used beyond a demonstration.
