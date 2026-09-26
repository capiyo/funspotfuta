// screens/ArenaScreen.tsx
//
// OVERHAUL: only presentation changed. All data, vote and pledge logic,
// and both modals are exactly as they were.
//   - status filter is a SegmentedControl (was a wrapping row of pill
//     chips that looked identical to the channel chips right above it)
//   - loading / empty / error use the shared list states
//   - no horizontal padding on the list: FeedItem owns the gutter
//   - last card clears the floating tab bar (LIST_BOTTOM_INSET)
//   - commentsOf() now mocks two comments (with commentor names) per
//     fixture until real comments are wired up — see below
//   - NEW: MatchCard's news/lineups link opens MatchDetailsModal

import { useCallback, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '../modals/Login-modal-context';
import {
  getAllFixtures,
  Fixture,
  FanColorPalette,
  FAN_SPACING,
  castVote,
  createBetWithVoteId,
  Voter,
} from '@funspot/core';
import { MatchCard, LatestComment } from '@/components/MatchCard';
import { SegmentedControl } from '@/components/ui/Segmentedcontrol';
import {
  EmptyState,
  ErrorBanner,
  SkeletonRows,
} from '@/components/ui/ListsStates';
import { SwipeableVotePledgeModal } from '@/components/actionModal';
import { AftermatchReviewModal } from '@/components/AftermatchModal';
import { MatchDetailsModal } from '@/modals/match/matchDetailsModals';

import { useFanColors } from '@/theme/use-fan-colors';
import { GUTTER, LIST_BOTTOM_INSET } from '@/theme/layout';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { useHome } from './home/home-context';
// TODO: export these from @funspot/core instead of reaching into its src.
import {
  fetchVoters,
  fetchPledges,
  fetchSubFixtures,
  fetchSubFixturePledges,
  fetchBets,
  fetchBalance,
  topUp,
  withdraw,
  getSavedPhone,
  savePhone,
  getUserPhone,
  placeSubFixturePledge,
  matchSubFixturePledge,
  matchMainPledge,
} from '../../../../packages/core/src/api/vote-modal-shims';

type Filter = 'all' | 'live' | 'upcoming' | 'completed';

const EMPTY_COPY: Record<Filter, { title: string; hint: string }> = {
  all: { title: 'No fixtures right now', hint: 'Check back soon.' },
  live: {
    title: 'Nothing live at the moment',
    hint: 'Live matches show up here.',
  },
  upcoming: {
    title: 'No upcoming fixtures',
    hint: 'New fixtures appear as they are scheduled.',
  },
  completed: {
    title: 'No completed matches yet',
    hint: 'Finished matches appear here.',
  },
};

const FIXTURES_KEY = ['fixtures'] as const;
const NO_FIXTURES: Fixture[] = [];

// ── Mock comments (until real comments are wired up) ───────────────────
// Every fixture gets its own pair, picked deterministically from its id so
// a card doesn't reshuffle its comments on every re-render/refetch, but two
// different fixtures still (almost always) show different lines.
const MOCK_COMMENTORS = [
  'Kevo',
  'Aisha',
  'Brian',
  'Faith',
  'Otieno',
  'Wanjiru',
  'Denis',
  'Nadia',
  'Mutiso',
  'Cheryl',
];
const MOCK_COMMENTS = [
  'This is going to be a banger 🔥',
  'My gut says an upset today',
  'Defense has to show up this time',
  "Can't wait for kickoff",
  'That midfield battle decides it',
  'Home crowd advantage all day',
  'Not confident about this one honestly',
  'Easy three points incoming',
  'Injuries could really hurt them here',
  'Give me a 2-1 all day',
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h || 1;
}

function seededPick<T>(pool: T[], seed: string, n: number): T[] {
  let h = hashSeed(seed);
  const used = new Set<number>();
  const picks: T[] = [];
  while (picks.length < n && used.size < pool.length) {
    h = (h * 1103515245 + 12345) >>> 0;
    let idx = h % pool.length;
    while (used.has(idx)) idx = (idx + 1) % pool.length;
    used.add(idx);
    picks.push(pool[idx]);
  }
  return picks;
}

function mockCommentsFor(fixtureId: string): LatestComment[] {
  const names = seededPick(MOCK_COMMENTORS, fixtureId, 2);
  const lines = seededPick(MOCK_COMMENTS, fixtureId + '#lines', 2);
  return names.map((username, i) => ({ username, comment: lines[i] }));
}

// Real comments if the fixture has any; otherwise two mock ones unique to
// this fixture, each with a commentor name.
function commentsOf(f: Fixture): LatestComment[] {
  const raw = ((f as any).comments ?? (f as any).latestComments ?? []) as any[];
  const real = raw
    .map((c) => ({
      username: c.username ?? c.userName ?? 'Fan',
      comment: c.comment ?? c.text ?? '',
    }))
    .filter((c) => c.comment);
  if (real.length) return real;
  return mockCommentsFor(f.matchId || f.id || 'fixture');
}

function isLiveFixture(f: Fixture) {
  return !!f.isLive || f.status === 'live';
}
function isUpcomingFixture(f: Fixture) {
  return f.status === 'upcoming' || f.status === 'soon';
}
function isCompletedFixture(f: Fixture) {
  return f.status === 'completed';
}
function matchesFilter(f: Fixture, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'live') return isLiveFixture(f);
  if (filter === 'upcoming') return isUpcomingFixture(f);
  return isCompletedFixture(f);
}
function statusRank(f: Fixture) {
  if (isLiveFixture(f)) return 0;
  if (isUpcomingFixture(f)) return 1;
  return 2;
}

export default function ArenaScreen() {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { userId, authToken, username, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  const { activeChannelId } = useHome();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();

  const { data, isPending, error, refetch } = useQuery({
    queryKey: FIXTURES_KEY,
    queryFn: getAllFixtures,
  });
  const fixtures = data ?? NO_FIXTURES;

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [modalFixture, setModalFixture] = useState<Fixture | null>(null);
  const [reviewFixture, setReviewFixture] = useState<Fixture | null>(null);
  const [matchDetailsFixture, setMatchDetailsFixture] = useState<Fixture | null>(
    null,
  );

  const loadError =
    error && fixtures.length === 0
      ? 'Could not load fixtures. Pull down to try again.'
      : null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const liveCount = useMemo(
    () => fixtures.filter(isLiveFixture).length,
    [fixtures],
  );

  // Count only on "Live": four equal segments don't have room for
  // "Completed (24)" on a phone.
  const filterOptions = useMemo(
    () => [
      { value: 'all' as const, label: 'All' },
      {
        value: 'live' as const,
        label: liveCount > 0 ? `Live · ${liveCount}` : 'Live',
      },
      { value: 'upcoming' as const, label: 'Upcoming' },
      { value: 'completed' as const, label: 'Completed' },
    ],
    [liveCount],
  );

  const filtered = useMemo(() => {
    const matched = fixtures.filter((f) => matchesFilter(f, filter));
    if (filter !== 'all') return matched;
    return matched
      .map((f, i) => ({ f, i }))
      .sort((a, b) => statusRank(a.f) - statusRank(b.f) || a.i - b.i)
      .map(({ f }) => f);
  }, [fixtures, filter]);

  const openChat = useCallback(
    (fixture?: Fixture) => {
      if (!isLoggedIn) return requireLogin(() => openChat(fixture));
      if (!activeChannelId) return;
      navigation.navigate('Chat', {
        channelId: activeChannelId,
        fixtureId: fixture ? fixture.matchId ?? fixture.id : undefined,
      });
    },
    [navigation, activeChannelId, isLoggedIn, requireLogin],
  );

  async function handleLike(fixture: Fixture) {
    if (!userId) return;
    // Stub — wire to your like endpoint when ready.
  }

  async function handleSubmitComment(fixture: Fixture, text: string) {
    if (!userId || !username) return;
    // Stub — MatchCard clears the draft after calling this, so until it is
    // wired a typed comment is discarded.
  }

  const listHeader = (
    <View style={styles.header}>
      <SegmentedControl
        options={filterOptions}
        value={filter}
        onChange={setFilter}
        colors={colors}
      />
      {loadError && <ErrorBanner colors={colors} message={loadError} />}
    </View>
  );

  return (
    <View style={styles.screen}>
      {isPending ? (
        <View>
          {listHeader}
          <SkeletonRows colors={colors} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={filtered}
          keyExtractor={(fixture) => fixture.id || fixture.matchId}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <EmptyState
              colors={colors}
              title={EMPTY_COPY[filter].title}
              hint={EMPTY_COPY[filter].hint}
            />
          }
          renderItem={({ item: fixture }) => (
            <MatchCard
              fixture={fixture}
              comments={commentsOf(fixture)}
              channelId={activeChannelId}
              onOpen={() => openChat(fixture)}
              onOpenVoteModal={setModalFixture}
              onOpenResults={setReviewFixture}
              onChatClick={() => openChat(fixture)}
              onLike={handleLike}
              onSubmitComment={handleSubmitComment}
              onOpenLineups={setMatchDetailsFixture}
            />
          )}
        />
      )}

      {modalFixture && (
        <SwipeableVotePledgeModal
          visible
          fixture={{
            id: modalFixture.id,
            matchId: modalFixture.matchId,
            homeTeam: modalFixture.homeTeam,
            awayTeam: modalFixture.awayTeam,
            league: modalFixture.league,
            isLive: modalFixture.isLive,
          }}
          userId={userId ?? ''}
          username={username ?? ''}
          authToken={authToken}
          isLoggedIn={!!isLoggedIn}
          hasUserVoted={(modalFixture.voters ?? []).some(
            (v) => v.userId === userId,
          )}
          userVoteSelection={
            (modalFixture.voters ?? []).find((v) => v.userId === userId)
              ?.selection
          }
          channelId={activeChannelId ?? ''}
          showPledgesTab
          showSubFixturesTab
          showBetsTab
          onClose={() => setModalFixture(null)}
          onVote={async (sel) => {
            if (!activeChannelId || !userId || !authToken) return false;
            const ok = await castVote({
              channelId: activeChannelId,
              fixtureId: modalFixture.matchId || modalFixture.id,
              userId,
              selection: sel === 'home' ? 'home_team' : 'away_team',
              authToken,
            });
            if (ok) {
              queryClient.setQueryData<Fixture[]>(FIXTURES_KEY, (prev = []) =>
                prev.map((fx) => {
                  if (
                    fx.id !== modalFixture.id &&
                    fx.matchId !== modalFixture.matchId
                  ) {
                    return fx;
                  }
                  const newVoter: Voter = {
                    userId: userId!,
                    userName: username ?? '',
                    selection: sel === 'home' ? 'home_team' : 'away_team',
                    votedAt: new Date(),
                    isComrade: false,
                    isCorrect: false,
                    pointsAwarded: 0,
                  };
                  return {
                    ...fx,
                    voters: [...(fx.voters ?? []), newVoter],
                  };
                }),
              );
            }
            return ok;
          }}
          onPledge={async (sel, amount) => {
            if (!activeChannelId || !userId || !username) return false;
            const r = await createBetWithVoteId({
              fixtureId: modalFixture.matchId || modalFixture.id,
              starterId: userId,
              starterName: username,
              starterSelection: sel === 'home' ? 'home_team' : 'away_team',
              amount,
              channelId: activeChannelId,
              voteId: '',
              authToken: authToken ?? undefined,
            });
            return r?.success !== false;
          }}
          onShowJoinGroups={() => { }}
          fetchVoters={fetchVoters}
          fetchPledges={fetchPledges}
          fetchSubFixtures={fetchSubFixtures}
          fetchSubFixturePledges={fetchSubFixturePledges}
          fetchBets={fetchBets}
          fetchBalance={fetchBalance}
          topUp={topUp}
          withdraw={withdraw}
          getSavedPhone={getSavedPhone}
          savePhone={savePhone}
          getUserPhone={getUserPhone}
          placeSubFixturePledge={placeSubFixturePledge}
          matchSubFixturePledge={matchSubFixturePledge}
          matchMainPledge={matchMainPledge}
        />
      )}

      {reviewFixture && activeChannelId && (
        <AftermatchReviewModal
          visible
          fixture={reviewFixture}
          userId={userId ?? ''}
          username={username ?? ''}
          authToken={authToken}
          channelId={activeChannelId}
          isLoggedIn={!!isLoggedIn}
          onClose={() => setReviewFixture(null)}
        />
      )}

      {matchDetailsFixture && (
        <MatchDetailsModal
          visible
          fixture={matchDetailsFixture}
          userId={userId ?? ''}
          username={username ?? ''}
          authToken={authToken}
          onClose={() => setMatchDetailsFixture(null)}
        />
      )}
    </View>
  );
}

function createStyles(colors: FanColorPalette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    list: { flex: 1 },
    content: { paddingBottom: LIST_BOTTOM_INSET },
    header: {
      paddingHorizontal: GUTTER,
      paddingVertical: FAN_SPACING.md,
    },
  });
}