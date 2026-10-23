import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAllFixtures, getUserParticipatedGames } from '../api/database-service';
import type { Fixture, Voter } from '../types/fixture';
import { queryKeys } from './queryKeys';

interface CachedVoteSnapshot {
  homeVotes: number;
  awayVotes: number;
  drawVotes: number;
  userVoteSelection: string | null;
  voters: Array<{
    userId: string;
    username: string;
    selection: string;
    votedAt?: Date | string;
    isComrade?: boolean;
  }>;
}

function mergeFixtureVoteSnapshot(
  fixture: Fixture,
  userId: string | undefined,
  queryClient: ReturnType<typeof useQueryClient>,
): Fixture {
  const fixtureId = fixture.matchId || fixture.id;
  const key = queryKeys.fixtureVotes(fixtureId, userId ?? 'anonymous');
  const snapshot = queryClient.getQueryData<CachedVoteSnapshot>(key);
  const merged = new Map<string, Voter>();
  for (const voter of fixture.voters ?? []) merged.set(voter.userId, voter);
  for (const voter of snapshot?.voters ?? []) {
    const serverVoter = merged.get(voter.userId);
    merged.set(voter.userId, {
      userId: voter.userId,
      userName: serverVoter?.userName ?? voter.username,
      selection: serverVoter?.selection ?? voter.selection,
      votedAt: serverVoter?.votedAt ?? (voter.votedAt ? new Date(voter.votedAt) : new Date()),
      isComrade: serverVoter?.isComrade ?? voter.isComrade ?? false,
      isCorrect: serverVoter?.isCorrect ?? null,
      pointsAwarded: serverVoter?.pointsAwarded ?? null,
    });
  }
  const voters = [...merged.values()];
  return { ...fixture, voters };
}

/**
 * Shared fixture query for web/mobile. Cached vote and voter snapshots are
 * merged into fresh fixture payloads so partial server responses do not erase
 * a locally recorded vote or voter name.
 */
export function useFixtures(userId?: string, enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.fixtures(),
    queryFn: getAllFixtures,
    select: (fresh) => fresh.map((fixture) => mergeFixtureVoteSnapshot(fixture, userId, queryClient)),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Seed a user-scoped vote snapshot from restored fixture voters only when
  // that vote snapshot is absent. This makes cached voter names available to
  // chat immediately after a cold start, without overwriting vote counts.
  useEffect(() => {
    for (const fixture of query.data ?? []) {
      const fixtureId = fixture.matchId || fixture.id;
      const key = queryKeys.fixtureVotes(fixtureId, userId ?? 'anonymous');
      if (queryClient.getQueryData(key)) continue;
      const ownVote = fixture.voters.find((voter) => voter.userId === userId);
      queryClient.setQueryData(key, {
        homeVotes: 0,
        awayVotes: 0,
        drawVotes: 0,
        userVoteSelection: ownVote?.selection ?? null,
        voters: fixture.voters.map((voter) => ({
          userId: voter.userId,
          username: voter.userName,
          selection: voter.selection,
          votedAt: voter.votedAt,
          isComrade: voter.isComrade,
        })),
      });
    }
  }, [query.data, userId, queryClient]);

  return query;
}

export function useHistoryGames(userId?: string) {
  return useQuery({
    queryKey: userId ? queryKeys.historyGames(userId) : ['historyGames', 'anonymous'],
    queryFn: () => getUserParticipatedGames(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}
