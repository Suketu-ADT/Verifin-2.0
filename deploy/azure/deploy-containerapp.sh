#!/usr/bin/env bash
# Deploy the API to Azure Container Apps from the public image built by .github/workflows/publish-image.yml.
# Run in Azure Cloud Shell (Bash) or any shell where `az login` has been done.
#
#   FRONTEND_ORIGIN=https://<github-user>.github.io LOCATION=centralindia ./deploy/azure/deploy-containerapp.sh
#
# Optional: IMAGE (default ghcr.io/suketu-adt/verifin-api:latest), RG (verifin-rg), APP (verifin-api), ALLOW_REGISTRATION (default false).
# The Atlas connection string is read from the prompt (or MONGODB_URI) and stored as a Container Apps secret, never in the image.
set -euo pipefail

: "${FRONTEND_ORIGIN:?set FRONTEND_ORIGIN to the site origin, e.g. https://<user>.github.io (no path, no trailing slash)}"
LOCATION="${LOCATION:-centralindia}"
RG="${RG:-verifin-rg}"
APP="${APP:-verifin-api}"
ENV_NAME="${ENV_NAME:-verifin-env}"
IMAGE="${IMAGE:-ghcr.io/suketu-adt/verifin-api:latest}"
ALLOW_REGISTRATION="${ALLOW_REGISTRATION:-false}"

if [ -z "${MONGODB_URI:-}" ]; then
  read -rsp "Atlas connection string (mongodb+srv://...): " MONGODB_URI; echo
fi

az extension add --name containerapp --upgrade --only-show-errors
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

az group create --name "$RG" --location "$LOCATION" --output none
az containerapp env create --name "$ENV_NAME" --resource-group "$RG" --location "$LOCATION" --output none

JWT_SECRET="$(openssl rand -hex 32)"
METRICS_TOKEN="$(openssl rand -hex 24)"

# One replica: the models are held in memory, and the job queue and rate limiter are per process. It scales to zero when idle.
# 2 vCPU and 4 GiB is a size the Consumption plan allows.
az containerapp create --name "$APP" --resource-group "$RG" --environment "$ENV_NAME" \
  --image "$IMAGE" --target-port 8000 --ingress external \
  --cpu 2 --memory 4Gi --min-replicas 0 --max-replicas 1 \
  --secrets "mongodb-uri=${MONGODB_URI}" "jwt-secret=${JWT_SECRET}" "metrics-token=${METRICS_TOKEN}" \
  --env-vars "ENVIRONMENT=production" "DEBUG=false" "LOG_FORMAT=json" "TRUST_PROXY_HEADERS=true" "MONGODB_DATABASE=verifin" \
             "FRONTEND_URL=${FRONTEND_ORIGIN}" "ALLOW_REGISTRATION=${ALLOW_REGISTRATION}" \
             "MONGODB_URI=secretref:mongodb-uri" "JWT_SECRET=secretref:jwt-secret" "METRICS_TOKEN=secretref:metrics-token" \
  --output none

FQDN="$(az containerapp show --name "$APP" --resource-group "$RG" --query properties.configuration.ingress.fqdn --output tsv)"
echo
echo "API:  https://${FQDN}"
echo "Next: set the GitHub repository variable API_BASE_URL to https://${FQDN}, then run  python scripts/smoke_test.py https://${FQDN}"
