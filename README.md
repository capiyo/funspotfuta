# Funspot — React Web + Mobile

Funspot is a multi-platform football community app. The mobile app is the **product and UX reference** for the web app: web should preserve the mobile app's visual language, interaction patterns, feature behavior, and real backend integration, adapted for larger screens.

Repository: [capiyo/funspotfuta](https://github.com/capiyo/funspotfuta)

## Product direction

- **Web:** React SPA built with Vite — no Next.js in the target architecture.
- **Mobile:** React Native + Expo, kept working and used as the reference implementation.
- **Shared logic:** `packages/core` for platform-independent domain types and API functions.
- **Backend:** the existing live API and Firebase integrations; do not replace real services with mock data during the migration.

The migration should be incremental. Preserve the existing mobile app, shared core, authentication/session behavior, API contracts, route coverage, and visual assets while converting the web app from Next.js App Router to React + Vite.

> **Migration status:** the current `apps/web` source is still Next.js. The React + Vite conversion is planned work, not yet complete. Do not deploy the web app as a Vite app until routing, environment variables, auth, all feature screens, and production build have been migrated and checked.

## Workspace layout

```text
funspot-monorepo/
├── apps/
│   ├── mobile/       Expo + React Native (reference app; preserve)
│   └── web/          React + Vite target (currently Next.js; migration pending)
├── packages/
│   ├── core/         Shared domain types and API client functions
│   └── storage/      Shared storage utilities
├── package.json      npm workspaces root
└── README.md
```

## Apps and local development

Install dependencies from the repository root:

```bash
npm install
```

### Mobile (reference app)

```bash
npm run dev:mobile
```

Or run the native app directly:

```bash
cd apps/mobile
npm run start
npm run ios       # requires macOS/Xcode
npm run android   # requires Android SDK/emulator
```

### Web (current implementation)

Until the migration is complete, the web app still uses Next.js:

```bash
npm run dev:web
```

The target web development command will remain `npm run dev:web`, backed by Vite after the conversion.

### Shared core checks

```bash
npm run typecheck:core
npm run typecheck:web
```

Run the mobile typecheck from its workspace:

```bash
npm run typecheck --workspace=funspot-mobile
```

## Mobile is the feature reference

Use the actual screens and flows in `apps/mobile` as the source of truth. The web implementation must reach feature parity for:

- Login and authenticated app entry
- Home and match/fixture discovery
- Trending
- Create/post flow and media handling
- Chat and channel interactions
- Profile
- Fixture detail, match voting/actions, and after-match flows
- Feed
- Comrades
- Leaderboard
- History
- Notifications and preferences
- Admin/channel management

Parity means more than matching route names: include loading, empty, error, signed-out, and signed-in states; working actions; API calls; permissions; and navigation behavior. Adapt layout for desktop without changing the product's core behavior.

## Design and implementation rules

1. **Reference before rewriting.** Inspect the corresponding mobile screen, shared components, API hooks, auth provider, and models before changing a web feature.
2. **Keep the mobile app stable.** Avoid changing `apps/mobile` unless a cross-platform bug or a clearly shared contract requires it.
3. **Reuse shared domain logic.** Prefer `@funspot/core` for types and API behavior; keep browser-only UI, browser storage, and DOM interactions inside `apps/web`.
4. **Respect platform differences.** React Native components cannot be directly reused as browser DOM components. Port the design and behavior into accessible web components rather than trying to share platform-specific view code.
5. **Preserve production integrations.** Keep the existing API base URL/configuration, Firebase auth behavior, upload flows, and environment-variable semantics. Never commit secrets.
6. **Avoid a big-bang replacement.** Convert routing/build infrastructure, then migrate feature screens in small, reviewable groups.
7. **Verify before calling it done.** Run TypeScript checks, production builds, and a route-by-route parity checklist. Manually validate login, navigation, posting/uploading, chat, fixture actions, profile, notifications, and admin access.

## React + Vite migration checklist

- [ ] Replace Next.js scripts/dependencies with Vite and React scripts/dependencies.
- [ ] Add the Vite HTML entry, React bootstrap, and SPA fallback routing.
- [ ] Map all existing URLs, including dynamic fixture and admin routes, to React Router.
- [ ] Port the shared app shell, navigation, layout, responsive behavior, and design tokens from the mobile reference.
- [ ] Migrate auth/session and toast providers without changing backend contracts.
- [ ] Port each feature screen and its real API interactions.
- [ ] Migrate static assets, Firebase messaging service worker, and public environment variables to Vite conventions.
- [ ] Update TypeScript, Tailwind/PostCSS, linting, and CI/deployment configuration.
- [ ] Remove Next.js-only imports, files, and dependencies only after their replacements are verified.
- [ ] Update lockfiles and documentation; run typecheck and production build.
- [ ] Complete the feature/state parity review against mobile before deployment.

## Shared core

`packages/core` contains platform-independent TypeScript domain types and API functions used by the apps. Keep API contracts and domain models consistent across platforms. When a shared contract changes, check both mobile and web consumers.

## Known boundaries

Some platform capabilities may need separate implementations. For example, browser uploads use browser file APIs while mobile uses native image-picker URIs; session persistence differs between browser storage and AsyncStorage; push delivery requires platform-specific setup. Preserve equivalent user-facing behavior while respecting those platform differences.

## Contribution workflow

The React web migration should be developed on a feature branch, reviewed in a pull request, and merged only after checks pass. Keep each change focused and document any feature parity gaps rather than silently replacing working functionality with placeholders.
