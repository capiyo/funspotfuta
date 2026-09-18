import { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClient,
  type PersistQueryClientOptions,
} from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { KVStorage } from '@funspot/storage';

/**
 * Wraps a KVStorage adapter in the shape TanStack's persister expects
 * (it wants getItem/setItem/removeItem returning promises).
 */
function toAsyncStorageLike(storage: KVStorage) {
  return {
    getItem: async (key: string) => storage.getItem(key),
    setItem: async (key: string, value: string) => storage.setItem(key, value),
    removeItem: async (key: string) => storage.removeItem(key),
  };
}

/**
 * Call once per app (web or mobile), passing in that platform's
 * storage adapter. Returns a ready-to-use QueryClient with
 * persistence + rehydration already configured.
 *
 * This one function replaces AppCache's:
 *   - loadAllFromDisk / saveToDisk
 *   - _loadCriticalData / _loadDeferredData (tiered hydration)
 *   - the 5-minute refresh timer (via staleTime/refetchInterval per-query)
 *   - the DiskWriteScheduler debounce (TanStack batches persistence writes)
 */
export function createAppQueryClient(storage: KVStorage) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 min: matches your old "don't repaint if unchanged"
        gcTime: 24 * 60 * 60 * 1000, // keep cached data 24h before eviction
        retry: 2,
        refetchOnWindowFocus: false, // set true on web if you want tab-focus refresh
      },
    },
  });

  const persister = createAsyncStoragePersister({
    storage: toAsyncStorageLike(storage),
    key: 'FUNSPOT_QUERY_CACHE',
    throttleTime: 1000, // debounce writes — direct analog of DiskWriteScheduler
  });

  const persistOptions: PersistQueryClientOptions = {
    queryClient,
    persister,
    maxAge: 24 * 60 * 60 * 1000,
    // Only persist queries you actually want surviving a restart —
    // mirrors your old "critical data" vs "deferred data" split.
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        const persistable = ['fixtures', 'channels', 'profile', 'userVotes'];
        return persistable.includes(query.queryKey[0] as string);
      },
    },
  };

  persistQueryClient(persistOptions);

  return queryClient;
}
