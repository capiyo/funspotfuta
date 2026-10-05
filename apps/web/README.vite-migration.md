# Vite migration bootstrap

This is an incremental migration alongside the existing Next.js application. The existing Next.js scripts and app remain the current default until route compatibility and feature parity are verified.

## Vite entry point

- `index.html` is the Vite document.
- `vite.config.ts` configures React and preserves the existing `@/` alias, with compatibility aliases for Next.js navigation and links.
- `src/main.tsx` reuses the existing auth, toast, and query providers.
- `src/App.tsx` maps the existing screen components into React Router routes.

## Commands

From the repository root:

- `npm run dev:web:vite` starts the Vite development server.
- `npm run build:web:vite` runs a production build.
- `npm run preview:web:vite` previews a production build.

The Vite dependencies are declared in the web workspace. Regenerate and commit the repository lockfile(s) with `npm install` before using clean `npm ci` installs. The existing Next.js scripts and dependencies remain in place until all route imports have been migrated and the Vite build passes.

## Migration constraints

- Do not modify `apps/mobile`; it remains the React Native reference implementation and is primarily TypeScript.
- Preserve existing API calls, Firebase setup, auth storage keys, and shared `@funspot/core` / `@funspot/storage` behavior.
- Audit browser compatibility for shared storage imports, migrate every required route, and replace Next-only navigation APIs before removing Next.js.
- This bootstrap is not feature-complete yet; route parity, lockfile regeneration, and production build validation remain required.
