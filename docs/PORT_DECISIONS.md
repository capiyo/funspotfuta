# Port decisions

## Source of truth and scope
- Base branch is `master` at `84255b277d0568b05986aba8ec54daf748871b7b`; working branch is `web-port-from-master`, created from that exact commit.
- `apps/mobile/**` is immutable. Final verification must run `git diff master -- apps/mobile` and require empty output.
- Do not carry over Arena/Logs/Trending/FixtureDetail/History. The authoritative mobile home has only Chats and Feed.
- Target web is React + Vite + TypeScript + Tailwind with React Router. Port matching relative paths under `apps/web/src/`.
- The only intentional home layout difference is top navbar adapted from `appHeader`, profile sidebar, then Chats and Feed side by side at equal 50/50 widths on desktop with independent scrolling; stack responsively on narrow screens.

## Auth and API
- Mobile `notification-service.ts` uses `https://clash-api-m5mr.onrender.com/api`; web should configure `VITE_API_BASE_URL` with this documented default and preserve endpoint paths/payloads from mobile.
- Verified from `apps/mobile/src/modals/LoginModal.tsx`: an existing user's Firebase phone-auth path uses the Firebase ID token as the session token; PIN login and registration use the token returned by the backend. The web port should preserve this split exactly.
- Firebase web configuration comes from Vite environment variables; never commit real config secrets.
- Verified from `packages/core/src/api/notification-service.ts`: `registerToken` posts to `/api/notifications/register-token` with `{ user_id, fcm_token, platform }`; the shared platform type includes `web`. Web calls this existing function only after the user explicitly enables notifications. Backend acceptance still needs a live check.

## Porting strategy
- Similar-looking legacy web components are not equivalent until reviewed. Keep each row pending until APIs, state transitions, text, and loading/empty/error states are compared.
- Preserve existing files unless deletion is necessary for the no-Next.js requirement or a reviewed mobile counterpart supports removal.
- Manual Firebase console steps belong in `FIREBASE_SETUP.md`.


## Notifications compatibility finding
- `packages/core/src/api/notification-service.ts` defines `registerToken` for `POST /api/notifications/register-token`, body `{ user_id, fcm_token, platform }`, with `platform: 'web'` accepted by the shared type. The mobile login flow still leaves automatic registration after login as a TODO, but the endpoint and payload contract exist. Web registration therefore reuses this exact shared function after an explicit user action; it does not invent an endpoint. Server acceptance still needs runtime verification.

- Home surface reset: Home is one page-background surface; borders, separators, shadows, and rounded corners are removed with scoped global CSS. Avatar circles remain circular because the mobile UI uses circular avatars.
- Home scrolling: panes and Home modal scroll containers remain scrollable but hide scrollbar chrome using the `.no-scrollbar` utility and equivalent scoped selectors. No stable scrollbar gutter is reserved.
- Feed composer: guests do not see a composer; only authenticated users can create posts.
- Feed media: web uses a natural-image aspect ratio clamped between 16:9 and 4:5, capped by viewport height. This is a deliberate web adaptation to avoid oversized media while preserving mobile's full-width media.
- Chats cards: channel assignment rotates through the filtered/sorted channel pool by visible card position, rather than using a fixture hash, so adjacent cards use different channels when at least two are available.
