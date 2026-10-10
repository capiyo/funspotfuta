# Web-to-mobile parity audit

Audit date: 2026-10-10  
Reference: current `apps/mobile/src` on `master`; web target: React + Vite on `chore/monorepo-clean-mobile-parity`.

This is a source-level audit plus automated CI verification. It is **not** a claim of live browser/backend acceptance testing.

## Route and screen review

| Web route/screen | Mobile reference | Review result |
|---|---|---|
| `/`, `/home?tab=chats` | `screens/home/HomeScreen.tsx`, `screens/ChatsScreen.tsx` | Web Home includes API-backed fixtures, channel selection/browse/join/create, fixture status filters, refresh/error handling, live fixture count, match details, vote/pledge and chat modals. Mobile's animated overlay header and floating-tab presentation are not identical. |
| `/home?tab=feed`, `/feed` | `screens/FeedScreen.tsx` | Uses persisted infinite-query data, paged loading, post creation, optimistic likes, follow calls, refresh and browser share/clipboard. Comments and repost remain placeholders in both current implementations. |
| `/home?tab=logs`, `/history`, `/logs` | `screens/HistoryScreen.tsx`, mobile history/logs flows | Logs tab is reachable from Home. History/live loading failures are handled; filler fans are development-only. Web History UI is not pixel-identical to the mobile list. |
| `/login` | `modals/LoginModal.tsx` | Browser Firebase phone OTP + reCAPTCHA, PIN fallback, and existing core registration/login endpoints are present. SMS delivery still requires correct Firebase authorized domains/configuration and testing on the deployed HTTPS origin. |
| `/trending` | `screens/TrendingScreen.tsx` | Uses core trending-market fetch and vote services; load/vote failures have visible handling and guest voting redirects to login. Live vote outcomes have not been tested. |
| `/fixture/:matchId` | `screens/FixtureDetailScreen.tsx` | Fixture, vote, pledge, sub-market and comment flows are present; channel ID lookup supports the current `channelId` shape. Backend interactions have not been exercised in a live browser session. |
| `/profile`, `/profile/:profileId` | Mobile profile flows | Own-profile summary, wallet, navigation, logout and editing for nickname/favorite club/country are present. A read-only other-member profile route and leaderboard-to-profile link are present. Profile-specific channel leaderboard presentation may still differ from mobile. |
| Chat modal opened from Home | Mobile `MessageScreen.tsx` | Web modal supports channel selection, message history/send, reply, image attachments and vote-gated input. Mobile uses a dedicated navigation screen, so presentation/navigation differs. Video messages are not implemented in the current mobile screen either. |
| `/comrades` | Mobile comrades/profile flows | Search/add/remove flows are present in web. Live account permissions and real account data still need runtime validation. |
| `/leaderboard` | Mobile `LeaderboardModal.tsx` | Ranking/filter/member-detail and profile navigation flows are present. Live account data still needs runtime validation. |
| `/notifications` | Mobile notification flows | Unread summary and preference controls are present. Web FCM token registration, background service worker and foreground notification feedback are wired; delivery depends on Firebase, HTTPS, browser permission and backend configuration. |
| `/admin/:channelId` | Mobile admin flows | Channel stats, member removal, payout computation and refresh are present. Current mobile admin port excludes deposit/withdraw controls and channel switching. Live authorization and payout results are unverified. |
| Match details, lineups, pitch/stats, vote/pledge and aftermatch overlays | Mobile match modals | Web implementations and core-backed vote/pledge services are present. Live payment/vote outcomes and responsive presentation have not been browser-tested. |
| Channel creation, comrades, leaderboard and notification overlays | Corresponding mobile modal implementations | Components and route/import wiring exist; live permissions, empty/error states and visual behavior need runtime acceptance checks. |

## Automated checks verified

Latest checked Typecheck workflow for head commit `8ca04f19d19a336447e255de43be155f943358ef` completed successfully on 2026-10-09:

- `npm install`
- `npm run typecheck:core`
- `npm run typecheck:web`
- `npm run build --workspace=funspot-web`
- `npm run typecheck:mobile`

Workflow run: https://github.com/capiyo/funspotfuta/actions/runs/37981189202

## Infrastructure and integrity

- Web uses React, React Router and Vite; Next.js is not used for runtime routing/build.
- QueryProvider uses persisted React Query cache with browser storage.
- Existing core API endpoints and request shapes were not intentionally changed in this parity pass.
- Production history filler fans are disabled; only real service-backed people appear in production.
- The workflow covers TypeScript and production build, but not browser-based or authenticated end-to-end tests.

## Remaining work / validation limits

1. No live browser session, responsive screenshot comparison, Firebase SMS test, or authenticated end-to-end backend test has been completed; runtime correctness is therefore not certified.
2. Confirm all route flows in a browser with a real test account, especially login, chat send/retry, fixture vote/pledge, profile edit, wallet, comrades, notifications and admin actions.
3. Confirm browser push delivery on the deployed HTTPS domain with Firebase and backend token registration configured.
4. Review visual parity at mobile and desktop breakpoints. The web chat remains a modal while mobile uses a dedicated screen; the Home tab/header presentation differs.
5. Feed comment/repost actions are placeholders in both current implementations and are not a web-only parity regression, but they remain unfinished product functionality.
