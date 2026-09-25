#!/usr/bin/env bash
# Deploys the store and every app to Vercel from the repo root (the whole workspace is uploaded; each
# project's Root Directory, set by scripts/vercel-projects.mjs, selects the app).
#
#   scripts/deploy-vercel.sh                 store + all ten apps
#   scripts/deploy-vercel.sh store rewind    just these
#
# Env vars live on the projects (node scripts/vercel-projects.mjs env KEY VALUE); this script only deploys.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f deploy/vercel-projects.json ] || { echo "run: node scripts/vercel-projects.mjs" >&2; exit 1; }

targets=("$@")
if [ ${#targets[@]} -eq 0 ]; then
  targets=(store)
  for d in apps/*/; do id=$(basename "$d"); [ "$id" != store ] && targets+=("$id"); done
fi

mkdir -p .vercel deploy
for id in "${targets[@]}"; do
  pid=$(node -e "const p=require('./deploy/vercel-projects.json')['$id']; if(!p) process.exit(1); console.log(p.id)")
  oid=$(node -e "console.log(require('./deploy/vercel-projects.json')['$id'].orgId)")
  printf '{"projectId":"%s","orgId":"%s"}\n' "$pid" "$oid" > .vercel/project.json
  echo
  echo "━━━ deploying $id"
  if vercel deploy --prod --yes 2>&1 | tee "deploy/$id.log" | grep -E 'Production:|Aliased:|Error|error' ; then :; fi
  if grep -qE '^Error|Error: ' "deploy/$id.log"; then echo "!! $id failed (see deploy/$id.log)"; fi
done
rm -f .vercel/project.json
