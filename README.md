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

Web route-level components live in `apps/web/src/screens/`; overlays live in `apps/web/src/modals/`; reusable web components live in `apps/web/components/`. See [apps/web/README.md](apps/web/README.md).

The mobile app is the behavioral reference for web parity. Keep browser-specific UI and runtime behavior in the web workspace while reusing shared domain/API logic from `packages/core`.

## Shared core

`packages/core` contains platform-independent API services, shared data types, match/fixture models, channel and chat models, and other domain services. Keep backend endpoints, authentication flow, and API shapes stable during parity work.

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

## Typechecking

Run the root workspace check:

```bash
npm run typecheck
```

For the web workspace:

```bash
cd apps/web
npm run typecheck
npm run build
```

## Architecture decisions

- **React-only web:** use React Router and Vite; do not add Next.js route files or dependencies.
- **Mobile as reference:** implement equivalent web screens and flows based on the existing mobile behavior.
- **Shared domain logic:** keep reusable API and domain logic in `packages/core`.
- **Web-owned query client:** the web app owns its TanStack Query `QueryClient`.
