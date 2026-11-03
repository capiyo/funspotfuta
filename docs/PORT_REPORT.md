# Web port and cross-platform integration report

## Current branch

- Repository: `capiyo/funspotfuta`
- Working branch: `web-port-from-master`
- Current validated head: `3789e82f53add1ae8beba4a6961581dc4dc26ce7`
- Current base: `master` at `a3e81ac602b304f6ae7d53189780ac7cd1e539e7`
- PR: #4, intentionally kept as draft while release checks remain outstanding.
- The branch is now a cross-platform integration branch. React Native changes are intentional following the later decision to update the monorepo's web and mobile applications together.

## Integrated functionality

- React + Vite + TypeScript + Tailwind + React Router web application; no Next.js runtime.
- Notification persistence, unread counts, mark-as-read, targeted push handling, token registration and logout cleanup.
- AppCache live commentary and feed-comment updates.
- Circular profile avatars across shared surfaces.
- Possession action opens its modal without triggering card-level chat navigation.
- Two-sided lineups, bench players and 365Scores portraits.
- Responsive desktop Chats/Feed sizing.
- Swipeable Lineups/Stats match details with live statistics updates.
- Latest master statistics and WebSocket changes are preserved in the integration branch.

## Automated validation on the current head

The following checks passed on `3789e82f53add1ae8beba4a6961581dc4dc26ce7`:

- Core tests.
- Shared core, web and React Native typechecks.
- Web lint and Vite production build.
- Android JavaScript bundle export.
- Public crawl-file validation.
- Playwright ChatsCard layouts at 360, 390, 600, 700, 1280 and 1920px.
- Playwright Match Details Lineups/Stats navigation.
- Playwright Home shell and Feed responsive checks.

The dependent notification/AppCache validation also passed both Android and iOS Expo bundle exports before its merge into this branch.

These are automated checks. They are not physical-device tests or proof of live service delivery.

## Netlify preview status

For the current head, three configured deploy previews report success:

- `funspotfuta`
- `funspotapp`
- `friendly-treacle-0716d4`

The `dapper-gaufre-2bc2d2` deploy preview reports failure. Its Netlify diagnostics page is not accessible from the current GitHub/browser connection, so that failure is unresolved. Do not describe all previews as failing or claim that this site is fixed.

## Remaining release verification

- Resolve or explicitly identify the failed `dapper-gaufre-2bc2d2` Netlify preview.
- Verify Firebase phone OTP and real web push/FCM delivery with configured live credentials.
- Verify production API behavior and notification delivery against the deployed backend.
- Perform physical iOS and Android device checks; Expo bundle export is not device validation.
- Confirm which Netlify site is linked to `funspot.co.ke` before a production deploy.

No production deployment is claimed.

## Current source-tree audit

A recursive tree audit of the current branch found 75 files under `apps/mobile/src`; 74 have same-relative-path counterparts under `apps/web/src`. The one missing same-path file is mobile `components/AdCarousel.tsx`; the browser messaging surface uses the web-specific `AdSenseCarousel` instead. There are 17 additional web-only source files. This is a path-presence audit, not proof of behavioral or visual parity.

The detailed table in `docs/PORT_MAP.md` is a historical 2026-10-11 inventory. Its line counts and PENDING/SUSPECT labels have not all been refreshed against the current cross-platform branch and must not be treated as the current completion state.
