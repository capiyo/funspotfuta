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

- Chats channel source: `useAllChannels` calls the existing core `getAllChannels`, which requests `GET /api/channels/all` and is explicitly documented in core as usable without auth. The visible pool merges that public/discoverable result with joined channels by `channelId`, preferring joined-channel records when duplicate IDs occur.
- Chat channel assignment: cards rotate through the already filtered/sorted fixture list by index. Vote/pledge/review modals receive the assigned card channel ID; chat and comments use it as well. The existing core `castFixtureVote` endpoint is global (`POST /api/actions/vote/cast`) and has no `channel_id` field, so it remains unchanged rather than inventing an API shape; pledge and review use the selected channel ID.
- Media: post video URLs are rendered with a real `<video>`, not an image. Playback observes a 60% visibility threshold, pauses offscreen, and a module-level active-video reference prevents concurrent playback. Image/video aspect ratios clamp to 4:5–16:9, with viewport height caps.
- Small modal fixes: comments show response counts and the exact first-comment empty copy, without a post-caption block; channel creation uses the requested effect dependency exception, black Create button text, and corrected `EyeOff` JSX.
- Narrow Home: Chats/Feed remain the existing mobile-style tabs; the profile sidebar collapses to a compact identity/sign-in strip on narrow screens.
- Existing behavior verified by source inspection: `useHomeList().scrollProps.onScroll` already reads `event.currentTarget.scrollTop`; no change was needed.

- If the public-channel request fails or returns no channels and the user has no joined channels, fixture cards are withheld and the empty/error state exposes Refresh. A fixture must never fall back to showing its league as a fake channel title.
- Media placeholder ratio starts at 4:3 when the API does not supply intrinsic dimensions, then updates to the natural ratio clamped to 4:5–16:9. This follows the mobile image component's placeholder behavior. The shared Post model currently strips intrinsic image dimensions, so the initial ratio cannot be derived from API metadata without changing core, which is outside this web-only scope.
- Home's global reset includes portal-rendered dialogs because the profile, login, vote, comments, and review modals render outside the .home-screen element. Circular avatar classes are the only radius exception.
- The existing core `getAllChannels` catches network/non-2xx failures and returns an empty array. When there are no joined channels either, web shows a refreshable empty state instead of rendering fixtures with a league label as a channel name.

## Home visual and interaction verification (2026-10-13)
- Desktop profile sidebar is fixed at 300px; below 651px it becomes a compact identity strip and Chats/Feed are switched by the existing tabs.
- Home and portal-rendered modal content keep native scrolling but hide scrollbar chrome. The CSS reset removes borders, outlines, shadows and corner radii, restoring circular radii only for user-avatar elements that are circular in the mobile UI.
- Feed image placeholders start at 4:3 until intrinsic dimensions are known, then use the mobile-derived natural ratio clamped to 4:5–16:9; image loading remains lazy and async. This is a browser layout adaptation, not a change to post data.
- Video playback is exclusive across cards: both visibility-triggered autoplay and a manual play action claim the shared active-video slot; videos pause when no longer at least 60% visible.
- Refresh is exposed for fixture errors, public-channel errors, or an empty displayed list. Public channels are fetched through the existing core `getAllChannels` function (the documented `GET /api/channels/all` endpoint); no endpoint or payload shape was added.
- Source review found the requested small fixes already present in `CommentsModal.tsx`, `ChannelCreation.tsx`, and `home-context.tsx`; no additional auth, backend, or mobile changes were made for those items.
