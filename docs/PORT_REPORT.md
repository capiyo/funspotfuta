# Web port and cross-platform integration report

## Current branch
- Repository: `capiyo/funspotfuta`
- Branch: `web-port-from-master`
- Current validated head: `b445b0421f80947ded757e7c469c7c6899aba6fc`
- Base: `master` at `a3e81ac602b304f6ae7d53189780ac7cd1e539e7`
- PR: [#4](https://github.com/capiyo/funspotfuta/pull/4), intentionally draft while release checks remain outstanding.
- This is a cross-platform integration branch: React Native changes are intentional and are validated alongside the browser app.

## Integrated functionality
- React + Vite + TypeScript + Tailwind + React Router web application; no Next.js runtime.
- Secure web/mobile session handling, notification token registration/cleanup, persisted unread counts and @mentions.
- AppCache live commentary and feed-comment updates.
- Circular profile avatars across shared surfaces.
- Possession action opens its modal without triggering card-level chat navigation.
- Two-sided lineups, bench players and 365Scores portraits.
- Responsive Chats/Feed layout and swipeable Lineups/Stats match details.
- Master-side Firebase notification and live-statistics changes preserved.

## Automated validation on current head
GitHub Actions Web port validation run #3150 passed on `b445b0421f80947ded757e7c469c7c6899aba6fc`:
- Core tests.
- Shared core, web and React Native typechecks.
- Android JavaScript bundle export.
- Web lint and production Vite build.
- Playwright ChatsCard checks at 360, 390, 600, 700, 1280 and 1920px.
- Playwright Match Details Lineups/Stats navigation.
- Playwright Home shell and Feed responsive checks.

Public crawlability validation and live-statistics client/web typechecks also passed on this head. The dependent notification/AppCache feature-stack CI passed both Android and iOS Expo bundle exports. The current web-port workflow itself exports Android only.

Automated checks do not establish live Firebase OTP, real FCM delivery, production API behavior or physical-device correctness.

## Netlify preview status
For the current head, the GitHub status checks report:
- `funspotfuta`: success
- `funspotapp`: success
- `friendly-treacle-0716d4`: success
- `dapper-gaufre-2bc2d2`: failure (deployment `6aea3dbdf06bce30950985d0`)

The failed deployment's Netlify diagnostic page is inaccessible from the current connection. Its failure is unresolved; do not claim all previews passed.

## Remaining release verification
1. Resolve or explicitly identify the failed `dapper-gaufre-2bc2d2` deploy preview.
2. Verify Firebase phone OTP and real web push/FCM delivery with configured live credentials.
3. Verify production API behavior and notification delivery against the deployed backend.
4. Perform physical iOS and Android installation and runtime checks; Expo bundle export is not device validation.
5. Confirm which Netlify site is linked to `funspot.co.ke` before production deployment.
6. Complete the behavioral parity audit described in `docs/PORT_MAP.md` and `docs/APPCACHE_PARITY_MIGRATION.md`.

No production deployment is claimed.
