import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchHistoryGames, type HistoryGame } from '../api/history-service';
import { queryKeys } from './queryKeys';

export interface HistoryPage {
  games: HistoryGame[];
}

export function historyQueryOptions(userId?: string, authToken?: string | null, pageSize = 20) {
  return {
    queryKey: queryKeys.history(userId),
    queryFn: async ({ pageParam }: { pageParam: number }) => ({
      games: await fetchHistoryGames({ limit: pageSize, skip: pageParam }, authToken ?? undefined),
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage: HistoryPage, allPages: HistoryPage[]) =>
      lastPage.games.length === pageSize ? allPages.length * pageSize : undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  } as const;
}

/** Shared persisted, cache-first paginated history for both platforms. */
export function useInfiniteHistoryGames(
  userId?: string,
  authToken?: string | null,
  options: { enabled?: boolean; pageSize?: number } = {},
) {
  const pageSize = options.pageSize ?? 20;
  return useInfiniteQuery({
    ...historyQueryOptions(userId, authToken, pageSize),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}
