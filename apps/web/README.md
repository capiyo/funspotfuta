# FunspotFuta Web — React + Vite

The web application is a React single-page app built with Vite, React Router, and TypeScript. It does not use Next.js or the Next.js App Router. The completed mobile app is the behavioral reference: the web app should match its user-visible features, state transitions, validation, error handling, and outcomes.

## Stack

- React 18 and React DOM
- React Router
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
- `lib/` — web API helpers and browser-specific adapters
- `theme/` — global stylesheet and theme resources

The old Next.js `app/` route tree is obsolete. Do not add `page.tsx`, `layout.tsx`, or Next.js routing conventions here.

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

## Parity rules

- Use the mobile implementation as the behavioral reference, not as a reason to leave web features incomplete.
- Reuse shared types and services from `@funspot/core`; preserve backend endpoints, authentication flow, and API shapes.
- Implement browser-specific behavior with browser APIs and adapters rather than copying mobile-only APIs literally.
- Do not fake successful verification, push delivery, uploads, payments, or persistence when the corresponding integration is not configured.
- Mock/filler fan data must be development-only and must not appear as production data.

## Remaining parity/integration areas

These are requirements to implement and validate, not permanent exclusions:

1. **Firebase Phone Auth OTP:** browser phone verification must use Firebase's actual verification flow, including reCAPTCHA and configured SMS delivery. The current phone/PIN flow should not imply that an unverified number has been verified.
2. **FCM / Web Push:** implement permission and subscription handling, service-worker/browser delivery, and provider configuration. Porting notification records or UI alone does not mean push delivery works.
3. **Offline cache and queue:** reproduce the intended offline experience with browser-compatible storage (for example, IndexedDB) and retry/synchronization behavior where needed; do not try to use mobile SQLite directly in the browser.
4. **Video in chat:** support choosing, uploading, sending, and rendering video messages with browser-compatible media/file handling while keeping existing API/storage contracts.
5. **Admin payments UI:** match the mobile admin dashboard's payment-related UI and states, reusing `payment-service.ts` and other shared services rather than duplicating payment logic.

A feature is complete only after its web interaction is implemented and tested, and any required external configuration or backend support is confirmed. Clearly document configuration blockers instead of silently downgrading the behavior.

## Architecture

The web workspace owns its TanStack Query client. Keep React components and browser-specific runtime behavior in `apps/web`, and shared domain/API logic in `packages/core`. Match mobile behavior while keeping each platform's UI/runtime independent.
