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


## Google crawling and AdSense (web only)

- `public/ads.txt` authorizes the Funspot AdSense publisher account. Confirm the publisher and slot configuration in the AdSense console before production traffic.
- `public/robots.txt` permits public crawling and excludes chat, login, and comments routes from indexing.
- `public/privacy.html` provides a public privacy disclosure for advertising and cookie technologies.
- The web entry point loads the AdSense script. Ad units are implemented only under `apps/web`; do not copy AdSense or AdMob IDs into `apps/mobile`.
- Set `VITE_SITE_URL` to the canonical production origin (for example, the full `https://` origin with no path) in the production build environment. The build then generates `dist/sitemap.xml` and adds its absolute URL to `dist/robots.txt`. The build deliberately does not guess the production domain when this value is missing.
- AdSense approval and serving are controlled by Google; adding these files does not guarantee approval or filled ads. Review the privacy policy against the deployed data practices and configure a Google-certified consent-management platform where required.
