import type { PersistedClient } from '@tanstack/query-persist-client-core';

const TAG = '__funspotPersistedType';
const MAX_PERSISTED_QUERIES = 150;
const MAX_PERSISTED_CHARS = 2_000_000;
const CACHE_PRIORITY: Record<string, number> = {
  fixtures: 100, fixtureVotes: 98, openPokes: 97, userPokes: 95,
  userVotes: 96, voteCounts: 94, voters: 92, channelFixtures: 90,
  channels: 88, chatMessages: 86, messages: 84, liveEvents: 83,
  feed: 82, profile: 80, postComments: 79, latestComments: 78,
  comrades: 76, userComrades: 74, history: 70, historyGames: 68,
  aftermatch: 66, liveCommentary: 65, notifications: 60, notificationSummary: 58, unreadCounts: 56,
};

function boundPayload(value: unknown, key = '', depth = 0): unknown {
  if (depth > 12) return null;
  if (Array.isArray(value)) {
    const limit = /^(messages|chatMessages|comments|postComments|historyComments|latestComments|notifications)$/i.test(key)
      ? 50
      : /^(transactions|posts|voters|comrades|events|liveEvents|liveCommentary)$/i.test(key)
        ? 100
        : /^pages$/i.test(key)
          ? 5
          : 250;
    return value.slice(-limit).map((item) => boundPayload(item, '', depth + 1));
  }
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [
      childKey,
      boundPayload(child, childKey, depth + 1),
    ]),
  );
}

/**
 * Bound both query count and total serialized payload size. This avoids an
 * unbounded fixture/channel/post key space or one oversized conversation
 * consuming the entire device/browser cache.
 */
export function compactPersistedClient(client: PersistedClient): PersistedClient {
  const ranked = client.clientState.queries.map((query, index) => {
    const boundedQuery = {
      ...query,
      state: { ...query.state, data: boundPayload(query.state.data) },
    };
    return {
      query: boundedQuery,
      index,
      priority: CACHE_PRIORITY[String(query.queryKey[0])] ?? 20,
      updatedAt: query.state.dataUpdatedAt ?? 0,
      size: JSON.stringify(boundedQuery).length,
    };
  });
  ranked.sort((a, b) => b.priority - a.priority || b.updatedAt - a.updatedAt || a.index - b.index);

  const retained = new Set<number>();
  let totalSize = 0;
  for (const item of ranked) {
    if (retained.size >= MAX_PERSISTED_QUERIES) break;
    if (item.size > MAX_PERSISTED_CHARS || totalSize + item.size > MAX_PERSISTED_CHARS) continue;
    retained.add(item.index);
    totalSize += item.size;
  }

  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries
        .map((query, index) => ({ query, index }))
        .filter(({ index }) => retained.has(index))
        .map(({ query }) => ({
          ...query,
          state: { ...query.state, data: boundPayload(query.state.data) },
        })),
    },
  };
}

/** JSON serialization that preserves Date values and explicit undefined values. */
export function serializePersistedClient(client: PersistedClient): string {
  return JSON.stringify(client, function (key, item: unknown) {
    const original = this && typeof this === 'object'
      ? (this as Record<string, unknown>)[key]
      : undefined;
    if (original instanceof Date) return { [TAG]: 'Date', value: original.toISOString() };
    if (original === undefined) return { [TAG]: 'Undefined' };
    return item;
  });
}

export function deserializePersistedClient(serialized: string): PersistedClient {
  return JSON.parse(serialized, (_key, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const tagged = item as Record<string, unknown>;
    if (tagged[TAG] === 'Date' && typeof tagged.value === 'string') return new Date(tagged.value);
    if (tagged[TAG] === 'Undefined') return undefined;
    return item;
  }) as PersistedClient;
}
