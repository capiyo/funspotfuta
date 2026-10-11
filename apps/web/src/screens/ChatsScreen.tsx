// Browser port of apps/mobile/src/screens/ChatsScreen.tsx.
// Business logic, query keys, API calls, filters, cache updates and user-facing
// messages intentionally follow the mobile implementation. DOM elements and
// browser navigation replace React Native presentation primitives.

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { Fixture, FanColorPalette, Voter } from '@funspot/core';
import { FAN_SPACING, getAllFixtures } from '@funspot/core';
import { sendChannelMessage } from '@funspot/core/src/api/send-channel-messages';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '@/modals/Login-modal-context';
import { MatchCard, type LatestComment, type ChannelHeaderData } from '@/components/ChatsCard';
import { channelHeaderOf } from '@/modals/channelHeader';
import { SegmentedControl } from '@/components/ui/Segmentedcontrol';
import { EmptyState, ErrorBanner, SkeletonRows } from '@/components/ui/ListsStates';
import { SwipeableVotePledgeModal } from '@/modals/actionModal';
import { AftermatchReviewModal } from '@/modals/AftermatchModal';
import { MatchDetailsModal } from '@/modals/match/matchDetailsModals';
import { useFanColors } from '@/theme/use-fan-colors';
import { LIST_BOTTOM_INSET, GUTTER } from '@/theme/layout';
import { useHome, useHomeList } from '@/screens/home/home-context';
import {
  fetchVoters, fetchPledges, fetchSubFixtures, fetchSubFixturePledges,
  fetchBets, fetchBalance, topUp as shimTopUp, withdraw as shimWithdraw,
  getSavedPhone as shimGetSavedPhone, savePhone as shimSavePhone,
  getUserPhone as shimGetUserPhone, placeSubFixturePledge as shimPlaceSubFixturePledge,
  matchSubFixturePledge as shimMatchSubFixturePledge,
} from '@funspot/core/src/api/vote-modal-shims';
import {
  castFixtureVote, createPledge, matchMainPledge as actionMatchMainPledge,
} from '@funspot/core/src/api/vote-actions';

type Filter = 'all' | 'live' | 'upcoming' | 'completed';
type Pick = 'home' | 'away';
type ActionResult = { success: boolean; message?: string; newBalance?: number };

const EMPTY_COPY: Record<Filter, { title: string; hint: string }> = {
  all: { title: 'No fixtures right now', hint: 'Check back soon.' },
  live: { title: 'Nothing live at the moment', hint: 'Live matches show up here.' },
  upcoming: { title: 'No upcoming fixtures', hint: 'New fixtures appear as they are scheduled.' },
  completed: { title: 'No completed matches yet', hint: 'Finished matches appear here.' },
};
const FIXTURES_KEY = ['fixtures'] as const;
const NO_FIXTURES: Fixture[] = [];
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
function isCompletedFixture(fixture: Fixture) {
  return fixture.status === 'completed' || fixture.status === 'finished';
}
function matchesFilter(fixture: Fixture, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'live') return isLiveFixture(fixture);
  if (filter === 'upcoming') return isUpcomingFixture(fixture);
  return isCompletedFixture(fixture);
}
function statusRank(fixture: Fixture) {
  if (isLiveFixture(fixture)) return 0;
  if (isUpcomingFixture(fixture)) return 1;
  return 2;
}
function channelIdFor(fixtureKey: string, ids: string[]): string | undefined {
  if (!ids.length) return undefined;
  const h = (hashSeed(fixtureKey + '#ch') * 1103515245 + 12345) >>> 0;
  return ids[(h >>> 16) % ids.length];
}
const panelStyle = (colors: FanColorPalette) => ({
  background: colors.background, color: colors.textPrimary, minWidth: 0, minHeight: 0,
});
const headerStyle = (colors: FanColorPalette) => ({
  padding: `${FAN_SPACING.md}px ${GUTTER}px`, display: 'grid', gap: FAN_SPACING.md,
  background: colors.background,
});
const listStyle = (colors: FanColorPalette) => ({
  overflowY: 'auto' as const, minHeight: 0, flex: 1,
  paddingBottom: LIST_BOTTOM_INSET, scrollbarGutter: 'stable' as const,
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

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: FIXTURES_KEY,
    queryFn: getAllFixtures,
    placeholderData: keepPreviousData,
    enabled: activeTab === 'Chats',
  });
  const fixtures = data ?? NO_FIXTURES;
  const headerById = useMemo(() => {
    const map = new Map<string, ChannelHeaderData>();
    for (const channel of channels) map.set(channel.channelId, channelHeaderOf(channel));
    return map;
  }, [channels]);

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [modalFixture, setModalFixture] = useState<Fixture | null>(null);
  const [reviewFixture, setReviewFixture] = useState<Fixture | null>(null);
  const [matchDetailsFixture, setMatchDetailsFixture] = useState<Fixture | null>(null);
  const channelIds = useMemo(() => channels.map((channel) => channel.channelId), [channels]);

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
    ? 'Could not load fixtures. Pull down to try again.'
    : null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  const liveCount = useMemo(() => fixtures.filter(isLiveFixture).length, [fixtures]);
  const filterOptions = useMemo(() => [
    { value: 'all' as const, label: 'All' },
    { value: 'live' as const, label: liveCount > 0 ? `Live · ${liveCount}` : 'Live' },
    { value: 'upcoming' as const, label: 'Upcoming' },
    { value: 'completed' as const, label: 'Completed' },
  ], [liveCount]);
  const filtered = useMemo(() => {
    const matched = fixtures.filter((fixture) => matchesFilter(fixture, filter));
    if (filter !== 'all') return matched;
    return matched.map((fixture, index) => ({ fixture, index }))
      .sort((a, b) => statusRank(a.fixture) - statusRank(b.fixture) || a.index - b.index)
      .map(({ fixture }) => fixture);
  }, [fixtures, filter]);

  const openChat = useCallback((fixture?: Fixture, channelId?: string) => {
    if (!isLoggedIn) return requireLogin(() => openChat(fixture, channelId));
    const cid = channelId ?? homeChannelId;
    if (!cid) return;
    const fixtureId = fixture ? fixture.matchId ?? fixture.id : undefined;
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
    queryClient.setQueryData<Fixture[]>(FIXTURES_KEY, (previous = []) =>
      previous.map((current) => {
        if (current.id !== fixture.id && current.matchId !== fixture.matchId) return current;
        if ((current.voters ?? []).some((voter) => voter.userId === userId)) return current;
        const newVoter: Voter = {
          userId, userName: username ?? '', selection: voteSelection, votedAt: new Date(),
          isComrade: false, isCorrect: false, pointsAwarded: 0,
        };
        return { ...current, voters: [...(current.voters ?? []), newVoter] };
      }),
    );
  }

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
    if (result.success && result.votedNow) addVoteToCache(liveModalFixture, selection);
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

  const listHeader = (
    <div style={headerStyle(colors)}>
      <SegmentedControl options={filterOptions} value={filter} onChange={setFilter} colors={colors} />
      {loadError && <ErrorBanner colors={colors} message={loadError} />}
    </div>
  );

  return (
    <section aria-label="Chats and fixtures" style={{ ...panelStyle(colors), display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {isPending ? (
        <div style={{ paddingTop: topInset, minHeight: 0, overflowY: 'auto' }} aria-busy="true">
          {listHeader}
          <SkeletonRows colors={colors} />
        </div>
      ) : (
        <div
          className="chats-fixture-list"
          style={{ ...listStyle(colors), paddingTop: topInset }}
          onScroll={scrollProps.onScroll}
          aria-label="Fixtures"
        >
          <div>{listHeader}</div>
          <div aria-live="polite">
            {filtered.length === 0 ? (
              isError ? (
                <EmptyState colors={colors} title="You're offline" hint="Pull down to retry once you're back online." />
              ) : (
                <EmptyState colors={colors} title={EMPTY_COPY[filter].title} hint={EMPTY_COPY[filter].hint} />
              )
            ) : filtered.map((fixture) => {
              const channelId = channelIdFor(fixture.matchId || fixture.id, channelIds) ?? homeChannelId;
              return (
                <div key={fixture.id || fixture.matchId} className="chats-fixture-row">
                  <MatchCard
                    fixture={fixture}
                    channel={channelId ? headerById.get(channelId) : undefined}
                    comments={commentsOf(fixture)}
                    channelId={channelId}
                    onOpenVoteModal={(selectedFixture) => {
                      setSheetChannelId(channelId);
                      setModalFixture(selectedFixture);
                    }}
                    onOpenResults={(selectedFixture) => {
                      setSheetChannelId(channelId);
                      setReviewFixture(selectedFixture);
                    }}
                    onChatClick={() => openChat(fixture, channelId)}
                    onLike={handleLike}
                    onSubmitComment={(selectedFixture, text) => handleSubmitComment(selectedFixture, text, channelId)}
                    onOpenLineups={setMatchDetailsFixture}
                  />
                </div>
              );
            })}
          </div>
          <div className="chats-list-footer">
            <button type="button" onClick={() => void onRefresh()} disabled={refreshing}
              aria-label="Refresh fixtures" aria-busy={refreshing}
              className="secondary-button">
              {refreshing ? 'Refreshing…' : 'Pull down to try again'}
            </button>
          </div>
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
          showPledgesTab showSubFixturesTab showBetsTab
          onClose={() => setModalFixture(null)}
          onVote={handleModalVote}
          onPledge={handleModalPledge}
          onShowJoinGroups={() => {}}
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
          visible fixture={reviewFixture} userId={userId ?? ''} username={username ?? ''}
          authToken={authToken} channelId={activeChannelId} isLoggedIn={!!isLoggedIn}
          onClose={() => setReviewFixture(null)}
        />
      )}
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
