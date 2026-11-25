# Master consolidation ledger

## Execution baseline

- Destination: `master`.
- Starting master SHA: `4510ea6c753b66d43b2deaff5191015631098c89`.
- Integrated source heads: `seo-app-at-root` (`43733059544637bab356adb12dd2f2bbc8b6df86`) and `seo-public-home-app-subpath` (`753bf744aac0a2d7361e3f502fef893bd286595d`).
- Branches discovered: 22 (including master); all listed heads were captured before consolidation.
- The integration commit uses master as its first parent and preserves both source branch histories as additional parents.
- No historical branch is deleted or rewritten. No production deployment or backend/Flutter repository modification is performed.

## Branch inventory and disposition

| Branch | Head SHA | Reconciliation decision |
|---|---|---|
| `adsense-web-integration` | `ee291e6d81e2669d851fd910a0640d60ad37e6dc` | RECONCILED — current AdSense/AdMob integration and carousel implementation retained. |
| `chore/monorepo-clean-mobile-parity` | `84c8508b579bbc1e20f73f08f5e58aa285212216` | EXCLUDED_WITH_REASON — older/legacy web-port architecture superseded; no wholesale copy. |
| `chore/web-only-react-parity` | `0adc8e0ec0d0672331da5dfd0ca709d844d16f88` | EXCLUDED_WITH_REASON — older/legacy web-port architecture superseded; no wholesale copy. |
| `feat/react-web-mobile-parity` | `ccecde213de6990354ff666d8a3b718c025dea14` | EXCLUDED_WITH_REASON — older/legacy web-port architecture superseded; no wholesale copy. |
| `feature/appcache-live-commentary-feed-comments` | `96c7975568d7732a617731e5d277ed6f0d25b692` | RECONCILED — persistent commentary/feed-comment cache and auth cache safeguards are present in current source. |
| `feature/balance-desktop-chats-feed-widths` | `b841eb38c2a6c3eab6d8ebdac8185bf43e1c4518` | RECONCILED — current desktop Chats/Feed column implementation retained. |
| `feature/chat-unread-mentions` | `a7ddaa733b0ab0b7c053272a1b982b1054200e76` | RECONCILED — current unread/mention implementation retained; CI normalized to master. |
| `feature/fix-two-sided-lineups-player-portraits` | `e64b879769594eef2436f22170dfdbe6803e7f87` | IMPLEMENTED — two-sided lineup, portrait, crest, formation and rating behavior reconciled and corrected. |
| `feature/live-possession-statistics-client` | `b2085dddacaa25cd2f4f484393cb8f2d3c74ba6f` | RECONCILED — typed statistics events and mobile live updates are present in current source. |
| `feature/possession-card-interaction` | `7984f2e5e2865a3a70eaa5afd357a5a137f6be34` | RECONCILED — current possession-card interaction retained. |
| `feature/round-profile-avatars` | `14d247807ea4ecb17afbeb44bc93f7300b245857` | RECONCILED — current round-avatar components retained. |
| `feature/srs-cpp-zig-video-platform` | `25a1be4e0ae6f0d5b353bb71bb6e1fe0cd562da7` | IMPLEMENTED — C++/Zig/SRS/Nginx infra and CI preserved; frontend Watch UI blocked pending backend grant and licensed ingest verification. |
| `feature/whatsapp-notification-parity` | `02fcdf0378ea84f996cb6bb1f3876ce7af6244bf` | RECONCILED — notification URL and channel/fixture fallback handling retained. |
| `fix/login-terms-messaging-ad-carousel` | `da6c39be0ba6367b6dee784a0db103a8ab694d1b` | EXCLUDED_WITH_REASON — square/low-visibility consent variant conflicts with circular green consent requirement; circular control implemented. |
| `fix/react-web-from-master` | `84255b277d0568b05986aba8ec54daf748871b7b` | EXCLUDED_WITH_REASON — older/legacy web-port architecture superseded; no wholesale copy. |
| `fix-live-status-transition` | `27b7eb0104ff3ea255bb002dfded908adeedf6ec` | RECONCILED — shared fixture live-status resolver and platform call sites retained. |
| `fix-live-status-transition-web-port` | `b0fc8f5e5e197fafe85c31dc0115f2acf31635e6` | RECONCILED — shared fixture live-status resolver and platform call sites retained. |
| `master` | `4510ea6c753b66d43b2deaff5191015631098c89` | MERGED — retained as first parent; fixture/player data contracts retained. |
| `player-ratings-and-assets` | `00bd638023020087d89ff2cec5c1f6e31e329c41` | IMPLEMENTED — fixture crest/player portrait/rating contracts retained; rating UI added to both platforms. |
| `seo-app-at-root` | `43733059544637bab356adb12dd2fbbc8b6df86` | MERGED — current app source; root SSR architecture excluded. |
| `seo-public-home-app-subpath` | `753bf744aac0a2d7361e3f502fef893bd286595d` | MERGED — static public pages and /app architecture; unique comment/consent work reconciled. |
| `web-port-from-master` | `edf0f4739e22d81ddf965ab87a6f28b941aeb292` | EXCLUDED_WITH_REASON — older/legacy web-port architecture superseded; no wholesale copy. |

## Architecture decisions

- Vite + React DOM + TypeScript + Tailwind + React Router remain the web stack; no Next.js app, `page.tsx`, or React Native Web dependency is introduced.
- The public site is static at `/`; the application is built to `/app/`. Netlify redirects preserve the canonical `www` host and route legacy message/comment/login links into the app.
- The Firebase messaging service worker remains root-scoped; notification URLs are normalized to `/app/`.
- The SSR-at-root implementation and its production deployment script were excluded because they conflict with the selected static-public-root plus /app SPA architecture.
- The shared fixture status resolver is retained to prevent early `live` transitions. Live statistics event handling remains typed and fixture-scoped.
- Query persistence retains live commentary and post-comment data. Existing WebSocket chat delivery semantics are preserved; only failed optimistic sends are marked failed when delivery throws.
- Nested comment replies are rendered recursively and inserted into the correct parent tree on both platforms.
- Lineup More/Less behavior is repaired; team crests, formations, portraits, and player ratings are displayed across web and mobile.
- Terms consent is circular with a visible green outline and accessible checked state on both platforms.
- The web channel leaderboard profile view now includes the contextual AdSense carousel after the fifth member; existing general and weekly leaderboard carousels retain the newer smooth-motion implementation.
- Profile avatar upload uses the shared cross-platform multipart `userId`/`userName` contract and does not attach a Bearer header; the existing post-upload flow is preserved.

## File-level comparison artifacts

The complete branch-head file comparisons are stored in `branch-file-matrix-01.json` through `branch-file-matrix-05.json`. They cover all 21 non-baseline branches relative to `seo-app-at-root`; every returned comparison reported `tooLarge=false`, so the provider did not truncate those path lists. The matrix records added, modified, deleted, and renamed paths with change counts.

## File-level conflicts found and resolved

| File | Conflict / defect | Resolution |
|---|---|---|
| `apps/web/src/main.tsx` | SSR-only entry did not mount the SPA from the static production shell. | Replaced with the static Vite mount entry. |
| `apps/web/src/bootstrap-app.tsx` | Router base must be the application subpath. | Both mount/hydrate routers use `/app`. |
| `apps/web/src/modals/match/lineupsTab.tsx` | More/Less referenced missing `showSquads` state. | Added controlled state and formation/crest header. |
| `apps/mobile/src/modals/match/lineupsTab.tsx` | Literal escaped newline made the state declaration invalid source. | Replaced with a real newline and added formation/crest header. |
| `apps/web/src/modals/match/pitchView.tsx` | Portrait data existed but rating was not displayed. | Added ratings to pitch labels and bench rows. |
| `apps/mobile/src/modals/match/pitchView.tsx` | Portrait data existed but rating was not displayed. | Added ratings to pitch labels and bench rows. |
| `apps/web/src/modals/CommentsModal.tsx` | Nested replies were not flattened for rendering or recursively updated. | Added recursive flatten/find/insert helpers and forced reload when parent is missing. |
| `apps/mobile/src/modals/CommentsModal.tsx` | Same nested reply rendering/update limitation. | Added matching recursive helpers and typed FlatList data. |
| `packages/core/src/api/use-channel-chat.tsx` | A thrown delivery error could leave an optimistic message pending. | Mark the optimistic message failed and rethrow; transport remains unchanged. |
| `apps/mobile/src/modals/LoginModal.tsx` | Consent checkbox border width was zero. | Added visible green circular border and accessibility state. |
| `apps/web/src/modals/LoginModal.tsx` | Consent control needed the same visible green treatment. | Applied matching circular green styling. |
| `apps/web/src/modals/profile/ChannelLeaderboard.tsx` | The profile channel leaderboard was missing its contextual ad placement. | Added the current AdSense carousel after the fifth member while retaining the newer carousel component. |
| `apps/web/scripts/generate-crawl-files.mjs`, `apps/web/scripts/check-public-placeholders.mjs` | CI had an exception for a reserved `.invalid` email. | Removed the exception; CI uses `ci-check@funspot.co.ke`. |

## Video-plane scope

The C++ worker, Zig gateway, SRS configuration, Nginx playback configuration, Compose files, security/rights documentation, and infrastructure CI are preserved under `infra/video`. The frontend Watch UI is not enabled by this consolidation: the branch documents a separate backend grant dependency and an authorized ingest source, neither of which can be verified or changed under this repository-only scope. No unlicensed stream is introduced.

## Verification status

- Repository branch inventory: completed (22 branches).
- Main source trees: compared and reconciled at branch heads.
- Targeted static routing, lineup, comment, consent, and chat failure-state changes: implemented.
- Local TypeScript, web build, mobile export, lint, unit, integration, and Playwright checks: NOT RUN in this remote GitHub editing environment. Do not treat them as passed.
- Master CI workflows: configured to run on push/pull request to `master`; their post-update results must be inspected before claiming validation.
- The web build requires a real `FUNSPOT_CONTACT_EMAIL` in the local environment. CI uses `ci-check@funspot.co.ke`.

## Remaining blocked work

1. Verify the backend video grant endpoint and licensed stream/ingest source before enabling the Watch UI.
2. Run the exact root package checks and both native platform exports after pulling master; fix any newly exposed compiler or bundler errors.
3. Inspect the resulting GitHub Actions runs and update this ledger with actual outcomes.
