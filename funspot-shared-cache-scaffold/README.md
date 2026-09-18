# Funspot monorepo — shared cache/query layer scaffold

## Layout

```
packages/
  storage/    -> KVStorage interface + web (localStorage) and mobile (MMKV) adapters
  core/       -> platform-agnostic: API fetch fns, query hooks, QueryClient factory
apps/
  web-example/     -> Next.js wiring (QueryProvider, example component)
  mobile-example/  -> React Native wiring (QueryProvider w/ AppState refetch-on-resume)
```

## Install (run from repo root, adjust for your package manager)

```bash
# root workspace deps
npm install -D turbo   # or nx, or plain npm/yarn/pnpm workspaces — your choice

# in packages/core
npm install @tanstack/react-query @tanstack/react-query-persist-client @tanstack/query-async-storage-persister

# in packages/storage (mobile adapter dep)
npm install react-native-mmkv
```

Wire `packages/*` into your workspace root `package.json`:

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

## Wiring into each app

**Next.js** (`apps/web/app/layout.tsx`):
```tsx
import { QueryProvider } from './QueryProvider'; // copy from apps/web-example

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

**React Native** (`apps/mobile/App.tsx`):
```tsx
import { QueryProvider } from './QueryProvider'; // copy from apps/mobile-example

export default function App() {
  return (
    <QueryProvider>
      <YourNavigator />
    </QueryProvider>
  );
}
```

## What this replaces from the Flutter AppCache

| Flutter AppCache concept                          | Here                                              |
|-----------------------------------------------------|----------------------------------------------------|
| In-memory maps + manual getters                    | TanStack Query's internal cache                    |
| `SharedPreferences` read/write + JSON encode/decode | `KVStorage` adapter + `createAsyncStoragePersister` |
| `DiskWriteScheduler` debounce                       | `throttleTime` on the persister                    |
| `_loadCriticalData` / `_loadDeferredData`           | `shouldDehydrateQuery` allowlist in queryClient.ts  |
| `Timer.periodic` 5-min auto-refresh                 | `refetchInterval` per query                        |
| `_fixtureListsEqual` signature diffing              | Built-in structural sharing (automatic, no code)   |
| App lifecycle pause/resume refresh                  | `AppState` + `focusManager` in mobile QueryProvider |

## Next steps
- Port `fetchChannels`, `fetchComrades`, `fetchChatMessages` into `packages/core/src/api/` the same way `fixtures.ts` is done here.
- Decide on realtime transport (websocket for live commentary/votes) — that stays platform-specific; happy to scaffold a `packages/core/src/realtime.ts` interface + web/RN socket adapters next.
- FCM/push token registration stays per-app (web push vs native FCM) — keep the existing `registerToken(userId, token, platform)` signature you already have server-side.
