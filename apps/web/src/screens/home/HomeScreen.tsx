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

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Fixture,
  getAllFixtures,
  getUserChannels,
  getAllChannels,
  joinChannel as joinChannelApi,
  Channel,
  getPosts,
  toggleLikePost,
  Post,
  displayCaption,
  bestImageUrl,
  formattedDate,
  isLikedBy,
  postTypeDisplay,
  followUser,
  fetchHistoryGames,
  scoreDisplay,
  HistoryGame,
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
import { HistoryCard } from '@/components/HistoryCard';
import { ChannelCreationModal } from '@/src/modals/ChannelCreationModal';
import { createPost } from '@/lib/api/posts-create';
import { toCardData } from '@/src/screens/HistoryScreen';
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
  const { data: fixtures = [], isPending: loading, isError } = useQuery({
    queryKey: ['fixtures'],
    queryFn: getAllFixtures,
  });
  const [modalFixture, setModalFixture] = useState<Fixture | null>(null);
  const [chatFixture, setChatFixture] = useState<Fixture | null>(null);

  if (loading) return <Spinner />;
  if (isError) return <p role="alert" className="px-fan-lg py-fan-xxl text-center text-fan-body text-fan-textTertiary">Could not load fixtures. Please retry.</p>;
  if (fixtures.length === 0) {
    return (
      <p className="px-fan-lg py-fan-xxl text-center text-fan-body text-fan-textTertiary">
        No fixtures right now.
      </p>
    );
  }

  return (
    <div className="px-fan-base">
      {fixtures.map((f) => (
        <MatchCard
          key={f.id || f.matchId}
          fixture={f}
          channelId={channelId}
          onOpen={setChatFixture}
          onChatClick={() => setChatFixture(f)}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// FEED — unchanged
// ---------------------------------------------------------------------------
function FeedColumn() {
  const { userId, username } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState('');
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [posting, setPosting] = useState(false);

  async function handleFollow(post: Post) {
    if (!userId || !post.userId) return;
    setFollowingIds((prev) => new Set(prev).add(post.userId!));
    await followUser(userId, post.userId);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getPosts({ page: 1, limit: 15 });
    setPosts(result.posts);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePost() {
    if (!userId || !username || !caption.trim()) return;
    setPosting(true);
    try {
      await createPost({ userId, userName: username, caption: caption.trim() });
      setCaption('');
      await load();
    } finally {
      setPosting(false);
    }
  }

  async function handleLike(post: Post, index: number) {
    if (!userId || !username || !post.id) return;
    const wasLiked = isLikedBy(post, userId);
    setPosts((prev) =>
      prev.map((p, i) =>
        i === index
          ? { ...p, likesCount: (p.likesCount ?? 0) + (wasLiked ? -1 : 1) }
          : p,
      ),
    );
    await toggleLikePost(post.id, userId, username);
  }

  return (
    <div className="px-fan-base">
      <div className="bg-fan-background py-fan-base">
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="What's on your mind?"
          rows={2}
          className="w-full resize-none bg-transparent text-fan-body text-fan-textPrimary outline-none placeholder:text-fan-textTertiary"
        />
        <button
          onClick={handlePost}
          disabled={posting || !caption.trim()}
          className="mt-fan-sm rounded-fan-pill bg-fan-primary px-fan-base py-fan-sm text-fan-button tracking-[0.4px] text-fan-textInverse disabled:opacity-50"
        >
          {posting ? 'POSTING…' : 'POST'}
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : posts.length === 0 ? (
        <p className="py-fan-xxl text-center text-fan-body text-fan-textTertiary">
          No posts yet.
        </p>
      ) : (
        <div>
          {posts.map((post, i) => {
            const liked = userId ? isLikedBy(post, userId) : false;
            const img = bestImageUrl(post);
            return (
              <div key={post.id ?? i} className="bg-fan-background py-fan-base">
                <div className="mb-fan-sm flex items-center justify-between">
                  <div className="flex items-center gap-fan-sm">
                    <span className="text-fan-body font-semibold text-fan-textPrimary">
                      {post.userName ?? 'Anonymous'}
                    </span>
                    <span className="text-fan-caption text-fan-textTertiary">
                      {formattedDate(post)}
                    </span>
                    <span className="text-fan-caption text-fan-textTertiary">
                      {postTypeDisplay(post)}
                    </span>
                  </div>
                  {post.userId &&
                    post.userId !== userId &&
                    !followingIds.has(post.userId) && (
                      <button
                        onClick={() => handleFollow(post)}
                        className="text-fan-caption text-fan-primary"
                      >
                        follow
                      </button>
                    )}
                </div>
                {displayCaption(post) && (
                  <p className="mb-fan-sm text-fan-body text-fan-textSecondary">
                    {displayCaption(post)}
                  </p>
                )}
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt=""
                    className="mb-fan-sm max-h-40 w-full rounded-fan-md object-cover"
                  />
                )}
                <div className="flex items-center gap-fan-base">
                  <button
                    onClick={() => handleLike(post, i)}
                    className={`text-fan-caption ${liked ? 'text-fan-away' : 'text-fan-textTertiary'
                      }`}
                  >
                    {liked ? '❤' : '🤍'} {post.likesCount ?? 0}
                  </button>
                  <span className="text-fan-caption text-fan-textTertiary">
                    💬 {post.commentsCount ?? 0}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LOGS — unchanged
// ---------------------------------------------------------------------------
function LogsColumn() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'history' | 'live'>('history');
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [liveFixtures, setLiveFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === 'history') {
      fetchHistoryGames({ limit: 20 }).then((g) => {
        setGames(g);
        setLoading(false);
      });
    } else {
      getAllFixtures().then((f) => {
        setLiveFixtures(f.filter((x) => x.isLive || x.status === 'live'));
        setLoading(false);
      });
    }
  }, [tab]);

  return (
    <div>
      <div className="flex gap-fan-lg px-fan-base pb-fan-sm">
        <button
          onClick={() => setTab('history')}
          className={`text-fan-body ${tab === 'history'
              ? 'font-semibold text-fan-textPrimary'
              : 'text-fan-textTertiary'
            }`}
        >
          History {games.length > 0 ? games.length : ''}
        </button>
        <button
          onClick={() => setTab('live')}
          className={`text-fan-body ${tab === 'live'
              ? 'font-semibold text-fan-textPrimary'
              : 'text-fan-textTertiary'
            }`}
        >
          Live {liveFixtures.length > 0 ? liveFixtures.length : ''}
        </button>
      </div>

      <div className="px-fan-base">
        {loading ? (
          <Spinner />
        ) : tab === 'history' ? (
          games.length === 0 ? (
            <p className="py-fan-xxl text-center text-fan-body text-fan-textTertiary">
              No history yet.
            </p>
          ) : (
            games.map((g) => (
              <HistoryCard
                key={g.id}
                data={toCardData(g, { canComment: true })}
                onOpen={() => navigate(`/fixture/${g.id}#chat`)}
                onOpenResults={() => navigate(`/fixture/${g.id}`)}
                onOpenChat={() => navigate(`/fixture/${g.id}#chat`)}
                onSubmitComment={() => {
                  /* wire to your existing comment mutation */
                }}
              />
            ))
          )
        ) : liveFixtures.length === 0 ? (
          <p className="py-fan-xxl text-center text-fan-body text-fan-textTertiary">
            No live matches right now.
          </p>
        ) : (
          liveFixtures.map((f) => (
            <div key={f.id} className="bg-fan-background py-fan-base">
              <div className="mb-fan-sm flex items-center justify-between text-fan-caption text-fan-textTertiary">
                <span>{f.league}</span>
                <span className="text-fan-away">🔴 LIVE</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex-1 truncate text-fan-body font-medium text-fan-textPrimary">
                  {f.homeTeam}
                </span>
                <span className="font-condensed px-fan-md text-fan-votePct text-fan-textPrimary">
                  {scoreDisplay(f) || 'vs'}
                </span>
                <span className="flex-1 truncate text-right text-fan-body font-medium text-fan-textPrimary">
                  {f.awayTeam}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}