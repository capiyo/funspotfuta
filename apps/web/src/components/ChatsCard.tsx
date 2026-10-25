// components/MatchCard.tsx
//
// Same design as HistoryCard, row for row:
//
//   league / channel (white)                          date <- or LiveBadge
//   [icon] one random comment / live commentary
//   Winner: Home   |   voter avatars, usernames and selected teams
//   (A) Kim      (B) Otieno
//   Vote  heart  comment  | Add a comment… | Arsenal 2 : 1 Chelsea
//   ^ one line, flush with the card floor; "vs" instead of the score
//     before kickoff
//
// TAP MODEL:
//   - Vote / Results button  -> vote modal (only vote entry)
//   - Like button            -> like handler
//   - Home vs Away caption   -> MatchDetailsModal (onOpenLineups)
//   - Comment box            -> real, login-gated; on a match that isn't
//                               finished you must have voted first
//   - EVERYTHING ELSE        -> open Chat
//
// STRUCTURE PRESERVED: same props, same callbacks, same login gates.
// channel is optional; when given, a small avatar + channel name replaces
// the league label in the top-left. Without it the card shows the league.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ChangeEvent, CSSProperties, KeyboardEvent } from 'react';
import {
  Heart,
  Lock,
  MessageCircle,
  Pointer,
  Radio,
  Vote,
} from 'lucide-react';
import {
  type Fixture,
  type Poke,
  getOpenPokes,
  queryKeys,
  hasScores,
  winner as fixtureWinner,
  outcomeColor,
  FAN_SPACING,
} from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '@/modals/Login-modal-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { ICON, PRESSED_OPACITY } from '@/theme/layout';
import { FeedItem } from './ui/FeedItem';
import { LiveBadge } from './ui/LiveBadge';
import { ActionButton } from './ui/ActionButton';
import { Input } from './ui/input';
import { VoterList } from './ui/Voterstack';
import { useTeamLogo } from '@/hooks/useTeamLogo';

const COMMENT_STYLE_COLOR = (colors: ReturnType<typeof useFanColors>) =>
  colors.textSecondary;

const EMPTY_VOTE_PROMPTS = [
  'Be the first to call it',
  'Who takes this one?',
  'Make your prediction',
  'No calls yet, go first',
  'Where do you stand?',
  'Pick your winner',
  'Be the first to pick',
];

export interface ChannelHeaderData {
  id?: string;
  name: string;
  imageUrl?: string | null;
  leaderName?: string | null;
  leaderPoints?: number | null;
  unreadCount?: number;
}

export interface LatestComment {
  username: string;
  comment: string;
}

export interface LiveCommentaryEntry {
  text: string;
  minute: number;
  timestamp?: string;
}

function TeamLogo({ name, url, colors }: { name: string; url: string | null; colors: ReturnType<typeof useFanColors> }) {
  const [failed, setFailed] = useState(false);
  const showFallback = !url || failed;
  return <span className="match-card-team-logo" aria-label={`${name} logo`} style={{ display: 'inline-flex', flex: '0 0 16px', width: 16, height: 16, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', borderRadius: '50%', border: 0, background: colors.primaryDim, color: colors.primary, fontSize: 9, fontWeight: 700 }}>
    <img className="match-card-team-logo-image" src={url ?? undefined} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} style={{ display: showFallback ? 'none' : 'block', position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
    <span className="match-card-team-fallback" style={{ display: showFallback ? 'inline' : 'none' }}>{name.trim().charAt(0).toUpperCase() || '?'}</span>
  </span>;
}
function kickoffLabel(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'TBD';
  const mins = Math.round((date.getTime() - Date.now()) / 60000);
  if (mins > 0 && mins < 60) return `in ${mins}m`;
  if (mins >= 60 && mins < 24 * 60) return `in ${Math.round(mins / 60)}h`;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizePick(selection: string): string {
  return selection.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function pickKind(selection: string): 'home' | 'away' | 'draw' | 'unknown' {
  const value = normalizePick(selection);
  if (['home_team', 'home', 'hometeam', '1', 'team1', 'home_side'].includes(value) || /(^|\W)home(\W|$)/.test(value)) return 'home';
  if (['away_team', 'away', 'awayteam', '2', 'team2', 'away_side'].includes(value) || /(^|\W)away(\W|$)/.test(value)) return 'away';
  if (['draw', 'tie', 'x', 'level', 'drawn'].includes(value) || /(^|\W)(draw|tie)(\W|$)/.test(value)) return 'draw';
  return 'unknown';
}

export function MatchCard({
  fixture,
  channel,
  channelId,
  comments,
  latestComment,
  liveCommentary,
  commentsCount,
  likesCount = 0,
  liked = false,
  onOpenVoteModal,
  onOpenPokeModal,
  onOpenResults,
  onChatClick,
  onChannelPress,
  onChannelLongPress,
  onWeeklyLeaderboardPress,
  onLike,
  onSubmitComment,
  onOpenLineups,
}: {
  fixture: Fixture;
  channel?: ChannelHeaderData;
  channelId?: string;
  comments?: LatestComment[];
  latestComment?: LatestComment;
  liveCommentary?: LiveCommentaryEntry;
  commentsCount?: number;
  likesCount?: number;
  liked?: boolean;
  onOpen?: (fixture: Fixture) => void;
  onOpenVoteModal?: (fixture: Fixture) => void;
  onOpenPokeModal?: (fixture: Fixture) => void;
  onOpenResults?: (fixture: Fixture) => void;
  onChatClick?: (fixture: Fixture) => void;
  onChannelPress?: () => void;
  onChannelLongPress?: () => void;
  onWeeklyLeaderboardPress?: () => void;
  onLike?: (fixture: Fixture) => void;
  onSubmitComment?: (fixture: Fixture, text: string) => void;
  onOpenLineups?: (fixture: Fixture) => void;
}) {
  const colors = useFanColors();
  const { userId, isLoggedIn, authToken } = useAuth();
  const { requireLogin } = useLoginModal();
  const [draft, setDraft] = useState('');
  const [openPokes, setOpenPokes] = useState<Poke[]>([]);
  const pokeCacheKeyRef = useRef('');
  const queryClient = useQueryClient();
  useEffect(() => {
    let active = true;
    const fixtureId = String(fixture.matchId || fixture.id);
    if (!channelId || !fixtureId) {
      // Channel data can be temporarily unavailable during startup or a carousel
      // transition. Do not erase a previously hydrated poke list for that gap.
      return () => { active = false; };
    }
    const cacheKey = queryKeys.openPokes(fixtureId, channelId);
    // Hydrate the visible list first; never make the UI wait for HTTP.
    const cached = queryClient.getQueryData<Poke[]>(cacheKey);
    const cacheIdentity = JSON.stringify(cacheKey);
    if (pokeCacheKeyRef.current !== cacheIdentity) {
      // Do not leak one fixture/channel's pokes into another card, but do not
      // clear the same card merely because its effect re-runs during a status
      // or authentication transition.
      pokeCacheKeyRef.current = cacheIdentity;
      setOpenPokes(cached ?? []);
    } else if (cached?.length) {
      setOpenPokes(cached);
    }

    // Subscribe to shared cache updates from poke actions/screens. ChatsScreen
    // invalidates openPokes when the user scrolls back to the top.
    let refresh = () => {};
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!active) return;
      const latest = queryClient.getQueryData<Poke[]>(cacheKey);
      if (latest?.length) setOpenPokes(latest);
      // Only this card's cache invalidation should trigger its HTTP request.
      // Matching just the first key segment made every card refetch for every
      // other fixture, creating a burst of racing requests and stale responses.
      if (event.type === 'updated' && event.action.type === 'invalidate') {
        const eventKey = event.query.queryKey;
        if (eventKey[0] === cacheKey[0]
          && eventKey[1] === cacheKey[1]
          && eventKey[2] === cacheKey[2]
          && (eventKey[3] ?? 'main_fixture') === (cacheKey[3] ?? 'main_fixture')) {
          refresh();
        }
      }
    });

    refresh = () => {
      // Keep the last-known list for live fixtures; don't request a list that
      // may be empty after the fixture has moved into play.
      if (fixture.isLive || fixture.status?.toLowerCase() === 'live') return;
      void getOpenPokes(fixtureId, authToken || undefined, channelId)
        .then((items) => {
          if (!active) return;
          const next = items
            .filter((item) => item.status.trim().toLowerCase() === 'open')
            .sort((a, b) => (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0));
          const previous = queryClient.getQueryData<Poke[]>(cacheKey) ?? [];
          // GET can return a partial/stale list while a newly-created poke is
          // already confirmed and cached. Merge by ID instead of replacing the
          // visible list with that incomplete response.
          const merged = new Map<string, Poke>();
          for (const poke of previous) {
            if (poke.id && poke.status.trim().toLowerCase() === 'open') merged.set(String(poke.id), poke);
          }
          for (const poke of next) {
            if (poke.id) merged.set(String(poke.id), poke);
          }
          const stable = [...merged.values()].sort(
            (a, b) => (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0),
          );
          queryClient.setQueryData<Poke[]>(cacheKey, stable);
          setOpenPokes(stable);
        })
        .catch(() => {
          // HTTP/network errors must leave the last successful cache/UI intact.
        });
    };
    void refresh();
    const interval = window.setInterval(refresh, 2 * 60 * 1000);
    return () => { active = false; unsubscribe(); window.clearInterval(interval); };
  }, [authToken, channelId, fixture.id, fixture.matchId, fixture.isLive, fixture.status, queryClient]);
  const channelPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longChannelPressFired = useRef(false);
  function startChannelPress() {
    longChannelPressFired.current = false;
    if (channelPressTimer.current) clearTimeout(channelPressTimer.current);
    channelPressTimer.current = setTimeout(() => {
      longChannelPressFired.current = true;
      onChannelLongPress?.();
    }, 500);
  }
  function endChannelPress() {
    if (channelPressTimer.current) clearTimeout(channelPressTimer.current);
    channelPressTimer.current = null;
  }
  function handleChannelPress() {
    if (longChannelPressFired.current) {
      longChannelPressFired.current = false;
      return;
    }
    onChannelPress?.();
  }
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const homeLogo = useTeamLogo(fixture.homeTeam, fixture as unknown as Record<string, unknown>, 'home');
  const awayLogo = useTeamLogo(fixture.awayTeam, fixture as unknown as Record<string, unknown>, 'away');

  // Random pick, fixed for this card's lifetime.
  const [seed] = useState(() => Math.random());
  const pool = comments?.length
    ? comments
    : latestComment
      ? [latestComment]
      : [];
  const preview = pool.length ? pool[Math.floor(seed * pool.length)] : null;

  const [emptyPrompt] = useState(
    () =>
      EMPTY_VOTE_PROMPTS[
        Math.floor(Math.random() * EMPTY_VOTE_PROMPTS.length)
      ],
  );

  const isLive = !!fixture.isLive || fixture.status === 'live';
  const isCompleted =
    fixture.status === 'completed' || fixture.status === 'finished';
  const voters = fixture.voters ?? [];
  const hasVoted = voters.some((voter) => voter.userId === userId);

  const voterItems = useMemo(
    () =>
      voters.slice(0, 3).map((voter) => {
        const kind = pickKind(voter.selection);
        return {
          id: voter.userId,
          name: voter.userName,
          uri: voter.uri ?? null,
          team:
            kind === 'home'
              ? fixture.homeTeam
              : kind === 'away'
                ? fixture.awayTeam
                : kind === 'draw'
                  ? 'Draw'
                  : voter.selection || 'Vote recorded',
          color: kind === 'unknown' ? colors.textTertiary : outcomeColor(kind, colors),
        };
      }),
    [voters, fixture.homeTeam, fixture.awayTeam, colors],
  );

  const pokeItems = useMemo(() => openPokes.map((poke) => ({
    id: `poke:${poke.id}`,
    name: poke.userName || 'Fan',
    uri: null,
    team: poke.selection === 'home' ? fixture.homeTeam : fixture.awayTeam,
    color: outcomeColor(poke.selection === 'home' ? 'home' : 'away', colors),
  })), [openPokes, fixture.homeTeam, fixture.awayTeam, colors]);
  // Pokes take priority. If fewer than three are open, fill the strip with
  // voters, excluding anyone already represented by an open poke.
  const priorityItems = useMemo(() => {
    const selectedPokes = pokeItems.slice(0, 3);
    const pokeUserIds = new Set(openPokes.slice(0, 3).map((poke) => poke.userId));
    return [...selectedPokes, ...voterItems.filter((voter) => !pokeUserIds.has(voter.id))]
      .slice(0, 3);
  }, [pokeItems, openPokes, voterItems]);
  const fixtureLabel = `${fixture.homeTeam} vs ${fixture.awayTeam}`;
  // Teams with the score between them, or "vs" before kickoff.
  const scoreLabel = hasScores(fixture) ? `${fixture.homeScore} : ${fixture.awayScore}` : 'vs';
  const canComment = !!isLoggedIn && (isCompleted || hasVoted);

  function handleChat() {
    if (!isLoggedIn) return requireLogin(handleChat);
    onChatClick?.(fixture);
  }

  function handleVote() {
    if (isLive) return;
    if (!isLoggedIn) return requireLogin(handleVote);
    if (isCompleted) onOpenResults?.(fixture);
    else onOpenVoteModal?.(fixture);
  }

  function handleLike() {
    if (!isLoggedIn) return requireLogin(handleLike);
    onLike?.(fixture);
  }

  function handleLineups() {
    if (!isLoggedIn) return requireLogin(handleLineups);
    onOpenLineups?.(fixture);
  }

  function handleSubmit() {
    if (!isLoggedIn) return requireLogin(handleSubmit);
    const text = draft.trim();
    if (!text || !canComment) return;
    onSubmitComment?.(fixture, text);
    setDraft('');
  }

  function handleCommentKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  }

  // Collapse action counts and team names as soon as the user enters text.
  // Clearing the draft after a successful send restores the full card footer.
  const isTyping = draft.length > 0;

  const placeholder = !isLoggedIn
    ? 'Log in to comment'
    : canComment
      ? 'Add a comment…'
      : 'Vote to comment';

  const styles: Record<string, CSSProperties> = {
    card: { position: 'relative', cursor: 'pointer' },
    openTarget: {
      position: 'absolute',
      inset: 0,
      zIndex: 0,
      width: '100%',
      height: '100%',
      padding: 0,
      border: 0,
      background: 'transparent',
      cursor: 'pointer',
    },
    content: {
      position: 'relative',
      zIndex: 1,
      pointerEvents: 'none',
      padding: '12px var(--match-card-horizontal-padding) 0',
    },
    lineRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
    },
    grow: { flex: 1, minWidth: 0 },
    metaRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: FAN_SPACING.sm,
      marginBottom: 0,
      minHeight: 24,
      position: 'relative',
      zIndex: 2,
    },
    channelLabel: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      flex: 1,
      minWidth: 0,
    },
    channelAvatar: {
      width: 24,
      height: 24,
      borderRadius: '50%',
      border: 0,
      background: colors.primaryDim,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0,
    },
    channelAvatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      objectFit: 'cover',
      display: 'block',
    },
    channelName: {
      ...fanText('competition', colors, colors.textPrimary),
      fontSize: 14,
      fontWeight: 600,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    leagueName: {
      ...fanText('competition', colors, colors.textTertiary),
      fontSize: 12,
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    date: { ...fanText('tag', colors, colors.textTertiary), fontSize: 11, lineHeight: 1.25 },
    secondaryRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: FAN_SPACING.sm,
      width: '100%', padding: 0, marginBottom: 3, textAlign: 'left', background: colors.background,
      color: colors.textSecondary, cursor: 'pointer', fontSize: 11, lineHeight: 1.25,
    },
    secondaryText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    previewRow: { marginTop: 8, marginBottom: 0 },
    previewText: {
      ...fanText('caption', colors, COMMENT_STYLE_COLOR(colors)),
      fontSize: 13,
      lineHeight: 1.25,
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    minute: fanText('tag', colors, colors.textTertiary),
    resultRow: { marginTop: 3 },
    resultText: fanText('caption', colors, COMMENT_STYLE_COLOR(colors)),
    stackRow: { marginTop: 3 },
    bottomRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      rowGap: 6,
      flexWrap: 'wrap',
      minHeight: 'var(--match-card-action-min-height)',
      marginTop: 10,
      padding: '0 var(--match-card-horizontal-padding) 6px',
      position: 'relative',
      zIndex: 2,
    },
    actions: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'nowrap',
    },
    inputCell: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
    },
    guestCommentPrompt: {
      ...fanText('caption', colors, colors.textSecondary),
      fontSize: 12,
      lineHeight: 1.25,
      flex: '1 1 auto',
      minWidth: 0,
      padding: 0,
      textAlign: 'left',
      whiteSpace: 'nowrap',
      background: colors.background,
      cursor: 'pointer',
    },
    input: {
      flex: 1,
      minWidth: 0,
      border: 0,
      background: 'transparent',
    },
  };

  return (
    <FeedItem colors={colors}>
      <div className="match-card" style={{ ...styles.card, lineHeight: 1.25, '--match-primary': colors.primary, '--match-primary-dim': colors.primaryDim } as CSSProperties}>
        {/* Layer 1 — invisible full-card tap target -> Chat */}
        <button
          type="button"
          onClick={handleChat}
          aria-label={`Open chat for ${fixtureLabel}`}
          className="match-card-open"
          style={styles.openTarget}
        />

        {/* Layer 2 — content */}
        <div className="match-card-content" style={styles.content}>
          {/* Meta: league or channel on the left, date / live on the right */}
          <div className="match-card-meta" style={styles.metaRow}>
            {channel ? (
              <button
                type="button"
                className="match-card-channel-label"
                style={{ ...styles.channelLabel, border: 0, padding: 0, background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer', position: 'relative', zIndex: 3, pointerEvents: 'auto' }}
                aria-label={`Open ${channel.name} leaderboard; long press for chat`}
                onClick={handleChannelPress}
                onPointerDown={startChannelPress}
                onPointerUp={endChannelPress}
                onPointerLeave={endChannelPress}
                onPointerCancel={endChannelPress}
                onContextMenu={(event) => { event.preventDefault(); longChannelPressFired.current = true; endChannelPress(); onChannelLongPress?.(); }}
              >
                <span className="match-card-channel-avatar" style={styles.channelAvatar}>
                  {channel.imageUrl && failedUri !== channel.imageUrl ? (
                    <img
                      src={channel.imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => setFailedUri(channel.imageUrl ?? null)}
                      style={styles.channelAvatarImage}
                    />
                  ) : (
                    <span style={fanText('tag', colors, colors.primary)}>
                      {(channel.name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="match-card-channel-name" style={styles.channelName}>{channel.name}</span>
              </button>
            ) : null}

            {isLive ? (
              <LiveBadge colors={colors} />
            ) : (
              <span className="match-card-date" style={styles.date}>{kickoffLabel(fixture.date)}</span>
            )}
          </div>

          {channel?.leaderName && (
            <button
              type="button"
              className="match-card-weekly-leader"
              onClick={onWeeklyLeaderboardPress}
              aria-label={`Open weekly leaderboard for ${channel.name}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', border: 0, padding: '3px 0', background: 'transparent', textAlign: 'left', cursor: 'pointer', position: 'relative', zIndex: 3, pointerEvents: 'auto' }}
            >
              <span style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Leader: {channel.leaderName}</span>
              <span style={{ color: colors.primary, fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{(channel.leaderPoints ?? 0).toLocaleString()} pts</span>
            </button>
          )}
          <div className="match-card-league-line" style={{ ...styles.leagueName, marginTop: 2, marginBottom: 0 }}>{fixture.league || 'Unknown league'}</div>

          {/* Comment preview / live commentary */}
          <div className="match-card-comment-preview" style={{ ...styles.lineRow, ...styles.previewRow }}>
            {isLive && liveCommentary ? (
              <>
                <Radio size={ICON.sm} color={colors.live} />
                <span className="match-card-preview-text" style={styles.previewText}>{liveCommentary.text}</span>
                <span style={styles.minute}>{liveCommentary.minute}&apos;</span>
              </>
            ) : (
              <>
                <MessageCircle size={ICON.sm} color={colors.textTertiary} />
                <span className="match-card-preview-text" style={styles.previewText}>
                  {preview
                    ? `${preview.username}: ${preview.comment}`
                    : 'Be the first to comment on this match'}
                </span>
              </>
            )}
          </div>

          {/* Match result only when complete; voting status is represented by the voter list. */}
          {isCompleted && (
            <div style={{ ...styles.resultRow }}>
              <span style={styles.resultText}>
                Winner: {fixtureWinner(fixture)}
              </span>
            </div>
          )}

          {/* Same voter row as native: circular avatar/initials, username, selected team. */}
          <div className="match-card-voter-stack" style={styles.stackRow}>
            <VoterList
              colors={colors}
              voters={priorityItems}
              emptyLabel={isCompleted ? 'No votes were cast' : emptyPrompt}
            />
          </div>
        </div>

        {/* Footer top row: comment input left, fixture teams right. */}
        <div className="match-card-bottom" style={{ ...styles.bottomRow, flexDirection: 'column', alignItems: 'stretch', flexWrap: 'nowrap', gap: 8, marginTop: 14, paddingBottom: 10 }}>
          <div className="match-card-footer-top" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0, width: '100%' }}>
            <div className="match-card-input-cell" style={{ ...styles.inputCell, flex: '1 1 0%', minWidth: 0 }}>
              {!isLoggedIn ? (
                <button type="button" onClick={handleSubmit} aria-label="Log in to comment" className="match-card-guest-comment-prompt" style={styles.guestCommentPrompt}>Log in to comment</button>
              ) : (
                <>
                  {!canComment && <Lock size={ICON.sm} color={colors.textTertiary} />}
                  <Input
                    colors={colors}
                    variant="inline"
                    value={draft}
                    onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value)}
                    disabled={!canComment}
                    placeholder={placeholder}
                    aria-label={placeholder}
                    onKeyDown={handleCommentKeyDown}
                    style={styles.input}
                  />
                  {isTyping && <button type="button" onClick={handleSubmit} disabled={!canComment} aria-label="Send comment" title="Send comment" style={{ flex: '0 0 auto', padding: '2px 0', border: 0, borderRadius: 0, background: 'transparent', color: canComment ? colors.primary : colors.textTertiary, font: 'inherit', fontSize: 12, fontWeight: 600, cursor: canComment ? 'pointer' : 'not-allowed' }}>Send</button>}
                </>
              )}
            </div>
            <button type="button" className="match-card-teams" onClick={handleLineups} aria-label={`Open match details: ${fixtureLabel}`} style={{ display: 'flex', flex: '0 1 48%', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-end', gap: 4, minWidth: 0, maxWidth: '48%', marginLeft: 'auto', padding: 0, border: 0, background: 'transparent', color: colors.textPrimary, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <TeamLogo name={fixture.homeTeam} url={homeLogo} colors={colors} />
              <span className="match-card-team-name" style={{ display: 'block', flex: '0 1 auto', minWidth: 0, maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colors.textPrimary, fontSize: 12, fontWeight: 500 }}>{fixture.homeTeam}</span>
              <span className="match-card-score" style={{ display: 'block', flex: '0 0 auto', color: colors.textTertiary, fontSize: 12, fontWeight: 500 }}>{scoreLabel}</span>
              <span className="match-card-team-name" style={{ display: 'block', flex: '0 1 auto', minWidth: 0, maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colors.textPrimary, fontSize: 12, fontWeight: 500 }}>{fixture.awayTeam}</span>
              <TeamLogo name={fixture.awayTeam} url={awayLogo} colors={colors} />
            </button>
          </div>
          <div className="match-card-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', alignItems: 'center', gap: 4, width: '100%' }}>
            <div className="match-card-action-slot" style={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}><ActionButton icon={Vote} label={isLive ? 'Live' : isCompleted ? 'Results' : 'Vote'} count={fixture.votes} colors={colors} onPress={handleVote} /></div>
            <div className="match-card-action-slot" style={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}>
              <button type="button" className="match-card-poke" aria-label={isLive ? 'Poking unavailable for live matches' : 'Poke on this match'} disabled={isLive} onClick={() => { if (isLive) return; if (!isLoggedIn) return requireLogin(() => onOpenPokeModal?.(fixture)); onOpenPokeModal?.(fixture); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, minHeight: 28, padding: 0, border: 0, borderRadius: 0, background: 'transparent', color: colors.primary, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', opacity: isLive ? 0.45 : 1, cursor: isLive ? 'not-allowed' : 'pointer' }}>
                <span className="match-card-poke-circle" style={{ display: 'inline-flex', flex: '0 0 28px', width: 28, minWidth: 28, height: 28, boxSizing: 'border-box', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: colors.primaryDim, color: colors.primary }}><Pointer size={15} aria-hidden="true" /></span><span>Poke</span>
              </button>
            </div>
            <div className="match-card-action-slot" style={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}><ActionButton icon={Heart} label={liked ? 'Unlike' : 'Like'} count={likesCount} active={liked} activeColor={colors.away} colors={colors} onPress={handleLike} /></div>
            <div className="match-card-action-slot" style={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}><ActionButton icon={MessageCircle} label="Comments" count={commentsCount ?? pool.length} colors={colors} onPress={() => {}} /></div>
          </div>
        </div>
      </div>
    </FeedItem>
  );
}
