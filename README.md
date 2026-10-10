# FunspotFuta — React Web + React Native Monorepo

A TypeScript monorepo containing the FunspotFuta React web application, React Native mobile app, and shared API/domain logic.

## Repository structure

```
funspotfuta/
├── apps/
│   ├── web/                 # React + Vite + TypeScript
│   └── mobile/              # Expo / React Native
├── packages/
│   └── core/                # Shared types, API services, domain logic
├── package.json             # Workspace scripts
└── turbo.json               # Turborepo task configuration
```

## Web application

The web app is a standard React single-page application built with Vite and React Router. It is not a Next.js application and does not use Next.js `page.tsx` or `layout.tsx` conventions.

- Route-level screens: `apps/web/src/screens/`
- Modals and overlays: `apps/web/src/modals/`
- Reusable UI: `apps/web/components/`
- Browser-specific services and helpers: `apps/web/lib/`

The completed mobile app is the behavioral reference for web parity. Web should preserve the same user-facing features and flow, using browser-native implementations where mobile APIs cannot run in a browser.

## Shared core and API contracts

`packages/core` contains platform-independent API services, shared data types, match/fixture models, channel and chat models, and other domain services. Keep backend endpoints, authentication flow, and API shapes stable during parity work. Reuse shared services rather than duplicating domain logic.

## Getting started

Install dependencies from the repository root:

```bash
npm install
```

Run the web app:

```bash
cd apps/web
npm run dev
```

Run the mobile app:

```bash
cd apps/mobile
npm run start
```

## Typechecking and build

From the repository root:

```bash
npm run typecheck
```

For the web workspace:

```bash
cd apps/web
npm run typecheck
npm run build
```

## Web parity requirements

The web implementation has been reviewed against the current mobile app. The current pass adds browser Firebase Phone Auth (OTP + PIN fallback), FCM token registration/foreground feedback, persisted query-cache restoration, persisted feed pagination, and persisted fixture queries.

Remaining integration work must be validated against the deployed environment:

- **Phone verification / OTP:** the real Firebase Phone Auth and reCAPTCHA flow is implemented. Verify SMS delivery, authorized domains, and error/fallback behavior on the deployed HTTPS origin.
- **Push notifications:** browser token registration, background service-worker notifications, and foreground toast feedback are wired. Verify permissions, Firebase configuration, token registration and delivery against the live backend.
- **Offline behavior:** browser query persistence is enabled for data accessed through TanStack Query. Review other direct-fetch screens for cache coverage and add retry/synchronization only where the mobile behavior requires it.
- **Profile parity:** the web profile has account details, editable fan details, wallet top-up/withdrawal, and read-only member profiles reachable from leaderboard activity.
- **Messaging parity:** web chat intentionally opens as a responsive modal; typing indicators, read receipts, copy/reply actions, image viewing, and send-failure feedback are wired without changing the backend contract. Video upload/playback is not ported by the current mobile reference either.

Do not report Firebase, push delivery, or authenticated end-to-end flows as verified until tested against the actual deployed browser origin and backend. Mock/filler fan data remains development-only.

## Architecture decisions

- **React-only web:** use React Router and Vite; do not add Next.js route files or dependencies.
- **Mobile as behavior reference:** match its screens, state transitions, error handling, and user-visible outcomes.
- **Shared domain logic:** keep reusable API and domain logic in `packages/core`.
- **Browser-native adapters:** use browser APIs for web-only runtime needs while preserving the intended feature behavior.
- **Stable contracts:** do not change backend endpoints, authentication flow, or API shapes as a shortcut to parity.
