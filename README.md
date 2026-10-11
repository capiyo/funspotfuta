# Funspot monorepo

Funspot is a shared TypeScript monorepo with a React + Vite web app, an Expo / React Native mobile app, and the shared `@funspot/core` domain/API package.

- `apps/web`: React, Vite, TypeScript, Tailwind, React Router.
- `apps/mobile`: Expo and React Native. The `master` version is the reference implementation and must not be changed during the web port.
- `packages/core`: shared API services and domain types.

## Development

Install dependencies at the repository root with `npm install`.

- `npm run dev:web` — start the web app with Vite.
- `npm run dev:mobile` — start Expo.
- `npm run typecheck:core` — typecheck shared core.
- `npm run typecheck:web` — typecheck web.
- `npm run typecheck:mobile` — typecheck mobile.
- `npm run build:web` — production Vite build.

## Web environment

Copy `apps/web/.env.example` to `apps/web/.env.local`, then fill in Firebase web configuration and the public VAPID key. The API base defaults to the existing Clash API at `https://clash-api-m5mr.onrender.com/api`. Never commit credentials.

## Port tracking

- `docs/PORT_MAP.md` inventories every file under `apps/mobile/src` and tracks parity work.
- `docs/PORT_DECISIONS.md` records scope and compatibility decisions.
- `docs/FIREBASE_SETUP.md` lists manual Firebase Console setup.
- `docs/PORT_REPORT.md` is the current status and verification checklist.

The web migration is not considered complete until every port-map row is verified and the checks in `docs/PORT_REPORT.md` pass.
