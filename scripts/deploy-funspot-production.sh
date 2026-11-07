#!/usr/bin/env bash
set -euo pipefail

# Funspot production deploy. Keep this Site ID pinned: it is the existing
# Netlify project serving https://www.funspot.co.ke.
readonly SITE_ID="ae14de5d-ae44-460f-86c7-5bbde4f0efa2"
readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly WEB_DIR="$REPO_ROOT/apps/web"
readonly DIST_DIR="$WEB_DIR/dist"
readonly FUNCTIONS_DIR="$REPO_ROOT/netlify/functions"

if [[ ! -f "$DIST_DIR/index.html" ]]; then
  printf 'ERROR: Missing production build: %s\nRun: npm run build:web\n' "$DIST_DIR" >&2
  exit 1
fi

if [[ ! -f "$WEB_DIR/dist-ssr/entry-server.js" ]]; then
  printf 'ERROR: Missing SSR bundle: %s\nRun: npm run build:web\n' "$WEB_DIR/dist-ssr/entry-server.js" >&2
  exit 1
fi

if [[ ! -f "$FUNCTIONS_DIR/ssr.mjs" ]]; then
  printf 'ERROR: Missing generated Netlify SSR function: %s\nRun: npm run build:web\n' "$FUNCTIONS_DIR/ssr.mjs" >&2
  exit 1
fi

# Netlify CLI resolves workspace paths relative to apps/web in this monorepo.
# Pass absolute Windows paths from Git Bash so the root-level function folder
# cannot accidentally resolve to apps/web/netlify/functions.
if command -v cygpath >/dev/null 2>&1; then
  NETLIFY_DIST_DIR="$(cygpath -aw "$DIST_DIR")"
  NETLIFY_FUNCTIONS_DIR="$(cygpath -aw "$FUNCTIONS_DIR")"
else
  NETLIFY_DIST_DIR="$DIST_DIR"
  NETLIFY_FUNCTIONS_DIR="$FUNCTIONS_DIR"
fi

printf 'Production site: https://www.funspot.co.ke\n'
printf 'Site ID:         %s\n' "$SITE_ID"
printf 'Publish folder:  %s\n' "$NETLIFY_DIST_DIR"
printf 'Functions:       %s\n' "$NETLIFY_FUNCTIONS_DIR"

cd "$WEB_DIR"
npx netlify deploy \
  --site "$SITE_ID" \
  --dir "$NETLIFY_DIST_DIR" \
  --functions "$NETLIFY_FUNCTIONS_DIR" \
  --prod \
  --no-build
