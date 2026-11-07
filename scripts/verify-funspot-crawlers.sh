#!/usr/bin/env bash
set -euo pipefail

readonly ORIGIN="https://www.funspot.co.ke"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

check_crawler() {
  local agent="$1"
  local label="$2"
  local headers="$tmp_dir/$label.headers"
  local body="$tmp_dir/$label.html"

  curl --fail --silent --show-error \
    --user-agent "$agent" \
    --dump-header "$headers" \
    --output "$body" \
    "$ORIGIN/"

  if ! grep -qi '^x-funspot-render: react-ssr' "$headers"; then
    printf 'FAIL: %s did not receive the React SSR homepage.\n' "$label" >&2
    grep -i '^x-funspot-render:' "$headers" >&2 || true
    return 1
  fi

  if ! grep -qi '<h1[^>]*' "$body" || ! grep -q 'Football is better' "$body"; then
    printf 'FAIL: %s received no meaningful server-rendered homepage content.\n' "$label" >&2
    return 1
  fi

  printf 'PASS: %s receives the server-rendered homepage.\n' "$label"
}

check_crawler "Googlebot" "Googlebot"
check_crawler "Mediapartners-Google" "AdSense crawler"

curl --fail --silent --show-error "$ORIGIN/robots.txt" --output "$tmp_dir/robots.txt"
grep -q '^User-agent: Mediapartners-Google$' "$tmp_dir/robots.txt"
grep -q '^Disallow: /app/$' "$tmp_dir/robots.txt"

curl --fail --silent --show-error "$ORIGIN/sitemap.xml" --output "$tmp_dir/sitemap.xml"
grep -q '<loc>https://www.funspot.co.ke/</loc>' "$tmp_dir/sitemap.xml"
if grep -q '<loc>[^<]*/app/' "$tmp_dir/sitemap.xml"; then
  printf 'FAIL: The sitemap contains private application routes.\n' >&2
  exit 1
fi

printf 'PASS: robots.txt permits public crawling and excludes /app/.\n'
printf 'PASS: sitemap.xml contains the public homepage and excludes /app/.\n'
