#!/usr/bin/env bash
# Commits and pushes refreshed snapshots (what the Railway cron runs after seeding).
# Env: GITHUB_TOKEN + GITHUB_REPO (owner/name) to push over HTTPS; GIT_BRANCH defaults to main.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "$(git status --porcelain -- apps/*/snapshots snapshots)" ]; then
  echo "publish: no snapshot changes"
  exit 0
fi
git config user.name "${GIT_AUTHOR_NAME:-longitude-cron}"
git config user.email "${GIT_AUTHOR_EMAIL:-cron@longitude.local}"
git add apps/*/snapshots snapshots
git commit -q -m "chore(snapshots): refresh $(date -u +%Y-%m-%dT%H:%MZ)"
if [ -n "${GITHUB_TOKEN:-}" ] && [ -n "${GITHUB_REPO:-}" ]; then
  git push -q "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" "HEAD:${GIT_BRANCH:-main}"
else
  git push -q
fi
echo "publish: pushed"
