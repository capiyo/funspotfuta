# Web port report

## Baseline
- Source: `master`, commit `84255b277d0568b05986aba8ec54daf748871b7b`.
- Working branch: `web-port-from-master`.
- Mobile source inventory: 70 files under `apps/mobile/src/`; see `PORT_MAP.md` for line counts and findings.

## Current status
This is a checkpoint, not a completion claim. All 70 rows in `PORT_MAP.md` are pending until React/DOM implementation and parity checks are complete. The legacy web tree contains Next.js routes, a duplicated `apps/web/testa/` tree, and layouts that diverge from mobile; those are not accepted as parity evidence. Firebase manual steps are recorded in `FIREBASE_SETUP.md`.

## Implemented on the working branch so far
- Added a React/Vite entry point, React Router, Tailwind entry stylesheet, a desktop navbar/profile-sidebar/Chats-and-Feed split, independently scrollable columns, initial live channel/feed loading, and a message pane backed by the existing shared chat hook.
- Added Firebase Web SDK initialization, phone OTP login/registration wiring, a service worker, and foreground notification handling. These are not yet manually tested against the live Firebase project.
- Removed the Next.js route tree and duplicate `apps/web/testa/` tree from the working branch, replaced the web package scripts with Vite scripts, and changed `.env.example` to placeholders only.
- Exported the existing core channels service from `@funspot/core` so the web can use the same channel API without duplicating it.
- Validation has **not** been run in this environment; no test pass is claimed. The port map remains pending because the full screen/modal parity port is incomplete.

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
