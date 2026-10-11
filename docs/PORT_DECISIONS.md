# Port decisions

## Source of truth and scope
- Base branch is `master` at `84255b277d0568b05986aba8ec54daf748871b7b`; working branch is `web-port-from-master`, created from that exact commit.
- `apps/mobile/**` is immutable. Final verification must run `git diff master -- apps/mobile` and require empty output.
- Do not carry over Arena/Logs/Trending/FixtureDetail/History. The authoritative mobile home has only Chats and Feed.
- Target web is React + Vite + TypeScript + Tailwind with React Router. Port matching relative paths under `apps/web/src/`.
- The only intentional home layout difference is top navbar adapted from `appHeader`, profile sidebar, then Chats and Feed side by side at equal 50/50 widths on desktop with independent scrolling; stack responsively on narrow screens.

## Auth and API
- Mobile `notification-service.ts` uses `https://clash-api-m5mr.onrender.com/api`; web should configure `VITE_API_BASE_URL` with this documented default and preserve endpoint paths/payloads from mobile.
- Mobile auth stores `usertoken`, `user`, `isLoggedIn`, `phone`, and `refreshToken`. Preserve backend-issued token semantics. Do not substitute Firebase ID tokens for the backend token unless mobile's backend login flow confirms that behavior.
- Firebase web configuration comes from Vite environment variables; never commit real config secrets.
- Confirm web FCM token compatibility against the exact mobile registration endpoint/payload. If backend lacks web-token support, do not silently change backend contracts; document the required change and disable registration gracefully.

## Porting strategy
- Similar-looking legacy web components are not equivalent until reviewed. Keep each row pending until APIs, state transitions, text, and loading/empty/error states are compared.
- Preserve existing files unless deletion is necessary for the no-Next.js requirement or a reviewed mobile counterpart supports removal.
- Manual Firebase console steps belong in `FIREBASE_SETUP.md`.


## Notifications compatibility finding
- `packages/core/src/api/notification-service.ts` defines `registerToken` for `POST /api/notifications/register-token`, body `{ user_id, fcm_token, platform }`, with `platform: 'web'` accepted by the shared type. The mobile login flow still leaves automatic registration after login as a TODO, but the endpoint and payload contract exist. Web registration therefore reuses this exact shared function after an explicit user action; it does not invent an endpoint. Server acceptance still needs runtime verification.
