# Remaining Funspot integration and release work

Branch: `web-port-from-master`  
Validated head: `f6791cc48c456afcc51a86d65ffb85bc2eb2dc2d`  
Tracking PR: [#4](https://github.com/capiyo/funspotfuta/pull/4) (draft)

This document replaces the obsolete handoff checklist that listed old web line counts and incorrectly said the React Native app must not be changed. The current project is intentionally cross-platform.

## Completed and automatically verified on the validated head
- Core tests and shared core, web and React Native typechecks.
- Web lint and production Vite build.
- Android and iOS JavaScript bundle exports.
- ChatsCard browser checks at 360, 390, 600, 700, 1280 and 1920px.
- Match Details Lineups/Stats navigation and Home/Feed responsive checks.
- Public crawlability and live-statistics client/web typechecks.
- The dependent notification/AppCache feature stack passed Android and iOS bundle exports.
- Web and mobile now clear unread notification/comment snapshots and pending join requests at logout/account switches, without clearing them during normal session restoration.

## Remaining functional parity work
The AppCache checklist in `docs/APPCACHE_PARITY_MIGRATION.md` remains the detailed source of truth. In particular:
1. Complete side-by-side behavior audits for the components still marked SUSPECT/PENDING in `docs/PORT_MAP.md`; prioritize login/OTP, channel creation/join, add-post, notifications, match pitch/lineups, and modal flows.
2. Finish cache-backed domain wiring for remaining fixture consumers, vote/voter state, channels/channel fixtures, counts/latest comments, comrade search/stats/actions, feed interactions, history/aftermatch/live events and notifications.
3. Route remaining shared profile edit, balance, saved-phone and transaction actions through appropriate shared query/mutation functions; never persist credentials or financial transaction history.
4. Audit direct HTTP calls in web/mobile components and verify that shared data uses canonical cache keys and account-scoped state.
5. Verify message pagination and dependent modal parity where the MessageScreen checklist still identifies gaps.
6. Refresh the historical file-by-file parity inventory; file presence and line counts are triage signals, not proof of behavior parity.

## Remaining release checks
1. Resolve or explicitly disposition the failed Netlify preview `dapper-gaufre-2bc2d2` (deployment `6aea3dbdf06bce30950985d0`). The other three configured previews report success.
2. Verify Firebase phone OTP and real web push/FCM delivery using live credentials.
3. Verify production API behavior and backend notification delivery.
4. Install and test on physical Android and iOS devices. Expo exports are bundle checks, not device tests.
5. Verify encrypted IndexedDB/MMKV removal, account switching, offline launch and cache restoration on real browsers/devices.
6. Confirm the Netlify site/domain mapping for `funspot.co.ke` before any production deploy.
7. Run formatting checks in a local checkout; Prettier has not been verified by the current CI workflow.

## Release rule
Do not mark the integration complete, mark PR #4 ready, or deploy production until the failed preview is understood and the required live-service/device checks have either passed or are explicitly accepted as release risks. Current CI success is not a claim of production deployment.
