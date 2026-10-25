import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAllFixtures, getUserParticipatedGames } from '../api/database-service';
import { fetchVoters } from '../api/vote-modal-shims';
import { voterFromJson } from '../types/fixture';
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
 * The /games endpoint often includes only vote totals (or a partial voter
 * array). Fetch the complete voter list for each unique fixture so every
 * channel card sharing that fixture can render the same voters. Limit
 * concurrency to avoid overwhelming the API when the schedule is large.
 */
async function getFixturesWithAllVoters(): Promise<Fixture[]> {
  const fixtures = await getAllFixtures();
  const enriched = [...fixtures];
  const concurrency = 8;

  for (let start = 0; start < fixtures.length; start += concurrency) {
    const batch = fixtures.slice(start, start + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (fixture) => {
        const fixtureId = fixture.matchId || fixture.id;
        if (!fixtureId) return { fixture, voters: [] as Voter[] };
        const rawVoters = await fetchVoters(fixtureId);
        return { fixture, voters: rawVoters.map(voterFromJson).filter((voter) => voter.userId !== '') };
      }),
    );

    results.forEach((result, index) => {
      const fixture = batch[index];
      if (result.status !== 'fulfilled') return;
      const existing = fixture.voters ?? [];
      const merged = new Map<string, Voter>();
      for (const voter of existing) merged.set(voter.userId, voter);
      for (const voter of result.value.voters) {
        const previous = merged.get(voter.userId);
        merged.set(voter.userId, {
          ...previous,
          ...voter,
          userName: voter.userName || previous?.userName || 'Anonymous',
          uri: voter.uri ?? previous?.uri ?? null,
        });
      }
      const indexInFixtures = start + index;
      enriched[indexInFixtures] = { ...fixture, voters: [...merged.values()] };
    });
  }

  return enriched;
}

/**
 * Shared fixture query for web/mobile. Fetches full voters for every fixture,
 * then merges cached vote snapshots so a failed/partial response does not
 * erase a locally recorded vote or voter name.
 */
export function useFixtures(userId?: string, enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.fixtures(),
    queryFn: getFixturesWithAllVoters,
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
