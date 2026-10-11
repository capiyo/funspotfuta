# Mobile-to-web port map

Source of truth: `master` at `84255b277d0568b05986aba8ec54daf748871b7b`. This inventories all 70 regular files under `apps/mobile/src/`; line counts were read from the exact source files. The required web target for each row is `apps/web/src/<same relative path>`. Existing legacy counterparts are comparison leads only, not evidence of parity.

**Status:** `PENDING` means not yet ported and verified. No row is considered complete based on a similar name alone.

| Mobile source | Lines | Current web counterpart / finding | Port status |
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
| `src/lib/auth/auth-context.tsx` | 213 | `apps/web/src/lib/auth/auth-context.tsx` (browser storage + Firebase token refresh) | PORTED |
| `src/lib/auth/auth-validation.tsx` | 104 | `apps/web/src/lib/auth/auth-validation.tsx` (byte-identical) | PORTED |
| `src/lib/firebase.ts` | 55 | `apps/web/src/lib/firebase.ts` (browser Firebase equivalent) | SUSPECT (42% line count) |
| `src/lib/toast/toast-context.tsx` | 111 | `apps/web/src/lib/toast/toast-context.tsx` | PORTED |
| `src/modals/AdminModal.tsx` | 1015 | MISSING — must port | PENDING |
| `src/modals/AftermatchModal.tsx` | 913 | MISSING — must port | PENDING |
| `src/modals/ChannelCreation.tsx` | 979 | `apps/web/src/modals/ChannelCreation.tsx` | SUSPECT (9% line count) |
| `src/modals/ChannelCreationModal.tsx` | 91 | `apps/web/src/modals/ChannelCreationModal.tsx` | PORTED (72% line count) |
| `src/modals/CommentsModal.tsx` | 1043 | `apps/web/src/modals/CommentsModal.tsx` (comments fetch/cache, nested replies, notifications, submit flow, keyboard dialog and Tailwind UI ported; web view is more compact than native styles) | PORTED — CI validation pending |
| `src/modals/ComradesModal.tsx` | 290 | `apps/web/src/modals/ComradesModal.tsx` | PORTED |
| `src/modals/HistoryModal.tsx` | 449 | MISSING — must port | PENDING |
| `src/modals/LeaderboardModal.tsx` | 1998 | MISSING — must port | PENDING |
| `src/modals/Login-modal-context.tsx` | 138 | `apps/web/src/modals/Login-modal-context.tsx` | SUSPECT (34% line count) |
| `src/modals/LoginModal.tsx` | 960 | `apps/web/src/modals/LoginModal.tsx` is a shortened web flow; full mobile flow still unported | PENDING |
| `src/modals/NotificationGate.tsx` | 100 | `apps/web/src/modals/NotificationGate.tsx` (browser permission requested only after click) | PORTED |
| `src/modals/NotificationsModal.tsx` | 313 | `apps/web/src/modals/NotificationsModal.tsx` | SUSPECT (37% line count) |
| `src/modals/actionModal.tsx` | 2764 | MISSING — must port | PENDING |
| `src/modals/addPostModal.tsx` | 834 | `apps/web/src/modals/addPostModal.tsx` (browser file picker; posts-create endpoint preserved) | SUSPECT (7% line count) |
| `src/modals/channelHeader.tsx` | 38 | `apps/web/src/modals/channelHeader.tsx` | PORTED |
| `src/modals/comradelist/comradeCard.tsx` | 279 | `apps/web/src/modals/comradelist/comradeCard.tsx` | SUSPECT (24% line count) |
| `src/modals/comradelist/index.tsx` | 1190 | MISSING — must port | PENDING |
| `src/modals/comradelist/types.ts` | 43 | `apps/web/src/modals/comradelist/types.ts` | PORTED |
| `src/modals/joingroupmodal.tsx` | 794 | `apps/web/src/modals/joingroupmodal.tsx` | SUSPECT (5% line count) |
| `src/modals/match/lineupsTab.tsx` | 362 | `apps/web/src/modals/match/lineupsTab.tsx` | SUSPECT (20% line count) |
| `src/modals/match/matchDetailsModals.tsx` | 500 | `apps/web/src/modals/match/matchDetailsModals.tsx` | SUSPECT (20% line count) |
| `src/modals/match/pitchView.tsx` | 1119 | `apps/web/src/modals/match/pitchView.tsx` (simplified view, suspect) | SUSPECT (18% line count) |
| `src/modals/match/statsTab.tsx` | 236 | `apps/web/src/modals/match/statsTab.tsx` | SUSPECT (30% line count) |
| `src/modals/profile/ChannelLeaderboard.tsx` | 563 | MISSING — must port | PENDING |
| `src/modals/profile/ProfileModal.tsx` | 1121 | MISSING — must port | PENDING |
| `src/modals/profile/index.tsx` | 1072 | MISSING — must port | PENDING |
| `src/modals/profile/paymentsDialogs.tsx` | 715 | MISSING — must port | PENDING |
| `src/modals/profile/types.ts` | 68 | `apps/web/src/modals/profile/types.ts` (logic copied unchanged) | PORTED |
| `src/navigation/RootNavigator.tsx` | 50 | MISSING — must port | PENDING |
| `src/screens/ChatsScreen.tsx` | 602 | `apps/web/src/screens/ChatsScreen.tsx` is 28 lines; mobile fixture list, voting, pledge, refresh and modal wiring still unported | PENDING |
| `src/screens/FeedScreen.tsx` | 368 | `apps/web/src/screens/FeedScreen.tsx` | SUSPECT (34% line count) |
| `src/screens/MessageScreen.tsx` | 1640 | `apps/web/src/screens/MessageScreen.tsx` is 30 lines; full mobile reply/media/vote/modal/message lifecycle behavior still unported | PENDING |
| `src/screens/home/HomeScreen.tsx` | 151 | `apps/web/src/screens/home/HomeScreen.tsx` has the requested desktop 3-column layout, but mobile state/layout parity remains unverified | PENDING |
| `src/screens/home/appHeader.tsx` | 460 | `apps/web/src/screens/home/appHeader.tsx` is a short navbar adaptation; full mobile header actions and channel creation remain unported | PENDING |
| `src/screens/home/header-inset.tsx` | 13 | `apps/web/src/screens/home/header-inset.tsx` | PORTED |
| `src/screens/home/home-context.tsx` | 386 | `apps/web/src/screens/home/home-context.tsx` | SUSPECT (57% line count) |
| `src/theme.ts` | 16 | `apps/web/src/theme.ts` | PORTED |
| `src/theme/index.ts` | 29 | `apps/web/src/theme/index.ts` | PORTED |
| `src/theme/layout.ts` | 24 | `apps/web/src/theme/layout.ts` | PORTED |
| `src/theme/use-fan-colors.ts` | 27 | `apps/web/src/theme/use-fan-colors.ts` | PORTED |
| `src/theme/use-fan-shadow.ts` | 46 | `apps/web/src/theme/use-fan-shadow.ts` | SUSPECT (48% line count) |
| `src/theme/use-fan-typography.ts` | 51 | `apps/web/src/theme/use-fan-typography.ts` | SUSPECT (49% line count) |

## Completion rule
For each row, create the same relative path under `apps/web/src/`, convert the view layer to accessible DOM/Tailwind, and compare API calls, state transitions, visible strings, and loading/empty/error states against mobile. Do not mark a row complete until typecheck and parity review pass. Especially large files such as `LeaderboardModal.tsx` (1,998 lines), `MessageScreen.tsx` (1,640 lines), `ProfileModal.tsx` (1,121 lines), and `CommentsModal.tsx` (1,043 lines) must not be replaced with abbreviated versions.


## Suspect files from prior port (line-count audit)

The prior run's 36 rows marked PORTED still require an automated mobile-vs-web line-count audit before being treated as parity-verified. Known suspects from the previous review: `src/components/ChatsCard.tsx`, `src/lib/auth/auth-context.tsx`, `src/modals/Login-modal-context.tsx`, and `src/screens/FeedScreen.tsx`. These have not been revalidated in this run.


## Previous-port line-count audit

The 41 rows marked PORTED before this audit were compared against the full source file on `master`. Rows below 60% of the mobile line count are marked `SUSPECT`; the ratio is a triage signal, not proof of missing behavior. They must be reviewed against mobile logic before claiming parity.

| File | Mobile lines | Web lines | Web/mobile |
|---|---:|---:|---:|
| `components/ChatsCard.tsx` | 504 | 133 | 26% |
| `components/FloatingPillTabBar.tsx` | 98 | 35 | 36% |
| `components/FooterPill.tsx` | 75 | 24 | 32% |
| `components/PostCard.tsx` | 237 | 74 | 31% |
| `components/SmartMedia.tsx` | 59 | 21 | 36% |
| `components/WalletCard.tsx` | 94 | 65 | 69% |
| `components/ui/ActionButton.tsx` | 78 | 26 | 33% |
| `components/ui/Avatar.tsx` | 84 | 26 | 31% |
| `components/ui/Chip.tsx` | 86 | 27 | 31% |
| `components/ui/CountryCodePicker.tsx` | 136 | 46 | 34% |
| `components/ui/FeedItem.tsx` | 48 | 20 | 42% |
| `components/ui/ListsStates.tsx` | 129 | 30 | 23% |
| `components/ui/LiveBadge.tsx` | 34 | 14 | 41% |
| `components/ui/Scoreline.tsx` | 88 | 30 | 34% |
| `components/ui/Segmentedcontrol.tsx` | 71 | 24 | 34% |
| `components/ui/Voterstack.tsx` | 108 | 49 | 45% |
| `components/ui/button.tsx` | 90 | 25 | 28% |
| `components/ui/input.tsx` | 69 | 28 | 41% |
| `components/ui/miniAvatar.tsx` | 50 | 21 | 42% |
| `components/ui/postImages.tsx` | 163 | 70 | 43% |
| `lib/api/media-service.ts` | 58 | 44 | 76% |
| `lib/api/notification-service.ts` | 969 | 1011 | 104% |
| `lib/api/posts-create.ts` | 93 | 74 | 80% |
| `lib/auth/auth-context.tsx` | 213 | 138 | 65% |
| `lib/auth/auth-validation.tsx` | 104 | 104 | 100% |
| `lib/firebase.ts` | 55 | 23 | 42% |
| `lib/toast/toast-context.tsx` | 111 | 89 | 80% |
| `modals/Login-modal-context.tsx` | 138 | 47 | 34% |
| `modals/NotificationGate.tsx` | 100 | 89 | 89% |
| `modals/NotificationsModal.tsx` | 313 | 117 | 37% |
| `modals/channelHeader.tsx` | 38 | 27 | 71% |
| `modals/comradelist/types.ts` | 43 | 30 | 70% |
| `screens/FeedScreen.tsx` | 368 | 125 | 34% |
| `screens/home/header-inset.tsx` | 13 | 13 | 100% |
| `screens/home/home-context.tsx` | 386 | 220 | 57% |
| `theme.ts` | 16 | 15 | 94% |
| `theme/index.ts` | 29 | 18 | 62% |
| `theme/layout.ts` | 24 | 22 | 92% |
| `theme/use-fan-colors.ts` | 27 | 27 | 100% |
| `theme/use-fan-shadow.ts` | 46 | 22 | 48% |
| `theme/use-fan-typography.ts` | 51 | 25 | 49% |
