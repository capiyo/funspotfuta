// packages/core/src/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { KVStorage } from '@funspot/storage';

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