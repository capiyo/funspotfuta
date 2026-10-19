/**
 * Canonical query keys for Flutter AppCache domains.
 *
 * Every user-specific cache entry includes userId in its key. Never put auth
 * tokens or other credentials in a query key or cached query data.
 */
export const queryKeys = {
  fixtures: () => ['fixtures'] as const,
  fixtureVotes: (fixtureId: string, userId: string) => ['fixtureVotes', fixtureId, userId] as const,
  userVotes: (userId: string) => ['userVotes', userId] as const,
  channels: (userId?: string) => userId ? ['channels', userId] as const : ['channels', 'all-public'] as const,
  channelFixtures: (channelId: string, userId?: string) => ['channelFixtures', channelId, userId ?? 'public'] as const,
  voteCounts: (fixtureId: string, channelId?: string) => ['voteCounts', fixtureId, channelId ?? 'all'] as const,
  commentCounts: (fixtureId: string, channelId?: string) => ['commentCounts', fixtureId, channelId ?? 'all'] as const,
  likeCounts: (postId: string) => ['likeCounts', postId] as const,
  pledgeCounts: (fixtureId: string, channelId?: string) => ['pledgeCounts', fixtureId, channelId ?? 'all'] as const,
  betCounts: (fixtureId: string, channelId?: string) => ['betCounts', fixtureId, channelId ?? 'all'] as const,
  unreadCounts: (userId: string) => ['unreadCounts', userId] as const,
  latestComments: (fixtureId: string, channelId?: string) => ['latestComments', fixtureId, channelId ?? 'all'] as const,
  messages: (fixtureId: string, userId?: string) => ['messages', fixtureId, userId ?? 'public'] as const,
  chatMessages: (fixtureId: string, channelId: string, userId?: string) => ['chatMessages', fixtureId, channelId, userId ?? 'public'] as const,
  voters: (fixtureId: string, channelId?: string) => ['voters', fixtureId, channelId ?? 'all'] as const,
  comradeVoters: (fixtureId: string, userId: string) => ['comradeVoters', fixtureId, userId] as const,
  comrades: (userId: string) => ['comrades', userId] as const,
  userComrades: (userId: string) => ['userComrades', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  historyGames: (userId: string) => ['historyGames', userId] as const,
  historyComments: (gameId: string, userId: string) => ['historyComments', gameId, userId] as const,
  aftermatch: (fixtureId: string, channelId: string) => ['aftermatch', fixtureId, channelId] as const,
  liveEvents: (fixtureId?: string) => ['liveEvents', fixtureId ?? 'all'] as const,
  postComments: (postId: string) => ['postComments', postId] as const,
  feed: (userId?: string) => ['feed', userId ?? 'public'] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  notificationSummary: (userId: string) => ['notificationSummary', userId] as const,
  balance: (userId: string) => ['balance', userId] as const,
  transactions: (userId: string) => ['transactions', userId] as const,
} as const;

export type QueryKeyFactory = typeof queryKeys;

/**
 * Merge server results into a cached list without deleting cached entries
 * omitted by an incomplete response. Items with matching IDs use the fresh
 * server version. Unidentifiable values are kept as separate entries.
 */
export function mergeCachedList<T>(cached: readonly T[] | undefined, incoming: readonly T[], getId: (item: T) => string | number | null | undefined): T[] {
  const result = new Map<string, T>();
  for (const item of cached ?? []) {
    const id = getId(item);
    if (id !== null && id !== undefined && String(id) !== '') result.set(String(id), item);
    else result.set(`cached:${result.size}`, item);
  }
  for (const item of incoming) {
    const id = getId(item);
    if (id !== null && id !== undefined && String(id) !== '') result.set(String(id), item);
    else result.set(`incoming:${result.size}`, item);
  }
  return [...result.values()];
}

/** Flutter's LocalDatabase keeps at most 50 chat messages per fixture. */
export function capCachedMessages<T>(messages: readonly T[], limit = 50): T[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 50;
  return messages.slice(-safeLimit);
}
