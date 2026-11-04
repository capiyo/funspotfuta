# Remaining Funspot integration and release work

Branch: `web-port-from-master`  
Notification hardening CI-verified head: `592a6e8ed5f1ecee6f3e094e1f4757b00ea8a3f0`  
Tracking PR: [#4](https://github.com/capiyo/funspotfuta/pull/4) (draft)

This document replaces the obsolete handoff checklist that listed old web line counts and incorrectly said the React Native app must not be changed. The current project is intentionally cross-platform.

## Notification hardening added after the last validated head

The following implementation changes are on `web-port-from-master`. All four GitHub Actions workflows completed successfully on `592a6e8ed5f1ecee6f3e094e1f4757b00ea8a3f0`; physical-device and live-push verification remain outstanding:

- Bind notification reconciliation to the active authenticated user and discard responses that finish after logout or account switching.
- Recheck the session boundary after asynchronous badge persistence and before emitting reconciled badge events.
- Reset the active notification session after failed login attempts and on logout/account boundaries.
- Attach web foreground FCM listeners only while a user is authenticated; tear down listeners safely if asynchronous registration resolves after unmount.
- Stop authenticated notification listeners immediately when logout begins and ignore queued mobile foreground, notification-open, and initial-notification callbacks after unmount.
- Carry Firebase message IDs through web, Android and iOS foreground/background handlers and deduplicate repeated deliveries using a bounded 500-ID persisted window. Events without a stable FCM/event ID cannot be deduplicated by this client mechanism.
- Keep fixture unread totals independent of the capped 10-item notification preview; marking a fixture read now resets its stored unread total and decrements the aggregate count by the true total.
- Store browser notification snapshots in AES-GCM encrypted IndexedDB instead of plaintext localStorage; migrate legacy notification keys into encrypted records and remove the old plaintext copies.
- If encrypted IndexedDB is unavailable, keep notification state in a volatile in-memory fallback; do not downgrade to plaintext persistence, and clear both stores at account boundaries.
- Make native notification storage operations await encrypted MMKV initialization so a cold-start background FCM handler does not write into the temporary pre-initialization memory buffer.
- Centralize mobile FCM token registration and token-refresh handling in the authenticated notification runtime; the login overlay no longer makes a duplicate registration request, and denied permission retries now explain the device-settings step.
- Serialize token unregistration after any in-flight registration and invalidate the local registration cache even when logout cleanup encounters a network error.
- Bound token registration and unregistration requests so a stalled network cannot hold the logout path indefinitely.
- Reject token registration when its originating account is no longer active; a late successful response is followed by an owner-scoped unregister so it cannot resurrect a logged-out device token.

These changes reduce client-side races and duplicate badge increments. They do not resolve the backend notification-router authorization blocker below, and they do not prove real push delivery.

## Completed and automatically verified on the notification-hardening CI head

- Web port validation run #3271 passed: core tests, core/web/mobile typechecks, Android and iOS bundle exports, web lint/build, ChatsCard responsive checks, Match Details tabs, and Home/Feed responsive checks.
- Public crawlability validation run #997 passed, including web typecheck, lint/build and generated crawl-file checks.
- Live-statistics client typecheck run #136 passed for shared core and React Native.
- Live-statistics web typecheck run #127 passed for shared core and React web.
- These are CI checks on the stated commit; they are not physical-device push tests or production deployment verification.

## Previously completed and automatically verified on the validated head
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
1. Resolve the currently pending `dapper-gaufre-2bc2d2` preview (latest PR-head deployment `6aeac9b07c90789a09ab5940`). On PR head `6b80ec4`, the `funspotfuta`, `friendly-treacle-0716d4`, and `funspotapp` previews report success. The earlier `dapper-gaufre` failure (`6aea3dbdf06bce30950985d0`) is historical; do not assume the current pending deployment has the same outcome.
2. Verify Firebase phone OTP and real web push/FCM delivery using live credentials.
3. Verify production API behavior and backend notification delivery.
4. Install and test on physical Android and iOS devices. Expo exports are bundle checks, not device tests.
5. Verify encrypted IndexedDB/MMKV removal, account switching, offline launch and cache restoration on real browsers/devices.
6. Confirm the Netlify site/domain mapping for `funspot.co.ke` before any production deploy.
7. Run formatting checks in a local checkout; Prettier has not been verified by the current CI workflow.

## Notification backend security blocker
- Backend source audit confirmed the issue in `capiyo/funspot-Backend`: `src/routes/notification.rs` mounts token registration/unregistration, notification reads, mark-read, preferences, `/send`, `/send-bulk`, `/cleanup` and `/debug/:user_id` without route authentication. `src/handlers/notification_handler.rs` trusts caller-supplied `user_id` values for token ownership, reads, mark-read and preferences; `/send` and `/send-bulk` let an unauthenticated caller trigger arbitrary user pushes. These endpoints need JWT authentication plus `claims.sub == requested user_id` for user-scoped operations. Sending and cleanup/debug must be moved behind trusted service/admin authorization, not ordinary client JWT access.
- The backend auth token generator in `src/handlers/auth.rs::generate_token` reads `JWT_SECRET` directly and falls back to the literal `secret`. Separately, `src/config.rs::AppConfig::from_env` uses a different insecure fallback (`insecure-default-change-me-in-production`). This split means config loading does not secure token generation. Remove both fallback paths, fail startup closed on missing/weak secret, use one validated secret source for issue/verify, and rotate the production secret before release.
- No backend auth patch is being claimed here: the notification handlers and token generator need coordinated changes and Rust tests. The front-end Bearer header is not protection until the backend validates it.

## Release rule
Do not mark the integration complete, mark PR #4 ready, or deploy production until the failed preview is understood and the required live-service/device checks have either passed or are explicitly accepted as release risks. Current CI success is not a claim of production deployment.
