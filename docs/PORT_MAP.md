# Mobile-to-web port map

Source of truth: `master` at `84255b277d0568b05986aba8ec54daf748871b7b`. This inventories all 70 regular files under `apps/mobile/src/`; line counts were read from the exact source files. The required web target for each row is `apps/web/src/<same relative path>`. Existing legacy counterparts are comparison leads only, not evidence of parity.

**Status:** `PENDING` means not yet ported and verified. No row is considered complete based on a similar name alone.

| Mobile source | Lines | Current web counterpart / finding | Port status |
|---|---:|---|---|
| `src/components/ChatsCard.tsx` | 504 | Missing; MatchCard is not equivalent | PENDING |
| `src/components/FloatingPillTabBar.tsx` | 98 | Missing; FloatingPillTabs is not verified equivalent | PENDING |
| `src/components/FooterPill.tsx` | 75 | legacy components/FooterPill.tsx | PENDING |
| `src/components/HistoryCard.tsx` | 253 | legacy components/HistoryCard.tsx | PENDING |
| `src/components/PostCard.tsx` | 237 | legacy components/PostCard.tsx | PENDING |
| `src/components/SmartMedia.tsx` | 59 | legacy components/SmartMedia.tsx | PENDING |
| `src/components/WalletCard.tsx` | 94 | legacy components/WalletCard.tsx | PENDING |
| `src/components/ui/ActionButton.tsx` | 78 | legacy components/ui/ActionButton.tsx | PENDING |
| `src/components/ui/Avatar.tsx` | 84 | legacy components/ui/Avatar.tsx | PENDING |
| `src/components/ui/Chip.tsx` | 86 | legacy components/ui/Chip.tsx | PENDING |
| `src/components/ui/CountryCodePicker.tsx` | 136 | missing | PENDING |
| `src/components/ui/FeedItem.tsx` | 48 | legacy components/ui/FeedItem.tsx | PENDING |
| `src/components/ui/ListsStates.tsx` | 129 | missing | PENDING |
| `src/components/ui/LiveBadge.tsx` | 34 | legacy components/ui/LiveBadge.tsx | PENDING |
| `src/components/ui/Scoreline.tsx` | 88 | missing; ScoreLine casing differs | PENDING |
| `src/components/ui/Segmentedcontrol.tsx` | 71 | missing; SegmentedControl casing differs | PENDING |
| `src/components/ui/Voterstack.tsx` | 108 | missing; VoterList not verified equivalent | PENDING |
| `src/components/ui/button.tsx` | 90 | missing; Button casing differs | PENDING |
| `src/components/ui/input.tsx` | 69 | missing; Input casing differs | PENDING |
| `src/components/ui/miniAvatar.tsx` | 50 | missing; MiniAvatar casing differs | PENDING |
| `src/components/ui/postImages.tsx` | 163 | missing | PENDING |
| `src/lib/api/media-service.ts` | 58 | legacy lib/api/media-service.ts | PENDING |
| `src/lib/api/notification-service.ts` | 969 | missing | PENDING |
| `src/lib/api/posts-create.ts` | 93 | legacy lib/api/posts-create.ts | PENDING |
| `src/lib/auth/auth-context.tsx` | 213 | legacy lib/auth/auth-context.tsx; auth parity unverified | PENDING |
| `src/lib/auth/auth-validation.tsx` | 104 | missing | PENDING |
| `src/lib/firebase.ts` | 55 | legacy lib/firebase.ts uses native SDK | PENDING |
| `src/lib/toast/toast-context.tsx` | 111 | legacy lib/toast/toast-context.tsx | PENDING |
| `src/modals/AdminModal.tsx` | 1015 | missing | PENDING |
| `src/modals/AftermatchModal.tsx` | 913 | components/aftermatchModal.tsx; not verified equivalent | PENDING |
| `src/modals/ChannelCreation.tsx` | 979 | missing; ChannelCreationModal is not equivalent | PENDING |
| `src/modals/ChannelCreationModal.tsx` | 91 | legacy components/ChannelCreationModal.tsx | PENDING |
| `src/modals/CommentsModal.tsx` | 1043 | missing | PENDING |
| `src/modals/ComradesModal.tsx` | 290 | missing | PENDING |
| `src/modals/HistoryModal.tsx` | 449 | missing | PENDING |
| `src/modals/LeaderboardModal.tsx` | 1998 | components/modals/leaderboardModal.tsx is only 574 lines; incomplete until proven otherwise | PENDING |
| `src/modals/Login-modal-context.tsx` | 138 | missing | PENDING |
| `src/modals/LoginModal.tsx` | 960 | missing; LoginScreen naming is not equivalent | PENDING |
| `src/modals/NotificationGate.tsx` | 100 | missing | PENDING |
| `src/modals/NotificationsModal.tsx` | 313 | missing | PENDING |
| `src/modals/actionModal.tsx` | 2764 | components/actionsModal.tsx; not verified equivalent | PENDING |
| `src/modals/addPostModal.tsx` | 834 | missing | PENDING |
| `src/modals/channelHeader.tsx` | 38 | missing | PENDING |
| `src/modals/comradelist/comradeCard.tsx` | 279 | missing | PENDING |
| `src/modals/comradelist/index.tsx` | 1190 | missing | PENDING |
| `src/modals/comradelist/types.ts` | 43 | missing | PENDING |
| `src/modals/joingroupmodal.tsx` | 794 | missing | PENDING |
| `src/modals/match/lineupsTab.tsx` | 362 | components/modals/LineupsTab.tsx; not verified equivalent | PENDING |
| `src/modals/match/matchDetailsModals.tsx` | 500 | components/modals/MatchDetailsModal.tsx; not verified equivalent | PENDING |
| `src/modals/match/pitchView.tsx` | 1119 | components/modals/PitchView.tsx; not verified equivalent | PENDING |
| `src/modals/match/statsTab.tsx` | 236 | components/modals/StatsTab.tsx; not verified equivalent | PENDING |
| `src/modals/profile/ChannelLeaderboard.tsx` | 563 | missing | PENDING |
| `src/modals/profile/ProfileModal.tsx` | 1121 | missing | PENDING |
| `src/modals/profile/index.tsx` | 1072 | missing | PENDING |
| `src/modals/profile/paymentsDialogs.tsx` | 715 | missing | PENDING |
| `src/modals/profile/types.ts` | 68 | missing | PENDING |
| `src/navigation/RootNavigator.tsx` | 50 | missing | PENDING |
| `src/screens/ChatsScreen.tsx` | 602 | missing; current home uses Arena instead of Chats | PENDING |
| `src/screens/FeedScreen.tsx` | 368 | legacy app/(app)/feed/page.tsx; parity unverified | PENDING |
| `src/screens/MessageScreen.tsx` | 1640 | missing | PENDING |
| `src/screens/home/HomeScreen.tsx` | 151 | legacy app/(app)/home/page.tsx uses Arena/Feed/Logs and is not equivalent | PENDING |
| `src/screens/home/appHeader.tsx` | 460 | WebNavbar is not equivalent; behavior not ported | PENDING |
| `src/screens/home/header-inset.tsx` | 13 | missing | PENDING |
| `src/screens/home/home-context.tsx` | 386 | missing | PENDING |
| `src/theme.ts` | 16 | missing | PENDING |
| `src/theme/index.ts` | 29 | missing | PENDING |
| `src/theme/layout.ts` | 24 | missing | PENDING |
| `src/theme/use-fan-colors.ts` | 27 | components/modals/use-fan-colors.ts; not verified equivalent | PENDING |
| `src/theme/use-fan-shadow.ts` | 46 | missing | PENDING |
| `src/theme/use-fan-typography.ts` | 51 | missing | PENDING |

## Completion rule
For each row, create the same relative path under `apps/web/src/`, convert the view layer to accessible DOM/Tailwind, and compare API calls, state transitions, visible strings, and loading/empty/error states against mobile. Do not mark a row complete until typecheck and parity review pass. Especially large files such as `LeaderboardModal.tsx` (1,998 lines), `MessageScreen.tsx` (1,640 lines), `ProfileModal.tsx` (1,121 lines), and `CommentsModal.tsx` (1,043 lines) must not be replaced with abbreviated versions.
