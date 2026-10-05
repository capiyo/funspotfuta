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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import {
  Fixture,
  getAllFixtures,
  getUserChannelsV2,
  getAllChannels,
  joinChannel,
  UserChannel,
  getPosts,
  toggleLikePost,
  Post,
  displayCaption,
  bestImageUrl,
  formattedDate,
  isLikedBy,
  postTypeDisplay,
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
import { WebNavbar } from '@/components/WebNavbar';
import { WebSidebar } from '@/components/WebSidebar';
import { MainContentColumns } from '@/components/MainContentColumns';
import { ChannelCreationModal } from '@/components/ChannelCreationModal';
import { FloatingPillTabs } from '@/components/FloatingPillTabs';
import { createPost } from '@/lib/api/posts-create';
import { toCardData } from '@/app/(app)/history/page';
import { SwipeableVotePledgeModal } from '@/components/actionsModal';
import { ChatModal } from '../chat/page';

// ── Page ────────────────────────────────────────────────────────
export default function HomePage() {
  const { userId, username, authToken } = useAuth();
  const [channels, setChannels] = useState<UserChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | undefined>();
  const [browseChannels, setBrowseChannels] = useState<UserChannel[]>([]);
  const [joiningChannelId, setJoiningChannelId] = useState<string | undefined>();
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = requestedTab === 'feed' || requestedTab === 'logs' ? requestedTab : 'arena';
  const [mobileTab, setMobileTab] = useState<'arena' | 'feed' | 'logs'>(initialTab);

  useEffect(() => {
    if (requestedTab === 'arena' || requestedTab === 'feed' || requestedTab === 'logs') {
      setMobileTab(requestedTab);
    }
  }, [requestedTab]);

  const reloadChannels = useCallback(async () => {
    if (!userId || !authToken) {
      setChannels([]);
      setBrowseChannels([]);
      setActiveChannelId(undefined);
      return;
    }
    try {
      const joined = await getUserChannelsV2(userId, authToken);
      setChannels(joined);
      setActiveChannelId((prev) => prev && joined.some((c) => c.channelId === prev) ? prev : joined[0]?.channelId);
      if (joined.length < 3) {
        try {
          const all = await getAllChannels(authToken);
          const joinedIds = new Set(joined.map((c) => c.channelId));
          setBrowseChannels(all.filter((c) => !joinedIds.has(c.channelId)));
        } catch (error) {
          console.error('Failed to load browsable channels', error);
          // Keep the last known browse list rather than replacing it with fake data.
        }
      } else {
        setBrowseChannels([]);
      }
    } catch (error) {
      console.error('Failed to reload joined channels', error);
      // Preserve the last known channels, matching mobile home-context behavior.
    }
  }, [userId, authToken]);

  useEffect(() => {
    void reloadChannels();
  }, [reloadChannels]);

  async function handleJoinChannel(channelId: string) {
    if (!userId || !username || !authToken || joiningChannelId) return;
    setJoiningChannelId(channelId);
    try {
      const ok = await joinChannel(channelId, { userId, username }, authToken);
      if (ok) {
        setActiveChannelId(channelId);
        await reloadChannels();
      }
    } finally {
      setJoiningChannelId(undefined);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-fan-background">
      <WebNavbar
        channels={channels.map((c) => ({
          id: c.channelId,
          name: c.name,
          isAdmin: c.isAdmin,
          members: c.members,
        }))}
        activeChannelId={activeChannelId}
        onSelectChannel={setActiveChannelId}
        browseChannels={browseChannels.map((c) => ({
          id: c.channelId,
          name: c.name,
          isAdmin: c.isAdmin,
          members: c.members,
        }))}
        onJoinChannel={handleJoinChannel}
        joiningChannelId={joiningChannelId}
        onCreateChannel={() => setShowCreateChannel(true)}
      />
      {/* Desktop: 3 simultaneous columns */}
      <div className="hidden flex-1 overflow-hidden md:flex">
        <WebSidebar />
        <MainContentColumns
          arena={<ArenaColumn channelId={activeChannelId} />}
          feed={<FeedColumn />}
          logs={<LogsColumn />}
        />
      </div>
      {/* Mobile: single active tab + floating pill nav */}
      <div className="flex flex-1 flex-col overflow-hidden md:hidden">
        <div className="flex-1 overflow-y-auto pb-20">
          {mobileTab === 'arena' && <ArenaColumn channelId={activeChannelId} />}
          {mobileTab === 'feed' && <FeedColumn />}
          {mobileTab === 'logs' && <LogsColumn />}
        </div>
        <FloatingPillTabs active={mobileTab} onChange={setMobileTab} />
      </div>
      {showCreateChannel && (
        <ChannelCreationModal
          onClose={() => {
            setShowCreateChannel(false);
            void reloadChannels();
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
type ArenaFilter = 'all' | 'live' | 'upcoming' | 'completed';

function arenaIsLive(f: Fixture) {
  return !!f.isLive || f.status === 'live';
}
function arenaIsUpcoming(f: Fixture) {
  return f.status === 'upcoming' || f.status === 'soon';
}
function arenaIsCompleted(f: Fixture) {
  return f.status === 'completed';
}
function arenaMatchesFilter(f: Fixture, filter: ArenaFilter) {
  if (filter === 'all') return true;
  if (filter === 'live') return arenaIsLive(f);
  if (filter === 'upcoming') return arenaIsUpcoming(f);
  return arenaIsCompleted(f);
}
function arenaStatusRank(f: Fixture) {
  if (arenaIsLive(f)) return 0;
  if (arenaIsUpcoming(f)) return 1;
  return 2;
}

function ArenaColumn({ channelId }: { channelId?: string }) {
  const { userId, username, authToken, isLoggedIn } = useAuth();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modalFixture, setModalFixture] = useState<Fixture | null>(null);
  const [chatFixture, setChatFixture] = useState<Fixture | null>(null);
  const [filter, setFilter] = useState<ArenaFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const liveCount = useMemo(() => fixtures.filter(arenaIsLive).length, [fixtures]);
  const filteredFixtures = useMemo(() => {
    const matched = fixtures.filter((f) => arenaMatchesFilter(f, filter));
    if (filter !== 'all') return matched;
    return matched
      .map((f, i) => ({ f, i }))
      .sort((a, b) => arenaStatusRank(a.f) - arenaStatusRank(b.f) || a.i - b.i)
      .map(({ f }) => f);
  }, [fixtures, filter]);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    getAllFixtures()
      .then((f) => setFixtures(f))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (loadError && fixtures.length === 0) {
    return (
      <div className="px-fan-lg py-fan-xxl text-center">
        <p className="text-fan-body text-fan-textTertiary">Could not load fixtures. Try again.</p>
        <button
          onClick={() => {
            setLoading(true);
            setLoadError(false);
            getAllFixtures()
              .then((f) => setFixtures(f))
              .catch(() => setLoadError(true))
              .finally(() => setLoading(false));
          }}
          className="mt-fan-md rounded-fan-pill bg-fan-primary px-fan-lg py-fan-sm text-fan-caption font-semibold text-fan-textInverse"
        >
          Try again
        </button>
      </div>
    );
  }
  async function refreshFixtures() {
    setRefreshing(true);
    try {
      const fresh = await getAllFixtures();
      setFixtures(fresh);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setRefreshing(false);
    }
  }

  if (fixtures.length === 0) {
    return (
      <p className="px-fan-lg py-fan-xxl text-center text-fan-body text-fan-textTertiary">
        No fixtures right now.
      </p>
    );
  }

  return (
    <div className="px-fan-base">
      <div className="mb-fan-sm flex items-center gap-fan-sm overflow-x-auto px-fan-sm py-fan-sm">
        {[
          ['all', 'All'],
          ['live', liveCount > 0 ? `Live · ${liveCount}` : 'Live'],
          ['upcoming', 'Upcoming'],
          ['completed', 'Completed'],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value as ArenaFilter)}
            className={`shrink-0 rounded-fan-pill px-fan-md py-fan-sm text-fan-caption font-medium ${
              filter === value
                ? 'bg-fan-primary text-fan-textInverse'
                : 'bg-fan-surface text-fan-textSecondary'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={refreshFixtures}
          disabled={refreshing}
          className="shrink-0 rounded-fan-pill bg-fan-surface px-fan-md py-fan-sm text-fan-caption text-fan-textSecondary disabled:opacity-50"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {filteredFixtures.length === 0 ? (
        <p className="px-fan-lg py-fan-xxl text-center text-fan-body text-fan-textTertiary">
          {filter === 'live' ? 'Nothing live at the moment.' : filter === 'upcoming' ? 'No upcoming fixtures.' : filter === 'completed' ? 'No completed matches yet.' : 'No fixtures right now.'}
        </p>
      ) : filteredFixtures.map((f) => (
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
          onShowJoinGroups={() => {}}
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
  const [posting, setPosting] = useState(false);

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
    try {
      const result = await toggleLikePost(post.id, userId, username);
      if (result.success && result.likesCount != null) {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likesCount: result.likesCount! } : p)));
      }
    } catch {
      // Match mobile: restore authoritative backend state after an optimistic failure.
      try {
        const fresh = await getPosts({ page: 1, limit: 15 });
        setPosts(fresh.posts);
      } catch {
        // Keep the optimistic state if recovery also fails.
      }
    }
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
  const router = useRouter();
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
                data={toCardData(g, { canComment: false })}
                onOpen={() => router.push(`/fixture/${g.id}#chat`)}
                onOpenResults={() => router.push(`/fixture/${g.id}`)}
                onOpenChat={() => router.push(`/fixture/${g.id}#chat`)}
                onSubmitComment={() => { /* Mobile has no Home history comment mutation. */ }}
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