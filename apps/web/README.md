# FunspotFuta Web — React

The web application is the React/React implementation of FunspotFuta.

It lives at `apps/web` in the monorepo and shares platform-independent API and domain logic with the mobile app through `@funspot/core`.

## Stack

- React 14 App Router
- React
- TypeScript
- Tailwind CSS
- TanStack Query
- `@funspot/core`

## Current parity status

The web app covers the mobile implementation's core product surfaces:

- Home / Arena
- Fixture detail
- Live channel chat
- Trending markets
- Feed
- Match history / Logs
- Profile
- Comrades
- Leaderboard
- Notifications
- Admin channel management

The mobile app remains the behavioral reference for parity. During the final monorepo cleanup, mobile-facing contracts were preserved while compatibility fixes were made in shared core and web.

## Project layout

```
apps/web/
├── app/                    # React routes and layouts
├── components/             # Reusable web UI
├── lib/
│   ├── api/                # Web API hooks/services
│   ├── match/              # Match/pitch presentation logic
│   ├── theme/              # Web theme helpers
│   └── ...                 # Other web-only utilities
├── public/
├── vite.config.ts
├── package.json
└── tsconfig.json
```

Shared domain/API code is in:

```
packages/core/
```

## Run locally

From the repository root:

```bash
npm install
cd apps/web
npm run dev
```

Then open:

```
http://localhost:3000
```

The application starts at the login flow and routes authenticated users into the main application.

## Typecheck

The web project must pass:

```bash
npx tsc --noEmit
```

The complete monorepo check is:

```bash
cd ../..
npm run typecheck
```

The validated parity branch currently passes TypeScript checks for:

- `packages/core`
- `apps/web`
- `apps/mobile`

## Shared core and API contracts

Web code should prefer the shared `@funspot/core` types and services for domain/API behavior rather than duplicating business logic.

For channels, `channelId` remains the canonical identifier. The shared `Channel.id` compatibility field exists for older consumers and should not replace `channelId` in new code.

The web app owns its TanStack Query `QueryClient`; it should not consume a QueryClient instance created by the shared core package.

## Web-specific parity implementations

Some behavior is shared conceptually but requires a web implementation:

- `lib/match/pitch-engine.ts` — pitch positioning and formation layout
- `lib/theme/use-fan-colors.ts` — fan/team color handling with browser theme support
- Web authentication/session, toast, media upload, routing, and UI primitives

These implementations use the mobile behavior as the reference without coupling the two platforms' UI runtimes.

## Environment

The web app currently does not require environment variables for the standard backend flow. See `.env.example` for optional Firebase web configuration related to future browser Phone-Auth OTP support.

## Production scope / known limitations

The following remain intentionally outside the current web scope:

- Firebase Phone-Auth OTP delivery/configuration
- FCM/Web Push notification delivery
- Mobile-only offline SQLite/cache infrastructure
- Mobile-specific video/background upload flows
- Some mobile-only admin/payment presentation

These are scope boundaries rather than mocked features.

## Development guidance

1. Treat `apps/mobile` as the behavioral reference when implementing parity.
2. Put reusable API/domain logic in `packages/core`.
3. Keep browser-only behavior inside `apps/web`.
4. Preserve existing mobile-facing core contracts when possible.
5. Run `npx tsc --noEmit` in web after changes.
6. Before merging broader architectural work, run the full monorepo typecheck.

## Validated branch

```text
chore/monorepo-clean-mobile-parity
```

Final validated commit:

```
2f8ab9f88839508e112272d3acc0d7f3e138bfb0
```

Repository: https://github.com/capiyo/funspotfuta
