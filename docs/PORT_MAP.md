# Mobile-to-web port map

> **Historical inventory:** The detailed file counts and PENDING/SUSPECT labels below are a 2026-10-11 snapshot. They are not a current completion checklist; refresh them against the current cross-platform branch before making parity claims.

## Current tree audit (2026-11-03)
- Branch: `web-port-from-master`
- Latest validated head: `b445b0421f80947ded757e7c469c7c6899aba6fc`
- `apps/mobile/src`: 75 files
- Same-relative-path counterparts in `apps/web/src`: 74
- Mobile-only same-path file: `components/AdCarousel.tsx`; the browser messaging surface uses the web-specific `AdSenseCarousel`.
- Web-only source files: 17
- Path presence does not establish functional parity. Use behavior, API, loading/error states, accessibility and responsive interaction tests for completion decisions.
- Current automated validation is recorded in `docs/PORT_REPORT.md`; remaining work is tracked in `docs/REMAINING.md` and `docs/APPCACHE_PARITY_MIGRATION.md`.

---

Source of truth for the historical table below: `master` at `84255b277d0568b05986aba8ec54daf748871b7b`. The file counts, line counts and PENDING/SUSPECT labels are a 2026-10-11 snapshot. They must be refreshed before using individual rows as current status. The required web target for each row is `apps/web/src/<same relative path>`; a similar filename or a passing typecheck is not proof of behavioral parity.

**Status:** `PENDING` means not yet ported and verified in that historical snapshot. No row is considered complete based on a similar name alone.

| Mobile source | Lines | Historical web counterpart / finding | Snapshot status |
|---|---:|---|---|
| `src/components/ChatsCard.tsx` | 504 | `apps/web/src/components/ChatsCard.tsx` | SUSPECT (26% line count) |
| `src/components/FloatingPillTabBar.tsx` | 98 | `apps/web/src/components/FloatingPillTabBar.tsx` | SUSPECT (36% line count) |
| `src/components/FooterPill.tsx` | 75 | `apps/web/src/components/FooterPill.tsx` | SUSPECT (32% line count) |
| `src/components/HistoryCard.tsx` | 253 | `apps/web/src/components/HistoryCard.tsx` | SUSPECT (30% line count) |
| `src/components/PostCard.tsx` | 237 | `apps/web/src/components/PostCard.tsx` | SUSPECT (31% line count) |
| `src/components/SmartMedia.tsx` | 59 | `apps/web/src/components/SmartMedia.tsx` | SUSPECT (36% line count) |
| `src/components/WalletCard.tsx` | 94 | `apps/web/src/components/WalletCard.tsx` | PORTED |
| `src/components/ui/ActionButton.tsx` | 78 | `apps/web/src/components/ui/ActionButton.tsx` | SUSPECT (33% line count) |
| `src/components/ui/Avatar.tsx` | 84 | `apps/web/src/components/ui/Avatar.tsx` | SUSPECT (31% line count) |
| `src/components/ui/Chip.tsx` | 86 | `apps/web/src/components/ui/Chip.tsx` | SUSPECT (31% line count) |
| `src/components/ui/CountryCodePicker.tsx` | 136 | `apps/web/src/components/ui/CountryCodePicker.tsx` | SUSPECT (34% line count) |
| `src/components/ui/FeedItem.tsx` | 48 | `apps/web/src/components/ui/FeedItem.tsx` | SUSPECT (42% line count) |
| `src/components/ui/ListsStates.tsx` | 129 | `apps/web/src/components/ui/ListsStates.tsx` | SUSPECT (23% line count) |
| `src/components/ui/LiveBadge.tsx` | 34 | `apps/web/src/components/ui/LiveBadge.tsx` | SUSPECT (41% line count) |
| `src/components/ui/Scoreline.tsx` | 88 | `apps/web/src/components/ui/Scoreline.tsx` | SUSPECT (34% line count) |
| `src/components/ui/Segmentedcontrol.tsx` | 71 | `apps/web/src/components/ui/Segmentedcontrol.tsx` | SUSPECT (34% line count) |
| `src/components/ui/Voterstack.tsx` | 108 | `apps/web/src/components/ui/Voterstack.tsx` | SUSPECT (45% line count) |
| `src/components/ui/button.tsx` | 90 | `apps/web/src/components/ui/button.tsx` | SUSPECT (28% line count) |
| `src/components/ui/input.tsx` | 69 | `apps/web/src/components/ui/input.tsx` | SUSPECT (41% line count) |
| `src/components/ui/miniAvatar.tsx` | 50 | `apps/web/src/components/ui/miniAvatar.tsx` | SUSPECT (42% line count) |
| `src/components/ui/postImages.tsx` | 163 | `apps/web/src/components/ui/postImages.tsx` | SUSPECT (43% line count) |
| `src/lib/api/media-service.ts` | 58 | `apps/web/src/lib/api/media-service.ts` | PORTED |
| `src/lib/api/notification-service.ts` | 969 | `apps/web/src/lib/api/notification-service.ts` | PORTED |
| `src/lib/api/posts-create.ts` | 93 | `apps/web/src/lib/api/posts-create.ts` | PORTED |
| `src/lib/auth/auth-context.tsx` | 213 | `apps/web/src/lib/auth/auth-context.tsx` | PORTED |
| `src/lib/auth/auth-validation.tsx` | 104 | `apps/web/src/lib/auth/auth-validation.tsx` | PORTED |
| `src/lib/firebase.ts` | 55 | `apps/web/src/lib/firebase.ts` | SUSPECT (42% line count) |
| `src/lib/toast/toast-context.tsx` | 111 | `apps/web/src/lib/toast/toast-context.tsx` | PORTED |
| `src/modals/AdminModal.tsx` | 1015 | `apps/web/src/modals/AdminModal.tsx` | PORTED — CI passed |
| `src/modals/AftermatchModal.tsx` | 913 | `apps/web/src/modals/AftermatchModal.tsx` | PORTED — functional review still required |
| `src/modals/ChannelCreation.tsx` | 979 | `apps/web/src/modals/ChannelCreation.tsx` | SUSPECT (9% line count) |
| `src/modals/ChannelCreationModal.tsx` | 91 | `apps/web/src/modals/ChannelCreationModal.tsx` | PORTED (72% line count) |
| `src/modals/CommentsModal.tsx` | 1043 | `apps/web/src/modals/CommentsModal.tsx` | PORTED — AppCache-backed; parity audit remains |
| `src/modals/ComradesModal.tsx` | 290 | `apps/web/src/modals/ComradesModal.tsx` | PORTED |
| `src/modals/HistoryModal.tsx` | 449 | `apps/web/src/modals/HistoryModal.tsx` | PORTED — functional review still required |
| `src/modals/LeaderboardModal.tsx` | 1998 | `apps/web/src/modals/LeaderboardModal.tsx` | PORTED — CI passed |
| `src/modals/Login-modal-context.tsx` | 138 | `apps/web/src/modals/Login-modal-context.tsx` | SUSPECT (34% line count) |
| `src/modals/LoginModal.tsx` | 960 | `apps/web/src/modals/LoginModal.tsx` | PENDING — shortened browser flow; OTP requires live verification |
| `src/modals/NotificationGate.tsx` | 100 | `apps/web/src/modals/NotificationGate.tsx` | PORTED |
| `src/modals/NotificationsModal.tsx` | 313 | `apps/web/src/modals/NotificationsModal.tsx` | SUSPECT (37% line count) |
| `src/modals/actionModal.tsx` | 2764 | `apps/web/src/modals/actionModal.tsx` | PORTED — functional review still required |
| `src/modals/addPostModal.tsx` | 834 | `apps/web/src/modals/addPostModal.tsx` | SUSPECT (7% line count) |
| `src/modals/channelHeader.tsx` | 38 | `apps/web/src/modals/channelHeader.tsx` | PORTED |
| `src/modals/comradelist/comradeCard.tsx` | 279 | `apps/web/src/modals/comradelist/comradeCard.tsx` | SUSPECT (24% line count) |
| `src/modals/comradelist/index.tsx` | 1190 | `apps/web/src/modals/comradelist/index.tsx` | PORTED — behavior parity still needs review |
| `src/modals/comradelist/types.ts` | 43 | `apps/web/src/modals/comradelist/types.ts` | PORTED |
| `src/modals/joingroupmodal.tsx` | 794 | `apps/web/src/modals/joingroupmodal.tsx` | SUSPECT (5% line count) |
| `src/modals/match/lineupsTab.tsx` | 362 | `apps/web/src/modals/match/lineupsTab.tsx` | SUSPECT (20% line count) |
| `src/modals/match/matchDetailsModals.tsx` | 500 | `apps/web/src/modals/match/matchDetailsModals.tsx` | Lineups/Stats navigation Playwright-verified; full modal parity not yet audited |
| `src/modals/match/pitchView.tsx` | 1119 | `apps/web/src/modals/match/pitchView.tsx` | SUSPECT (18% line count) |
| `src/modals/match/statsTab.tsx` | 236 | `apps/web/src/modals/match/statsTab.tsx` | SUSPECT (30% line count) |
| `src/modals/profile/ChannelLeaderboard.tsx` | 563 | `apps/web/src/modals/profile/ChannelLeaderboard.tsx` | PORTED — CI passed |
| `src/modals/profile/ProfileModal.tsx` | 1121 | `apps/web/src/modals/profile/ProfileModal.tsx` | PORTED — CI passed |
| `src/modals/profile/index.tsx` | 1072 | `apps/web/src/modals/profile/index.tsx` | PORTED — CI passed |
| `src/modals/profile/paymentsDialogs.tsx` | 715 | `apps/web/src/modals/profile/paymentsDialogs.tsx` | PORTED — physical flow verification required |
| `src/modals/profile/types.ts` | 68 | `apps/web/src/modals/profile/types.ts` | PORTED |
| `src/navigation/RootNavigator.tsx` | 50 | `apps/web/src/navigation/RootNavigator.tsx` | Browser routes present; route parity audit remains |
| `src/screens/ChatsScreen.tsx` | 602 | `apps/web/src/screens/ChatsScreen.tsx` | Ported; full behavior parity audit remains |
| `src/screens/FeedScreen.tsx` | 368 | `apps/web/src/screens/FeedScreen.tsx` | Ported; full behavior parity audit remains |
| `src/screens/MessageScreen.tsx` | 1640 | `apps/web/src/screens/MessageScreen.tsx` | Ported with remaining pagination/dependent-modal parity review |
| `src/screens/home/HomeScreen.tsx` | 151 | `apps/web/src/screens/home/HomeScreen.tsx` | Ported — responsive Playwright checks passed |
| `src/screens/home/appHeader.tsx` | 460 | `apps/web/src/screens/home/appHeader.tsx` | Browser adaptation; full action parity review remains |
| `src/screens/home/header-inset.tsx` | 13 | `apps/web/src/screens/home/header-inset.tsx` | PORTED |
| `src/screens/home/home-context.tsx` | 386 | `apps/web/src/screens/home/home-context.tsx` | Shared context present; parity review remains |
| `src/theme.ts` | 16 | `apps/web/src/theme.ts` | PORTED |
| `src/theme/index.ts` | 29 | `apps/web/src/theme/index.ts` | PORTED |
| `src/theme/layout.ts` | 24 | `apps/web/src/theme/layout.ts` | PORTED |
| `src/theme/use-fan-colors.ts` | 27 | `apps/web/src/theme/use-fan-colors.ts` | PORTED |
| `src/theme/use-fan-shadow.ts` | 46 | `apps/web/src/theme/use-fan-shadow.ts` | SUSPECT (48% line count) |
| `src/theme/use-fan-typography.ts` | 51 | `apps/web/src/theme/use-fan-typography.ts` | SUSPECT (49% line count) |

## Historical same-path audit (2026-10-11)
A recursive tree comparison then found 70 mobile source files, 70/70 same-path web counterparts, and 0 missing paths. This is superseded by the current 2026-11-03 tree audit above. The newer current tree contains 75 mobile source files, 74 same-path web counterparts, one mobile-only `AdCarousel.tsx`, and 17 web-only source files.

## Completion rule
For each feature, compare behavior—not just paths or line counts—including API calls, state transitions, visible strings, loading/empty/error states, accessibility and responsive interaction. CI validates type safety, lint and bundling; it does not prove every feature is behaviorally or visually identical.

## Home responsive verification
The current head passed automated Playwright checks for the Home shell and Feed layout, and ChatsCard at 360, 390, 600, 700, 1280 and 1920px. The test does not replace live scrolling, real media playback, device testing, or verification against production API responses. Prettier has not been run in a local checkout.
