#!/usr/bin/env bash
set -euo pipefail

# render-auto-deploy.sh
# Usage:
#   export RENDER_API_KEY=rnd_xxx
#   export RENDER_SERVICE_ID=srv-xxxx
#   ./scripts/render-auto-deploy.sh
# This script will:
#  - fetch the service
#  - update service settings to use Docker and Dockerfile
#  - clear the rootDirectory
#  - trigger a new deploy and tail logs

API_BASE="https://api.render.com/v1"

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  echo "ERROR: RENDER_API_KEY is not set. Export it and try again."
  exit 1
fi

if [[ -z "${RENDER_SERVICE_ID:-}" ]]; then
  echo "ERROR: RENDER_SERVICE_ID is not set. Export it and try again."
  exit 1
fi

auth_header=( -H "Authorization: Bearer ${RENDER_API_KEY}" )

echo "Fetching service ${RENDER_SERVICE_ID}..."
svc_json=$(curl -s "${auth_header[@]}" "$API_BASE/services/${RENDER_SERVICE_ID}")
echo "$svc_json" | jq -r '.id, .name, .env, .rootDirectory' 2>/dev/null || true

echo "Updating service to use Docker and Dockerfile (rootDirectory cleared)..."
patch_payload=$(jq -n '{rootDirectory: "", dockerfilePath: "Dockerfile", env: "docker"}')

resp=$(curl -s -o /dev/stderr -w "%{http_code}" -X PATCH "${API_BASE}/services/${RENDER_SERVICE_ID}" \
  "${auth_header[@]}" -H "Content-Type: application/json" -d "$patch_payload") || true

if [[ "$resp" != "200" && "$resp" != "201" && "$resp" != "202" ]]; then
  echo "Warning: update returned HTTP $resp. The API may reject some fields; continuing to trigger a deploy anyway."
fi

echo "Triggering deploy..."
deploy_resp=$(curl -s -X POST "${API_BASE}/services/${RENDER_SERVICE_ID}/deploys" "${auth_header[@]}" -H "Content-Type: application/json" -d '{}')
deploy_id=$(echo "$deploy_resp" | jq -r '.id // empty')

if [[ -z "$deploy_id" ]]; then
  echo "Failed to create deploy. Response:"
  echo "$deploy_resp"
  exit 1
fi

echo "Created deploy $deploy_id. Polling status..."
while true; do
  d=$(curl -s "${auth_header[@]}" "$API_BASE/deploys/$deploy_id")
  state=$(echo "$d" | jq -r '.status')
  echo "Status: $state"
  if [[ "$state" == "success" ]]; then
    echo "Deploy succeeded."
    break
  elif [[ "$state" == "failed" || "$state" == "cancelled" ]]; then
    echo "Deploy failed/cancelled. Response:"
    echo "$d"
    exit 1
  fi
  sleep 5
done

echo "Done. Tail logs with: render logs ${RENDER_SERVICE_ID} --tail"
