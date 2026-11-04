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
    uri?: string | null;
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
      uri: serverVoter?.uri ?? voter.uri ?? null,
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
async function getFixturesWithAllVoters(authToken?: string | null): Promise<Fixture[]> {
  const fixtures = await getAllFixtures();
  const enriched = [...fixtures];
  const concurrency = 8;

  for (let start = 0; start < fixtures.length; start += concurrency) {
    const batch = fixtures.slice(start, start + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (fixture) => {
        const fixtureIds = [...new Set([fixture.matchId, fixture.id].filter((id) => id.trim().length > 0))];
        if (fixtureIds.length === 0) return { fixture, voters: [] as Voter[] };

        // API deployments differ on whether the vote record is keyed by the
        // public matchId or Mongo fixture _id. Query both identifiers and merge.
        const voterLists = await Promise.all(
          fixtureIds.map((fixtureId) => fetchVoters(fixtureId, authToken).catch(() => [])),
        );
        const votersById = new Map<string, Voter>();
        for (const rawVoter of voterLists.flat()) {
          const voter = voterFromJson(rawVoter);
          if (!voter.userId) continue;
          const previous = votersById.get(voter.userId);
          votersById.set(voter.userId, {
            ...previous,
            ...voter,
            userName: voter.userName && voter.userName !== 'Anonymous' ? voter.userName : previous?.userName ?? voter.userName,
            uri: voter.uri ?? previous?.uri ?? null,
          });
        }
        return { fixture, voters: [...votersById.values()] };
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
export function useFixtures(userId?: string, enabled = true, authToken?: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.fixtures(),
    queryFn: () => getFixturesWithAllVoters(authToken),
    select: (fresh) => fresh.map((fixture) => mergeFixtureVoteSnapshot(fixture, userId, queryClient)),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Re-fetch after auth changes because the action modal uses the authenticated
  // voter endpoint; an old public fixture cache may contain only the current user's vote.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.fixtures() });
  }, [authToken, queryClient]);

  // Keep the persisted per-fixture snapshots in sync with every refreshed
  // voter list. Merge rather than replace so a partial endpoint response never
  // drops voters, avatars, vote totals, or the locally confirmed user vote.
  useEffect(() => {
    for (const fixture of query.data ?? []) {
      const fixtureId = fixture.matchId || fixture.id;
      const key = queryKeys.fixtureVotes(fixtureId, userId ?? 'anonymous');
      const previous = queryClient.getQueryData<CachedVoteSnapshot>(key);
      const voters = new Map<string, CachedVoteSnapshot['voters'][number]>();
      for (const voter of previous?.voters ?? []) voters.set(voter.userId, voter);
      for (const voter of fixture.voters ?? []) {
        if (!voter.userId) continue;
        const old = voters.get(voter.userId);
        voters.set(voter.userId, {
          userId: voter.userId,
          username: voter.userName || old?.username || 'Anonymous',
          selection: voter.selection || old?.selection || '',
          votedAt: voter.votedAt ?? old?.votedAt,
          isComrade: voter.isComrade ?? old?.isComrade,
          uri: voter.uri ?? old?.uri ?? null,
        });
      }
      const ownVote = [...voters.values()].find((voter) => voter.userId === userId);
      queryClient.setQueryData<CachedVoteSnapshot>(key, {
        homeVotes: previous?.homeVotes ?? 0,
        awayVotes: previous?.awayVotes ?? 0,
        drawVotes: previous?.drawVotes ?? 0,
        userVoteSelection: ownVote?.selection ?? previous?.userVoteSelection ?? null,
        voters: [...voters.values()],
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
