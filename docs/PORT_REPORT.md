# Web port report

## Baseline and branch
- Repository: capiyo/funspotfuta
- Source of truth: apps/mobile/src on master, baseline 84255b277d0568b05986aba8ec54daf748871b7b
- Working branch: web-port-from-master (draft PR #4)
- Web stack: React, Vite, TypeScript, Tailwind and React Router; no Next.js route tree.

## Current implementation checkpoint
The recursive GitHub tree comparison found 70 mobile source files and 70 same-path web counterparts (0 missing paths). The path audit includes navigation/RootNavigator.tsx, HomeScreen, and the five requested modal paths: CommentsModal, actionModal, comradelist/index, AftermatchModal, and HistoryModal. This is a file-path result, not a claim that every UI component has full visual parity.

The Home route is the only intended screen-layout divergence: desktop navbar on top, profile/channel sidebar on the left, and Chats/Feed panes at 50/50 with independent scrolling. Narrow screens use the shared Chats/Feed pill tab bar. RootNavigator exposes Home/Tabs and Chat only; there are no Arena, Logs, Trending, FixtureDetail, or History screen routes. Providers are ordered Auth → Toast → LoginModal, with NotificationGate mounted by the login-modal provider.

## Validation
GitHub Actions run for code commit 2143f43d649166d8ac5d4b68f13e08b76f3cc3fd passed npm run typecheck:core, npm run typecheck:web, npm run typecheck:mobile, npm run lint:web, and npm run build:web.

The run validates code at that commit. Documentation-only commits may follow it; the latest branch head must be checked again before treating a later code change as validated. No live Firebase SMS, web push delivery, production API behavior, or browser end-to-end session has been manually verified here.

## Remaining parity work
- apps/web/src/screens/ChatsScreen.tsx remains much shorter than mobile and still needs a full pass for fixture lists, voting/pledging, refresh and modal wiring.
- apps/web/src/screens/home/appHeader.tsx is still a shorter navbar adaptation; full mobile header actions/channel-creation behavior remain.
- LoginModal.tsx, FeedScreen.tsx, and multiple small UI/theme components remain shorter than their mobile counterparts; docs/PORT_MAP.md retains SUSPECT/PENDING labels for these.
- CommentsModal, comradelist/index, and other modal view trees are more compact in the browser than native StyleSheet versions; CI is not a substitute for interaction and visual parity checks.
- Browser notification permission, Firebase phone OTP, token registration, and actual production API responses still require a live configured test.

## Repository integrity
- apps/mobile is the source of truth and has not been intentionally modified by this port work.
- The same-path audit is recorded in docs/PORT_MAP.md; no missing mobile-relative paths remain in the current tree comparison.
- Keep PR #4 as draft until the remaining parity work and live browser checks are complete.
