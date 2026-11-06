#!/usr/bin/env bash
set -Eeuo pipefail

BRANCH="seo-app-at-root"
REPO="/d/Funspot/frontend/funspotfuta"
LOG="$REPO/deploy-ssr.log"
CONTACT_EMAIL="engineercapiyo@gmail.com"

exec > >(tee -a "$LOG") 2>&1

step() {
  local label="$1"
  shift
  echo
  echo "================================================"
  echo "RUNNING: $label"
  echo "================================================"
  "$@"
  echo "SUCCESS: $label"
}

echo "FUNSPOT SSR PRODUCTION DEPLOYMENT"
echo "Started: $(date)"
cd "$REPO"

if [[ ! -d .git ]]; then
  echo "ERROR: Repository not found at $REPO"
  exit 1
fi

step "Fetch production branch" git fetch origin "$BRANCH"
if [[ "$(git branch --show-current)" != "$BRANCH" ]]; then
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    step "Switch to production branch" git switch "$BRANCH"
  else
    step "Create tracking branch" git switch --track -c "$BRANCH" "origin/$BRANCH"
  fi
fi
step "Pull latest production changes" git pull --ff-only origin "$BRANCH"

step "Install dependencies" npm install --no-audit --no-fund
step "Notification normalizer tests" npm run test:web:notification-normalizer
step "Contact email tests" npm run test:web:contact-email
step "Web typecheck" npm run typecheck:web
step "Web lint" npm run lint:web

export FUNSPOT_CONTACT_EMAIL="$CONTACT_EMAIL"
step "Build client, React SSR bundle and crawl files" npm run build:web

if [[ ! -s "$REPO/apps/web/dist/index.html" ]]; then
  echo "ERROR: Production index.html was not generated."
  exit 1
fi
if [[ ! -s "$REPO/apps/web/dist/server/entry-server.js" ]]; then
  echo "ERROR: React SSR server bundle is missing."
  exit 1
fi
if [[ ! -s "$REPO/netlify/functions/ssr.mjs" ]]; then
  echo "ERROR: Netlify SSR function was not generated."
  exit 1
fi
if ! grep -Fq "react-ssr" "$REPO/netlify/functions/ssr.mjs"; then
  echo "ERROR: Generated Netlify function is missing its SSR response marker."
  exit 1
fi

echo
echo "SSR BUILD VERIFIED"
echo "Client: apps/web/dist"
echo "Server: apps/web/dist/server/entry-server.js"
echo "Function: netlify/functions/ssr.mjs"

step "Deploy static assets and Netlify SSR function to production"   netlify deploy --no-build --dir="apps/web/dist" --functions="netlify/functions" --prod

echo
echo "================================================"
echo "FUNSPOT SSR DEPLOYMENT COMPLETED"
echo "Finished: $(date)"
echo "================================================"
