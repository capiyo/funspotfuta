# Web port report

## Baseline
- Source: `master`, commit `84255b277d0568b05986aba8ec54daf748871b7b`.
- Working branch: `web-port-from-master`.
- Mobile source inventory: 70 files under `apps/mobile/src/`; see `PORT_MAP.md` for line counts and findings.

## Current status
This is a checkpoint, not a completion claim. All 70 rows in `PORT_MAP.md` are pending until React/DOM implementation and parity checks are complete. The legacy web tree contains Next.js routes, a duplicated `apps/web/testa/` tree, and layouts that diverge from mobile; those are not accepted as parity evidence. Firebase manual steps are recorded in `FIREBASE_SETUP.md`.

## Implemented on the working branch so far
- Added a React/Vite entry point, React Router, Tailwind entry stylesheet, a desktop navbar/profile-sidebar/Chats-and-Feed split, independently scrollable columns, initial live channel/feed loading, and a message pane backed by the existing shared chat hook.
- Added Firebase Web SDK initialization, phone OTP flow, country-aware E.164 validation, username validation, PIN fallback, resend cooldown, and Firebase session wiring. These are not yet manually tested against the live Firebase project.
- Added explicit user-action web-push permission/token generation and registered the token using the existing shared `/api/notifications/register-token` contract (`platform: 'web'`). Foreground toast and background notification click-through are wired; server acceptance/browser delivery are not live-tested.
- Removed the Next.js route tree and duplicate `apps/web/testa/` tree from the working branch, replaced the web package scripts with Vite scripts, and changed `.env.example` to placeholders only.
- Exported the existing core channels service from `@funspot/core` so the web can use the same channel API without duplicating it.
- GitHub Actions validates `typecheck:core`, `typecheck:web`, `typecheck:mobile`, `lint:web`, and `build:web`. A previous checkpoint at `9d3e5156db9eeaa070dee3fbfed43b7f89083080` passed all five checks. Newer commits are queued/running validation; do not treat that earlier pass as validation of the latest head. The port map remains pending because full screen/modal parity is incomplete.

## Remaining work — do not merge as complete
- The web `ChatsScreen` is still much smaller than mobile's 602-line `ChatsScreen`; its fixture cards, vote/pledge flow, comments, match-details modal, pull-to-refresh, and shared list-state behavior are not fully ported.
- The web `FeedScreen` is still much smaller than mobile's 368-line `FeedScreen`; composer, media picker/upload, comments/actions, pagination, and complete loading/error states need a parity pass.
- `MessageScreen` is not yet a full equivalent of mobile's 1,639-line `MessageScreen` (reply/media/video/commentary/optimistic and history behavior remain unverified).
- Profile, Comments, addPost, joingroup, Leaderboard, and Admin modals are not yet ported into the required matching `src/modals/` paths. Several mobile UI components also remain missing or have only legacy counterparts.
- The profile sidebar is a shell, not a fully ported profile screen/modal.
- Phone auth's PIN fallback is wired, but the complete mobile country list, terms behavior edge cases, PIN error mapping, and Firebase live behavior still need verification.

## Known blocker
- Master mobile currently has a TODO for FCM token registration and no confirmed token-registration endpoint/payload. See `PORT_DECISIONS.md`; web must not invent an API contract.

## Verification remaining
- [ ] `git diff master -- apps/mobile` is empty.
- [ ] No `next` dependency in any package.json; no `page.tsx` anywhere.
- [ ] All `PORT_MAP.md` rows ported with matching relative filenames and reviewed parity.
- [ ] Typecheck, lint, and Vite build pass for core, web, and mobile.
- [ ] Browser verifies navbar + profile sidebar + Chats and Feed at 50/50 with independent scrolling and responsive stacking.
- [ ] Phone auth is wired and manually tested with Firebase configuration.
- [ ] FCM token registration and foreground/background handling are verified, or backend incompatibility is documented with graceful fallback.
- [ ] Final report contains actual commit and test evidence.
