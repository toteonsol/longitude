#!/usr/bin/env bash
# Deploys the store and every app to Vercel straight from this machine (no git remote needed).
#
#   scripts/deploy-vercel.sh                 store + all ten apps
#   scripts/deploy-vercel.sh store rewind    just these
#   ENV=1 scripts/deploy-vercel.sh ...       also (re)write the production env vars from .env first
#
# Each app becomes its own Vercel project named after its folder (rookie-scout, two-faced, ...).
# After the first deploy, note the production URLs it prints and set NEXT_PUBLIC_APP_URL_TEMPLATE /
# NEXT_PUBLIC_STORE_URL in .env to match, then rerun with ENV=1 so the store links to the apps.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && source .env; set +a

TEMPLATE=${NEXT_PUBLIC_APP_URL_TEMPLATE:-https://{id}.vercel.app}
STORE=${NEXT_PUBLIC_STORE_URL:-https://longitude.vercel.app}
SCOPE=${VERCEL_SCOPE:-}

targets=("$@")
if [ ${#targets[@]} -eq 0 ]; then
  targets=(store)
  for d in apps/*/; do id=$(basename "$d"); [ "$id" != store ] && targets+=("$id"); done
fi

push_env() { # name value
  [ -z "$2" ] && return 0
  vercel env rm "$1" production --yes ${SCOPE:+--scope "$SCOPE"} >/dev/null 2>&1 || true
  printf '%s' "$2" | vercel env add "$1" production ${SCOPE:+--scope "$SCOPE"} >/dev/null
}

for id in "${targets[@]}"; do
  echo
  echo "━━━ deploying $id"
  (
    cd "apps/$id"
    if [ "${ENV:-}" = "1" ]; then
      vercel link --yes ${SCOPE:+--scope "$SCOPE"} >/dev/null
      push_env NEXT_PUBLIC_STORE_URL "$STORE"
      push_env NEXT_PUBLIC_APP_URL_TEMPLATE "$TEMPLATE"
      push_env NANSEN_API_KEY "${NANSEN_API_KEY:-}"
      push_env NANSEN_CREDIT_CAP "${NANSEN_CREDIT_CAP:-300}"
      push_env UPSTASH_REDIS_REST_URL "${UPSTASH_REDIS_REST_URL:-}"
      push_env UPSTASH_REDIS_REST_TOKEN "${UPSTASH_REDIS_REST_TOKEN:-}"
    fi
    vercel deploy --prod --yes ${SCOPE:+--scope "$SCOPE"}
  )
done
