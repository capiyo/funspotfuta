# Vite migration bootstrap

This is an incremental migration alongside the existing Next.js application. The existing Next.js scripts and app remain the current default until route compatibility and feature parity are verified.

## Vite entry point

- `index.html` is the Vite document.
- `vite.config.ts` configures React and preserves the existing `@/` alias.
- `src/main.tsx` reuses the existing auth, toast, query, storage, and core providers.
- `src/App.tsx` starts with root, login, and home route wiring.

## Dependencies and scripts

The Vite entry requires `vite`, `@vitejs/plugin-react`, and `react-router-dom`. Add these through the repository's package manager and update the lockfile before running this entry. Keep the existing Next.js dependencies/scripts until every route and import has been migrated and the Vite build passes.

## Migration constraints

- Do not modify `apps/mobile`; it remains the mobile reference implementation.
- Preserve existing API calls, Firebase setup, auth storage keys, and shared `@funspot/core` / `@funspot/storage` behavior.
- Migrate every route and replace Next-only navigation APIs before removing Next.js.
- This bootstrap is not feature-complete yet; route parity and production build validation remain required.
