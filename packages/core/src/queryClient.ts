// packages/core/src/api/query-client.ts
import { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClient,
  type PersistQueryClientOptions,
} from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { KVStorage } from '@funspot/storage';

const DAY = 24 * 60 * 60 * 1000;

function toAsyncStorageLike(storage: KVStorage) {
  return {
    getItem: async (key: string) => storage.getItem(key),
    setItem: async (key: string, value: string) => storage.setItem(key, value),
    removeItem: async (key: string) => storage.removeItem(key),
  };
}

export function createAppQueryClient(storage: KVStorage) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: DAY,
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  });

  const persister = createAsyncStoragePersister({
    storage: toAsyncStorageLike(storage),
    key: 'FUNSPOT_QUERY_CACHE',
    throttleTime: 1000,
  });

  const persistOptions: PersistQueryClientOptions = {
    queryClient,
    persister,
    maxAge: DAY,
    buster: 'v1',
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        const [key, arg] = query.queryKey as [string, unknown];
        if (query.state.status !== 'success') return false;
        if (key === 'history') return arg === '';
        return ['fixtures', 'feed', 'channels', 'profile', 'userVotes'].includes(key);
      },
    },
  };

  const [_unsubscribe, rehydratePromise] = persistQueryClient(persistOptions);

  return { queryClient, rehydratePromise };
}