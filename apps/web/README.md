# FunspotFuta Web — React + Vite

The web application is a plain React SPA built with Vite and TypeScript. It does not use Next.js or the Next.js App Router. Mobile remains the behavioral reference for web parity.

## Stack

- React 18, React DOM, and React Router
- Vite and TypeScript
- Tailwind CSS
- TanStack Query
- `@funspot/core` for shared API/domain logic

## Screens and organization

- `App.tsx` — application shell and route definitions
- `main.tsx` — React entry point
- `src/screens/` — route-level screens
- `src/modals/` — modal and overlay components
- `components/` — reusable web UI
- `lib/` — web API helpers and platform-specific utilities
- `theme/` — global stylesheet and theme resources

The old Next.js `app/` route tree is obsolete and is not part of the React app. Do not add `page.tsx`, `layout.tsx`, or Next.js routing conventions here.

## Run locally

From the repository root:

```bash
npm install
cd apps/web
npm run dev
```

Vite prints the local URL when the server starts (typically http://localhost:5173).

## Typecheck and build

```bash
npm run typecheck
npm run build
```

From the monorepo root, run `npm run typecheck` for workspace typechecking.

## Shared core and API contracts

Prefer shared types and services from `@funspot/core` for domain/API behavior. Preserve backend endpoints, authentication flow, and API shapes when implementing web parity. The web app owns its TanStack Query client.

## Platform-specific behavior

Browser routing, theme behavior, media handling, and UI primitives belong in `apps/web`; shared domain and API logic belongs in `packages/core`. Use `apps/mobile` as the behavior reference without coupling the two platforms' UI runtimes.

## Scope notes

Some mobile-specific capabilities—such as offline SQLite/cache infrastructure, FCM delivery, and mobile background upload flows—need browser-specific implementations and should not be represented as completed merely because shared domain services exist.
