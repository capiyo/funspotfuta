'use client';

// Visual port of the Flutter ChatScreen — as a MODAL.
// Wires the carousel header, message bubbles, reply indicator,
// attachment menu, and vote-gated input bar to useChannelChat().
// Presentation only — the hook owns socket, history, optimistic send,
// commentary, and typing.
//
// This is a modal: it takes `fixture` + `channelId` + `onClose` from the
// parent (Arena / MatchCard tap), instead of being a /chat route.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/lib/toast/toast-context';
import {
  getUserChannels,
  castVote,
  createBetWithVoteId,
  Channel,
  Fixture,
  ChatMessage,
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
import { useChannelChat } from '@/lib/api/use-channel-chat';
import { Image as ImageIcon, Paperclip, Send, Lock, X } from 'lucide-react';
import { SwipeableVotePledgeModal } from '@/components/actionsModal';
import { AftermatchReviewModal } from '@/components/aftermatchModal';

interface ChatModalProps {
  fixture: Fixture;
  channelId: string;
  onClose: () => void;
}

export function ChatModal({ fixture, channelId, onClose }: ChatModalProps) {
  const { userId, username, authToken, isLoggedIn } = useAuth();
  const toast = useToast();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>(channelId);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [showVoters, setShowVoters] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync prop changes (parent may switch channel while modal is open)
  useEffect(() => {
    setActiveChannelId(channelId);
  }, [channelId]);

  // ── Channels (for the picker) ────────────────────────────────
  useEffect(() => {
    if (!userId || !authToken) return;
    getUserChannels(userId, authToken).then((c) => {
      setChannels(c);
      setActiveChannelId((prev) => prev ?? c[0]?.id ?? '');
    });
  }, [userId, authToken]);

  const fixtureId = fixture.matchId ?? fixture.id;

  const {
    messages,
    connected,
    loadingHistory,
    uploadingImage,
    send,
    sendImage,
  } = useChannelChat({
    channelId: activeChannelId,
    fixtureId,
    userId,
    username,
    authToken,
  });

  // ── Auto-scroll on new messages ──────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // ── Vote gate (upcoming/soon only) ───────────────────────────
  const requiresVote =
    (fixture.status === 'upcoming' || fixture.status === 'soon') && !!fixtureId;

  const hasVoted = useMemo(() => {
    if (!userId) return false;
    return (fixture.voters ?? []).some((v) => v.userId === userId);
  }, [fixture, userId]);

  const voteGateActive = requiresVote && !hasVoted;

  const isCompleted =
    fixture.status === 'completed' || fixture.status === 'finished';

  // ── Handlers ─────────────────────────────────────────────────
  async function handleSend() {
    if (!draft.trim() || voteGateActive) return;
    const text = draft.trim();
    setDraft('');

    const replyPayload = replyTo
      ? replyTo.replyTo ?? {
        messageId: replyTo.id,
        text:
          replyTo.text ||
          (replyTo.isImage ? '📷 Image' : replyTo.isVideo ? '🎥 Video' : ''),
        username: replyTo.username,
        selection: replyTo.selection,
        isMe: replyTo.userId === userId,
        imageUrl: replyTo.imageUrl,
        videoUrl: replyTo.videoUrl,
        isImage: replyTo.isImage,
        isVideo: replyTo.isVideo,
      }
      : null;

    setReplyTo(null);
    await send(text, '', { replyTo: replyPayload });
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await sendImage(file);
    } catch (err: any) {
      toast.showError(err?.message ?? 'Failed to send image');
    }
  }

  function openVoteOrReview() {
    if (isCompleted) setReviewModalOpen(true);
    else setVoteModalOpen(true);
  }

  // ── Empty channel state ─────────────────────────────────────
  if (channels.length === 0) {
    return (
      <ModalShell onClose={onClose}>
        <div className="flex flex-1 items-center justify-center px-fan-xxl text-center">
          <p className="text-fan-body text-fan-textTertiary">
            Join or create a channel to start chatting.
          </p>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="flex h-full flex-col bg-fan-background">
        {/* Top bar */}
        <div className="flex items-center gap-fan-sm px-fan-lg pt-fan-md pb-fan-sm">
          <select
            value={activeChannelId ?? ''}
            onChange={(e) => setActiveChannelId(e.target.value)}
            className="flex-1 rounded-fan-md border border-fan-border bg-fan-surface px-fan-base py-fan-xs text-fan-caption text-fan-textPrimary"
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span
            className={`text-fan-tag ${connected ? 'text-fan-primary' : 'text-fan-textTertiary'
              }`}
          >
            {connected ? '● live' : '○ connecting…'}
          </span>
        </div>

        {/* Carousel header */}
        <CarouselHeader fixture={fixture} onOpenVote={openVoteOrReview} />

        {/* Vote stats / quick-vote strip — mirrors mobile */}
        <VoteStrip
          fixture={fixture}
          userId={userId}
          onQuickVote={async (selection) => {
            if (!activeChannelId || !userId || !authToken || hasVoted) return;
            try {
              await castVote({ channelId: activeChannelId, fixtureId, userId, selection, authToken });
            } catch {
              toast.showError('Failed to cast vote');
            }
          }}
          onPressTotals={() => setShowVoters((v) => !v)}
        />
        {showVoters && <VotersPanel fixtureId={fixtureId} userId={userId} />}

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-2 overflow-y-auto px-fan-sm py-fan-sm"
        >
          {loadingHistory ? (
            <p className="py-fan-xxl text-center text-fan-caption text-fan-textTertiary">
              Loading messages…
            </p>
          ) : messages.length === 0 ? (
            <p className="py-fan-xxl text-center text-fan-caption text-fan-textTertiary">
              No messages yet — say something.
            </p>
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                isMe={m.userId === userId}
                onLongPress={() => setReplyTo(m)}
              />
            ))
          )}
        </div>

        {/* Reply indicator */}
        {replyTo && (
          <div className="mx-fan-md mb-fan-xs flex items-center gap-fan-sm rounded-fan-md border-[0.5px] border-fan-primary/25 bg-fan-primaryDim px-fan-sm py-fan-xs">
            <span className="text-[14px] text-fan-primary">↩</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-fan-tag font-semibold text-fan-primary">
                Replying to{' '}
                {replyTo.userId === userId ? 'yourself' : replyTo.username}
              </p>
              <p className="truncate text-fan-tag italic text-fan-textTertiary">
                {replyTo.text || (replyTo.isImage ? '📷 Image' : 'Media')}
              </p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="rounded-full bg-fan-surfaceSunken p-1"
              aria-label="Cancel reply"
            >
              <X size={12} className="text-fan-textTertiary" />
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className="border-t-[0.5px] border-fan-border/20 px-fan-sm pt-fan-sm pb-fan-md">
          <div className="flex items-end gap-fan-xs">
            <button
              onClick={openVoteOrReview}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[0.5px] ${voteGateActive
                  ? 'border-fan-draw/40 bg-fan-draw/10 text-fan-draw'
                  : 'border-fan-border/30 bg-fan-surfaceSunken text-fan-primary'
                }`}
              aria-label="Vote"
            >
              {voteGateActive ? '⚠' : '🗳'}
            </button>

            {isLoggedIn && !voteGateActive && (
              <button
                onClick={() => setShowAttachMenu((v) => !v)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fan-surfaceSunken text-fan-textTertiary"
                aria-label="Attach"
              >
                <Paperclip size={16} />
              </button>
            )}

            {voteGateActive ? (
              <button
                onClick={openVoteOrReview}
                className="flex flex-1 items-center justify-center gap-fan-xs rounded-fan-md border-[0.5px] border-fan-draw/25 bg-fan-surfaceSunken py-fan-sm"
              >
                <Lock size={12} className="text-fan-draw" />
                <span className="text-fan-caption font-medium text-fan-draw">
                  {fixture.status === 'soon'
                    ? 'Vote before game starts 💬'
                    : 'Vote to chat 💬'}
                </span>
              </button>
            ) : (
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                placeholder={
                  !isLoggedIn
                    ? 'Log in to chat'
                    : uploadingImage
                      ? 'Uploading…'
                      : 'Type a message…'
                }
                disabled={!isLoggedIn}
                className="flex-1 rounded-fan-md border-[0.5px] border-fan-border bg-fan-surfaceSunken px-fan-md py-fan-xs text-fan-caption text-fan-textPrimary outline-none focus:border-fan-primary disabled:opacity-60"
              />
            )}

            {isLoggedIn && !voteGateActive && draft.trim().length > 0 && (
              <button
                onClick={handleSend}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fan-primary"
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            )}
          </div>

          {showAttachMenu && isLoggedIn && (
            <div className="mt-fan-sm flex gap-fan-md">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImagePick}
                className="hidden"
              />
              <button
                onClick={() => {
                  setShowAttachMenu(false);
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-fan-xs rounded-fan-pill bg-fan-primaryDim px-fan-md py-fan-xs text-fan-tag font-semibold text-fan-primary"
              >
                <ImageIcon size={14} />
                Image
              </button>
              <button
                onClick={() => {
                  setShowAttachMenu(false);
                  toast.showInfo('Video coming soon');
                }}
                className="flex items-center gap-fan-xs rounded-fan-pill bg-fan-draw/10 px-fan-md py-fan-xs text-fan-tag font-semibold text-fan-draw"
              >
                🎥 Video
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Vote modal */}
      {voteModalOpen && activeChannelId && (
        <SwipeableVotePledgeModal
          fixture={fixture}
          userId={userId ?? ''}
          username={username ?? ''}
          authToken={authToken}
          isLoggedIn={!!isLoggedIn}
          hasUserVoted={hasVoted}
          userVoteSelection={
            fixture.voters?.find((v) => v.userId === userId)?.selection ?? null
          }
          channelId={activeChannelId}
          showPledgesTab
          showSubFixturesTab
          showBetsTab
          onClose={() => setVoteModalOpen(false)}
          onVote={async (sel) => {
            if (!activeChannelId || !userId || !authToken) return false;
            const ok = await castVote({
              channelId: activeChannelId,
              fixtureId,
              userId,
              selection: sel === 'home' ? 'home_team' : 'away_team',
              authToken,
            });
            return ok;
          }}
          onPledge={async (sel, amount) => {
            if (!activeChannelId || !userId || !username) return false;
            const r = await createBetWithVoteId({
              fixtureId,
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

      {/* Aftermatch review modal */}
      {reviewModalOpen && activeChannelId && (
        <AftermatchReviewModal
          fixture={fixture}
          userId={userId ?? ''}
          username={username ?? ''}
          authToken={authToken}
          channelId={activeChannelId}
          isLoggedIn={!!isLoggedIn}
          onClose={() => setReviewModalOpen(false)}
        />
      )}
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal shell — backdrop + sheet + X button
// ─────────────────────────────────────────────────────────────
function ModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-[18px] bg-fan-background shadow-2xl sm:h-[78vh] sm:rounded-fan-lg"
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between border-b-[0.5px] border-fan-border/20 px-fan-lg py-fan-sm">
          <p className="font-condensed text-fan-body font-semibold text-fan-textPrimary">
            Chat
          </p>
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="rounded-full bg-fan-surfaceSunken p-1.5 text-fan-textSecondary"
          >
            <X size={14} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Carousel header
// ─────────────────────────────────────────────────────────────
function CarouselHeader({
  fixture,
  onOpenVote,
}: {
  fixture: Fixture;
  onOpenVote: () => void;
}) {
  const isLive = fixture.status === 'live' || fixture.status === 'half_time';
  const completed =
    fixture.status === 'completed' || fixture.status === 'finished';
  const homeScore = fixture.homeScore ?? 0;
  const awayScore = fixture.awayScore ?? 0;

  return (
    <div className="mx-fan-sm mb-fan-xs flex items-center gap-fan-sm rounded-fan-md border-[0.5px] border-fan-border/30 bg-fan-surface px-fan-sm py-fan-xs">
      <span
        className={`shrink-0 rounded-fan-sm px-1.5 py-[1px] text-fan-tag font-bold ${isLive
            ? 'bg-fan-awayDim text-fan-live'
            : completed
              ? 'bg-fan-primaryDim text-fan-primary'
              : 'bg-fan-surfaceSunken text-fan-textTertiary'
          }`}
      >
        {isLive ? '● LIVE' : completed ? 'FT' : 'SOON'}
      </span>
      <span className="shrink-0 rounded-fan-sm bg-fan-primaryDim px-1.5 py-[1px] text-fan-caption font-bold text-fan-primary">
        {homeScore} - {awayScore}
      </span>
      <span className="truncate text-fan-caption font-semibold text-fan-textPrimary">
        {fixture.homeTeam} <span className="text-fan-textTertiary">vs</span>{' '}
        {fixture.awayTeam}
      </span>
      <button
        onClick={onOpenVote}
        className="ml-auto shrink-0 text-fan-tag font-semibold text-fan-primary"
      >
        {completed ? 'Results' : 'Vote'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────────────────────
function MessageBubble({
  message,
  isMe,
  onLongPress,
}: {
  message: ChatMessage;
  isMe: boolean;
  onLongPress: () => void;
}) {
  const isCommentary = message.isCommentary;
  const effectiveIsMe = isCommentary ? false : isMe;
  const hasMedia = !!(message.imageUrl || message.videoUrl);

  return (
    <div className="flex flex-col">
      {!effectiveIsMe && (
        <p
          className={`mb-[2px] text-left text-fan-tag font-semibold ${isCommentary
              ? 'ml-[34px] flex items-center gap-[3px] text-fan-draw'
              : 'ml-[34px] text-fan-primary'
            }`}
        >
          {isCommentary && <span>⚽</span>}
          {message.username}
        </p>
      )}

      <div
        className={`flex items-end gap-fan-xs ${effectiveIsMe ? 'justify-end' : 'justify-start'
          }`}
      >
        {!effectiveIsMe && (
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isCommentary ? 'bg-fan-draw/10' : 'bg-fan-primaryDim'
              }`}
          >
            {isCommentary ? (
              <span className="text-[12px]">⚽</span>
            ) : (
              <span className="text-fan-tag font-semibold text-fan-primary">
                {message.username[0]?.toUpperCase()}
              </span>
            )}
          </div>
        )}

        <button
          onContextMenu={(e) => {
            e.preventDefault();
            onLongPress();
          }}
          onDoubleClick={onLongPress}
          className={`max-w-[78%] rounded-fan-lg px-fan-sm py-fan-xs text-left ${isCommentary
              ? 'border-[0.5px] border-fan-draw/20 bg-fan-draw/[0.08]'
              : effectiveIsMe
                ? 'bg-fan-primaryDim'
                : 'bg-fan-surface'
            } ${message.isPending ? 'opacity-60' : ''}`}
        >
          {message.replyTo && (
            <div
              className={`mb-[3px] border-l-2 pl-fan-sm ${message.replyTo.username.toLowerCase().includes('commentary')
                  ? 'border-fan-draw/40'
                  : 'border-fan-primary/40'
                }`}
            >
              <p className="text-fan-tag font-semibold text-fan-primary">
                ↳ {message.replyTo.isMe ? 'You' : message.replyTo.username}
              </p>
              <p className="truncate text-fan-tag italic text-fan-textTertiary">
                {message.replyTo.text}
              </p>
            </div>
          )}

          {hasMedia && message.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.imageUrl}
              alt=""
              className="mb-fan-xs max-h-56 w-full rounded-fan-md object-cover"
            />
          )}
          {hasMedia && message.videoUrl && !message.imageUrl && (
            <div className="mb-fan-xs flex h-40 items-center justify-center rounded-fan-md bg-fan-surfaceSunken">
              <span className="text-fan-tag text-fan-textTertiary">
                🎥 Video
              </span>
            </div>
          )}

          {message.text && (
            <p
              className={`text-fan-caption text-fan-textPrimary ${isCommentary ? 'italic' : ''
                }`}
            >
              {message.text}
            </p>
          )}

          <p className="mt-[2px] text-right text-fan-tag text-fan-textTertiary">
            {timeAgo(message.timestamp)}
          </p>
        </button>
      </div>
    </div>
  );
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
function VoteStrip({
  fixture, userId, onQuickVote, onPressTotals,
}: {
  fixture: Fixture;
  userId: string | null;
  onQuickVote: (selection: 'home_team' | 'away_team' | 'draw') => void;
  onPressTotals: () => void;
}) {
  const voters = fixture.voters ?? [];
  const home = voters.filter((v) => v.selection === 'home_team').length;
  const draw = voters.filter((v) => v.selection === 'draw').length;
  const away = voters.filter((v) => v.selection === 'away_team').length;
  const total = home + draw + away;
  if (!total) return <div className="mx-fan-sm mb-fan-xs flex gap-fan-xs rounded-fan-md bg-fan-surface p-fan-xs">
    {([['home_team', fixture.homeTeam], ['draw', 'Draw'], ['away_team', fixture.awayTeam]] as const).map(([sel,label]) => <button key={sel} disabled={voters.some(v => v.userId === userId)} onClick={() => onQuickVote(sel)} className="flex-1 truncate rounded-fan-pill bg-fan-surfaceSunken px-fan-sm py-fan-xs text-fan-tag text-fan-textSecondary">{label}</button>)}
  </div>;
  return <button onClick={onPressTotals} className="mx-fan-sm mb-fan-xs flex h-10 w-[calc(100%-1rem)] gap-1 rounded-fan-md bg-fan-surface p-fan-xs">
    <span style={{flex: Math.max(home,.001)}} className="rounded-fan-pill bg-fan-primary" />
    <span style={{flex: Math.max(draw,.001)}} className="rounded-fan-pill bg-fan-draw" />
    <span style={{flex: Math.max(away,.001)}} className="rounded-fan-pill bg-fan-away" />
    <span className="px-fan-xs text-fan-tag text-fan-textPrimary">{total}</span>
  </button>;
}

function VotersPanel({ fixtureId, userId }: { fixtureId: string; userId: string | null }) {
  const [voters, setVoters] = useState<{userId:string; username:string; selection:string}[]>([]);
  useEffect(() => { let cancelled=false; fetchVoters(fixtureId).then((v:any) => { if (!cancelled && Array.isArray(v)) setVoters(v); }); return () => { cancelled=true; }; }, [fixtureId]);
  return <div className="mx-fan-sm mb-fan-xs rounded-fan-md bg-fan-surface p-fan-sm">
    <div className="mb-fan-xs flex justify-between text-fan-body text-fan-textPrimary"><span>Votes ({voters.length})</span></div>
    {voters.length === 0 ? <p className="text-fan-caption text-fan-textTertiary">No votes yet</p> : voters.map(v => <div key={v.userId} className="flex justify-between py-1 text-fan-caption"><span className="text-fan-textPrimary">{v.userId === userId ? 'You' : v.username}</span><span className="text-fan-textTertiary">{v.selection}</span></div>)}
  </div>;
}

