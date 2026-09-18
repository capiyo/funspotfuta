import { useQuery } from '@tanstack/react-query';
import { getAllFixtures, getUserParticipatedGames } from '../api/database-service';

/**
 * Replaces AppCache.refreshFixturesWithTime + the fixturesStream +
 * the 5-minute Timer.periodic auto-refresh, all at once.
 *
 * Any component in apps/web OR apps/mobile can call this identically.
 */
export function useFixtures() {
  return useQuery({
    queryKey: ['fixtures'],
    queryFn: getAllFixtures,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // matches your old auto-refresh cadence
  });
}

export function useHistoryGames(userId?: string) {
  return useQuery({
    queryKey: ['historyGames', userId],
    queryFn: () => getUserParticipatedGames(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}