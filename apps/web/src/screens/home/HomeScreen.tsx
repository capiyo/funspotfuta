'use client';

// Rebuilt to match the real web architecture: WebNavbar + WebSidebar +
// MainContentColumns showing Arena / Feed / Logs as three simultaneous
// columns.
//
// ArenaColumn owns the vote/pledge/sub-fixtures modal AND the chat modal.
//   • MatchCard body tap / 💬 pill → ChatModal
//   • 👥 votes pill → SwipeableVotePledgeModal (live / upcoming) or
//                     AftermatchReviewModal (completed)
//
// LogsColumn renders through <HistoryCard>, adapter imported from
// app/(app)/history/page.

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Fixture,
  getAllFixtures,
  getUserChannels,
  getAllChannels,
  joinChannel as joinChannelApi,
  Channel,
  castVote,
  createBetWithVoteId,
} from '@funspot/core';
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
} from '@/lib/api/vote-modal-shims';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { MatchCard } from '@/components/MatchCard';
import { MatchDetailsModal } from '@/src/modals/match/MatchDetailsModal';
import { ChannelCreationModal } from '@/src/modals/ChannelCreationModal';
import { SwipeableVotePledgeModal } from '@/src/modals/actionModal';
import { ChatModal } from '@/src/screens/ChatsScreen';
import FeedScreen from '../FeedScreen';
import HistoryScreen from '../HistoryScreen';

// ── Page ────────────────────────────────────────────────────────
export default function HomePage() {
  const { userId, username, authToken, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | undefined>();
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showBrowseChannels, setShowBrowseChannels] = useState(false);
  const [joiningChannelId, setJoiningChannelId] = useState<string | null>(null);
  const { data: allChannels = [], isPending: loadingAllChannels } = useQuery({
    queryKey: ['channels'],
    queryFn: () => getAllChannels(authToken ?? undefined),
    enabled: showBrowseChannels,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeSection = requestedTab === 'feed' || requestedTab === 'logs' ? requestedTab : 'chats';
  const activeChannel = channels.find((channel) => channel.channelId === activeChannelId);

  async function handleJoinChannel(channel: Channel) {
    if (!isLoggedIn || !userId || !authToken) {
      navigate(`/login?next=${encodeURIComponent('/home?tab=chats')}`);
      return;
    }
    if (channels.length >= 3) {
      toast.showInfo('You can join up to 3 channels.');
      return;
    }
    setJoiningChannelId(channel.channelId);
    try {
      const joined = await joinChannelApi(channel.channelId, { userId, username: username ?? '' }, authToken);
      if (!joined) {
        toast.showError('Could not join this channel. Please try again.');
        return;
      }
      const nextChannels = await getUserChannels(userId, authToken);
      setChannels(nextChannels);
      setActiveChannelId(channel.channelId);
      setShowBrowseChannels(false);
      toast.showSuccess(`Joined ${channel.name}.`);
    } catch (error) {
      console.error('Could not join channel:', error);
      toast.showError('Could not join this channel. Please try again.');
    } finally {
      setJoiningChannelId(null);
    }
  }

  useEffect(() => {
    if (!userId || !authToken) {
      setChannels([]);
      setActiveChannelId(undefined);
      return;
    }
    let cancelled = false;
    getUserChannels(userId, authToken)
      .then((nextChannels) => {
        if (cancelled) return;
        setChannels(nextChannels);
        setActiveChannelId((prev) =>
          prev && nextChannels.some((channel) => channel.channelId === prev)
            ? prev
            : nextChannels[0]?.channelId,
        );
      })
      .catch((error) => {
        console.error('Could not load home channels', error);
        if (!cancelled) toast.showError('Could not load your channels. Please try again.');
      });
    return () => { cancelled = true; };
  }, [userId, authToken]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-fan-background">
      {activeSection === 'chats' && (
        <div className="flex items-center gap-fan-sm border-b border-fan-border/60 px-fan-base py-fan-sm">
          {channels.length > 0 && (
            <label className="flex min-w-0 flex-1 items-center gap-fan-sm text-fan-caption text-fan-textTertiary">
              Channel
              <select aria-label="Active channel" value={activeChannelId ?? ''} onChange={(event) => setActiveChannelId(event.target.value)} className="min-w-0 flex-1 rounded-fan-md border border-fan-border bg-fan-surface px-fan-md py-fan-sm text-fan-body text-fan-textPrimary">
                {channels.map((channel) => <option key={channel.channelId} value={channel.channelId}>{channel.name}</option>)}
              </select>
            </label>
          )}
          {activeChannel?.isAdmin && (
            <button onClick={() => navigate(`/admin/${encodeURIComponent(activeChannel.channelId)}`)} className="shrink-0 rounded-fan-pill border border-fan-primary/40 bg-fan-primaryDim px-fan-base py-fan-sm text-fan-caption font-semibold text-fan-primary">Admin</button>
          )}
          <button onClick={() => setShowBrowseChannels(true)} className="shrink-0 rounded-fan-pill border border-fan-border px-fan-base py-fan-sm text-fan-caption font-semibold text-fan-textSecondary">Browse</button>
          <button onClick={() => isLoggedIn ? setShowCreateChannel(true) : navigate(`/login?next=${encodeURIComponent('/home?tab=chats')}`)} className="shrink-0 rounded-fan-pill bg-fan-primary px-fan-base py-fan-sm text-fan-caption font-semibold text-fan-textInverse">+ Create channel</button>
        </div>
      )}
      {/* Chats, Feed and Logs follow the mobile Home tabs. */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {activeSection === 'chats' ? <ArenaColumn channelId={activeChannelId} /> : activeSection === 'feed' ? <FeedScreen /> : <HistoryScreen />}
      </div>
      {showBrowseChannels && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setShowBrowseChannels(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="browse-channels-title" className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-fan-xl border border-fan-border bg-fan-background p-fan-lg sm:rounded-fan-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-fan-lg flex items-center justify-between">
              <h2 id="browse-channels-title" className="font-condensed text-fan-headline text-fan-textPrimary">Browse channels</h2>
              <button onClick={() => setShowBrowseChannels(false)} className="rounded-fan-pill px-fan-md py-fan-xs text-fan-caption text-fan-textTertiary">Close</button>
            </div>
            {channels.length >= 3 && <p className="mb-fan-md text-fan-caption text-fan-away">You have reached the 3-channel limit.</p>}
            {loadingAllChannels ? <Spinner /> : allChannels.filter((channel) => !channels.some((joined) => joined.channelId === channel.channelId)).length === 0 ? (
              <p className="py-fan-xl text-center text-fan-body text-fan-textTertiary">No channels available to join.</p>
            ) : (
              <div className="space-y-fan-sm">
                {allChannels.filter((channel) => !channels.some((joined) => joined.channelId === channel.channelId)).map((channel) => (
                  <div key={channel.channelId} className="flex items-center gap-fan-md rounded-fan-lg border border-fan-border bg-fan-surface p-fan-md">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-fan-body font-semibold text-fan-textPrimary">{channel.name}</p>
                      <p className="text-fan-caption text-fan-textTertiary">{channel.memberCount ?? channel.members?.length ?? 0} members</p>
                    </div>
                    <button onClick={() => void handleJoinChannel(channel)} disabled={!isLoggedIn || channels.length >= 3 || joiningChannelId === channel.channelId} className="rounded-fan-pill bg-fan-primary px-fan-base py-fan-sm text-fan-caption font-semibold text-fan-textInverse disabled:opacity-50">{joiningChannelId === channel.channelId ? 'Joining…' : 'Join'}</button>
                  </div>
                ))}
              </div>
            )}
            {!isLoggedIn && <button onClick={() => navigate(`/login?next=${encodeURIComponent('/home?tab=chats')}`)} className="mt-fan-lg w-full rounded-fan-lg border border-fan-border py-fan-sm text-fan-caption text-fan-textSecondary">Sign in to join a channel</button>}
          </section>
        </div>
      )}
      {showCreateChannel && (
        <ChannelCreationModal
          onClose={() => {
            setShowCreateChannel(false);
            if (userId && authToken)
              getUserChannels(userId, authToken).then((nextChannels) => {
                setChannels(nextChannels);
                setActiveChannelId((prev) => prev ?? nextChannels[0]?.channelId);
              });
          }}
        />
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-fan-xxl">
      <div className="h-6 w-6 animate-spin rounded-fan-pill border-2 border-fan-primary border-t-transparent" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ARENA — fixtures + vote modal + chat modal
// ---------------------------------------------------------------------------
function ArenaColumn({ channelId }: { channelId?: string }) {
  const { userId, username, authToken, isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const { data: fixtures = [], isPending: loading, isError, refetch, isFetching } = useQuery({
    queryKey: ['fixtures'],
    queryFn: getAllFixtures,
  });
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [modalFixture, setModalFixture] = useState<Fixture | null>(null);
  const [chatFixture, setChatFixture] = useState<Fixture | null>(null);
  const [detailsFixture, setDetailsFixture] = useState<Fixture | null>(null);
  const isLiveFixture = (fixture: Fixture) => !!fixture.isLive || fixture.status === 'live';
  const isUpcomingFixture = (fixture: Fixture) => fixture.status === 'upcoming' || fixture.status === 'soon';
  const isCompletedFixture = (fixture: Fixture) => fixture.status === 'completed' || fixture.status === 'finished';
  const filteredFixtures = fixtures
    .filter((fixture) => filter === 'all' || (filter === 'live' && isLiveFixture(fixture)) || (filter === 'upcoming' && isUpcomingFixture(fixture)) || (filter === 'completed' && isCompletedFixture(fixture)))
    .sort((a, b) => (isLiveFixture(a) ? 0 : isUpcomingFixture(a) ? 1 : 2) - (isLiveFixture(b) ? 0 : isUpcomingFixture(b) ? 1 : 2));

  if (loading) return <Spinner />;
  if (isError && fixtures.length === 0) return (
    <div role="alert" className="px-fan-lg py-fan-xxl text-center text-fan-body text-fan-textTertiary">
      <p>Could not load fixtures.</p>
      <button type="button" onClick={() => void refetch()} disabled={isFetching} className="mt-fan-md underline disabled:opacity-50">{isFetching ? 'Retrying…' : 'Try again'}</button>
    </div>
  );

  return (
    <div className="px-fan-base">
      {isError && (
        <div role="alert" className="mb-fan-md flex items-center justify-between gap-fan-md rounded-fan-lg border border-fan-border bg-fan-surface p-fan-md text-fan-caption text-fan-textTertiary">
          <span>Could not refresh fixtures. Showing the last available data.</span>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className="shrink-0 underline disabled:opacity-50">{isFetching ? 'Retrying…' : 'Retry'}</button>
        </div>
      )}
      <div className="mb-fan-md flex items-center justify-between gap-fan-sm">
        <div role="group" aria-label="Filter fixtures" className="flex min-w-0 gap-fan-xs overflow-x-auto py-fan-sm">
          {([
            ['all', 'All'],
            ['live', 'Live'],
            ['upcoming', 'Upcoming'],
            ['completed', 'Completed'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`shrink-0 rounded-fan-pill px-fan-base py-fan-sm text-fan-caption font-semibold ${filter === value ? 'bg-fan-primary text-fan-textInverse' : 'border border-fan-border text-fan-textSecondary'}`}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={() => void refetch()} disabled={isFetching} className="shrink-0 rounded-fan-pill border border-fan-border px-fan-base py-fan-sm text-fan-caption text-fan-textSecondary disabled:opacity-50">{isFetching ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {filteredFixtures.length === 0 ? (
        <p className="py-fan-xxl text-center text-fan-body text-fan-textTertiary">{fixtures.length === 0 ? 'No fixtures right now.' : filter === 'live' ? 'Nothing live at the moment.' : filter === 'upcoming' ? 'No upcoming fixtures.' : filter === 'completed' ? 'No completed matches yet.' : 'No fixtures match this filter.'}</p>
      ) : filteredFixtures.map((f) => (
        <MatchCard
          key={f.id || f.matchId}
          fixture={f}
          channelId={channelId}
          onOpen={setChatFixture}
          onChatClick={() => setChatFixture(f)}
          onOpenDetails={setDetailsFixture}
          onOpenVoteModal={setModalFixture}
        />
      ))}

      {/* Vote / pledge / sub-fixtures modal */}
      {modalFixture && (
        <SwipeableVotePledgeModal
          fixture={modalFixture}
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
          channelId={channelId ?? ''}
          showPledgesTab
          showSubFixturesTab
          showBetsTab
          onClose={() => setModalFixture(null)}
          onVote={async (sel) => {
            if (!channelId || !userId || !authToken) return false;
            const ok = await castVote({
              channelId,
              fixtureId: modalFixture.matchId || modalFixture.id,
              userId,
              selection: sel === 'home' ? 'home_team' : 'away_team',
              authToken,
            });
            if (ok) {
              const fresh = await getAllFixtures();
              queryClient.setQueryData(['fixtures'], fresh);
            }
            return ok;
          }}
          onPledge={async (sel, amount) => {
            if (!channelId || !userId || !username) return false;
            const r = await createBetWithVoteId({
              fixtureId: modalFixture.matchId || modalFixture.id,
              starterId: userId,
              starterName: username,
              starterSelection:
                sel === 'home' ? 'home_team' : 'away_team',
              amount,
              channelId,
              voteId: '',
              authToken: authToken ?? undefined,
            });
            return r?.success !== false;
          }}
          onShowJoinGroups={() => {
            /* route to /channels or whatever the join-groups flow is */
          }}
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

      {/* Chat modal — card body tap or 💬 pill */}
      {chatFixture && channelId && (
        <ChatModal
          fixture={chatFixture}
          channelId={channelId}
          onClose={() => setChatFixture(null)}
        />
      )}

      {detailsFixture && (
        <MatchDetailsModal
          visible
          fixture={detailsFixture}
          userId={userId ?? undefined}
          username={username ?? undefined}
          authToken={authToken}
          onClose={() => setDetailsFixture(null)}
        />
      )}
    </div>
  );
}
