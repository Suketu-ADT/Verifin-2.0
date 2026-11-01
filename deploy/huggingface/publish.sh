#!/usr/bin/env bash
# Publish the API to a Hugging Face Docker Space. Run from the repository root.
#
#   HF_SPACE=<hf-username>/<space-name> ./deploy/huggingface/publish.sh
#
# Create the Space first (huggingface.co, New Space, SDK: Docker, Blank, CPU basic, Public). The script stages only what the image
# needs (the Space's own Dockerfile and card, backend/app, the requirements and data/demo) into a temporary git repository and
# pushes it. Git asks for your Hugging Face username and, as the password, an access token with Write permission; nothing is stored here.
# Secrets and variables are set in the Space's Settings page, never in this repository.
#   DRY_RUN=1  stage the files and list them without pushing.
set -euo pipefail

: "${HF_SPACE:?set HF_SPACE to <hf-username>/<space-name>}"
cd "$(git rev-parse --show-toplevel)"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$STAGE/backend" "$STAGE/data"
cp deploy/huggingface/Dockerfile deploy/huggingface/README.md "$STAGE/"
cp backend/requirements.txt backend/requirements.lock.txt "$STAGE/backend/"
cp -r backend/app "$STAGE/backend/app"
cp -r data/demo "$STAGE/data/demo"
find "$STAGE" -name __pycache__ -type d -prune -exec rm -rf {} +
find "$STAGE" -name '*.pyc' -delete

if [ "${DRY_RUN:-0}" = "1" ]; then
  (cd "$STAGE" && find . -type f | sort | head -40 && echo "... $(find . -type f | wc -l) files, $(du -sh . | cut -f1)")
  exit 0
fi

cd "$STAGE"
git init -q -b main
git add -A
git -c user.name="verifin-publish" -c user.email="publish@localhost" commit -q -m "Publish API from $(git -C "$OLDPWD" rev-parse --short HEAD)"
git push --force "https://huggingface.co/spaces/${HF_SPACE}" main
echo
echo "Pushed. The Space now builds the image (about 10 minutes the first time). Watch the Logs tab on huggingface.co/spaces/${HF_SPACE}."
echo "API URL: https://$(echo "${HF_SPACE}" | tr '/' '-' | tr '[:upper:]' '[:lower:]' | tr '_' '-').hf.space"
