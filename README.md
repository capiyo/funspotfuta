# Funspot — Monorepo (Web + iOS/Android)

A single codebase for the [capiyo/funspot](https://github.com/capiyo/funspot)
Flutter app's real, live backend (`https://clash-api-m5mr.onrender.com/api`),
split into a shared domain layer plus one app per platform:

```
funspot-monorepo/
├── packages/
│   └── core/            @funspot/core — shared types + API client functions
├── apps/
│   ├── web/              Next.js 14 (App Router) — funspot-web
│   └── mobile/            Expo / React Native — funspot-mobile (iOS + Android)
└── package.json          npm workspaces root
```

## Why this split

`packages/core` contains everything that is **pure TypeScript with no
platform dependency** — data models (`Fixture`, `Bet`, `ChatMessage`, `Post`,
etc.) and API client functions that just call `fetch` against the real
backend. That's the majority of the ported logic, and it is byte-for-byte
identical whether it runs in a browser or on a phone, so it lives once and
both apps import it as `@funspot/core`.

What's **not** in core — because it genuinely differs by platform — stays
local to each app:

| Concern | apps/web | apps/mobile |
|---|---|---|
| Persistent session storage | `localStorage` | `AsyncStorage` |
| Toast notifications | DOM overlay | `Animated`/`View` overlay |
| Image upload for chat/posts | `File`/`Blob` | `{ uri, name, type }` (expo-image-picker) |
| Routing | Next.js App Router | React Navigation (stack + bottom tabs) |
| UI primitives | HTML + Tailwind | React Native `View`/`Text`/`StyleSheet` |

Each app has its own `auth-context.tsx`, `toast-context.tsx`,
`media-service.ts`, and `posts-create.ts` for exactly this reason — same
method names and behavior as their sibling, different implementation
underneath.

## packages/core

See `packages/core/src/index.ts` for the full export list. Ported from:

- `lib/models/fixture_models.dart`, `chat_message.dart`, `post_models.dart`,
  and the smaller model files → `src/types/*.ts`
- `lib/services/auth_service.dart`'s backend calls, `database_service.dart`,
  `comrade_service.dart` (full), `bet_service.dart` (full), the sub-fixture
  voting + posts/follow sections of `api_services.dart`,
  `payment_service.dart`, `web_soecket.dart`, the REST half of
  `notification_service.dart`, and the admin-only endpoints from
  `admin_dashboard.dart` → `src/api/*.ts`

Every function hits the **real production API** — there is no mock data.
Full per-file mapping tables are in each app's own README (they were written
before the monorepo split and are still accurate for the ported logic
itself, just not the current file paths).

## apps/web (Next.js)

```bash
cd apps/web
npm run dev
```

14 routes: `/login`, `/home`, `/fixture/[matchId]`, `/chat`, `/trending`,
`/profile`, `/feed`, `/comrades`, `/leaderboard`, `/history`,
`/notifications`, `/admin/[channelId]`, plus the root redirect.

## apps/mobile (Expo — iOS + Android)

```bash
cd apps/mobile
npm run start   # then press i for iOS simulator, a for Android emulator
```

Same 12 screens as the web app's routes, using React Navigation: a login
gate, a 5-tab bottom nav (Home, Trending, +Create, Chat, Profile — matching
`bottom_navigation.dart`'s original layout/colors exactly), and stack
screens for Fixture Detail, Feed, Comrades, Leaderboard, History,
Notifications, and Admin.

**This app was written and typechecked in a sandbox without Xcode or the
Android SDK** — `tsc --noEmit` passes cleanly, but it has not been run on an
actual simulator/device. Running `npm run ios` / `npm run android` for the
first time locally is the real test; expect the normal first-run friction
of a fresh Expo project (pod install on iOS, SDK/emulator setup on Android).

## Root workspace notes

- `package.json`'s `overrides` pins `react`, `react-dom`, and `@types/react`
  to the versions React Native 0.74 requires exactly (`18.2.0` /
  `~18.2.79`). Without this, npm installs two copies of React (one for
  Next.js's looser `^18.3.1` range, one for RN's exact pin), and Next's
  production build fails with a `useContext` null error from the
  duplicate-React problem. If you bump Next.js or RN independently in the
  future and hit that error again, this is why — realign the override.
- `apps/mobile/metro.config.js` points Metro (RN's bundler) at the
  workspace root so it can see `packages/core` and the hoisted
  `node_modules` — standard requirement for any Expo app in a monorepo.
- `apps/web/next.config.mjs` sets `transpilePackages: ['@funspot/core']`
  since core ships TypeScript source directly rather than a build step.

## What's not ported (same reasons as before the monorepo split)

- Firebase Phone-Auth OTP (needs live Firebase reCAPTCHA/SMS config)
- FCM/Web Push notification *delivery* (the data half — unread counts,
  preferences — is ported; actual push delivery isn't)
- Local SQLite caching / offline queue (solved mobile connectivity
  problems that don't apply the same way to a browser tab or a freshly
  re-fetching RN screen)
- Video in chat, admin dashboard's own payments UI (reuses the wallet's
  `payment-service.ts` instead of duplicating it)
