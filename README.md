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

The goal is feature and behavior parity with mobile, not to mark browser-different features as permanently out of scope. The following areas need browser-specific implementation and real environment/backend configuration as applicable:

- **Phone verification / OTP:** use the intended Firebase Phone Auth verification flow in the browser, including reCAPTCHA and configured SMS delivery. Do not silently treat entering a phone number as proof of ownership.
- **Push notifications:** implement browser push permission/subscription and delivery (Web Push or supported Firebase Messaging), with HTTPS/service-worker and provider configuration where required. Shared notification data alone is not delivery.
- **Offline behavior:** preserve the user-visible offline/cache/queue behavior where required, using browser-appropriate persistence such as IndexedDB rather than trying to run mobile SQLite directly.
- **Chat video:** support selecting, uploading, sending, and rendering video messages with browser-compatible media/file handling and the existing API/storage contracts.
- **Admin payments:** bring the mobile admin payment UI and its states/actions to web parity, reusing shared payment services such as `payment-service.ts` instead of duplicating business logic.

These are parity tasks and integration dependencies, not features to dismiss as unsupported. Never report them as complete until the browser flow is implemented and validated against the available backend/configuration. Keep mock/filler fan data development-only; production behavior should use real service responses.

## Architecture decisions

- **React-only web:** use React Router and Vite; do not add Next.js route files or dependencies.
- **Mobile as behavior reference:** match its screens, state transitions, error handling, and user-visible outcomes.
- **Shared domain logic:** keep reusable API and domain logic in `packages/core`.
- **Browser-native adapters:** use browser APIs for web-only runtime needs while preserving the intended feature behavior.
- **Stable contracts:** do not change backend endpoints, authentication flow, or API shapes as a shortcut to parity.
