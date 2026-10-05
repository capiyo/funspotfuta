// packages/core/src/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { KVStorage } from '@funspot/storage';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Query keys whose data is persisted to disk. Matched on queryKey[0] only.
 * Must include EVERY key[0] you want to survive a cold start. Previously
 * 'userChannels' and 'historyGames' were missing, so they were never saved.
 */
const PERSISTED_KEYS = new Set([
  'fixtures',
  'feed',
  'history',
  'historyGames',
  'channels',
  'userChannels',
  'profile',
  'userVotes',
]);

/**
 * Dehydrate + buster options, shared by the provider's persistOptions and
 * QueryProvider's background flush so both write snapshots the restore path
 * accepts.
 *
 * Bump `buster` whenever cached data shape changes, or when bad snapshots
 * (e.g. empty arrays cached from swallowed errors) must be discarded.
 * v1 -> v2: flushes empty-fixtures snapshots written by the old
 * catch-and-return-[] queryFns.
 */
export const PERSIST_OPTIONS = {
  buster: 'v2',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: {
      queryKey: readonly unknown[];
      state: { data: unknown };
    }) => {
      const key = query.queryKey[0];
      // Persist anything that holds data, including queries momentarily
      // refetching.
      if (query.state.data === undefined) return false;
      return typeof key === 'string' && PERSISTED_KEYS.has(key);
    },
  },
} as const;

/** Identity: returns previous data unchanged (avoids TS7006 in defaultOptions). */
function keepPreviousData<T>(previousData: T | undefined): T | undefined {
  return previousData;
}

/**
 * Builds the QueryClient and persister. It does NOT start persistence itself:
 * pass `persistOptions` to <PersistQueryClientProvider>, which restores the
 * cache and holds queries until restore is done (no fetch-before-restore race).
 *
 * Call this once at MODULE scope (not inside a component / useState), so
 * StrictMode double-invocation can't create two clients writing the same key.
 */
export function createAppQueryClient(storage: KVStorage) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Serve cache instantly, refresh in the background.
        staleTime: 5 * 60 * 1000,
        // Keep in memory as long as the on-disk snapshot may live.
        gcTime: 7 * DAY,
        // Cap the retry cycle at ~3s per delay so cold-start failures settle fast.
        retry: 2,
        retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 3000),
        refetchOnWindowFocus: false,
        // Never flip a populated query back to pending during a refetch.
        placeholderData: keepPreviousData,
      },
    },
  });

  // MMKV is synchronous, so use the sync persister.
  const persister = createSyncStoragePersister({
    storage: {
      getItem: (key: string) => storage.getItem(key) as string | null,
      setItem: (key: string, value: string) => storage.setItem(key, value),
      removeItem: (key: string) => storage.removeItem(key),
    },
    key: 'FUNSPOT_QUERY_CACHE',
    // Shorter window = less data lost if the app is killed without a
    // background event (crash, dev reload, force-stop).
    throttleTime: 500,
  });

  const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
    persister,
    // Match gcTime so a week-old snapshot is still restorable.
    maxAge: 7 * DAY,
    ...PERSIST_OPTIONS,
  };

  return { queryClient, persister, persistOptions };
}