// packages/core/src/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { KVStorage } from '@funspot/storage';
import { compactPersistedClient, deserializePersistedClient, serializePersistedClient } from './persistence/serialization';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Query-key prefixes whose data is persisted to disk. Matched on queryKey[0].
 *
 * This is the shared persisted cache for web and mobile. It covers the Flutter
 * AppCache domains as those domains are migrated to React Query: fixtures,
 * votes, fixture/channel chat, channels, profile/account display data,
 * comrades, feed/post interactions, history, aftermatch, notifications and
 * per-fixture activity counters.
 *
 * Adding a prefix permits data under that prefix to persist; each screen still
 * needs to read/write the matching query key (do not bypass this cache with
 * component-owned fetch state). Auth tokens, passwords, payment credentials,
 * and other secrets must never be stored as query data.
 */
function containsCredential(value: unknown, depth = 0): boolean {
  if (depth > 8 || value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => containsCredential(item, depth + 1));
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
    if (/(^|_)(auth|access|refresh)?token$|password|secret|credential|authorization/i.test(key)) return true;
    return containsCredential(child, depth + 1);
  });
}

const PERSISTED_KEYS = new Set([
  // Flutter AppCache: fixtures, history and aftermatch.
  'fixtures',
  'history',
  'historyGames',
  'aftermatch',
  'liveEvents',
  // Flutter AppCache: votes, voters, counts and fixture/channel activity.
  'userVotes',
  'fixtureVotes',
  'votes',
  'voters',
  'openPokes',
  'userPokes',
  'comradeVoters',
  'channelFixtures',
  'voteCounts',
  'commentCounts',
  'likeCounts',
  'pledgeCounts',
  'betCounts',
  'unreadCounts',
  'latestComments',
  'perChannelVoteCounts',
  // Flutter AppCache: fixture and channel messages/comments.
  'messages',
  'chatMessages',
  'comments',
  'postComments',
  'historyComments',
  // Flutter AppCache: profile, accounts and comrades.
  'profile',
  'account',
  'accounts',
  'userProfile',
  'comrades',
  'userComrades',
  'userChannelCounts',
  // Flutter AppCache: channels, feed and post data.
  'channels',
  'userChannels',
  'channelLeaderboard',
  'feed',
  'posts',
  'postStats',
  'followers',
  'following',
  // Flutter AppCache: notifications and payment display data.
  'notifications',
  'notificationPreferences',
  'notificationSummary',
  'balance',
  'transactions',
]);

/**
 * Dehydrate + buster options, shared by the provider's persistOptions and
 * QueryProvider's background flush so both write snapshots the restore path
 * accepts.
 *
 * Bump `buster` whenever cached data shape changes, or when bad snapshots
 * (e.g. empty arrays cached from swallowed errors) must be discarded.
 * v1 -> v2 flushed empty-fixtures snapshots written by old catch-and-return-[]
 * queryFns. v2 -> v3 also drops unsuccessful query snapshots, which must never
 * replace a previously successful persisted result.
 */
export const PERSIST_OPTIONS = {
  buster: 'v6',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: {
      queryKey: readonly unknown[];
      state: { data: unknown; status: string };
    }) => {
      const key = query.queryKey[0];
      // Only persist successful, validated server responses. A query that
      // failed after hydration must not overwrite a good disk snapshot.
      if (query.state.status !== 'success' || query.state.data === undefined) return false;
      return typeof key === 'string' && PERSISTED_KEYS.has(key);
    },
    // Only replay-safe paused mutations may survive restart. Never persist a
    // mutation whose variables contain bearer tokens, passwords or credentials.
    shouldDehydrateMutation: (mutation: { state: { isPaused: boolean; variables?: unknown } }) =>
      mutation.state.isPaused && !containsCredential(mutation.state.variables),
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
        // Serve restored cache instantly, then refresh stale data in background.
        staleTime: 5 * 60 * 1000,
        // Cached data may render offline; a failed request is allowed to fall
        // back to persisted data rather than treating it as a cache miss.
        networkMode: 'offlineFirst',
        // Keep in memory as long as the on-disk snapshot may live.
        gcTime: DAY,
        // Cap the retry cycle at ~3s per delay so cold-start failures settle fast.
        retry: 2,
        retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 3000),
        refetchOnWindowFocus: false,
        // Never flip a populated query back to pending during a refetch.
        placeholderData: keepPreviousData,
      },
      mutations: {
        // Queue mutations while offline; providers resume them after hydration.
        networkMode: 'offlineFirst',
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
    serialize: (client) => serializePersistedClient(compactPersistedClient(client)),
    deserialize: deserializePersistedClient,
    // Shorter window = less data lost if the app is killed without a
    // background event (crash, dev reload, force-stop).
    throttleTime: 500,
  });

  const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
    persister,
    // Bound retained data and align restore lifetime with in-memory GC.
    maxAge: DAY,
    ...PERSIST_OPTIONS,
  };

  return { queryClient, persister, persistOptions };
}