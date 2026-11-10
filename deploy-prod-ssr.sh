#!/usr/bin/env bash
set -Eeuo pipefail

BRANCH="seo-app-at-root"
REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
LOG="$REPO/deploy-ssr.log"
CONTACT_EMAIL="${FUNSPOT_CONTACT_EMAIL:-}"

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

for command in git node npm npx bash; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "ERROR: Required command is missing: $command"
    exit 1
  fi
done
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) { console.error("ERROR: Node.js 20 or newer is required."); process.exit(1); }'

if [[ -z "$CONTACT_EMAIL" ]]; then
  read -r -p "Public Funspot contact email: " CONTACT_EMAIL
fi
if [[ -z "$CONTACT_EMAIL" ]]; then
  echo "ERROR: A public contact email is required for the crawlable pages."
  exit 1
fi
if [[ ! "$CONTACT_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "ERROR: FUNSPOT_CONTACT_EMAIL must be a valid public email address."
  exit 1
fi
cd "$REPO"

if [[ ! -d .git ]]; then
  echo "ERROR: Repository not found at $REPO"
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Working tree is not clean. Commit or stash local changes before deployment."
  git status --short
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

step "Install locked dependencies" npm ci --no-audit --no-fund
step "Core tests" npm run test:core
step "Core typecheck" npm run typecheck:core
step "Mobile typecheck" npm run typecheck:mobile
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

node --input-type=module <<'NODE'
import handler from './netlify/functions/ssr.mjs';

const response = await handler(new Request(
  'https://www.funspot.co.ke/.netlify/functions/ssr?path=%2F&ssr-smoke=1',
));
const html = await response.text();
if (response.status !== 200 || response.headers.get('x-funspot-render') !== 'react-ssr') {
  throw new Error('Local Netlify SSR function did not return a React SSR 200 response.');
}
for (const marker of ['home-screen', 'home-columns', 'id="funspot-query-state"']) {
  if (!html.includes(marker)) throw new Error('SSR response is missing required application markup: ' + marker);
}
console.log('PASS: the real app workspace and dehydrated public query state are server-rendered.');
// End this one-shot smoke process explicitly; imported SDKs may retain idle handles.
process.exit(0);
NODE

step "Deploy static assets and Netlify function to production" bash "$REPO/scripts/deploy-funspot-production.sh"

step "Verify Googlebot, AdSense crawler, robots.txt and sitemap" bash "$REPO/scripts/verify-funspot-crawlers.sh"

echo
echo "================================================"
echo "FUNSPOT PRODUCTION DEPLOYMENT COMPLETED"
echo "Finished: $(date)"
echo "================================================"
