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
GitHub Actions run for feature commit `da18f163ae1ca2c250803ccfa59ebcd08893724b` passed:
- Core tests and shared-core, web, and React Native typechecks
- Android JavaScript bundle export
- Web lint and Vite production build
- Generated public crawl-file checks
- ChatsCard Playwright parity at 360, 390, 600, 700, 1280, and 1920px
- Match Details Playwright test: Lineups-only before stats are ready, then swipe to Stats and back to Lineups
- Home shell, Feed, responsive layout, and comments-modal Playwright checks

The feature-specific browser checks are automated CI tests, not manual device testing. Live Firebase SMS, web push delivery, production API behavior, and Netlify deploy-preview success remain unverified. Netlify preview status checks are currently failing across the configured preview sites; their diagnostic pages were not accessible during this review.

## Remaining parity work
- apps/web/src/screens/ChatsScreen.tsx remains much shorter than mobile and still needs a full pass for fixture lists, voting/pledging, refresh and modal wiring.
- apps/web/src/screens/home/appHeader.tsx is still a shorter navbar adaptation; full mobile header actions/channel-creation behavior remain.
- LoginModal.tsx, FeedScreen.tsx, and multiple small UI/theme components remain shorter than their mobile counterparts; docs/PORT_MAP.md retains SUSPECT/PENDING labels for these.
- CommentsModal, comradelist/index, and other modal view trees are more compact in the browser than native StyleSheet versions; CI is not a substitute for interaction and visual parity checks.
- Browser notification permission, Firebase phone OTP, token registration, and actual production API responses still require a live configured test.

## Repository integrity
- apps/mobile remains the source of truth for the web port. The separate Match Details swipe-tab enhancement was committed to master mobile; the Vite port branch continues to leave apps/mobile unchanged.
- The same-path audit is recorded in docs/PORT_MAP.md; no missing mobile-relative paths remain in the current tree comparison.
- PR #4 is kept as draft until the remaining parity work and Netlify deployment checks are resolved.
