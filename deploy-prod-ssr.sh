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

echo "FUNSPOT PRODUCTION DEPLOYMENT"
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
step "Build the single application shell and crawl files" npm run build:web

if [[ ! -s "$REPO/apps/web/dist/index.html" ]]; then
  echo "ERROR: Production index.html was not generated."
  exit 1
fi
if grep -Eq 'public-home|PublicHomeContent' "$REPO/apps/web/dist/index.html"; then
  echo "ERROR: Separate public homepage content remains in index.html."
  exit 1
fi
if [[ ! -s "$REPO/netlify/functions/ssr.mjs" ]]; then
  echo "ERROR: Netlify application-shell function was not generated."
  exit 1
fi
if ! grep -Fq "renderApp" "$REPO/netlify/functions/ssr.mjs" || ! grep -Fq "home-screen" "$REPO/apps/web/dist-ssr/entry-server.js"; then
  echo "ERROR: Netlify function is not configured to server-render the real Funspot application."
  exit 1
fi

echo
echo "SINGLE APP SHELL BUILD VERIFIED"
echo "Client: apps/web/dist"
echo "Function: netlify/functions/ssr.mjs"

step "Deploy static assets and Netlify function to production" netlify deploy --no-build --dir="$REPO/apps/web/dist" --functions="$REPO/netlify/functions" --prod

echo
echo "================================================"
echo "FUNSPOT PRODUCTION DEPLOYMENT COMPLETED"
echo "Finished: $(date)"
echo "================================================"
