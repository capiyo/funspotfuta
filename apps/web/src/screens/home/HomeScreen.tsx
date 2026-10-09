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
import { useSearchParams } from 'react-router-dom';
import {
  Fixture,
  getAllFixtures,
  getUserChannels,
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
import { MatchCard } from '@/components/MatchCard';
import { HistoryCard } from '@/components/HistoryCard';
import { ChannelCreationModal } from '@/src/modals/ChannelCreationModal';
import { createPost } from '@/lib/api/posts-create';
import { toCardData } from '@/src/screens/HistoryScreen';
import { SwipeableVotePledgeModal } from '@/src/modals/actionModal';
import { ChatModal } from '@/src/screens/ChatsScreen';

// ── Page ────────────────────────────────────────────────────────
export default function HomePage() {
  const { userId, authToken } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | undefined>();
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTab = searchParams.get('tab') === 'feed' ? 'feed' : 'chats';
  const activeSection = selectedTab === 'feed' ? 'feed' : 'chats';
  const setActiveSection = (tab: 'chats' | 'feed') => setSearchParams({ tab }, { replace: false });

  useEffect(() => {
    if (!userId || !authToken) return;
    getUserChannels(userId, authToken).then((c) => {
      setChannels(c);
      setActiveChannelId((prev) => prev ?? c[0]?.channelId);
    });
  }, [userId, authToken]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-fan-background">
      {/* Chats and Feed are sections of one shared Home page on every viewport. */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {activeSection === 'chats' ? <ArenaColumn channelId={activeChannelId} /> : <FeedColumn />}
      </div>
      {showCreateChannel && (
        <ChannelCreationModal
          onClose={() => {
            setShowCreateChannel(false);
            if (userId && authToken)
              getUserChannels(userId, authToken).then(setChannels);
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
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalFixture, setModalFixture] = useState<Fixture | null>(null);
  const [chatFixture, setChatFixture] = useState<Fixture | null>(null);

  useEffect(() => {
    setLoading(true);
    getAllFixtures().then((f) => {
      setFixtures(f);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner />;
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
              setFixtures(fresh);
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