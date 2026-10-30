#!/usr/bin/env bash
# Build the API image and deploy it to Cloud Run. Run from the repository root after `gcloud auth login`.
#
#   PROJECT=my-project FRONTEND_ORIGIN=https://<user>.github.io ./deploy/deploy-cloudrun.sh
#
# Optional: REGION (default us-central1), SERVICE (verifin-api), ALLOW_REGISTRATION (true|false, default false).
# The Atlas connection string is read from the prompt (or MONGODB_URI) and stored in Secret Manager, never in the image.
set -euo pipefail

: "${PROJECT:?set PROJECT to your Google Cloud project id}"
: "${FRONTEND_ORIGIN:?set FRONTEND_ORIGIN to the site origin, e.g. https://<user>.github.io (no path, no trailing slash)}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-verifin-api}"
ALLOW_REGISTRATION="${ALLOW_REGISTRATION:-false}"
REPO="verifin"
TAG="$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/api:${TAG}"

gcloud config set project "$PROJECT" >/dev/null
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

gcloud artifacts repositories describe "$REPO" --location "$REGION" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "$REPO" --repository-format docker --location "$REGION" --description "VERIFIN images"

put_secret() { # name, value from stdin: create the secret or add a new version
  if gcloud secrets describe "$1" >/dev/null 2>&1; then gcloud secrets versions add "$1" --data-file=- >/dev/null
  else gcloud secrets create "$1" --replication-policy automatic --data-file=- >/dev/null; fi
}

if ! gcloud secrets describe verifin-jwt-secret >/dev/null 2>&1; then
  openssl rand -hex 32 | put_secret verifin-jwt-secret
fi
if ! gcloud secrets describe verifin-metrics-token >/dev/null 2>&1; then
  openssl rand -hex 24 | put_secret verifin-metrics-token
fi
if [ -n "${MONGODB_URI:-}" ]; then
  printf '%s' "$MONGODB_URI" | put_secret verifin-mongodb-uri
elif ! gcloud secrets describe verifin-mongodb-uri >/dev/null 2>&1; then
  read -rsp "Atlas connection string (mongodb+srv://...): " uri; echo
  printf '%s' "$uri" | put_secret verifin-mongodb-uri
fi

# The Cloud Run runtime identity must be able to read the secrets.
SA="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
for s in verifin-jwt-secret verifin-metrics-token verifin-mongodb-uri; do
  gcloud secrets add-iam-policy-binding "$s" --member "serviceAccount:${SA}" --role roles/secretmanager.secretAccessor >/dev/null
done

gcloud builds submit --config deploy/cloudbuild.yaml --substitutions "_IMAGE=${IMAGE}" .

# One instance: the models are held in memory, and the job queue and rate limiter are per process.
# CPU is always allocated because verification jobs keep running after the HTTP response has been sent.
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" --region "$REGION" --allow-unauthenticated --port 8000 \
  --cpu 2 --memory 4Gi --cpu-boost --no-cpu-throttling \
  --min-instances 0 --max-instances 1 --concurrency 20 --timeout 300 \
  --set-env-vars "ENVIRONMENT=production,DEBUG=false,LOG_FORMAT=json,TRUST_PROXY_HEADERS=true,MONGODB_DATABASE=verifin,FRONTEND_URL=${FRONTEND_ORIGIN},ALLOW_REGISTRATION=${ALLOW_REGISTRATION}" \
  --set-secrets "JWT_SECRET=verifin-jwt-secret:latest,MONGODB_URI=verifin-mongodb-uri:latest,METRICS_TOKEN=verifin-metrics-token:latest"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)')"
echo
echo "API:  ${URL}"
echo "Next: set the GitHub repository variable API_BASE_URL to ${URL}, then run  python scripts/smoke_test.py ${URL}"
