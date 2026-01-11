#!/usr/bin/env bash
set -euo pipefail

# render-set-envs.sh
# Usage:
#   export RENDER_API_KEY=rnd_xxx
#   export RENDER_SERVICE_ID=srv-xxxx
#   ./scripts/render-set-envs.sh [.env-file]
# This script will:
#  - read the .env file (default .env)
#  - build an envVars JSON array for Render
#    - marks keys starting with VITE_ or containing PUBLIC or ANON as non-secret
#  - PATCH the service to set `envVars`
#  - trigger a deploy

API_BASE="https://api.render.com/v1"
ENV_FILE="${1:-.env}"

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  echo "ERROR: RENDER_API_KEY is not set. Export it and try again."
  exit 1
fi

if [[ -z "${RENDER_SERVICE_ID:-}" ]]; then
  echo "ERROR: RENDER_SERVICE_ID is not set. Export it and try again."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: env file '$ENV_FILE' not found"
  exit 1
fi

command -v jq >/dev/null 2>&1 || { echo "jq is required. Install it and retry."; exit 1; }

TMPDIR=$(mktemp -d)
count=0
while IFS= read -r line || [[ -n "$line" ]]; do
  # skip comments and empty lines
  [[ "$line" =~ ^# ]] && continue
  [[ -z "$line" ]] && continue
  if ! echo "$line" | grep -q '='; then
    continue
  fi
  key=$(echo "$line" | sed 's/=.*$//')
  val=$(echo "$line" | sed 's/^[^=]*=//')
  # strip surrounding quotes
  val=$(echo "$val" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")

  # determine if secret: VITE_ and PUBLIC/ANON keys are not secret
  if [[ "$key" == VITE_* ]] || echo "$key" | grep -qiE '(PUBLIC|ANON)'; then
    secure=false
  else
    secure=true
  fi

  jq -n --arg name "$key" --arg value "$val" --argjson secure $secure '{name:$name, value:$value, secure:$secure}' > "$TMPDIR/env_$count.json"
  count=$((count+1))
done < "$ENV_FILE"

if [[ $count -eq 0 ]]; then
  echo "No env vars found in $ENV_FILE"
  rm -rf "$TMPDIR"
  exit 1
fi

envs_json=$(jq -s '.' "$TMPDIR"/env_*.json)
payload=$(jq -n --argjson envs "$envs_json" '{envVars: $envs}')

echo "Patching service ${RENDER_SERVICE_ID} with ${count} env vars..."
curl -s -X PATCH "${API_BASE}/services/${RENDER_SERVICE_ID}" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$payload" | jq -r '.message // "patched"' || true

echo "Triggering deploy..."
deploy_resp=$(curl -s -X POST "${API_BASE}/services/${RENDER_SERVICE_ID}/deploys" -H "Authorization: Bearer ${RENDER_API_KEY}" -H "Content-Type: application/json" -d '{}')
deploy_id=$(echo "$deploy_resp" | jq -r '.id // empty')
if [[ -z "$deploy_id" ]]; then
  echo "Failed to create deploy. Response:"; echo "$deploy_resp"; rm -rf "$TMPDIR"; exit 1
fi

echo "Deploy created: $deploy_id. Polling until finished..."
while true; do
  d=$(curl -s -H "Authorization: Bearer ${RENDER_API_KEY}" "${API_BASE}/deploys/$deploy_id")
  state=$(echo "$d" | jq -r '.status')
  echo "Status: $state"
  if [[ "$state" == "success" ]]; then
    echo "Deploy succeeded."; break
  elif [[ "$state" == "failed" || "$state" == "cancelled" ]]; then
    echo "Deploy failed/cancelled. Response:"; echo "$d"; rm -rf "$TMPDIR"; exit 1
  fi
  sleep 4
done

echo "Done. Tail logs with: render logs ${RENDER_SERVICE_ID} --tail"
rm -rf "$TMPDIR"
