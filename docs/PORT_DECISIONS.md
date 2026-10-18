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

## Feed and first-open data loading (2026-10-13)
- The Feed column contains posts only. Post creation remains in `addPostModal.tsx`, launched by a logged-in-only **Post** action in the profile sidebar; creating a post invalidates the feed query.
- Root cause of first-open blank/stale columns: fixture fetching was disabled on narrow screens until the Chats tab became active, so both columns did not prefetch on mount. Web query defaults also had only one retry and a 15-second stale time; public-channel fetches in core swallowed HTTP/network failures into `[]`, which React Query treated as a successful empty result. Web now fetches fixtures, posts, and public channels with explicit response validation, a 60-second abort timeout for GET requests, shared retry defaults, and a 10-second visible-column retry while empty.
- The web app does not configure persisted query-cache restoration. React Query does not cache rejected query functions as data; the web channel query now throws for failed or malformed responses instead of converting them to empty results. A genuinely empty successful API response remains a valid empty result, with Refresh and periodic retry available.
- Auth hydration is represented by `isInitialized`; route content waits for it while guest sessions hydrate to an initialized anonymous state. When the hydrated user ID, login state, or token changes, active fixtures, channels, and feed queries are invalidated. Guest queries are not gated on login.


## Narrow Home mobile parity (2026-10-14)
- Narrow screens (<=650px) now use the mobile app's two-row AppHeader structure: Saira Condensed Funspot brand, notifications, refresh, avatar/menu (guest menu icon plus Join), horizontally scrolling channel chips, safe-area top inset, and the native 220–260ms fade/slide behavior. The desktop navbar and sidebar remain visible only above this breakpoint.
- The floating Chats/Feed pill mirrors mobile's MessageCircle/Newspaper icons, lowercase labels, active primary pill, rounded surface, spacing, elevation-like shadow, bottom/sides margins and safe-area inset. One column is visible at a time; existing list bottom insets are retained.
- The mobile menu opens a focus-trapped, Escape/backdrop/route-dismissable profile drawer. It reuses the web profile sidebar content, including guest sign-in, Post, balance actions, stats, channels/leaderboard, and adds create/join channel actions. Body scrolling is locked while open; channel selection navigates to that channel's chat.
- Browser adaptations: native React Native Modal/safe-area APIs and elevation cannot be reproduced literally in a browser; they are implemented with a React portal, CSS safe-area env values, keyboard focus management, and a CSS shadow. No data-fetching or retry code was changed for this task, and no mobile files were edited.


## Narrow Home menu parity (2026-10-15)
- Native AppHeader menu order found in mobile: Create Post, Create Channel, Profile, Comrades, History, Admin Dashboard (only when an active channel ID exists, matching the native menu entry point), Logout. Web additionally exposes Login for guests, Notifications, and Join Channel choices.
- Profile, channel creation, admin, comrades, history, post creation, login, logout, and notifications use existing web modal/auth handlers. Profile balance, stats and leaderboard remain in ProfileModal/profile content rather than becoming the menu itself.
- Browser dialog uses the existing portal, Escape/backdrop dismissal, focus trap and body scroll lock. React Native Modal and safe-area/elevation behavior are adapted to browser portal/CSS.
- Media reserves a 4:5 frame, begins loading immediately, retries a failed individual media URL once after three seconds, then shows Tap to retry. No fetching, query retry, cache, or API code changed.


## Shared compact Home menu (2026-10-15)
- Mobile menu items and order copied into one shared desktop/mobile popover: Login for guests / Logout for signed-in users, Create Post (signed-in users), Create Channel, Profile, Comrades, History, Notifications, Admin Dashboard (only when an active channel ID exists, matching the native menu entry point).
- The previous Join Channel list and profile/group content are not part of the menu. Desktop and narrow layouts share the same menu state and action handlers. The popover uses a browser portal, focus trap, Escape and outside-click dismissal; React Native modal presentation is adapted to an anchored 220px browser popover.


## Shared profile surface (2026-10-15)
- The sidebar must render the existing web port of the mobile `ProfileModal` directly; profile fetching, editing, balance/payment dialogs, logout, and leaderboard behavior stay in that one flow rather than being reimplemented in `ProfileSidebar`.
- `ProfileSidebar` now only owns its container, the logged-in Post action, and channel-selection callbacks. The separate mock-only guest identity, balance/stats cards, channel list, and leaderboard markup were removed from the sidebar component.
- The profile palette is sourced from `useFanColors()` / the core fan color tokens. Profile-specific surfaces may use the profile's rounded cards and green-tinted borders; Home's no-border/no-rounding rule remains scoped to the other Home surfaces.
- Remaining follow-up for this pass: split the current large profile implementation into `ProfileContent` plus small presentational components and replace the profile modal's current shell with the specified desktop-centered / narrow bottom-sheet shell. Those structural changes require extracting shared UI without duplicating the existing data and payment logic.


## Profile implementation follow-up (2026-10-15)
- Profile leaderboard member rows use a bottom-only green-tinted border; no surrounding card border or rounded corners.
- The profile content still imports the web native-compat adapter. A true pure-React/DOM conversion of the profile, leaderboard, and payment dialogs remains outstanding and must preserve the existing API/auth/payment behavior.
- Guest presentation must be keyed to the absence of an authenticated user, rather than treating a missing profile for an authenticated user as the guest state. This behavior still requires implementation and verification.


## Desktop Chats card rhythm verification (2026-10-18)
- Desktop-only (min-width: 651px) Chats cards use 14px top/left/right inset, 12px bottom inset, 28px header row, 4px league offset, 10px comment offset, and 12px action-row offset. Card-to-card spacing is 8px.
- Desktop columns use minmax(0, clamp(440px, 30vw, 560px)) minmax(0, 1fr) with a 5px gap; Feed cards cap at 840px and align to the left of the Feed column. Chats cards and the filter row fill the Chats column.
- scripts/verify-home-layout.mjs measures desktop card heights, row geometry, column/filter edges, horizontal overflow, and screenshots at 1024/1280/1440/1920px. It also supports recording/comparing the 390px baseline. Browser execution and the parent-commit baseline comparison must be run in an environment with Playwright/Chromium and the app's fixture routes available.


## Desktop ChatsCard Poke and team logos
- Repository source search across `apps/mobile`, `packages/core`, and `apps/web` found no existing Poke feature or Poke API. Poke therefore uses the exact existing Vote handler: guests go through `requireLogin`, signed-in users open the existing vote modal, and completed fixtures retain the current Results behavior. No endpoint was invented.
- The mapped `Fixture` type in `packages/core/src/types/fixture.ts` does not define team-logo properties and `fixtureFromJson` does not preserve logo payload fields. The web hook checks common camelCase/snake_case home/away logo, crest, and badge fields when present on a mapped fixture; otherwise it uses only TheSportsDB public search endpoint and caches/rate-limits lookups.
