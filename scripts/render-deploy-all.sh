#!/usr/bin/env bash
set -euo pipefail

# Wrapper to set envs, update service settings, trigger deploy, and tail logs.
# Usage:
#   export RENDER_API_KEY=rnd_xxx
#   export RENDER_SERVICE_ID=srv-xxxx
#   ./scripts/render-deploy-all.sh [env-file]

ENV_FILE="${1:-.env}"

command -v curl >/dev/null 2>&1 || { echo "curl is required. Install it and retry."; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq is required. Install it and retry."; exit 1; }

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  echo "ERROR: RENDER_API_KEY not set. Export it and retry."; exit 1
fi

if [[ -z "${RENDER_SERVICE_ID:-}" ]]; then
  echo "ERROR: RENDER_SERVICE_ID not set. Export it and retry."; exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file '$ENV_FILE' not found."; exit 1
fi

echo "Uploading env vars from $ENV_FILE to Render..."
./scripts/render-set-envs.sh "$ENV_FILE"

echo "Ensuring service is configured for Docker and triggering a deploy..."
./scripts/render-auto-deploy.sh

if command -v render >/dev/null 2>&1; then
  echo "Tailing logs with Render CLI... (press Ctrl+C to stop)"
  render logs ${RENDER_SERVICE_ID} --tail
else
  echo "Render CLI not found. To tail logs install it (Homebrew):"
  echo "  brew install render"
  echo "Or tail logs in the Dashboard." 
fi
