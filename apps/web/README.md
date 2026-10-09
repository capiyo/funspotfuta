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

The current pass has added the browser Firebase Phone Auth flow (OTP with the existing PIN fallback), FCM token registration and foreground/background notification handling, persisted query-cache restoration, and persisted feed/fixture queries.

Still to validate or complete:

1. **Firebase Phone Auth:** verify reCAPTCHA, SMS delivery, authorized domains, OTP failure behavior and PIN fallback on the deployed HTTPS origin.
2. **FCM / Web Push:** confirm permission, browser token registration and real delivery with the deployed Firebase configuration and backend.
3. **Offline coverage:** Feed and fixture queries use the persisted cache. Review the remaining direct-fetch screens for cache behavior and add synchronization/retry where the mobile experience requires it.
4. **Profile parity:** mobile-aligned profile editing (nickname, favorite club, country) is now present; viewing other members is not yet represented by the web profile page.
5. **Messaging navigation parity:** web chat is a modal; mobile chat is a dedicated stack screen. Review browser back/keyboard behavior and preserve the existing image-message API contract.

The current mobile chat screen also marks video upload/playback as not ported, so that is not considered mobile parity in this pass. The current mobile AdminModal likewise deliberately excludes deposit/withdraw controls; profile wallet flows remain available.

A feature is complete only after its interaction is implemented and tested, and any required external configuration or backend support is confirmed. Clearly document deployment blockers instead of silently downgrading behavior.

## Architecture

The web workspace owns its TanStack Query client. Keep React components and browser-specific runtime behavior in `apps/web`, and shared domain/API logic in `packages/core`. Match mobile behavior while keeping each platform's UI/runtime independent.
