# FunspotFuta — Web + Mobile Monorepo

A TypeScript monorepo containing the FunspotFuta web application, React Native mobile application, and shared API/domain logic.

## Repository structure

```
funspotfuta/
├── apps/
│   ├── web/                 # React 18 + Vite / React / TypeScript / Tailwind
│   └── mobile/              # Expo / React Native
├── packages/
│   └── core/                # Shared types, API services, and domain logic
├── package.json             # Workspace scripts and dependency overrides
└── turbo.json               # Turborepo task configuration
```

## Current status

The `chore/monorepo-clean-mobile-parity` branch is the validated cleanup/parity branch.

GitHub Actions TypeScript validation is green for all three workspaces:

- `packages/core` — `tsc --noEmit`
- `apps/web` — `tsc --noEmit`
- `apps/mobile` — `tsc --noEmit`

The final validated commit is:

```
2f8ab9f88839508e112272d3acc0d7f3e138bfb0
```

## Web application

The React web application lives in `apps/web`.

It uses:

- React 18 + Vite App Router
- React + TypeScript
- Tailwind CSS
- TanStack Query
- `@funspot/core` for shared API/domain logic

Web routes cover the mobile app's core surfaces, including:

- Home / Arena
- Fixture detail
- Chat
- Trending
- Feed
- Match history / Logs
- Profile
- Comrades
- Leaderboard
- Notifications
- Admin channel management

See [apps/web/README.md](apps/web/README.md) for the web-specific implementation and setup details.

## Shared core

`packages/core` contains platform-independent TypeScript:

- API services
- Shared data types
- Match/fixture models
- Channel and chat models
- Betting and payment services
- Posts, notifications, comrades, and admin services

Platform-specific UI and storage remain inside the individual apps.

The canonical channel identifier is `channelId`. A backward-compatible `Channel.id` field is retained so existing consumers continue to work without changing the mobile API contract.

## Mobile reference

`apps/mobile` is the React Native / Expo implementation and is treated as the behavioral reference for web parity.

The final typecheck compatibility work preserved the mobile-facing API contracts without changing mobile source code.

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

Run the complete workspace validation from the root:

```bash
npm run typecheck
```

Or check an individual workspace:

```bash
cd packages/core && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
cd apps/mobile && npx tsc --noEmit
```

## Architecture decisions

### Keep mobile behavior stable

Web parity work uses mobile as the reference implementation. Compatibility fixes should normally be made in shared core or web rather than changing established mobile behavior.

### Web-owned TanStack Query client

The web app creates and owns its native TanStack Query `QueryClient`. This avoids crossing the core/web provider boundary with incompatible package instances or types.

### Web pitch and theme behavior

The web app contains its own pitch-positioning engine and fan-color hook, based on the mobile behavior where the behavior is shared but the UI/runtime implementation is platform-specific.

### Stale web test tree

The abandoned `apps/web/testa` tree is excluded from the web TypeScript project so stale experimental code cannot break production typechecking.

### PR #3 remains separate

The broader React/Vite migration in PR #3 is intentionally not included in this cleanup branch. It should only be brought in as a separate architectural change when explicitly required.

## What is not currently ported

Some mobile-specific capabilities remain intentionally outside the web implementation, including:

- Firebase Phone-Auth OTP browser integration
- FCM/Web Push delivery
- Mobile offline SQLite/cache infrastructure
- Mobile-specific video/background upload flows
- Some mobile-only admin/payment presentation

The shared API/data layer is real and targets the application's configured backend; the web UI is not a mock implementation.

## Branch

For the validated web/mobile parity work:

```text
chore/monorepo-clean-mobile-parity
```

Repository: https://github.com/capiyo/funspotfuta
