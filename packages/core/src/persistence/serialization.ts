import type { PersistedClient } from '@tanstack/query-persist-client-core';

const TAG = '__funspotPersistedType';

/**
 * Keep the on-disk snapshot bounded. Query cache keys are often parameterized
 * by fixture, channel, post and user, so an allowlist alone can grow forever.
 * Retain a small, priority-ranked working set: core fixture/vote state first,
 * then conversations/feed/profile, with recent entries preferred within a tier.
 */
const MAX_PERSISTED_QUERIES = 150;
const CACHE_PRIORITY: Record<string, number> = {
  fixtures: 100,
  fixtureVotes: 98,
  userVotes: 96,
  voteCounts: 94,
  voters: 92,
  channelFixtures: 90,
  channels: 88,
  chatMessages: 86,
  messages: 84,
  feed: 82,
  profile: 80,
  comrades: 76,
  userComrades: 74,
  history: 70,
  historyGames: 68,
  aftermatch: 66,
  latestComments: 64,
  postComments: 62,
  notifications: 60,
  notificationSummary: 58,
  unreadCounts: 56,
  balance: 50,
  transactions: 48,
};

export function compactPersistedClient(client: PersistedClient): PersistedClient {
  const queries = client.clientState.queries;
  if (queries.length <= MAX_PERSISTED_QUERIES) return client;

  const ranked = queries.map((query, index) => ({
    query,
    index,
    priority: CACHE_PRIORITY[String(query.queryKey[0])] ?? 20,
    updatedAt: query.state.dataUpdatedAt ?? 0,
  }));
  ranked.sort((a, b) => b.priority - a.priority || b.updatedAt - a.updatedAt || a.index - b.index);

  const retained = new Set(ranked.slice(0, MAX_PERSISTED_QUERIES).map(({ index }) => index));
  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: queries.filter((_query, index) => retained.has(index)),
    },
  };
}

/** JSON serialization that preserves Date values and explicit undefined values. */
export function serializePersistedClient(client: PersistedClient): string {
  return JSON.stringify(client, function (key, item: unknown) {
    // Date#toJSON executes before the replacer sees the value; inspect the
    // original property to preserve its runtime type.
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
