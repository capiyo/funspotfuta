# Funspot

Funspot is a TypeScript monorepo for a football-fan community app. It contains an Expo/React Native mobile app, a React DOM web app, and a shared API/domain package.

> **Project status:** Active development. The web app is a work in progress, not yet verified as fully feature- or visually equivalent to the mobile app. A matching file path or a successful TypeScript/build check does not prove feature parity. Check the current branch and CI results before relying on any feature in production.

## Repository layout

- `apps/mobile` — Expo and React Native app; the established mobile implementation is the reference for intended behavior.
- `apps/web` — browser app built with React, Vite, TypeScript, Tailwind CSS, and React Router. It uses DOM/browser implementations rather than Next.js.
- `packages/core` — shared TypeScript API clients, domain types, and query utilities.
- `docs/PORT_MAP.md` — file-by-file mobile-to-web comparison and outstanding parity work.
- `docs/PORT_REPORT.md` — migration findings and known verification gaps.
- `docs/PORT_DECISIONS.md` — recorded implementation decisions.
- `docs/FIREBASE_SETUP.md` — manual Firebase setup notes.

## Current web experience

The web Home is designed around a desktop navbar, a profile/channel sidebar, and Chats and Feed panes. On narrow screens, the layout switches to the mobile-style Chats/Feed tab interface. The app includes work on fixture cards and voting flows, feed posts and media, profile and channel UI, messaging, authentication, and modal flows.

These are areas of ongoing implementation, **not a claim that every flow is complete or production-verified**. In particular, the port tracking documents still identify shorter or suspect web counterparts and outstanding parity work in ChatsScreen, the app header, login flow, feed and other UI components. Live Firebase phone verification, push-notification delivery, production API behavior, and full browser/device interaction testing require separate runtime verification.

The guest comment prompt is implemented in the web Chats card and the React Native Chats card. This change alone does not establish that every guest/authentication interaction works end to end.

## Requirements

- Node.js and npm compatible with the repository's dependencies
- Firebase web configuration for the browser app's Firebase-backed features
- Access to the configured API for live data and end-to-end checks

## Install and run

Run these commands from the repository root:

```sh
npm install

# Web development server (Vite)
npm run dev:web

# Expo development server
npm run dev:mobile
```

For Android or iOS native development, use the scripts in `apps/mobile/package.json` and the Expo/native toolchain required by your environment.

## Checks available in the repository

Run these individually from the repository root:

```sh
npm run typecheck:core
npm run typecheck:web
npm run typecheck:mobile
npm run lint:web
npm run build:web
npm run test:core
```

The web package also provides a Chats card verification script:

```sh
cd apps/web
npm run verify:card-parity
```

A check passing validates only what that check covers. It does not verify Firebase Console configuration, actual SMS delivery, push delivery, API behavior against production, responsive rendering on real devices, or complete mobile/web parity. Record the result from the latest commit; do not reuse an older successful run as proof that newer changes pass.

## Web environment

Copy `apps/web/.env.example` to `apps/web/.env.local` if the example file is present, then configure the Firebase web settings and public VAPID key required by your environment. The API base used by the current web setup defaults to:

```text
https://clash-api-m5mr.onrender.com/api
```

Use the appropriate API URL and Firebase project for your deployment. Never commit private credentials or secret keys. Public browser configuration values are not substitutes for securing backend endpoints.

## Parity and release status

The migration is not complete while the port map contains `PENDING` or `SUSPECT` items, or while required live checks remain unverified. Before calling the web app release-ready:

1. Review and update `docs/PORT_MAP.md` against the current mobile source and web behavior.
2. Complete the outstanding flows documented in `docs/PORT_REPORT.md`.
3. Run the typechecks, lint, build, and relevant tests against the current commit.
4. Exercise guest and authenticated paths, messaging, fixture actions, feed/media, profile, and modals in a real browser and on supported mobile devices.
5. Verify Firebase SMS/OTP, notification registration and delivery, and API interactions with valid environment configuration.
6. Keep the migration pull request in draft until these checks pass.

Do not treat matching filenames, line-count comparisons, or static source review as proof of behavioral or visual parity.
