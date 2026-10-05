// screens/ChatsScreen.tsx
//
// Presentation, plus vote / pledge handlers aligned with the Flutter flow
// (fixture_page.dart: _processVote / _processPledge).
//   - status filter is a SegmentedControl
//   - loading / empty / error use the shared list states
//   - no horizontal padding on the list: FeedItem owns the gutter
//   - last card clears the floating tab bar (LIST_BOTTOM_INSET)
//   - mock comments are dev-only; production renders only API-backed comments
//   - MatchCard's bottom-right fixture caption opens MatchDetailsModal
//   - scroll reported via useHomeList().scrollProps; content padded by topInset
//   - keepPreviousData + isError branch so offline shows cached fixtures
//   - each card shows one of the user's channels (stable pseudo-random per
//     fixture); chat / vote / review follow that card's channel
//   - joined channels come from useHome() (single source of truth); this
//     screen no longer runs its own duplicate channels query
//   - no screen-level retry override: the global QueryClient retry applies
//
// Vote / pledge / match go through api/vote-actions.ts (Flutter endpoints).
//   - onVote / onPledge return { success, message } so the modal can show the
//     server's real reason instead of a generic "failed".
//   - onPledge sends home / away and voteId = userId.
//   - onPledge casts the vote first when the user hasn't voted.
//   - hasUserVoted is derived from the LIVE query data, not the snapshot taken
//     when the modal opened, so it updates right after voting.
//   - the modal's payment / phone / sub-fixture props are bound to the user id
//     and token here (modalApi), because the shims need both.

import { useCallback, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { sendChannelMessage } from '../../../../packages/core/src/api/send-channel-messages';
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';

import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '../modals/Login-modal-context';
import {
  getAllFixtures,
  Fixture,
  FanColorPalette,
  FAN_SPACING,
  Voter,
} from '@funspot/core';
import {
  MatchCard,
  LatestComment,
  ChannelHeaderData,
} from '@/components/ChatsCard';
import { channelHeaderOf } from '../modals/channelHeader';
import { SegmentedControl } from '@/components/ui/Segmentedcontrol';
import {
  EmptyState,
  ErrorBanner,
  SkeletonRows,
} from '@/components/ui/ListsStates';
import { SwipeableVotePledgeModal } from '@/modals/actionModal';
import { AftermatchReviewModal } from '@/modals/AftermatchModal';
import { MatchDetailsModal } from '@/modals/match/matchDetailsModals';

import { useFanColors } from '@/theme/use-fan-colors';
import { GUTTER, LIST_BOTTOM_INSET } from '@/theme/layout';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { useHome, useHomeList } from './home/home-context';
// TODO: export these from @funspot/core instead of reaching into its src.
import {
  fetchVoters,
  fetchPledges,
  fetchSubFixtures,
  fetchSubFixturePledges,
  fetchBets,
  fetchBalance,
  topUp as shimTopUp,
  withdraw as shimWithdraw,
  getSavedPhone as shimGetSavedPhone,
  savePhone as shimSavePhone,
  getUserPhone as shimGetUserPhone,
  placeSubFixturePledge as shimPlaceSubFixturePledge,
  matchSubFixturePledge as shimMatchSubFixturePledge,
} from '../../../../packages/core/src/api/vote-modal-shims';
import {
  castFixtureVote,
  createPledge,
  matchMainPledge as actionMatchMainPledge,
} from '../../../../packages/core/src/api/vote-actions';

type Filter = 'all' | 'live' | 'upcoming' | 'completed';
type Pick = 'home' | 'away';
type ActionResult = { success: boolean; message?: string; newBalance?: number };

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

const MOCK_COMMENTORS = [
  'Kevo', 'Aisha', 'Brian', 'Faith', 'Otieno',
  'Wanjiru', 'Denis', 'Nadia', 'Mutiso', 'Cheryl',
];
const MOCK_COMMENTS = [
  'This is going to be a banger',
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

function commentsOf(f: Fixture): LatestComment[] {
  const raw = ((f as any).comments ?? (f as any).latestComments ?? []) as any[];
  const real = raw
    .map((c) => ({
      username: c.username ?? c.userName ?? 'Fan',
      comment: c.comment ?? c.text ?? '',
    }))
    .filter((c) => c.comment);
  if (real.length) return real;
  if (__DEV__) return mockCommentsFor(f.matchId || f.id || 'fixture');
  return [];
}

function isLiveFixture(f: Fixture) {
  return !!f.isLive || f.status === 'live';
}
function isUpcomingFixture(f: Fixture) {
  return f.status === 'upcoming' || f.status === 'soon';
}
function isCompletedFixture(f: Fixture) {
  return f.status === 'completed' || f.status === 'finished';
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

// Stable pseudo-random channel per fixture: a card always shows the same
// channel, but neighbouring cards can differ or repeat.
function channelIdFor(fixtureKey: string, ids: string[]): string | undefined {
  if (ids.length === 0) return undefined;
  const h = (hashSeed(fixtureKey + '#ch') * 1103515245 + 12345) >>> 0;
  return ids[(h >>> 16) % ids.length];
}

export default function ChatsScreen() {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { userId, authToken, username, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  const {
    activeChannelId: homeChannelId,
    activeTab,
    channels,
  } = useHome();
  const { scrollProps, topInset } = useHomeList();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: FIXTURES_KEY,
    queryFn: getAllFixtures,
    placeholderData: keepPreviousData,
    enabled: activeTab === 'Chats',
  });
  const fixtures = data ?? NO_FIXTURES;

  const headerById = useMemo(() => {
    const map = new Map<string, ChannelHeaderData>();
    for (const c of channels) map.set(c.channelId, channelHeaderOf(c));
    return map;
  }, [channels]);

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [modalFixture, setModalFixture] = useState<Fixture | null>(null);
  const [reviewFixture, setReviewFixture] = useState<Fixture | null>(null);
  const [matchDetailsFixture, setMatchDetailsFixture] =
    useState<Fixture | null>(null);

  const channelIds = useMemo(() => channels.map((c) => c.channelId), [channels]);

  // Channel of the card whose vote / results modal is open.
  const [sheetChannelId, setSheetChannelId] = useState<string | undefined>();
  const activeChannelId = sheetChannelId ?? homeChannelId;

  // The modal fixture as it is NOW. `modalFixture` is a snapshot taken when the
  // sheet opened; after a vote the query cache changes but the snapshot does
  // not, which left hasUserVoted stuck on false.
  const liveModalFixture = useMemo(() => {
    if (!modalFixture) return null;
    return (
      fixtures.find(
        (f) =>
          (!!f.id && f.id === modalFixture.id) ||
          (!!f.matchId && f.matchId === modalFixture.matchId),
      ) ?? modalFixture
    );
  }, [fixtures, modalFixture]);

  const myVote = useMemo(
    () => (liveModalFixture?.voters ?? []).find((v) => v.userId === userId),
    [liveModalFixture, userId],
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
    (fixture?: Fixture, channelId?: string) => {
      if (!isLoggedIn) return requireLogin(() => openChat(fixture, channelId));
      const cid = channelId ?? homeChannelId;
      if (!cid) return;
      navigation.navigate('Chat', {
        channelId: cid,
        fixtureId: fixture ? fixture.matchId ?? fixture.id : undefined,
      });
    },
    [navigation, homeChannelId, isLoggedIn, requireLogin],
  );

  async function handleLike(_fixture: Fixture) {
    if (!userId) return;
  }

  async function handleSubmitComment(
    fixture: Fixture,
    text: string,
    channelId?: string,
  ): Promise<boolean> {
    if (!userId || !username || !channelId) return false;

    const fixtureId = fixture.matchId || fixture.id;
    const mySelection =
      (fixture.voters ?? []).find((v) => v.userId === userId)?.selection ?? '';

    const ok = await sendChannelMessage({
      text,
      tempId: `temp_${Date.now()}_${userId}`,
      userId,
      username,
      authToken,
      channelId,
      fixtureId,
      selection: mySelection,
    });

    if (ok) {
      // Show it in the card's preview line straight away.
      queryClient.setQueryData<Fixture[]>(FIXTURES_KEY, (prev = []) =>
        prev.map((fx) => {
          if (fx.id !== fixture.id && fx.matchId !== fixture.matchId) return fx;
          const existing = ((fx as any).comments ?? (fx as any).latestComments ?? []) as any[];
          return { ...fx, comments: [{ username, comment: text }, ...existing] } as Fixture;
        }),
      );
    }
    return ok;
  }

  // ── Vote / pledge ────────────────────────────────────────────

  /** Mirrors a new vote into the fixtures cache so hasUserVoted flips immediately. */
  function addVoteToCache(fixture: Fixture, sel: Pick) {
    if (!userId) return;
    const selection = sel === 'home' ? 'home_team' : 'away_team';
    queryClient.setQueryData<Fixture[]>(FIXTURES_KEY, (prev = []) =>
      prev.map((fx) => {
        if (fx.id !== fixture.id && fx.matchId !== fixture.matchId) return fx;
        if ((fx.voters ?? []).some((v) => v.userId === userId)) return fx;
        const newVoter: Voter = {
          userId,
          userName: username ?? '',
          selection,
          votedAt: new Date(),
          isComrade: false,
          isCorrect: false,
          pointsAwarded: 0,
        };
        return { ...fx, voters: [...(fx.voters ?? []), newVoter] };
      }),
    );
  }

  // Voting: POST /actions/vote/cast with the server's own message on failure.
  async function handleModalVote(sel: Pick): Promise<ActionResult> {
    if (!liveModalFixture) return { success: false, message: 'No match selected' };
    if (!userId || !authToken || !username) {
      return { success: false, message: 'Please sign in to vote' };
    }
    const r = await castFixtureVote({
      fixtureId: liveModalFixture.matchId || liveModalFixture.id,
      userId,
      username,
      selection: sel,
      authToken,
    });
    if (r.success) addVoteToCache(liveModalFixture, sel);
    return { success: r.success, message: r.message };
  }

  // Pledging: votes first if needed, creates the bet, rolls the vote back if
  // the bet fails (Flutter's _processPledge).
  async function handleModalPledge(sel: Pick, amount: number): Promise<ActionResult> {
    if (!liveModalFixture) return { success: false, message: 'No match selected' };
    if (!userId || !username || !authToken) {
      return { success: false, message: 'Please sign in to continue' };
    }
    if (!activeChannelId) {
      return { success: false, message: 'Join a group to pledge' };
    }
    const r = await createPledge({
      fixtureId: liveModalFixture.matchId || liveModalFixture.id,
      userId,
      username,
      selection: sel,
      amount,
      channelId: activeChannelId,
      alreadyVoted: !!myVote,
      authToken,
    });
    if (r.success && r.votedNow) addVoteToCache(liveModalFixture, sel);
    return { success: r.success, message: r.message, newBalance: r.newBalance };
  }

  // The modal's props carry no user or token, but every shim call needs them.
  // Bind them here once.
  const modalApi = useMemo(() => {
    const uid = userId ?? '';
    const uname = username ?? '';
    return {
      topUp: (amount: number, phone: string, purpose: string) =>
        shimTopUp({ userId: uid, username: uname, authToken, amount, phone, purpose }),
      withdraw: (amount: number, phone: string) =>
        shimWithdraw({ userId: uid, username: uname, authToken, amount, phone }),
      getSavedPhone: (kind: 'topup' | 'withdraw') => shimGetSavedPhone(uid, kind, authToken),
      savePhone: (kind: 'topup' | 'withdraw', phone: string) =>
        shimSavePhone(uid, kind, phone, authToken),
      getUserPhone: () => shimGetUserPhone(uid, authToken),
      placeSubFixturePledge: (a: Parameters<typeof shimPlaceSubFixturePledge>[0]) =>
        shimPlaceSubFixturePledge({ ...a, authToken }),
      matchSubFixturePledge: (a: Parameters<typeof shimMatchSubFixturePledge>[0]) =>
        shimMatchSubFixturePledge({ ...a, authToken }),
      matchMainPledge: (a: Parameters<typeof actionMatchMainPledge>[0]) =>
        actionMatchMainPledge({ ...a, authToken }),
    };
  }, [userId, username, authToken]);

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
        <View style={{ paddingTop: topInset }}>
          {listHeader}
          <SkeletonRows colors={colors} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={filtered}
          keyExtractor={(fixture) => fixture.id || fixture.matchId}
          contentContainerStyle={[styles.content, { paddingTop: topInset }]}
          showsVerticalScrollIndicator={false}
          {...scrollProps}
          scrollIndicatorInsets={{ top: topInset }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              progressViewOffset={topInset}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            isError ? (
              <EmptyState
                colors={colors}
                title="You're offline"
                hint="Pull down to retry once you're back online."
              />
            ) : (
              <EmptyState
                colors={colors}
                title={EMPTY_COPY[filter].title}
                hint={EMPTY_COPY[filter].hint}
              />
            )
          }
          renderItem={({ item: fixture }) => {
            const cid =
              channelIdFor(fixture.matchId || fixture.id, channelIds) ??
              homeChannelId;
            return (
              <MatchCard
                fixture={fixture}
                channel={cid ? headerById.get(cid) : undefined}
                comments={commentsOf(fixture)}
                channelId={cid}
                onOpenVoteModal={(f) => {
                  setSheetChannelId(cid);
                  setModalFixture(f);
                }}
                onOpenResults={(f) => {
                  setSheetChannelId(cid);
                  setReviewFixture(f);
                }}
                onChatClick={() => openChat(fixture, cid)}
                onLike={handleLike}
                onSubmitComment={handleSubmitComment}
                onOpenLineups={setMatchDetailsFixture}
              />
            );
          }}
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
            isLive: liveModalFixture?.isLive ?? modalFixture.isLive,
          }}
          userId={userId ?? ''}
          username={username ?? ''}
          authToken={authToken}
          isLoggedIn={!!isLoggedIn && !!userId && userId !== 'guest' && !!authToken}
          hasUserVoted={!!myVote}
          userVoteSelection={myVote?.selection}
          channelId={activeChannelId ?? ''}
          showPledgesTab
          showSubFixturesTab
          showBetsTab
          onClose={() => setModalFixture(null)}
          onVote={handleModalVote}
          onPledge={handleModalPledge}
          onShowJoinGroups={() => { }}
          fetchVoters={fetchVoters}
          fetchPledges={fetchPledges}
          fetchSubFixtures={fetchSubFixtures}
          fetchSubFixturePledges={fetchSubFixturePledges}
          fetchBets={fetchBets}
          fetchBalance={fetchBalance}
          topUp={modalApi.topUp}
          withdraw={modalApi.withdraw}
          getSavedPhone={modalApi.getSavedPhone}
          savePhone={modalApi.savePhone}
          getUserPhone={modalApi.getUserPhone}
          placeSubFixturePledge={modalApi.placeSubFixturePledge}
          matchSubFixturePledge={modalApi.matchSubFixturePledge}
          matchMainPledge={modalApi.matchMainPledge}
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