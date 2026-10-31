// Browser port of apps/mobile/src/screens/ChatsScreen.tsx.
// Business logic, query keys, API calls, filters, cache updates and user-facing
// messages intentionally follow the mobile implementation. DOM elements and
// browser navigation replace React Native presentation primitives.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, UIEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Channel, Fixture, FanColorPalette, Voter } from '@funspot/core';
import { useFixtures, queryKeys } from '@funspot/core';
import { useAllChannels } from '@/hooks/useAllChannels';
import { sendChannelMessage } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '@/modals/Login-modal-context';
import { MatchCard, type LatestComment, type ChannelHeaderData } from '@/components/ChatsCard';
import { channelHeaderOf } from '@/modals/channelHeader';
import { EmptyState, ErrorBanner, SkeletonRows } from '@/components/ui/ListsStates';
import { SwipeableVotePledgeModal } from '@/modals/actionModal';
import { PokeModal } from '@/modals/PokeModal';
import { PossessionModal } from '@/modals/PossessionModal';
import { AftermatchReviewModal } from '@/modals/AftermatchModal';
import { MatchDetailsModal } from '@/modals/match/matchDetailsModals';
import LeaderboardModal from '@/modals/LeaderboardModal';
import { WeeklyLeaderboardModal } from '@/modals/WeeklyLeaderboardModal';
import { useFanColors } from '@/theme/use-fan-colors';
import { LIST_BOTTOM_INSET } from '@/theme/layout';
import { useHome, useHomeList } from '@/screens/home/home-context';
import {
  fetchVoters, fetchPledges, fetchSubFixtures, fetchSubFixturePledges,
  fetchBets, fetchBalance, topUp as shimTopUp, withdraw as shimWithdraw,
  getSavedPhone as shimGetSavedPhone, savePhone as shimSavePhone,
  getUserPhone as shimGetUserPhone, placeSubFixturePledge as shimPlaceSubFixturePledge,
  matchSubFixturePledge as shimMatchSubFixturePledge,
} from '@funspot/core';
import {
  castFixtureVote, createPledge, matchMainPledge as actionMatchMainPledge,
} from '@funspot/core';

type Pick = 'home' | 'away';
type ActionResult = { success: boolean; message?: string; newBalance?: number };

const FIXTURES_KEY = queryKeys.fixtures();
const NO_FIXTURES: Fixture[] = [];
const NO_CHANNELS: Channel[] = [];


const MOCK_COMMENTORS = ['Kevo', 'Aisha', 'Brian', 'Faith', 'Otieno', 'Wanjiru', 'Denis', 'Nadia', 'Mutiso', 'Cheryl'];
const MOCK_COMMENTS = [
  'This is going to be a banger', 'My gut says an upset today',
  'Defense has to show up this time', "Can't wait for kickoff",
  'That midfield battle decides it', 'Home crowd advantage all day',
  'Not confident about this one honestly', 'Easy three points incoming',
  'Injuries could really hurt them here', 'Give me a 2-1 all day',
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
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
function commentsOf(fixture: Fixture): LatestComment[] {
  const raw = ((fixture as any).comments ?? (fixture as any).latestComments ?? []) as any[];
  const real = raw.map((comment) => ({
    username: comment.username ?? comment.userName ?? 'Fan',
    comment: comment.comment ?? comment.text ?? '',
  })).filter((comment) => comment.comment);
  return real.length ? real : mockCommentsFor(fixture.matchId || fixture.id || 'fixture');
}
function isLiveFixture(fixture: Fixture) {
  return !!fixture.isLive || fixture.status === 'live';
}
function isUpcomingFixture(fixture: Fixture) {
  return fixture.status === 'upcoming' || fixture.status === 'soon';
}
function statusRank(fixture: Fixture) {
  if (isLiveFixture(fixture)) return 0;
  if (isUpcomingFixture(fixture)) return 1;
  return 2;
}
const panelStyle = (colors: FanColorPalette) => ({
  background: colors.background, color: colors.textPrimary, minWidth: 0, minHeight: 0,
});
const listStyle = (colors: FanColorPalette) => ({
  overflowY: 'auto' as const, minHeight: 0, flex: 1,
  paddingBottom: LIST_BOTTOM_INSET,
  background: colors.background,
});

export default function ChatsScreen() {
  const colors = useFanColors();
  const { userId, authToken, username, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  const { activeChannelId: homeChannelId, activeTab, channels } = useHome();
  const { scrollProps, topInset } = useHomeList();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isPending, isFetching, isError, error, refetch } = useFixtures(userId ?? undefined, true, authToken);
    const fixtures = useMemo(() => (data ?? NO_FIXTURES).map((fixture) => {
    if (!userId) return fixture;
    const cached = queryClient.getQueryData<{ voters?: Array<{ userId: string; username?: string; userName?: string; selection: string; isComrade?: boolean; votedAt?: Date; uri?: string | null }> }>(
      queryKeys.fixtureVotes(fixture.matchId || fixture.id, userId),
    );
    if (!cached?.voters?.length) return fixture;
    const localVoters: Voter[] = cached.voters.map((voter) => ({
      userId: voter.userId,
      userName: voter.userName ?? voter.username ?? 'Fan',
      selection: voter.selection,
      uri: voter.uri ?? null,
      isCorrect: null,
      pointsAwarded: null,
      isComrade: voter.isComrade ?? false,
      votedAt: voter.votedAt ? new Date(voter.votedAt) : new Date(),
    }));
    const merged = [...localVoters, ...(fixture.voters ?? []).filter((voter) => !localVoters.some((local) => local.userId === voter.userId))];
    return { ...fixture, voters: merged };
  }), [data, userId, queryClient]);
  const {
    data: publicChannels = NO_CHANNELS,
    isError: isAllChannelsError,
    refetch: refetchAllChannels,
  } = useAllChannels(authToken);
  useEffect(() => {
    if ((data?.length ?? 0) > 0 && publicChannels.length > 0) return;
    const retryIfVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!window.matchMedia('(min-width: 651px)').matches && activeTab !== 'Chats') return;
      void refetch();
      void refetchAllChannels();
    };
    const timer = window.setInterval(retryIfVisible, 10_000);
    return () => window.clearInterval(timer);
  }, [data, publicChannels.length, activeTab, refetch, refetchAllChannels]);

  const channelPool = useMemo(() => channels.filter((channel) => !!channel.channelId && !!channel.name), [channels]);
  const [channelStartOffset] = useState(() => Math.floor(Math.random() * 3));
  const headerById = useMemo(() => {
    const map = new Map<string, ChannelHeaderData>();
    for (const channel of channelPool) map.set(channel.channelId, channelHeaderOf(channel));
    return map;
  }, [channelPool]);

  const [refreshing, setRefreshing] = useState(false);
  const lastTopRefreshAt = useRef(0);
  const scrolledAwayFromTop = useRef(false);
  const handleFixtureScroll = useCallback((event: UIEvent<HTMLElement>) => {
    scrollProps.onScroll(event);
    const offset = event.currentTarget.scrollTop;
    if (offset > 80) {
      scrolledAwayFromTop.current = true;
      return;
    }
    if (!scrolledAwayFromTop.current) return;
    scrolledAwayFromTop.current = false;
    const now = Date.now();
    if (now - lastTopRefreshAt.current < 30_000) return;
    lastTopRefreshAt.current = now;
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ['openPokes'] });
  }, [scrollProps.onScroll, refetch, queryClient]);
  const [modalFixture, setModalFixture] = useState<Fixture | null>(null);
  const [pokeModalFixture, setPokeModalFixture] = useState<Fixture | null>(null);
  const [pokeModalChannelId, setPokeModalChannelId] = useState<string | undefined>();
  const [possessionFixture, setPossessionFixture] = useState<Fixture | null>(null);
  const [possessionChannelId, setPossessionChannelId] = useState<string | undefined>();
  const [reviewFixture, setReviewFixture] = useState<Fixture | null>(null);
  const [matchDetailsFixture, setMatchDetailsFixture] = useState<Fixture | null>(null);
  const [leaderboardChannel, setLeaderboardChannel] = useState<{ id: string; name: string } | null>(null);
  const [weeklyChannel, setWeeklyChannel] = useState<{ id: string; name: string } | null>(null);

  // Each open vote sheet remembers the channel associated with that fixture.
  const [sheetChannelId, setSheetChannelId] = useState<string | undefined>();
  const activeChannelId = sheetChannelId ?? homeChannelId;

  // Always derive vote state from live query data, not the modal's old snapshot.
  const liveModalFixture = useMemo(() => {
    if (!modalFixture) return null;
    return fixtures.find((fixture) =>
      (!!fixture.id && fixture.id === modalFixture.id) ||
      (!!fixture.matchId && fixture.matchId === modalFixture.matchId),
    ) ?? modalFixture;
  }, [fixtures, modalFixture]);
  const myVote = useMemo(
    () => (liveModalFixture?.voters ?? []).find((voter) => voter.userId === userId),
    [liveModalFixture, userId],
  );
  const loadError = error && fixtures.length === 0
    ? 'Could not load fixtures. Try again.'
    : isAllChannelsError && channelPool.length === 0
      ? 'Could not load channels. Try again.'
      : null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchAllChannels()]);
      await queryClient.invalidateQueries({ queryKey: ['openPokes'] });
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchAllChannels, queryClient]);

  const chatFixtures = useMemo(() => fixtures
    .map((fixture, index) => ({ fixture, index }))
    .sort((a, b) => statusRank(a.fixture) - statusRank(b.fixture) || a.index - b.index)
    .map(({ fixture }) => fixture), [fixtures]);

  const openChat = useCallback((fixture?: Fixture, channelId?: string) => {
    if (!isLoggedIn) return requireLogin(() => openChat(fixture, channelId));
    const cid = channelId ?? homeChannelId;
    if (!cid) return;
    const fixtureId = fixture ? fixture.matchId?.trim() || fixture.id?.trim() : undefined;
    navigate(`/messages/${encodeURIComponent(cid)}${fixtureId ? `?fixtureId=${encodeURIComponent(fixtureId)}` : ''}`);
  }, [navigate, homeChannelId, isLoggedIn, requireLogin]);

  async function handleLike(_fixture: Fixture) {
    if (!userId) return;
  }

  async function handleSubmitComment(fixture: Fixture, text: string, channelId?: string): Promise<boolean> {
    if (!userId || !username || !channelId) return false;
    const fixtureId = fixture.matchId || fixture.id;
    const mySelection = (fixture.voters ?? []).find((voter) => voter.userId === userId)?.selection ?? '';
    const ok = await sendChannelMessage({
      text, tempId: `temp_${Date.now()}_${userId}`, userId, username, authToken,
      channelId, fixtureId, selection: mySelection,
    });
    if (ok) {
      queryClient.setQueryData<Fixture[]>(FIXTURES_KEY, (previous = []) =>
        previous.map((current) => {
          if (current.id !== fixture.id && current.matchId !== fixture.matchId) return current;
          const existing = ((current as any).comments ?? (current as any).latestComments ?? []) as any[];
          return { ...current, comments: [{ username, comment: text }, ...existing] } as Fixture;
        }),
      );
    }
    return ok;
  }

  // Vote / pledge flows mirror the Flutter fixture screen handlers.
  function addVoteToCache(fixture: Fixture, selection: Pick) {
    if (!userId) return;
    const voteSelection = selection === 'home' ? 'home_team' : 'away_team';
    const newVoter: Voter = {
      userId, userName: username ?? '', selection: voteSelection, votedAt: new Date(),
      isComrade: false, isCorrect: false, pointsAwarded: 0,
    };
    const cacheVoter = {
      userId, username: username ?? '', selection: voteSelection, isComrade: false, votedAt: new Date(),
    };
    // Persist the confirmed selection in the shared QueryClient cache so the
    // messaging screen can unlock without repeating vote-count/voter requests.
    queryClient.setQueryData(queryKeys.fixtureVotes(fixture.matchId || fixture.id, userId), (previous: { homeVotes?: number; awayVotes?: number; drawVotes?: number; userVoteSelection?: string | null; voters?: Array<{ userId: string; username: string; selection: string; isComrade: boolean; votedAt: Date }> } | undefined) => ({
      homeVotes: previous?.homeVotes ?? 0,
      awayVotes: previous?.awayVotes ?? 0,
      drawVotes: previous?.drawVotes ?? 0,
      userVoteSelection: voteSelection,
      voters: [cacheVoter, ...(previous?.voters ?? []).filter((voter) => voter.userId !== userId)],
    }));
    queryClient.setQueryData<Fixture[]>(FIXTURES_KEY, (previous = []) =>
      previous.map((current) => {
        if (current.id !== fixture.id && current.matchId !== fixture.matchId) return current;
        return { ...current, voters: [newVoter, ...(current.voters ?? []).filter((voter) => voter.userId !== userId)] };
      }),
    );
  }

  /**
   * The action modal is the place where the complete server voter list is
   * already fetched. Treat that result as shared app-cache data: write it into
   * both the persisted fixture list and the fixtureVotes snapshot so every
   * ChatsCard re-renders immediately and Messaging sees the same voter state.
   */
  const fetchVotersAndSyncCache = useCallback(async (fixtureId: string, token?: string | null) => {
    const fetched = await fetchVoters(fixtureId, token);
    const normalized: Voter[] = fetched
      .filter((voter) => !!voter?.userId)
      .map((voter) => ({
        userId: String(voter.userId),
        userName: String(voter.userName ?? voter.username ?? 'Fan'),
        selection: String(voter.selection ?? ''),
        uri: voter.uri ?? null,
        votedAt: voter.votedAt ? new Date(voter.votedAt) : new Date(),
        isComrade: Boolean(voter.isComrade),
        isCorrect: typeof voter.isCorrect === 'boolean' ? voter.isCorrect : null,
        pointsAwarded: typeof voter.pointsAwarded === 'number' ? voter.pointsAwarded : null,
      }));

    let matchedFixture: Fixture | undefined;
    queryClient.setQueryData<Fixture[]>(FIXTURES_KEY, (previous = []) => previous.map((current) => {
      const matches = current.id === fixtureId || current.matchId === fixtureId;
      if (!matches) return current;
      matchedFixture = current;
      const merged = new Map<string, Voter>();
      for (const voter of current.voters ?? []) merged.set(voter.userId, voter);
      for (const voter of normalized) {
        const previousVoter = merged.get(voter.userId);
        merged.set(voter.userId, {
          ...previousVoter,
          ...voter,
          userName: voter.userName || previousVoter?.userName || 'Fan',
          uri: voter.uri ?? previousVoter?.uri ?? null,
        });
      }
      return { ...current, voters: [...merged.values()] };
    }));

    const matching = matchedFixture
      ?? (data ?? NO_FIXTURES).find((current) => current.id === fixtureId || current.matchId === fixtureId);
    const cacheIds = [...new Set([fixtureId, matching?.matchId, matching?.id].filter((id): id is string => !!id))];
    for (const id of cacheIds) {
      const key = queryKeys.fixtureVotes(id, userId ?? 'anonymous');
      queryClient.setQueryData(key, (previous: {
        homeVotes?: number;
        awayVotes?: number;
        drawVotes?: number;
        userVoteSelection?: string | null;
        voters?: Array<{ userId: string; username?: string; userName?: string; selection: string; isComrade?: boolean; votedAt?: Date; uri?: string | null }>;
      } | undefined) => {
        const merged = new Map<string, NonNullable<NonNullable<typeof previous>['voters']>[number]>();
        for (const voter of previous?.voters ?? []) merged.set(voter.userId, voter);
        for (const voter of normalized) {
          const prior = merged.get(voter.userId);
          merged.set(voter.userId, {
            ...prior,
            userId: voter.userId,
            username: voter.userName,
            userName: voter.userName,
            selection: voter.selection,
            isComrade: voter.isComrade,
            votedAt: voter.votedAt,
            uri: voter.uri ?? prior?.uri ?? null,
          });
        }
        const ownVote = normalized.find((voter) => voter.userId === userId);
        return {
          homeVotes: previous?.homeVotes ?? 0,
          awayVotes: previous?.awayVotes ?? 0,
          drawVotes: previous?.drawVotes ?? 0,
          userVoteSelection: ownVote?.selection ?? previous?.userVoteSelection ?? null,
          voters: [...merged.values()],
        };
      });
    }
    return fetched;
  }, [queryClient, userId, data]);

  // Hydrate each fixture's voter list as soon as Chats loads. Previously the
  // complete list was reliably synchronized only by opening the Action modal,
  // leaving cards stuck with the current user's cached vote until then.
  const autoVoterSyncRef = useRef<{ token: string | null | undefined; fixtureIds: Set<string> }>({
    token: undefined,
    fixtureIds: new Set<string>(),
  });
  useEffect(() => {
    const syncState = autoVoterSyncRef.current;
    if (syncState.token !== authToken) {
      syncState.token = authToken;
      syncState.fixtureIds.clear();
    }
    if (!authToken || !data?.length) return;

    const pendingIds = [...new Set(data
      .map((fixture) => fixture.matchId || fixture.id)
      .filter((id) => !!id && !syncState.fixtureIds.has(id)))];
    // Mark all IDs before awaiting so cache updates from an earlier batch
    // cannot schedule duplicate requests for the remaining fixtures.
    for (const id of pendingIds) syncState.fixtureIds.add(id);
    if (pendingIds.length === 0) return;

    void (async () => {
      for (let start = 0; start < pendingIds.length; start += 4) {
        if (autoVoterSyncRef.current.token !== authToken) return;
        await Promise.all(pendingIds.slice(start, start + 4).map(async (fixtureId) => {
          try {
            await fetchVotersAndSyncCache(fixtureId, authToken);
          } catch {
            // Keep Chats usable if a fixture's voter endpoint is temporarily unavailable.
          }
        }));
      }
    })();
  }, [data, authToken, fetchVotersAndSyncCache]);
  async function handleModalVote(selection: Pick): Promise<ActionResult> {
    if (!liveModalFixture) return { success: false, message: 'No match selected' };
    if (!userId || !authToken || !username) return { success: false, message: 'Please sign in to vote' };
    const result = await castFixtureVote({
      fixtureId: liveModalFixture.matchId || liveModalFixture.id,
      userId, username, selection, authToken,
    });
    if (result.success) addVoteToCache(liveModalFixture, selection);
    return { success: result.success, message: result.message };
  }

  async function handleModalPledge(selection: Pick, amount: number): Promise<ActionResult> {
    if (!liveModalFixture) return { success: false, message: 'No match selected' };
    if (!userId || !username || !authToken) return { success: false, message: 'Please sign in to continue' };
    if (!activeChannelId) return { success: false, message: 'Join a group to pledge' };
    const result = await createPledge({
      fixtureId: liveModalFixture.matchId || liveModalFixture.id,
      userId, username, selection, amount, channelId: activeChannelId,
      alreadyVoted: !!myVote, authToken,
    });
    if (result.success) addVoteToCache(liveModalFixture, selection);
    return { success: result.success, message: result.message, newBalance: result.newBalance };
  }

  // The vote modal shims require credentials that are not modal-level props.
  const modalApi = useMemo(() => {
    const uid = userId ?? '';
    const uname = username ?? '';
    return {
      topUp: (amount: number, phone: string, purpose: string) =>
        shimTopUp({ userId: uid, username: uname, authToken, amount, phone, purpose }),
      withdraw: (amount: number, phone: string) =>
        shimWithdraw({ userId: uid, username: uname, authToken, amount, phone }),
      getSavedPhone: (kind: 'topup' | 'withdraw') => shimGetSavedPhone(uid, kind, authToken),
      savePhone: (kind: 'topup' | 'withdraw', phone: string) => shimSavePhone(uid, kind, phone, authToken),
      getUserPhone: () => shimGetUserPhone(uid, authToken),
      placeSubFixturePledge: (args: Parameters<typeof shimPlaceSubFixturePledge>[0]) =>
        shimPlaceSubFixturePledge({ ...args, authToken }),
      matchSubFixturePledge: (args: Parameters<typeof shimMatchSubFixturePledge>[0]) =>
        shimMatchSubFixturePledge({ ...args, authToken }),
      matchMainPledge: (args: Parameters<typeof actionMatchMainPledge>[0]) =>
        actionMatchMainPledge({ ...args, authToken }),
    };
  }, [userId, username, authToken]);

  return (
    <section aria-label="Chats and fixtures" style={{ ...panelStyle(colors), display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {isPending || ((data?.length ?? 0) === 0 && isFetching) ? (
        <div className="no-scrollbar" style={{ paddingTop: topInset, minHeight: 0, overflowY: 'auto' }} aria-busy="true">
          {loadError && <ErrorBanner colors={colors} message={loadError} />}
          <SkeletonRows colors={colors} />
        </div>
      ) : (
        <div
          className="chats-fixture-list no-scrollbar"
          style={{ ...listStyle(colors), paddingTop: topInset }}
          onScroll={handleFixtureScroll}
          aria-label="Fixtures"
        >
          {loadError && <ErrorBanner colors={colors} message={loadError} />}
          <div aria-live="polite">
            {chatFixtures.length === 0 ? (
              isError ? (
                <EmptyState colors={colors} title="You're offline" hint="Tap Refresh once you're back online." />
              ) : (
                <EmptyState colors={colors} title={'No fixtures right now'} hint={'New fixtures appear here as they are scheduled.'} />
              )
            ) : chatFixtures.map((fixture, index) => {
              const slideChannels = channelPool.length > 1
                ? [...channelPool.slice((channelStartOffset + index) % channelPool.length), ...channelPool.slice(0, (channelStartOffset + index) % channelPool.length)]
                : channelPool;
              return (
                <div key={fixture.id || fixture.matchId} className="chats-fixture-row">
                  <ChannelSwipeCarousel
                    channels={slideChannels}
                    renderSlide={(channel) => {
                      const channelId = channel?.channelId ?? homeChannelId;
                      return <MatchCard
                        fixture={fixture}
                        channel={channelId ? headerById.get(channelId) : undefined}
                        comments={commentsOf(fixture)}
                        channelId={channelId}
                        onOpenVoteModal={(selectedFixture) => { setSheetChannelId(channelId); setModalFixture(selectedFixture); }}
                        onOpenPokeModal={(selectedFixture) => { setPokeModalChannelId(channelId); setPokeModalFixture(selectedFixture); }}
                        onOpenPossessionModal={(selectedFixture) => { setPossessionChannelId(channelId); setPossessionFixture(selectedFixture); }}
                        onOpenResults={(selectedFixture) => { setSheetChannelId(channelId); setReviewFixture(selectedFixture); }}
                        onChatClick={() => openChat(fixture, channelId)}
                        onChannelPress={() => {
                          const cid = channelId;
                          if (!cid) return;
                          const open = () => setLeaderboardChannel({ id: cid, name: headerById.get(cid)?.name ?? 'Channel' });
                          if (!isLoggedIn) return requireLogin(open);
                          open();
                        }}
                        onChannelLongPress={() => openChat(fixture, channelId)}
                        onWeeklyLeaderboardPress={() => {
                          const cid = channelId;
                          if (!cid) return;
                          const open = () => setWeeklyChannel({ id: cid, name: headerById.get(cid)?.name ?? 'Channel' });
                          if (!isLoggedIn) return requireLogin(open);
                          open();
                        }}
                        onLike={handleLike}
                        onSubmitComment={(selectedFixture, text) => handleSubmitComment(selectedFixture, text, channelId)}
                        onOpenLineups={setMatchDetailsFixture}
                      />;
                    }}
                  />
                </div>
              );
            })}
          </div>
          {(isError || isAllChannelsError || chatFixtures.length === 0 || channelPool.length === 0) && <div className="chats-list-footer">
            <button type="button" onClick={() => void onRefresh()} disabled={refreshing}
              aria-label="Refresh fixtures" aria-busy={refreshing} className="secondary-button">
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>}
        </div>
      )}

      {modalFixture && (
        <SwipeableVotePledgeModal
          visible
          fixture={{
            id: modalFixture.id, matchId: modalFixture.matchId,
            homeTeam: modalFixture.homeTeam, awayTeam: modalFixture.awayTeam,
            league: modalFixture.league, isLive: liveModalFixture?.isLive ?? modalFixture.isLive,
          }}
          userId={userId ?? ''}
          username={username ?? ''}
          authToken={authToken}
          isLoggedIn={!!isLoggedIn && !!userId && userId !== 'guest' && !!authToken}
          hasUserVoted={!!myVote}
          userVoteSelection={myVote?.selection}
          channelId={activeChannelId ?? ''}
          showPledgesTab showSubFixturesTab
          onClose={() => setModalFixture(null)}
          onVote={handleModalVote}
          onPledge={handleModalPledge}
          onShowJoinGroups={() => {}}
          fetchVoters={fetchVotersAndSyncCache}
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

      {pokeModalFixture && userId && userId !== 'guest' && (
        <PokeModal
          fixture={pokeModalFixture}
          userId={userId}
          username={username ?? ''}
          authToken={authToken}
          onClose={() => { setPokeModalFixture(null); setPokeModalChannelId(undefined); }}
          channelId={pokeModalChannelId ?? activeChannelId ?? undefined}/>
      )}

      {possessionFixture && (
        <PossessionModal
          fixture={possessionFixture}
          channelId={possessionChannelId}
          userId={userId ?? ''}
          username={username ?? ''}
          authToken={authToken}
          isLoggedIn={!!isLoggedIn && !!userId && userId !== 'guest' && !!authToken}
          onClose={() => { setPossessionFixture(null); setPossessionChannelId(undefined); }}
        />
      )}

      {reviewFixture && activeChannelId && (
        <AftermatchReviewModal
          visible fixture={reviewFixture} userId={userId ?? ''} username={username ?? ''}
          authToken={authToken} channelId={activeChannelId} isLoggedIn={!!isLoggedIn}
          onClose={() => setReviewFixture(null)}
        />
      )}
      {leaderboardChannel && (
        <LeaderboardModal
          visible
          channelId={leaderboardChannel.id}
          channelName={leaderboardChannel.name}
          onClose={() => setLeaderboardChannel(null)}
        />
      )}
      <WeeklyLeaderboardModal
        visible={!!weeklyChannel}
        channelId={weeklyChannel?.id ?? null}
        channelName={weeklyChannel?.name ?? 'Channel'}
        onClose={() => setWeeklyChannel(null)}
      />
      {matchDetailsFixture && (
        <MatchDetailsModal
          visible fixture={matchDetailsFixture} userId={userId ?? ''}
          username={username ?? ''} authToken={authToken}
          onClose={() => setMatchDetailsFixture(null)}
        />
      )}
    </section>
  );
}

type SwipeChannel = Channel;
function ChannelSwipeCarousel({ channels: slideChannels, renderSlide }: {
  channels: SwipeChannel[];
  renderSlide: (channel: SwipeChannel | undefined) => ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const count = Math.max(1, slideChannels.length);
  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (track) setActiveIndex(Math.min(count - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
  }, [count]);
  return <div style={{ minWidth: 0 }}>
    {count > 1 && <nav className="desktop-chat-channel-controls" aria-label="Choose channel for this fixture">
      {slideChannels.map((channel, index) => <button
        key={channel.channelId}
        type="button"
        aria-current={index === activeIndex ? 'page' : undefined}
        title={channel.name}
        onClick={() => {
          const track = trackRef.current;
          if (track) track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
        }}
      >{channel.name}</button>)}
    </nav>}
    <div ref={trackRef} onScroll={onScroll} className="no-scrollbar"
      aria-label="Channel cards" style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', touchAction: 'pan-x pan-y', scrollbarWidth: 'none' }}>
      {(slideChannels.length ? slideChannels : [undefined]).map((channel, index) => <div key={channel?.channelId ?? 'default'} style={{ flex: '0 0 100%', minWidth: 0, scrollSnapAlign: 'start' }}>
        {renderSlide(channel)}
      </div>)}
    </div>
    {count > 1 && <div aria-label={`Channel ${activeIndex + 1} of ${count}`} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '8px 0 10px' }}>
      {slideChannels.map((channel, index) => <span key={channel.channelId} aria-label={channel.name} style={{ display: 'block', width: index === activeIndex ? 7 : 5, height: index === activeIndex ? 7 : 5, borderRadius: '50%', background: index === activeIndex ? 'currentColor' : 'currentColor', opacity: index === activeIndex ? 0.85 : 0.3 }} />)}
    </div>}
  </div>;
}
