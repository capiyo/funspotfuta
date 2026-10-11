# Mobile-to-web port map

Source of truth: `master` at `84255b277d0568b05986aba8ec54daf748871b7b`. This inventories all 70 regular files under `apps/mobile/src/`; line counts were read from the exact source files. The required web target for each row is `apps/web/src/<same relative path>`. Existing legacy counterparts are comparison leads only, not evidence of parity.

**Status:** `PENDING` means not yet ported and verified. No row is considered complete based on a similar name alone.

| Mobile source | Lines | Current web counterpart / finding | Port status |
|---|---:|---|---|
| `src/components/ChatsCard.tsx` | 504 | MISSING — must port | PENDING |
| `src/components/FloatingPillTabBar.tsx` | 98 | `apps/web/src/components/FloatingPillTabBar.tsx` | PORTED |
| `src/components/FooterPill.tsx` | 75 | MISSING — must port | PENDING |
| `src/components/HistoryCard.tsx` | 253 | MISSING — must port | PENDING |
| `src/components/PostCard.tsx` | 237 | MISSING — must port | PENDING |
| `src/components/SmartMedia.tsx` | 59 | MISSING — must port | PENDING |
| `src/components/WalletCard.tsx` | 94 | MISSING — must port | PENDING |
| `src/components/ui/ActionButton.tsx` | 78 | `apps/web/src/components/ui/ActionButton.tsx` | PORTED |
| `src/components/ui/Avatar.tsx` | 84 | `apps/web/src/components/ui/Avatar.tsx` | PORTED |
| `src/components/ui/Chip.tsx` | 86 | `apps/web/src/components/ui/Chip.tsx` | PORTED |
| `src/components/ui/CountryCodePicker.tsx` | 136 | MISSING — must port | PENDING |
| `src/components/ui/FeedItem.tsx` | 48 | `apps/web/src/components/ui/FeedItem.tsx` | PORTED |
| `src/components/ui/ListsStates.tsx` | 129 | MISSING — must port | PENDING |
| `src/components/ui/LiveBadge.tsx` | 34 | `apps/web/src/components/ui/LiveBadge.tsx` | PORTED |
| `src/components/ui/Scoreline.tsx` | 88 | `apps/web/src/components/ui/Scoreline.tsx` | PORTED |
| `src/components/ui/Segmentedcontrol.tsx` | 71 | `apps/web/src/components/ui/Segmentedcontrol.tsx` | PORTED |
| `src/components/ui/Voterstack.tsx` | 108 | MISSING — must port | PENDING |
| `src/components/ui/button.tsx` | 90 | MISSING — must port | PENDING |
| `src/components/ui/input.tsx` | 69 | MISSING — must port | PENDING |
| `src/components/ui/miniAvatar.tsx` | 50 | MISSING — must port | PENDING |
| `src/components/ui/postImages.tsx` | 163 | MISSING — must port | PENDING |
| `src/lib/api/media-service.ts` | 58 | Exists at matching path; parity not yet verified | PENDING |
| `src/lib/api/notification-service.ts` | 969 | Exists at matching path; parity not yet verified | PENDING |
| `src/lib/api/posts-create.ts` | 93 | `apps/web/src/lib/api/posts-create.ts` | PORTED |
| `src/lib/auth/auth-context.tsx` | 213 | Exists at matching path; parity not yet verified | PENDING |
| `src/lib/auth/auth-validation.tsx` | 104 | Exists at matching path; parity not yet verified | PENDING |
| `src/lib/firebase.ts` | 55 | Exists at matching path; parity not yet verified | PENDING |
| `src/lib/toast/toast-context.tsx` | 111 | `apps/web/src/lib/toast/toast-context.tsx` | PORTED |
| `src/modals/AdminModal.tsx` | 1015 | MISSING — must port | PENDING |
| `src/modals/AftermatchModal.tsx` | 913 | MISSING — must port | PENDING |
| `src/modals/ChannelCreation.tsx` | 979 | MISSING — must port | PENDING |
| `src/modals/ChannelCreationModal.tsx` | 91 | MISSING — must port | PENDING |
| `src/modals/CommentsModal.tsx` | 1043 | MISSING — must port | PENDING |
| `src/modals/ComradesModal.tsx` | 290 | MISSING — must port | PENDING |
| `src/modals/HistoryModal.tsx` | 449 | MISSING — must port | PENDING |
| `src/modals/LeaderboardModal.tsx` | 1998 | MISSING — must port | PENDING |
| `src/modals/Login-modal-context.tsx` | 138 | MISSING — must port | PENDING |
| `src/modals/LoginModal.tsx` | 960 | Exists at matching path; parity not yet verified | PENDING |
| `src/modals/NotificationGate.tsx` | 100 | MISSING — must port | PENDING |
| `src/modals/NotificationsModal.tsx` | 313 | MISSING — must port | PENDING |
| `src/modals/actionModal.tsx` | 2764 | MISSING — must port | PENDING |
| `src/modals/addPostModal.tsx` | 834 | MISSING — must port | PENDING |
| `src/modals/channelHeader.tsx` | 38 | MISSING — must port | PENDING |
| `src/modals/comradelist/comradeCard.tsx` | 279 | MISSING — must port | PENDING |
| `src/modals/comradelist/index.tsx` | 1190 | MISSING — must port | PENDING |
| `src/modals/comradelist/types.ts` | 43 | MISSING — must port | PENDING |
| `src/modals/joingroupmodal.tsx` | 794 | MISSING — must port | PENDING |
| `src/modals/match/lineupsTab.tsx` | 362 | MISSING — must port | PENDING |
| `src/modals/match/matchDetailsModals.tsx` | 500 | MISSING — must port | PENDING |
| `src/modals/match/pitchView.tsx` | 1119 | MISSING — must port | PENDING |
| `src/modals/match/statsTab.tsx` | 236 | MISSING — must port | PENDING |
| `src/modals/profile/ChannelLeaderboard.tsx` | 563 | MISSING — must port | PENDING |
| `src/modals/profile/ProfileModal.tsx` | 1121 | MISSING — must port | PENDING |
| `src/modals/profile/index.tsx` | 1072 | MISSING — must port | PENDING |
| `src/modals/profile/paymentsDialogs.tsx` | 715 | MISSING — must port | PENDING |
| `src/modals/profile/types.ts` | 68 | MISSING — must port | PENDING |
| `src/navigation/RootNavigator.tsx` | 50 | MISSING — must port | PENDING |
| `src/screens/ChatsScreen.tsx` | 602 | Exists at matching path; parity not yet verified | PENDING |
| `src/screens/FeedScreen.tsx` | 368 | Exists at matching path; parity not yet verified | PENDING |
| `src/screens/MessageScreen.tsx` | 1640 | Exists at matching path; parity not yet verified | PENDING |
| `src/screens/home/HomeScreen.tsx` | 151 | Exists at matching path; parity not yet verified | PENDING |
| `src/screens/home/appHeader.tsx` | 460 | Exists at matching path; parity not yet verified | PENDING |
| `src/screens/home/header-inset.tsx` | 13 | `apps/web/src/screens/home/header-inset.tsx` | PORTED |
| `src/screens/home/home-context.tsx` | 386 | `apps/web/src/screens/home/home-context.tsx` | PORTED |
| `src/theme.ts` | 16 | `apps/web/src/theme.ts` | PORTED |
| `src/theme/index.ts` | 29 | `apps/web/src/theme/index.ts` | PORTED |
| `src/theme/layout.ts` | 24 | `apps/web/src/theme/layout.ts` | PORTED |
| `src/theme/use-fan-colors.ts` | 27 | `apps/web/src/theme/use-fan-colors.ts` | PORTED |
| `src/theme/use-fan-shadow.ts` | 46 | `apps/web/src/theme/use-fan-shadow.ts` | PORTED |
| `src/theme/use-fan-typography.ts` | 51 | `apps/web/src/theme/use-fan-typography.ts` | PORTED |

## Completion rule
For each row, create the same relative path under `apps/web/src/`, convert the view layer to accessible DOM/Tailwind, and compare API calls, state transitions, visible strings, and loading/empty/error states against mobile. Do not mark a row complete until typecheck and parity review pass. Especially large files such as `LeaderboardModal.tsx` (1,998 lines), `MessageScreen.tsx` (1,640 lines), `ProfileModal.tsx` (1,121 lines), and `CommentsModal.tsx` (1,043 lines) must not be replaced with abbreviated versions.
