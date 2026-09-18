import { useQuery } from '@tanstack/react-query';
import { fetchFixtures, fetchHistoryGames } from '../api/fixtures';

/**
 * Replaces AppCache.refreshFixturesWithTime + the fixturesStream +
 * the 5-minute Timer.periodic auto-refresh, all at once.
 *
 * Any component in apps/web OR apps/mobile can call this identically.
 */
export function useFixtures() {
  return useQuery({
    queryKey: ['fixtures'],
    queryFn: fetchFixtures,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // matches your old auto-refresh cadence
  });
}

export function useHistoryGames(authToken?: string) {
  return useQuery({
    queryKey: ['historyGames', authToken],
    queryFn: () => fetchHistoryGames(authToken),
    staleTime: 5 * 60 * 1000,
  });
}
