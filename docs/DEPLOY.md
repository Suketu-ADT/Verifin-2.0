# Deploying VERIFIN 2.0 on free tiers

Frontend on GitHub Pages, API on Google Cloud Run (or a Hugging Face Space, section 2b), data in MongoDB Atlas. Free-tier figures were checked on 2026-10-31 and
change without notice: re-read the linked pages before a demo.

| Part | Service | Free allowance (source) |
|---|---|---|
| Frontend | GitHub Pages | public repository only; 1 GB site, soft 100 GB/month ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)) |
| API | Cloud Run | request billing: 180,000 vCPU-s, 360,000 GiB-s, 2 M requests/month; instance billing: 240,000 vCPU-s, 450,000 GiB-s ([pricing](https://cloud.google.com/run/pricing)) |
| Data | Atlas free cluster | 0.5 GB, 500 connections, 100 ops/s, 10 GB in and out per week, paused after 30 idle days ([limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)) |

Cloud Run needs a Google Cloud billing account (a card on file) even for free usage. Set a budget alert before deploying:
Billing, Budgets & alerts, a budget of 1 USD with alerts at 50% and 100%.

## 1. Database (MongoDB Atlas)

1. Create a project and a **Free** cluster; pick a Google Cloud region near the API (for example Iowa, `us-central1`).
2. Database Access: add a user with a long random password and the *Read and write to any database* role.
3. Network Access: Cloud Run has no fixed egress address and free clusters have no private endpoints, so allow `0.0.0.0/0`.
   Access is then controlled by the database password and TLS only. Use a unique password and do not reuse it.
4. Connect, Drivers: copy the `mongodb+srv://...` string and put the password in it.

The API creates its collections and indexes on first start.

## 2. API (Cloud Run)

```bash
gcloud auth login
PROJECT=<your-project-id> FRONTEND_ORIGIN=https://<github-user>.github.io ./deploy/deploy-cloudrun.sh
```

`FRONTEND_ORIGIN` is the origin only (no path, no trailing slash); the app is served from `/<repository>/` but CORS compares
origins. The script enables the APIs, stores the Atlas string, a generated JWT secret and a metrics token in Secret Manager,
builds the image with Cloud Build (`deploy/cloudbuild.yaml`), and deploys with:

| Setting | Value | Why |
|---|---|---|
| `--cpu 2 --memory 4Gi` | 2 vCPU, 4 GiB | PyTorch and three models are held in memory; uploads also use memory on Cloud Run |
| `--max-instances 1` | one instance | the job queue and rate limiter are per process; also caps free-tier use |
| `--no-cpu-throttling` | CPU always on | verification jobs keep running after the 202 response; with throttling they would stall |
| `--min-instances 0` | scale to zero | no cost while idle; the first request pays a cold start |
| `ENVIRONMENT=production` | | forces authentication, refuses to start without Atlas or a strong secret |
| `ALLOW_REGISTRATION=false` | | public sign-up off; see below |

**Create the first account.** With registration off nobody can sign in. Deploy once with `ALLOW_REGISTRATION=true`, register
the admin account in the app, then turn it off without a rebuild:
`gcloud run services update verifin-api --region us-central1 --update-env-vars ALLOW_REGISTRATION=false`. Further users are
created from the Admin page.

## 2b. API on a Hugging Face Space (no card needed)

Use this instead of section 2 when you do not want a Google Cloud billing account. The free CPU Space has 2 vCPU and 16 GB of
memory, needs no payment method and sleeps after a period without traffic (check the current limits on the
[Spaces overview](https://huggingface.co/docs/hub/spaces-overview)). Atlas and Pages are unchanged.

1. On huggingface.co create an access token (Settings, Access Tokens) with **Write** permission, then **New Space**: SDK
   **Docker**, template **Blank**, hardware **CPU basic**, visibility **Public**. Note `<username>/<space-name>`.
2. Publish the API from the repository root (Git Bash on Windows). Git asks for your Hugging Face username and, as the password,
   the token:
   ```bash
   HF_SPACE=<username>/<space-name> ./deploy/huggingface/publish.sh
   ```
3. In the Space, Settings, **Variables and secrets**:

   | Name | Kind | Value |
   |---|---|---|
   | `MONGODB_URI` | secret | the Atlas `mongodb+srv://...` string |
   | `JWT_SECRET` | secret | 64 random hex characters: `python -c "import secrets; print(secrets.token_hex(32))"` |
   | `METRICS_TOKEN` | secret | any other random string (keeps `/metrics` private) |
   | `ENVIRONMENT` | variable | `production` |
   | `FRONTEND_URL` | variable | `https://<github-user>.github.io` (origin only) |
   | `TRUST_PROXY_HEADERS` | variable | `true` |
   | `MONGODB_DATABASE` | variable | `verifin` |
   | `ALLOW_REGISTRATION` | variable | `true` until the admin account exists, then `false` |
   | `HF_TOKEN` | secret | optional: a token with only the Inference Providers permission turns on LLM fact extraction (cached on disk) |
   | `LOW_MEMORY` | variable | optional: `true` saves about 300 MB with identical dev verdicts (see the model card) |

   Changing a value restarts the Space.
4. The API is at `https://<username>-<space-name>.hf.space` (lower case). Use that as `API_BASE_URL` in section 3, and run the smoke test
   against it.

The build takes about ten minutes the first time because the three models are downloaded into the image. As on Cloud Run, there is
one instance, so the job queue and rate limiter are per process, and uploaded PDFs live on the container's disk and do not
survive a restart.

## 3. Frontend (GitHub Pages)

1. The repository must be public on the Free plan.
2. Settings, Pages: set the source to **GitHub Actions**.
3. Settings, Secrets and variables, Actions, Variables: add `API_BASE_URL` with the Cloud Run URL printed by the script.
4. Run *Deploy frontend to GitHub Pages* manually (Actions tab, Run workflow). To deploy on every push to `main` instead, restore the `push` trigger described at the top of `.github/workflows/deploy-pages.yml`. The site appears at
   `https://<github-user>.github.io/<repository>/`.

## 4. Smoke test

```bash
SMOKE_EMAIL=<admin email> SMOKE_PASSWORD=<password> \
  python scripts/smoke_test.py https://<service>.run.app --origin https://<github-user>.github.io
```

It waits out the cold start, then checks health and readiness, that unauthenticated calls and `/metrics` are refused, that
CORS admits the frontend, and a full run: login, upload, queued job, completion, a flagged fabricated figure, provenance,
PDF and CSV export, history and the audit chain. Exit code 0 means all passed. Run it before every demo; it also warms the
instance.

## Known limits

- **Cold start.** After idle the first request waits for the container and model loading (about 23 s locally; expect longer
  on Cloud Run). Open the site and run the smoke test a few minutes before presenting.
- **Uploaded PDFs do not survive a restart.** They are written to the instance's memory-backed disk. Verifications, claims,
  history and reports are stored in Atlas and survive; only the in-browser original-PDF viewer fails for a document uploaded
  before the last restart. Upload the document again to view it. Durable file storage (Atlas GridFS or a bucket) is not built.
- **Free-tier headroom.** With CPU always on, the instance bills while it is alive (until about 15 minutes after the last
  request). 450,000 GiB-s at 4 GiB is about 31 hours of instance time a month. Image storage in Artifact Registry above its
  free amount may cost a few cents a month; check the budget alert.
- **One instance.** Throughput is one container with two verification jobs at a time. Horizontal scaling needs a shared job
  queue and rate-limit store, which are not built.
- **Not verified here.** The deploy script, Cloud Build file and Pages workflow were written without access to a Google Cloud
  project or GitHub Actions and have not been run end to end. The Docker image has not been built locally (no container
  engine was running). The smoke test itself was run against a local secured server: all checks passed except the
  public-`/metrics` check, which is expected there because that server runs in development mode.
