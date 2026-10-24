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

- `public/ads.txt` authorizes the publisher account used by the Flutter implementation. Confirm the site is approved and these existing ad units are active in AdSense; approval and fill rates are controlled by Google.
- `public/robots.txt` permits public crawling and excludes chat, login, and comments routes from indexing.
- `public/privacy.html` provides a public privacy disclosure for advertising and cookie technologies.
- The web entry point loads the AdSense script. Ad units are implemented only under `apps/web`; do not copy AdSense or AdMob IDs into `apps/mobile`. AdSense is intentionally excluded from private messaging screens because Google disallows ads on pages where private communication is the primary focus.
- Live AdSense runs automatically on `funspot.co.ke` and `www.funspot.co.ke` production hosts only; localhost and preview hosts never request ads. The build defaults to the canonical `https://funspot.co.ke` origin, generates `dist/sitemap.xml`, and adds its absolute URL to `dist/robots.txt`. Override `VITE_SITE_URL` only if the canonical domain changes.
- AdSense approval and serving are controlled by Google; adding these files does not guarantee approval or filled ads. Review the privacy policy against the deployed data practices and configure a Google-certified consent-management platform where required.
