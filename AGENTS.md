# Funspot engineering instructions

## Authoritative repository state

- `master` is the only authoritative working branch and destination for approved repository changes.
- Do not create, rename, or switch branches. Do not force-push or reset branch history.
- Preserve unrelated work and inspect existing file contents before modifying them.
- Keep historical branches intact unless the user separately authorizes branch cleanup.

## Architecture

- This is a React + React Native monorepo with shared TypeScript contracts in `packages/core`.
- Web is Vite + React DOM + TypeScript + Tailwind + React Router. Do not introduce Next.js, `page.tsx`, Next dependencies, or React Native Web.
- The public website is static at `/`; the SPA is mounted under `/app/`.
- Keep the Firebase messaging service worker at the root scope; normalize notification destinations to `/app/`.
- Do not edit the separate backend repository or Flutter reference project as part of this repository task.

## Engineering quality

- Do not introduce `any`, `@ts-ignore`, `@ts-expect-error`, placeholder implementations, fake data, or weakened compiler settings.
- Do not change messaging credentials or delivery semantics without an explicit requirement and verified backend contract.
- Preserve the established home/away-only outcome model and existing voting, poke, settlement, and points contracts.
- Review related types, callers, cache behavior, and both platform implementations before changing shared functionality.
- Run the package's real scripts; never report a check as passed if it was not executed.

## Build

- Install from the root lockfile with `npm ci`.
- Web production build: `npm run build:web`.
- The public-page build requires a real `FUNSPOT_CONTACT_EMAIL`; reserved example/test/invalid/localhost domains are rejected.
- EAS is for native mobile builds, not the Vite web build.
- Do not deploy production or modify hosting settings without explicit authorization.
