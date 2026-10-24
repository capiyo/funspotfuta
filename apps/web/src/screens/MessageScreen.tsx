/*
 * MessageScreen browser port, matching apps/mobile/src/screens/MessageScreen.tsx.
 *
 * State is screen-local: active channel, route-provided fixture (if any), draft/reply,
 * message context actions, attachment menu, voting/review/details/comrades
 * dialogs, voter visibility, pending image/caption, image viewer, and the
 * remote flag that controls optional voting tabs.
 *
 * Channel and fixture selection are resolved from the route and existing
 * shared services. The shared chat hook owns REST history, optimistic
 * messages, WebSocket messages, typing indicators, vote counts, match state,
 * image upload, retry status, and mark-read.
 *
 * The browser scroll container replaces FlatList and scrollToEnd; DOM dialogs
 * replace native Modal and contain focus, restore focus, close on Escape, and
 * close on backdrop click. Right-click, hover, and keyboard-accessible actions
 * replace native long-press. Browser object URLs are revoked after sending or
 * cancelling an image selection.
 *
 * The native screen currently requests at most 100 history messages; it does
 * not implement an older-message pagination control. The ChatMessage model
 * has no reaction collection or reaction endpoint, so no reaction UI/API is
 * fabricated here. Native video playback/upload and message deletion are
 * explicitly unavailable in the source screen and retain its user-facing
 * “coming soon” behavior rather than inventing backend endpoints.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Image as ImageIcon, Info, Lock, Paperclip, Send, Users, X,
  RefreshCw, Copy, Reply as ReplyIcon, AlertCircle, MoreHorizontal,
} from 'lucide-react';
import {
  getUserChannels, getAllFixtures, type Channel, type Fixture, type ChatMessage,
  type ReplyData,
} from '@funspot/core';
import {
  fetchVoters, fetchPledges, fetchSubFixtures, fetchSubFixturePledges,
  fetchBets, fetchBalance, topUp as shimTopUp, withdraw as shimWithdraw,
  getSavedPhone as shimGetSavedPhone, savePhone as shimSavePhone,
  getUserPhone as shimGetUserPhone, placeSubFixturePledge as shimPlaceSubFixturePledge,
  matchSubFixturePledge as shimMatchSubFixturePledge,
} from '../../../../packages/core/src/api/vote-modal-shims';
import {
  castFixtureVote, createPledge, matchMainPledge as actionMatchMainPledge,
} from '../../../../packages/core/src/api/vote-actions';
import { useChannelChat, type Voter } from '@/lib/api/use-channel-chat';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import { useFanColors } from '@/theme/use-fan-colors';
import AdSenseCarousel from '@/components/AdSenseCarousel';
import { fanText } from '@/theme/use-fan-typography';
import { SwipeableVotePledgeModal } from '@/modals/actionModal';
import { AftermatchReviewModal } from '@/modals/AftermatchModal';
import { MatchDetailsModal } from '@/modals/match/matchDetailsModals';
import ComradesScreen from '@/modals/ComradesModal';

type FanColors = ReturnType<typeof useFanColors>;
const FIXTURES_KEY = ['fixtures'] as const;
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://clash-api-m5mr.onrender.com/api').replace(/\/$/, '');
const UPLOADING = 'uploading...';
const TYPING_THROTTLE_MS = 1500;

interface WebImageAsset { uri: string; name?: string; type?: string; width?: number; height?: number; }
type RouteParams = { channelId?: string };

function formatMinute(timeElapsed: number): string {
  if (!timeElapsed || timeElapsed <= 0) return "0'";
  const minutes = Math.floor(timeElapsed);
  const seconds = Math.round((timeElapsed % 1) * 60);
  return seconds > 0 ? `${minutes}'${String(seconds).padStart(2, '0')}` : `${minutes}'`;
}
function isFailed(message: ChatMessage): boolean {
  return (message as unknown as { status?: string }).status === 'failed';
}
function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function initials(value: string): string {
  return value.trim().charAt(0).toUpperCase() || '?';
}
function dimColor(color: string, alpha = 0.1): string {
  const value = color.replace('#', '');
  if (value.length !== 6) return color;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function isCompletedStatus(status: string): boolean {
  return status === 'completed' || status === 'finished';
}
function isUpcomingStatus(status: string): boolean {
  return status === 'upcoming' || status === 'soon';
}

/**
 * The web implementation is an independent routed screen. It deliberately
 * does not render inside ChatsScreen, so route state and the message lifecycle
 * remain scoped to this screen.
 */
export default function MessageScreen(props: { channel?: Channel; userId?: string | null; username?: string | null; authToken?: string | null } = {}) {
  const colors = useFanColors();
  const navigate = useNavigate();
  const routeParams = useParams<RouteParams>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const userId = props.userId !== undefined ? props.userId : auth.userId;
  const username = props.username !== undefined ? props.username : auth.username;
  const authToken = props.authToken !== undefined ? props.authToken : auth.authToken;
  const isLoggedIn = auth.isLoggedIn;
  const toast = useToast();

  const routeChannelId = props.channel?.channelId ?? routeParams.channelId ?? searchParams.get('channelId');
  const routeFixtureId = searchParams.get('fixtureId');
  const legacyEmbed = !!props.channel && !routeParams.channelId && !searchParams.get('channelId');
  const [activeChannelId, setActiveChannelId] = useState<string | null>(routeChannelId ?? null);
  // A missing fixtureId means channel-wide group chat. Do not infer fixture
  // context from another match in the same channel.
  const [loadedRouteFixture, setLoadedRouteFixture] = useState<Fixture | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [optionsFor, setOptionsFor] = useState<ChatMessage | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [matchDetailsOpen, setMatchDetailsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [showVoters, setShowVoters] = useState(false);
  const [pendingImage, setPendingImage] = useState<WebImageAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [showExtraTabs, setShowExtraTabs] = useState(true);
  const [screenError, setScreenError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const lastTypingSentRef = useRef(0);
  const markReadRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Keep the selected channel in sync with the URL, including browser history.
  useEffect(() => {
    if (routeChannelId) setActiveChannelId(routeChannelId);
  }, [routeChannelId]);

  // If this route was opened without a channel ID, use the first channel the
  // signed-in user belongs to, preserving the native default-channel behavior.
  useEffect(() => {
    if (routeChannelId || !userId || !authToken) return;
    let alive = true;
    getUserChannels(userId, authToken)
      .then((channels: Channel[]) => {
        if (alive) setActiveChannelId((previous) => previous ?? channels[0]?.channelId ?? null);
      })
      .catch((error: unknown) => {
        if (alive) setScreenError(error instanceof Error ? error.message : 'Unable to load channels');
      });
    return () => { alive = false; };
  }, [routeChannelId, userId, authToken]);

  // Remote visibility flag controls pledge, bets and sub-fixture tabs.
  useEffect(() => {
    let alive = true;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    fetch(`${API_BASE}/visibility/votes_button_show`, { headers })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (alive && data && typeof data.value === 'boolean') setShowExtraTabs(data.value);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [authToken]);

  // Resolve a route-provided fixture from the shared fixtures query cache.
  const routeFixture = useMemo(() => {
    if (!routeFixtureId) return null;
    const cached = queryClient.getQueryData<Fixture[]>(FIXTURES_KEY) ?? [];
    return cached.find((fixture) => fixture.id === routeFixtureId || fixture.matchId === routeFixtureId) ?? null;
  }, [queryClient, routeFixtureId]);

  // Chats passes a fixture ID explicitly. Resolve that exact fixture if it
  // is not cached, but never auto-select a fixture for AppHeader group chats.
  useEffect(() => {
    if (!routeFixtureId || routeFixture) return;
    let alive = true;
    getAllFixtures()
      .then((fixtures) => {
        if (!alive) return;
        setLoadedRouteFixture(
          fixtures.find((fixture) => fixture.id === routeFixtureId || fixture.matchId === routeFixtureId) ?? null,
        );
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [routeFixtureId, routeFixture]);

  const fixture =
    routeFixture ??
    (loadedRouteFixture?.id === routeFixtureId || loadedRouteFixture?.matchId === routeFixtureId
      ? loadedRouteFixture
      : null);
// Keep an explicit route fixture ID scoped during lookup; never briefly use the group room.
  const fixtureId = fixture?.matchId ?? fixture?.id ?? routeFixtureId ?? null;
  const chat = useChannelChat({
    channelId: activeChannelId,
    fixtureId,
    userId,
    username,
    authToken,
    fixtureStatus: fixture?.status ?? null,
    seed: fixture ? {
      status: fixture.status,
      homeScore: fixture.homeScore ?? 0,
      awayScore: fixture.awayScore ?? 0,
      timeElapsed: fixture.timeElapsed ?? 0,
      isLive: fixture.isLive,
    } : null,
  });
  const {
    messages, connected, loadingHistory, uploadingImage, typingUsers, send,
    sendImage, sendTyping, markRead, matchStatus, homeScore, awayScore,
    timeElapsed, isLive, homeVotes, awayVotes, userVoteSelection, voters,
    recordUserVote, refetchVoteCounts,
  } = chat;

  const isCompleted = isCompletedStatus(matchStatus);
  const isUpcomingOrSoon = isUpcomingStatus(matchStatus);
  const requireVoteToChat = isUpcomingOrSoon && !!fixtureId;
  const hasVoted = userVoteSelection != null;
  const voteGateActive = requireVoteToChat && !hasVoted;

  // Bind authenticated identity to the legacy modal shims once. The endpoint
  // shapes are kept unchanged from the mobile caller.
  const modalApi = useMemo(() => {
    const uid = userId ?? '';
    const uname = username ?? '';
    return {
      topUp: (amount: number, phone: string, purpose: string) => shimTopUp({ userId: uid, username: uname, authToken, amount, phone, purpose }),
      withdraw: (amount: number, phone: string) => shimWithdraw({ userId: uid, username: uname, authToken, amount, phone }),
      getSavedPhone: (kind: 'topup' | 'withdraw') => shimGetSavedPhone(uid, kind, authToken),
      savePhone: (kind: 'topup' | 'withdraw', phone: string) => shimSavePhone(uid, kind, phone, authToken),
      getUserPhone: () => shimGetUserPhone(uid, authToken),
      placeSubFixturePledge: (args: Parameters<typeof shimPlaceSubFixturePledge>[0]) => shimPlaceSubFixturePledge({ ...args, authToken }),
      matchSubFixturePledge: (args: Parameters<typeof shimMatchSubFixturePledge>[0]) => shimMatchSubFixturePledge({ ...args, authToken }),
      matchMainPledge: (args: Parameters<typeof actionMatchMainPledge>[0]) => actionMatchMainPledge({ ...args, authToken }),
    };
  }, [userId, username, authToken]);

  // Auto-scroll when messages arrive, and keep the newest item in view after
  // the browser lays out media. History remains ordered by the chat hook.
  useEffect(() => {
    if (messages.length === 0) return;
    const timer = window.setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [messages.length]);

  // FlatList's onContentSizeChange also scrolls after text and media layout.
  // A MutationObserver gives the DOM list the same behavior when the content
  // grows without changing the message count (for example after image decode).
  useEffect(() => {
    const element = listRef.current;
    if (!element) return;
    const observer = new MutationObserver(() => {
      element.scrollTo({ top: element.scrollHeight, behavior: 'auto' });
    });
    observer.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => { markReadRef.current = markRead; }, [markRead]);
  useEffect(() => () => { void markReadRef.current?.(); }, []);

  const sendWithReply = useCallback(async (text: string, reply: ReplyData | null) => {
    await send(text, reply ? { replyTo: reply } : {});
  }, [send]);

  async function handleSend() {
    if (!draft.trim() || voteGateActive) return;
    if (!isLoggedIn || !userId || !username || !authToken) {
      toast.showInfo('Log in to chat');
      return;
    }
    const text = draft.trim();
    setDraft('');
    const replyPayload: ReplyData | null = replyTo
      ? replyTo.replyTo ?? {
        messageId: replyTo.id,
        text: replyTo.text || (replyTo.isImage ? '📷 Image' : replyTo.isVideo ? '🎥 Video' : ''),
        username: replyTo.username,
        selection: replyTo.selection,
        isMe: replyTo.userId === userId && !replyTo.isCommentary,
        imageUrl: replyTo.imageUrl,
        videoUrl: replyTo.videoUrl,
        isImage: replyTo.isImage,
        isVideo: replyTo.isVideo,
      }
      : null;
    setReplyTo(null);
    try { await sendWithReply(text, replyPayload); }
    catch (error) {
      setDraft(text);
      toast.showError(error instanceof Error ? error.message : 'Failed to send message');
    }
  }

  function handleDraftChange(text: string) {
    setDraft(text);
    if (!text || !isLoggedIn) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    sendTyping();
  }

  // React Native's multiline TextInput grows until its maxHeight. Mirror that
  // behavior in the browser without changing the text or typing-throttle flow.
  function handleComposerChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    handleDraftChange(target.value);
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 100)}px`;
    target.style.overflowY = target.scrollHeight > 100 ? 'auto' : 'hidden';
  }

  async function handleImagePick(event?: ChangeEvent<HTMLInputElement>) {
    setShowAttachMenu(false);
    const input = event?.currentTarget;
    const file = input?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.showError('Could not read image');
      input.value = '';
      return;
    }
    const uri = URL.createObjectURL(file);
    setPendingImage({ uri, name: file.name || `image-${Date.now()}.jpg`, type: file.type || 'image/jpeg', width: undefined, height: undefined });
    setCaption('');
    input.value = '';
  }

  async function confirmSendImage() {
    if (!pendingImage) return;
    const asset = pendingImage;
    const text = caption.trim();
    setPendingImage(null);
    setCaption('');
    try {
      await sendImage(asset, text);
      URL.revokeObjectURL(asset.uri);
    } catch (error) {
      toast.showError(error instanceof Error ? error.message : 'Failed to send image');
    }
  }

  function openVoteOrReview() {
    if (isCompleted) setReviewModalOpen(true);
    else setVoteModalOpen(true);
  }
  function handleBack() {
    queryClient.invalidateQueries({ queryKey: FIXTURES_KEY });
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }
  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.showSuccess('Copied');
    } catch {
      toast.showError('Unable to copy text');
    }
  }
  function retryMessage(message: ChatMessage) {
    if (!message.text?.trim() && !message.imageUrl && !message.videoUrl) {
      toast.showInfo('This message cannot be retried');
      return;
    }
    setOptionsFor(null);
    void send(message.text, {
      replyTo: message.replyTo ?? null,
      imageUrl: message.imageUrl && message.imageUrl !== UPLOADING ? message.imageUrl : null,
      videoUrl: message.videoUrl ?? null,
      videoThumbnailUrl: message.videoThumbnailUrl ?? null,
      isImage: message.isImage,
      isVideo: message.isVideo,
    });
  }

  const pageStyle: CSSProperties = {
    background: colors.background, color: colors.textPrimary,
    minHeight: '100dvh', height: '100dvh', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', paddingTop: 'env(safe-area-inset-top)',
  };

  if (legacyEmbed && props.channel?.channelId) {
    return <Navigate to={`/messages/${encodeURIComponent(props.channel.channelId)}`} replace />;
  }

  return <main
      className="message-screen flex min-h-0 flex-col"
      style={pageStyle}>
    {/* (a) Own header and match layout */}
    <header
      className="flex shrink-0 items-center gap-2 border-b px-3 py-3 sm:px-5"
      style={{ borderColor: colors.border, background: colors.surface }}>
      <button
      type="button"
      onClick={handleBack}
      aria-label="Back to chats"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      style={{ background: colors.surfaceSunken }}>
        <ArrowLeft size={18} color={colors.textPrimary}/>
      </button>
      {fixture && <button
      type="button"
      onClick={() => setMatchDetailsOpen(true)}
      aria-label="Match details"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      style={{ background: colors.surfaceSunken }}>
<Info size={15} color={colors.textPrimary}/>
</button>}
      <div
      className="min-w-0 flex-1">
        {fixture ? <MatchStatusBar
      colors={colors}
      fixture={fixture}
      status={matchStatus}
      homeScore={homeScore}
      awayScore={awayScore}
      isLive={isLive}
      timeElapsed={timeElapsed}
      onPress={openVoteOrReview}/> : <div
      className="flex items-center gap-2">
<div
      className="flex h-8 w-8 items-center justify-center rounded-full font-bold"
      style={{ background: colors.primaryDim, color: colors.primary }}>#</div>
<div>
<h1
      className="text-sm font-bold">Chat</h1>
<p
      className="text-[10px]"
      style={{ color: connected ? colors.primary : colors.textTertiary }}>{connected ? 'Connected' : 'Connecting…'}</p>
</div>
</div>}
      </div>
      <button
      type="button"
      onClick={() => { try { window.localStorage.setItem('home.activeTab', 'Feed'); } catch { /* storage may be unavailable */ } navigate('/'); }}
      aria-label="Open Feeds"
      className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold"
      style={{ color: colors.primary, background: colors.primaryDim }}>
        Feeds
      </button>
      <button
      type="button"
      onClick={() => setLeaderboardOpen(true)}
      aria-label="Comrades and leaderboard"
      className="flex shrink-0 items-center justify-center gap-1 rounded-full px-2 py-2"
      style={{ background: colors.surfaceSunken }}>
        <Users size={16} color={colors.textPrimary}/>
        <span className="text-[11px] font-semibold" style={{ color: colors.textPrimary }}>Comrades</span>
      </button>
    </header>

    {/* Same swipeable ad carousel flow as native: between messaging header and fixture controls. */}
    <AdSenseCarousel
      placement="chats"
      label="Messaging advertisements"
      slots={['9051548379', '3164796870', '1372263706']}
    />

    {/* Vote strip: chips open the vote/review dialog; totals open voter details. */}
    {fixture && fixtureId && <VoteStrip
      colors={colors}
      fixture={fixture}
      homeVotes={homeVotes}
      awayVotes={awayVotes}
      onOpenModal={openVoteOrReview}
      onPressTotals={() => setShowVoters((previous) => !previous)}/>}

    {!activeChannelId ? <section
      className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div
      className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
      style={{ background: colors.surfaceSunken }}>
<Users size={22} color={colors.textTertiary}/>
</div>
      <p
      className="text-sm"
      style={fanText('body', colors, colors.textTertiary)}>Join or create a channel to start chatting.</p>
      {screenError && <p
      role="alert"
      className="mt-3 text-xs"
      style={{ color: colors.away }}>{screenError}</p>}
    </section> : <>
      {showVoters && <VotersPanel
      colors={colors}
      voters={voters}
      userId={userId}
      onClose={() => setShowVoters(false)}/>}
      {/* (b) Scrollable message list. The chat hook fetches up to 100 messages,
          merges REST history with socket updates and orders by timestamp. */}
      <div
      ref={listRef}
      className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
      aria-live="polite"
      aria-relevant="additions text"
      style={{ overscrollBehavior: 'contain' }}>
        {loadingHistory && messages.length === 0 && <div
      className="flex min-h-40 flex-col items-center justify-center gap-3">
<span
      className="h-6 w-6 animate-spin rounded-full border-2 border-current border-r-transparent"
      style={{ color: colors.primary }}/>
<p
      className="text-xs"
      style={{ color: colors.textTertiary }}>Loading messages…</p>
</div>}
        {!loadingHistory && messages.length === 0 && <div
      className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
<div
      className="flex h-12 w-12 items-center justify-center rounded-full"
      style={{ background: colors.surfaceSunken }}>
<Users size={22} color={colors.textTertiary}/>
</div>
<strong
      className="text-xs">No messages yet — say something.</strong>
<p
      className="text-xs"
      style={{ color: colors.textTertiary }}>Your channel conversation will appear here.</p>
</div>}
        {messages.map((message) => <MessageBubble
      key={message.id}
      colors={colors}
      message={message}
      isMe={message.userId === userId}
      onLongPress={() => setOptionsFor(message)}
      onImagePress={setViewerUri}
      onRetry={() => retryMessage(message)}/>)}
        {loadingHistory && messages.length > 0 && <p
      className="py-2 text-center text-[10px]"
      style={{ color: colors.textTertiary }}>Refreshing messages…</p>}
      </div>

      {typingUsers.length > 0 && <div
      className="shrink-0 px-5 pb-1"
      aria-live="polite">
<span
      className="text-[10px]"
      style={{ color: colors.textTertiary }}>{typingUsers.length === 1 ? `${typingUsers[0]} is typing…` : `${typingUsers.length} people are typing…`}</span>
</div>}

      {/* (c) Reply preview and composer */}
      {replyTo && <div
      className="mx-3 mb-1 flex items-center gap-3 rounded-xl px-3 py-2 sm:mx-5"
      style={{ background: colors.primaryDim }}>
        <ReplyIcon size={15} color={colors.primary}/>
        <div
      className="min-w-0 flex-1">
<p
      className="truncate text-[10px] font-semibold"
      style={{ color: colors.primary }}>Replying to {replyTo.isCommentary ? replyTo.username : replyTo.userId === userId ? 'yourself' : replyTo.username}</p>
<p
      className="truncate text-[10px]"
      style={{ color: colors.textTertiary }}>{replyTo.text || (replyTo.isImage ? '📷 Image' : replyTo.isVideo ? '🎥 Video' : 'Media')}</p>
</div>
        <button
      type="button"
      onClick={() => setReplyTo(null)}
      aria-label="Cancel reply"
      className="rounded-full p-1"
      style={{ background: colors.surfaceSunken }}>
<X size={13} color={colors.textTertiary}/>
</button>
      </div>}

      <footer
      className="shrink-0 border-t px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 sm:px-5"
      style={{ borderColor: colors.border, background: colors.surface }}>
        <div
      className="flex items-end gap-2">
          <button
      type="button"
      onClick={openVoteOrReview}
      aria-label="Vote or review match"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      style={{ background: voteGateActive ? dimColor(colors.draw) : colors.surfaceSunken }}>
<span
      aria-hidden="true">{voteGateActive ? '⚠' : '🗳'}</span>
</button>
          {isLoggedIn && !voteGateActive && <button
      type="button"
      onClick={() => setShowAttachMenu((previous) => !previous)}
      aria-label="Attach media"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      style={{ background: colors.surfaceSunken }}>
<Paperclip size={16} color={colors.textTertiary}/>
</button>}
          {voteGateActive ? <button
      type="button"
      onClick={openVoteOrReview}
      className="flex min-h-9 flex-1 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold"
      style={{ background: dimColor(colors.draw), color: colors.draw }}>
<Lock size={12}/>{matchStatus === 'soon' ? 'Vote before game starts 💬' : 'Vote to chat 💬'}</button> : <form
      className="flex min-h-9 min-w-0 flex-1 items-end rounded-3xl px-4"
      style={{ background: colors.surfaceSunken }}
      onSubmit={(event) => { event.preventDefault(); void handleSend(); }}>
            <textarea
      value={draft}
      onChange={handleComposerChange}
      onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }}
      disabled={!isLoggedIn || uploadingImage}
      rows={1}
      placeholder={!isLoggedIn ? 'Log in to chat' : uploadingImage ? 'Uploading…' : isLive ? '🔴 Live - join the conversation!' : isCompleted ? '📊 Game finished - discuss the match!' : 'Type a message…'}
      aria-label="Type a message"
      className="max-h-28 min-h-9 flex-1 resize-none bg-transparent py-2.5 text-[13px] outline-none"
      style={{ color: colors.textPrimary, ...fanText('caption', colors, colors.textPrimary) }}/>
          </form>}
          {isLoggedIn && !voteGateActive && draft.trim().length > 0 && <button
      type="button"
      onClick={() => void handleSend()}
      aria-label="Send message"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      style={{ background: colors.primary }}>
<Send size={16} color="#fff"/>
</button>}
        </div>
        {showAttachMenu && isLoggedIn && <div
      className="mt-3 flex gap-3">
          <label
      className="flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold"
      style={{ background: colors.primaryDim, color: colors.primary }}>
<ImageIcon size={14}/> Image<input
      type="file"
      accept="image/*"
      className="sr-only"
      onChange={(event) => void handleImagePick(event)}/>
</label>
          <button
      type="button"
      onClick={() => { setShowAttachMenu(false); toast.showInfo('Video coming soon'); }}
      className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold"
      style={{ background: dimColor(colors.draw), color: colors.draw }}>🎥 Video</button>
        </div>}
      </footer>
    </>}

    {/* (d) Image caption dialog */}
    {pendingImage && <Dialog
      colors={colors}
      label="Add a caption"
      onClose={() => { URL.revokeObjectURL(pendingImage.uri); setPendingImage(null); }}>
      <div
      className="flex items-center justify-between">
<h2
      className="text-sm font-bold">Add a caption</h2>
<button
      type="button"
      onClick={() => { URL.revokeObjectURL(pendingImage.uri); setPendingImage(null); }}
      aria-label="Close caption dialog">
<X size={16}/>
</button>
</div>
      <img
      src={pendingImage.uri}
      alt="Selected image preview"
      className="mt-4 max-h-56 w-full rounded-xl object-contain"
      style={{ background: colors.surfaceSunken }}/>
      <textarea
      value={caption}
      onChange={(event) => setCaption(event.target.value.slice(0, 500))}
      maxLength={500}
      placeholder="Add a caption to your image..."
      className="mt-3 min-h-20 w-full rounded-xl p-3 text-sm outline-none"
      style={{ color: colors.textPrimary, background: colors.surfaceSunken }}/>
      <div
      className="mt-4 flex justify-end gap-2">
<button
      type="button"
      onClick={() => { URL.revokeObjectURL(pendingImage.uri); setPendingImage(null); }}
      className="rounded-lg px-4 py-2 text-xs"
      style={{ color: colors.textSecondary }}>Cancel</button>
<button
      type="button"
      onClick={() => void confirmSendImage()}
      className="rounded-lg px-4 py-2 text-xs font-bold"
      style={{ background: colors.primary, color: '#fff' }}>Send</button>
</div>
    </Dialog>}

    {/* Full-screen image viewer */}
    {viewerUri && <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/95 p-4"
      onClick={() => setViewerUri(null)}
      onKeyDown={(event) => { if (event.key === 'Escape') setViewerUri(null); }}>
<button
      type="button"
      className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white"
      aria-label="Close image viewer"
      onClick={() => setViewerUri(null)}>
<X size={20}/>
</button>
<img
      src={viewerUri}
      alt="Full-size message attachment"
      className="max-h-[85vh] max-w-full object-contain"
      onClick={(event) => event.stopPropagation()}/>
</div>}

    {/* Message actions: right-click and hover replace native long-press. */}
    {optionsFor && <Dialog
      colors={colors}
      label="Message options"
      onClose={() => setOptionsFor(null)}>
      <div
      className="mb-4 flex items-center justify-between">
<h2
      className="text-sm font-bold">Message options</h2>
<button
      type="button"
      onClick={() => setOptionsFor(null)}
      aria-label="Close message options">
<X size={16}/>
</button>
</div>
      <ActionRow
      icon={<ReplyIcon size={16}/>}
      label="Reply"
      onClick={() => { setReplyTo(optionsFor); setOptionsFor(null); }}/>
      {!!optionsFor.text && <ActionRow
      icon={<Copy size={16}/>}
      label="Copy text"
      onClick={() => { void handleCopy(optionsFor.text); setOptionsFor(null); }}/>}
      {isFailed(optionsFor) && <ActionRow
      icon={<RefreshCw size={16}/>}
      label="Retry sending"
      onClick={() => retryMessage(optionsFor)}/>}
      {optionsFor.userId === userId && !optionsFor.isCommentary && <ActionRow
      icon={<AlertCircle size={16}/>}
      label="Delete" danger
      onClick={() => { toast.showInfo('Delete coming soon'); setOptionsFor(null); }}/>}
    </Dialog>}

    {/* (e) Vote, aftermatch, match details and comrades dialogs */}
    {fixture && voteModalOpen && activeChannelId && <SwipeableVotePledgeModal
      visible
      fixture={{ id: fixture.id, matchId: fixture.matchId, homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam, league: fixture.league, isLive: fixture.isLive }}
      userId={userId ?? ''}
      username={username ?? ''}
      authToken={authToken}
      isLoggedIn={!!isLoggedIn}
      hasUserVoted={hasVoted}
      userVoteSelection={userVoteSelection}
      channelId={activeChannelId}
      showPledgesTab={showExtraTabs}
      showSubFixturesTab={showExtraTabs}
      showBetsTab={showExtraTabs}
      onClose={() => setVoteModalOpen(false)}
      onVote={async (selection) => {
        if (!userId || !authToken || !username) return { success: false, message: 'Please sign in to vote' };
        const result = await castFixtureVote({ fixtureId: fixture.matchId ?? fixture.id, userId, username, selection, authToken });
        if (result.success) {
          // Publish the confirmed vote locally before any network refresh so
          // the chat composer unlocks immediately and the voter stack updates.
          recordUserVote(selection);
          queryClient.setQueryData<Fixture[]>(FIXTURES_KEY, (previous = []) => previous.map((item) => {
            if (item.id !== fixture.id && item.matchId !== fixture.matchId) return item;
            const existing = item.voters ?? [];
            const mine = { userId, userName: username, selection: selection === 'home' ? 'home_team' : 'away_team', votedAt: new Date(), isComrade: false, isCorrect: false, pointsAwarded: 0 };
            return { ...item, voters: [mine, ...existing.filter((voter) => voter.userId !== userId)] };
          }));
          queryClient.invalidateQueries({ queryKey: FIXTURES_KEY });
        }
        return { success: result.success, message: result.message };
      }}
      onPledge={async (selection, amount) => {
        if (!userId || !username || !authToken) return { success: false, message: 'Please sign in to continue' };
        const result = await createPledge({ fixtureId: fixture.matchId ?? fixture.id, userId, username, selection, amount, channelId: activeChannelId, alreadyVoted: hasVoted, authToken });
        if (result.success) {
          recordUserVote(selection);
          queryClient.setQueryData<Fixture[]>(FIXTURES_KEY, (previous = []) => previous.map((item) => {
            if (item.id !== fixture.id && item.matchId !== fixture.matchId) return item;
            const existing = item.voters ?? [];
            const mine = { userId, userName: username, selection: selection === 'home' ? 'home_team' : 'away_team', votedAt: new Date(), isComrade: false, isCorrect: false, pointsAwarded: 0 };
            return { ...item, voters: [mine, ...existing.filter((voter) => voter.userId !== userId)] };
          }));
          queryClient.invalidateQueries({ queryKey: FIXTURES_KEY });
          if (result.votedNow) await refetchVoteCounts();
        }
        return { success: result.success, message: result.message, newBalance: result.newBalance };
      }}
      onShowJoinGroups={() => undefined}
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
    />}
    {fixture && reviewModalOpen && activeChannelId && <AftermatchReviewModal visible
      fixture={fixture}
      userId={userId ?? ''}
      username={username ?? ''}
      authToken={authToken}
      channelId={activeChannelId}
      isLoggedIn={!!isLoggedIn}
      showPledgesTab={showExtraTabs}
      showBetsTab={showExtraTabs}
      showSubFixturesTab={showExtraTabs}
      onClose={() => setReviewModalOpen(false)}/>}
    {fixture && matchDetailsOpen && <MatchDetailsModal visible
      fixture={fixture}
      userId={userId ?? ''}
      username={username ?? ''}
      authToken={authToken}
      onClose={() => setMatchDetailsOpen(false)}/>}
    <ComradesScreen
      visible={leaderboardOpen}
      onClose={() => setLeaderboardOpen(false)}/>
  </main>;
}

/* Match status and score bar, including all status labels used by mobile. */
function MatchStatusBar({ colors, fixture, status, homeScore, awayScore, isLive, timeElapsed, onPress }: {
  colors: FanColors; fixture: Fixture; status: string; homeScore: number; awayScore: number;
  isLive: boolean; timeElapsed: number; onPress: () => void;
}) {
  const completed = isCompletedStatus(status);
  const minutes = Math.floor(timeElapsed || 0);
  const liveNow = status === 'live' || isLive;
  let label = status.toUpperCase();
  let labelColor = colors.textTertiary;
  if (status === 'half_time' || (liveNow && minutes === 45)) { label = '⚡ HT'; labelColor = colors.draw; }
  else if (liveNow && minutes >= 90 && completed) { label = '✅ FT'; labelColor = colors.primary; }
  else if (liveNow) { label = '🔴 LIVE'; labelColor = colors.live ?? colors.primary; }
  else if (completed) { label = '✅ FT'; labelColor = colors.primary; }
  else if (status === 'upcoming') label = '⏳ UPCOMING';
  else if (status === 'soon') { label = '🔜 SOON'; labelColor = colors.draw; }
  return <button
      type="button"
      onClick={onPress}
      className="flex min-w-0 items-center gap-1.5 text-left"
      aria-label="Open match vote or review">
    <span
      className="shrink-0 rounded-md px-1.5 py-1 text-[9px] font-bold"
      style={{ color: labelColor, background: dimColor(labelColor) }}>{label}</span>
    <span
      className="shrink-0 rounded-md px-2 py-1 text-[11px] font-bold"
      style={{ color: colors.primary, background: colors.primaryDim }}>{homeScore} - {awayScore}</span>
    {liveNow && <span
      className="shrink-0 rounded-md px-1.5 py-1 text-[9px]"
      style={{ color: colors.textTertiary, background: colors.surfaceSunken }}>{formatMinute(timeElapsed)}</span>}
    <span
      className="min-w-0 truncate text-[11px] font-semibold"
      style={{ color: colors.textPrimary }}>{fixture.homeTeam} <span
      style={{ color: colors.textTertiary }}>vs</span> {fixture.awayTeam}</span>
  </button>;
}

/* Home/Away vote strip: zero totals show team choices; nonzero totals show
   a weighted two-color bar and a total that opens the voter list. */
function VoteStrip({ colors, fixture, homeVotes, awayVotes, onOpenModal, onPressTotals }: {
  colors: FanColors; fixture: Fixture; homeVotes: number; awayVotes: number;
  onOpenModal: () => void; onPressTotals: () => void;
}) {
  const total = homeVotes + awayVotes;
  if (total === 0) return <div
      className="mx-3 mt-2 flex h-10 gap-1 rounded-xl p-1 sm:mx-5"
      style={{ background: colors.surface }}>
    <button
      type="button"
      onClick={onOpenModal}
      className="min-w-0 flex-1 truncate rounded-full px-3 text-[10px] font-bold"
      style={{ color: colors.primary, background: dimColor(colors.primary) }}>{fixture.homeTeam}</button>
    <button
      type="button"
      onClick={onOpenModal}
      className="min-w-0 flex-1 truncate rounded-full px-3 text-[10px] font-bold"
      style={{ color: colors.away, background: dimColor(colors.away) }}>{fixture.awayTeam}</button>
  </div>;
  return <button
      type="button"
      onClick={onPressTotals}
      aria-label={`Show ${total} voters`}
      className="mx-3 mt-2 flex h-10 items-center gap-2 rounded-xl px-3 sm:mx-5"
      style={{ background: colors.surface }}>
    <div
      className="flex h-1.5 flex-1 overflow-hidden rounded-full"
      aria-label={`Home ${homeVotes}, Away ${awayVotes}`}>
<span
      style={{ width: `${total ? homeVotes / total * 100 : 50}%`, background: colors.primary }}/>
<span
      className="flex-1"
      style={{ background: colors.away }}/>
</div>
    <span
      className="text-[10px] font-bold"
      style={{ color: colors.textPrimary }}>{total}</span>
  </button>;
}

/* Voter panel supports an empty state and displays the current user's row first. */
function VotersPanel({ colors, voters, userId, onClose }: { colors: FanColors; voters: Voter[]; userId: string | null; onClose: () => void }) {
  const displayVote = (selection: string) => selection === 'home_team' || selection === 'home' ? 'Home' : selection === 'away_team' || selection === 'away' ? 'Away' : selection;
  return <section
      className="mx-3 mb-2 max-h-52 overflow-y-auto rounded-xl p-3 sm:mx-5"
      style={{ background: colors.surface }}>
    <header
      className="mb-2 flex items-center justify-between">
<h2
      className="text-xs font-bold">Votes ({voters.length})</h2>
<button
      type="button"
      onClick={onClose}
      aria-label="Close voters">
<X size={14}/>
</button>
</header>
    {voters.length === 0 ? <p
      className="text-xs"
      style={{ color: colors.textTertiary }}>No votes yet</p> : voters.map((voter) => <div
      key={voter.userId}
      className="flex justify-between py-1 text-xs">
<span>{voter.userId === userId ? 'You' : voter.username}</span>
<span
      style={{ color: colors.textTertiary }}>{displayVote(voter.selection)}</span>
</div>)}
  </section>;
}

/* Message bubble includes commentary, self/other alignment, reply quotes,
   media upload/error states, and web right-click/hover equivalents for
   native long-press actions. */
function MessageBubble({ colors, message, isMe, onLongPress, onImagePress, onRetry }: {
  colors: FanColors; message: ChatMessage; isMe: boolean; onLongPress: () => void;
  onImagePress: (uri: string) => void; onRetry: () => void;
}) {
  const commentary = !!message.isCommentary;
  const mine = commentary ? false : isMe;
  const uploading = message.imageUrl === UPLOADING || message.videoUrl === UPLOADING;
  const failed = isFailed(message);
  const hasImage = !!message.imageUrl && !uploading;
  const hasVideo = !!message.videoUrl && !uploading && !message.imageUrl;
  const bubbleBackground = failed ? dimColor(colors.away) : commentary ? dimColor(colors.draw) : mine ? colors.primaryDim : colors.surface;
  const actionEvents = {
    onContextMenu: (event: MouseEvent) => { event.preventDefault(); onLongPress(); },
  };
  return <article
      className={`group mb-3 flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
    {!mine && <p
      className="mb-1 ml-9 max-w-[78%] truncate text-[10px] font-semibold"
      style={{ color: commentary ? colors.draw : colors.primary }}>{commentary ? '⚽ ' : ''}{message.username}</p>}
    <div
      className={`flex max-w-full items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
      {!mine && <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
      style={{ background: commentary ? dimColor(colors.draw) : colors.primaryDim, color: commentary ? colors.draw : colors.primary }}>{commentary ? '⚽' : initials(message.username ?? '')}</div>}
      <div
      className="relative max-w-[min(78vw,620px)]">
        <button
      type="button"
      onClick={onLongPress} {...actionEvents}
      aria-label="Open message actions"
      className="absolute -top-2 z-10 hidden rounded-full border p-1.5 shadow group-hover:flex focus:flex"
      style={{ right: mine ? 'auto' : -6, left: mine ? -6 : 'auto', background: colors.surface, borderColor: colors.border }}>
<MoreHorizontal size={13}/>
</button>
        <div
      className={`rounded-2xl px-3.5 py-2.5 ${mine ? 'rounded-br-sm' : 'rounded-bl-sm'} ${failed ? 'border' : ''} ${message.isPending && !failed ? 'opacity-60' : ''}`}
      style={{ background: bubbleBackground, borderColor: failed ? colors.away : 'transparent', color: colors.textPrimary }}
      onContextMenu={(event) => { event.preventDefault(); onLongPress(); }}>
          {message.replyTo && <div
      className="mb-2 border-l-2 pl-2"
      style={{ borderColor: dimColor(colors.primary, .6) }}>
<p
      className="truncate text-[10px] font-bold"
      style={{ color: colors.primary }}>↳ {message.replyTo.isMe ? 'You' : message.replyTo.username}</p>
<p
      className="line-clamp-2 text-[10px]"
      style={{ color: colors.textTertiary }}>{message.replyTo.text}</p>
</div>}
          {uploading && <div
      className="flex h-36 w-56 items-center justify-center rounded-xl"
      style={{ background: colors.surfaceSunken }}>
<span
      className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent"
      style={{ color: colors.primary }}/>
</div>}
          {hasImage && <button
      type="button"
      onClick={() => onImagePress(message.imageUrl as string)}
      className="block">
<img
      src={message.imageUrl as string}
      alt="Message attachment"
      className="mb-2 max-h-64 w-full rounded-xl object-cover"/>
</button>}
          {hasVideo && <div
      className="flex h-36 w-56 items-center justify-center rounded-xl"
      style={{ background: colors.surfaceSunken }}>
<span
      className="text-xs"
      style={{ color: colors.textTertiary }}>🎥 Video</span>
</div>}
          {!!message.text && <p
      className={`whitespace-pre-wrap break-words text-[13px] leading-[18px] ${commentary ? 'italic' : ''}`}>{message.text}</p>}
          <div
      className="mt-1 flex items-center justify-end gap-2 text-[8px] font-bold tracking-wide"
      style={{ color: failed ? colors.away : colors.textTertiary }}>
<time>{failed ? 'Failed to send' : timeAgo(message.timestamp)}</time>{message.isPending && !failed && <span
      aria-label="Sending">◷</span>}{failed && <button
      type="button"
      onClick={onRetry}
      className="underline">Retry</button>}</div>
        </div>
      </div>
      {mine && <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
      style={{ background: colors.primary, color: colors.textInverse }}>{initials(message.username ?? '')}</div>}
    </div>
  </article>;
}

/* Shared accessible portal dialog with focus restoration and Tab containment. */
function Dialog({ colors, label, onClose, children }: { colors: FanColors; label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button,textarea,input')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input:not(:disabled),[href]'));
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onClose]);
  return createPortal(<div
      className="fixed inset-0 z-[1050] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
<section
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="w-full max-w-lg rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl"
      style={{ maxHeight: '88vh', overflowY: 'auto', background: colors.surface, color: colors.textPrimary, border: `1px solid ${colors.border}` }}>{children}</section>
</div>, document.body);
}
function ActionRow({ icon, label, onClick, danger = false }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  const colors = useFanColors();
  return <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm"
      style={{ color: danger ? colors.away : colors.textPrimary }}>
<span>{icon}</span>
<span>{label}</span>
</button>;
}
