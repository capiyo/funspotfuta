# Funspot — React + React Native monorepo

Funspot is a cross-platform fan community app backed by the existing live API:
`https://clash-api-m5mr.onrender.com/api`.

- **Web:** React, Vite, TypeScript, React Router and Tailwind CSS.
- **Mobile:** Expo + React Native. The completed mobile app is the reference for web parity.
- **Shared:** `packages/core` contains platform-agnostic TypeScript types and API services; `packages/storage` contains storage adapters.

```text
packages/
  core/       shared domain types, API clients and queries
  storage/    platform-specific storage adapters
apps/
  web/        React + Vite web app (no Next.js runtime)
  mobile/     Expo / React Native app
```

## Requirements

- Node.js 20+
- npm

## Install and run

From the repository root:

```bash
npm install
npm run dev:web
npm run dev:mobile
```

The web development server runs at `http://localhost:3000`. Expo prints instructions for opening the mobile app in a simulator or device.

## Validation

```bash
npm run typecheck:core
npm run typecheck:web
npm run typecheck:mobile
npm run build:web
```

`npm run typecheck` runs the three workspace typechecks in sequence. CI runs the typechecks and web production build on pushes and pull requests.

## Web routes

The React Router app includes login, home, chat, trending, fixture detail, feed, profile, comrades, leaderboard, history, notifications and channel administration. Protected routes use the existing auth context. Route and UI behavior should stay aligned with the completed React Native app.

## Backend and scope

The web and mobile clients continue to use the existing backend endpoints and authentication contracts. This web migration does not change backend API shapes or the authentication flow. Firebase phone OTP and push delivery require their own live configuration; a UI alone does not mean those integrations have been tested or enabled.

## Architecture notes

- Web entry point: `apps/web/main.tsx`; Vite configuration: `apps/web/vite.config.ts`.
- Mobile uses Expo and React Native and is not being rebuilt as part of web parity work.
- Shared code must remain free of browser-only and React Native-only imports.
- Do not add Next.js-specific routing, configuration or dependencies to `apps/web`.
