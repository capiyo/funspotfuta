# Funspot

Funspot is a React and React Native monorepo with a shared TypeScript domain package.

## Web architecture

- Web: Vite + React DOM + TypeScript + Tailwind + React Router.
- Public website: static, crawlable HTML at `/` and the public information pages.
- Application: the Vite SPA is served under `/app/`; private app routes are excluded from indexing.
- Canonical host: `https://www.funspot.co.ke` (apex redirects to `www`).
- The Firebase messaging service worker remains at the site root and normalizes notification destinations into `/app/`.

## Build and verification

Run from the repository root:

```sh
npm ci
npm run test:core
npm run typecheck:core
npm run typecheck:web
npm run typecheck:mobile
npm run lint:web
npm run build:web
```

The public-page build requires `FUNSPOT_CONTACT_EMAIL` to be set to a real, non-placeholder contact address. Do not use reserved example, test, invalid, or localhost domains. The build intentionally fails if the contact address is missing or invalid.

Web deployment is a static Netlify build. EAS is for native mobile builds, not web builds. Do not deploy or change hosting settings as part of ordinary repository development.

## Repository rules

`master` is the authoritative branch. Read `AGENTS.md` before making changes. Preserve existing work, avoid blind merges, and do not edit the separate backend or Flutter reference repository from this repository task.
