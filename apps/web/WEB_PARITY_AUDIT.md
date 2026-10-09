# Web-to-mobile parity audit

Audit date: 2026-10-09  
Reference: current `apps/mobile/src` on `master`; web target: React + Vite on `chore/monorepo-clean-mobile-parity`.

This is a page-by-page source review, not a claim of live browser/backend acceptance testing. TypeScript and production-build results are tracked by GitHub Actions.

## Route and screen review

| Web route/screen | Mobile reference | Review result |
|---|---|---|
| `/`, `/home?tab=chats` | `screens/home/HomeScreen.tsx`, `screens/ChatsScreen.tsx` | Web Home has a Chats/Arena section, API-backed fixtures, channel selection, channel creation access, vote/pledge and chat modals. Mobile's animated overlay header, browse/join channel flow and floating-tab presentation are not identical. |
| `/home?tab=feed`, `/feed` | `screens/FeedScreen.tsx` | Uses persisted infinite-query data, paged loading, create-post and optimistic like flows; follow calls the shared API; sharing uses browser share/clipboard where available. Comments and repost are placeholders in both current implementations. |
| `/home?tab=logs`, `/history`, `/logs` | `screens/HistoryScreen.tsx`, `modals/HistoryModal.tsx` | Logs tab is now reachable from Home. History/live loading failures are handled; deterministic filler fans only render in development. The web History UI is richer than the basic mobile Home Logs list. |
| `/login` | `modals/LoginModal.tsx` | Browser Firebase phone OTP + reCAPTCHA is implemented, with the existing PIN fallback and existing core registration/login endpoints retained. Real SMS delivery still requires browser-authorized Firebase domains/configuration and must be tested on the deployed HTTPS origin. |
| `/trending` | `screens/TrendingScreen.tsx` | Uses core trending-market fetch and vote services; load/vote failures now have visible handling and voting redirects guests to login. |
| `/fixture/:matchId` | `screens/FixtureDetailScreen.tsx` | Web contains fixture, vote, pledge, sub-market and comment flows. Channel ID lookup now supports the current `channelId` shape. Data/backend interaction has not been exercised in a live browser session. |
| `/profile` | `modals/profile/ProfileModal.tsx` | Web profile summary, wallet, navigation links and logout are present. It does not yet match mobile's full profile editor (nickname/favorite club/country), other-member profile view, and profile-specific channel leaderboard presentation. |
| Chat modal opened from Home | `screens/MessageScreen.tsx` | Web modal supports channel selection, message history/send, reply, image attachments and vote-gated input. Mobile uses a dedicated navigation screen; this web navigation/presentation difference remains. Video messages are not implemented in the current mobile screen either. |
| `/comrades` | `modals/ComradeListModal` / profile flows | Search/add/remove flows are present in web. Live account permissions/data still need runtime validation. |
| `/leaderboard` | `modals/LeaderboardModal.tsx` | Ranking/filter/member-detail flows are present in web. Live account data still needs runtime validation. |
| `/notifications` | `modals/NotificationsModal.tsx` | Unread summary and preference controls are present. Web FCM token registration, background service worker and foreground notification feedback are wired; delivery still depends on Firebase, HTTPS, permission and backend configuration. |
| `/admin/:channelId` | `modals/AdminModal.tsx` | Channel stats, member removal and payout computation are present. The current mobile admin port intentionally excludes deposit/withdraw controls and channel switching. Web confirms member removal and handles load errors; mobile additionally has pull-to-refresh, which is not yet mirrored in web. |
| Match details, lineups, pitch/stats, vote/pledge and aftermatch overlays | `modals/match/*`, `modals/actionModal.tsx`, `modals/AftermatchModal.tsx` | Web implementations and existing core-backed vote/pledge services were reviewed. Live payment/vote outcomes and responsive presentation have not been browser-tested. |
| Channel creation, comrades, leaderboard and notification overlays | Corresponding mobile modal implementations | Web components exist and routes/imports are connected; live permissions, empty/error states and visual behavior need runtime acceptance checks. |

## Infrastructure and integrity checks

- Web is built with React, React Router and Vite; it does not use Next.js routing at runtime.
- Web QueryProvider now restores persisted query cache using `PersistQueryClientProvider` and browser storage. Feed and fixtures use query-backed data.
- Core API endpoints and request shapes were not changed in this parity pass.
- Production history filler fans are disabled; only real service-backed people are shown in production.
- The automated workflow checks core TypeScript, web TypeScript, web production build and mobile TypeScript.

## Remaining validation limits

1. No live browser session, responsive screenshot comparison, Firebase SMS test, or authenticated end-to-end backend test was available during this pass.
2. Profile editing/other-member profiles and some mobile-specific Home navigation behavior still need implementation for full parity.
3. Browser push delivery must be confirmed on the deployed HTTPS domain with Firebase and backend token registration configured.
4. Visual parity cannot be certified by TypeScript/build checks alone.
