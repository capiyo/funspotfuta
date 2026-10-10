# Funspot Web — React + Vite

The web app is a **React + TypeScript + Vite** application. It does not use Next.js. It uses React Router for client-side routing, Tailwind CSS for styling, and the existing production API through shared services in `@funspot/core`.

## Run locally

From the repository root:

```bash
npm install
npm run dev:web
```

Or from this directory:

```bash
npm run dev
```

Vite serves the app at `http://localhost:3000`.

## Validate

From the repository root:

```bash
npm run typecheck:web
npm run build:web
```

## Route map

| Route | Purpose |
| --- | --- |
| `/login` | Sign in / registration UI |
| `/home` | Main fixture and channel feed |
| `/chat` | Channel chat |
| `/trending` | Trending markets |
| `/fixture/:matchId` | Fixture detail, votes, pledges and markets |
| `/feed` | Posts feed |
| `/profile` | Profile, wallet and account links |
| `/comrades` | Friends/comrades |
| `/leaderboard` | Leaderboard |
| `/history` | Match history |
| `/notifications` | Notification data/preferences |
| `/admin/:channelId` | Channel administration |

Protected routes use the current web auth context. Keep route names and equivalent feature behavior aligned with the completed React Native app, which is the reference for web parity.

## Structure

- `main.tsx` — Vite/React entry point
- `App.tsx` — React Router route declarations and providers
- `app/` — page components retained as ordinary React modules (the folder name is organizational; it is not a Next.js App Router)
- `components/` — shared web UI
- `lib/` — auth, API, toast and platform-specific helpers
- `vite.config.ts` — Vite configuration

## Backend constraints and known limitations

The app uses the existing API endpoints and request/response contracts; this web migration does not change the backend or authentication flow. Firebase phone OTP and browser push delivery still require their own live configuration and must not be considered implemented until tested with that configuration. Do not substitute fake backend behavior for a real API call.
