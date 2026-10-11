# Funspot web

The web app is built with **React + Vite + TypeScript + Tailwind + React Router**. It is not a Next.js app.

## Commands
Run from the repository root:

- `npm run dev:web` — Vite development server.
- `npm run build:web` — production build.
- `npm run typecheck:web` — TypeScript check.
- `npm run lint:web` — current static validation script.

## Environment
Copy `.env.example` to `.env.local` and fill in Firebase Web SDK configuration. Keep real values out of version control. Firebase console instructions are in `../../docs/FIREBASE_SETUP.md`.

## Mobile parity
The source of truth is `apps/mobile/src` on `master`. Port files to matching relative paths under `src/`; do not add Arena, Logs, Trending, FixtureDetail, or History screens. The web home layout is the only intentional structural difference: navbar, profile sidebar, and independently scrolling Chats and Feed columns at 50/50 on desktop.

Track every port and validation item in `../../docs/PORT_MAP.md` and `../../docs/PORT_REPORT.md`. Similar names in the old web tree do not count as parity without reviewing behavior, API contracts, text, and loading/error/empty states.
