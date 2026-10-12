// components/MatchCard.tsx
//
// Same design as HistoryCard, row for row:
//
//   league / channel (white)                          date <- or LiveBadge
//   [icon] one random comment / live commentary
//   Winner: Home   |   Vote recorded
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

import { useMemo, useState } from 'react';
import type { ChangeEvent, CSSProperties, KeyboardEvent } from 'react';
import {
  Check,
  Heart,
  Lock,
  MessageCircle,
  Radio,
  Vote,
} from 'lucide-react';
import {
  type Fixture,
  hasScores,
  scoreDisplay,
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

function pickKind(selection: string): 'home' | 'away' | 'draw' {
  if (selection === 'home_team') return 'home';
  if (selection === 'away_team') return 'away';
  return 'draw';
}

export function MatchCard({
  fixture,
  channel,
  comments,
  latestComment,
  liveCommentary,
  commentsCount,
  likesCount = 0,
  liked = false,
  onOpenVoteModal,
  onOpenResults,
  onChatClick,
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
  onOpenResults?: (fixture: Fixture) => void;
  onChatClick?: (fixture: Fixture) => void;
  onLike?: (fixture: Fixture) => void;
  onSubmitComment?: (fixture: Fixture, text: string) => void;
  onOpenLineups?: (fixture: Fixture) => void;
}) {
  const colors = useFanColors();
  const { userId, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  const [draft, setDraft] = useState('');
  const [failedUri, setFailedUri] = useState<string | null>(null);

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
          team:
            kind === 'home'
              ? fixture.homeTeam
              : kind === 'away'
                ? fixture.awayTeam
                : 'Draw',
          color: outcomeColor(kind, colors),
        };
      }),
    [voters, fixture.homeTeam, fixture.awayTeam, colors],
  );

  const fixtureLabel = `${fixture.homeTeam} vs ${fixture.awayTeam}`;
  // Teams with the score between them, or "vs" before kickoff.
  const captionLabel = `${fixture.homeTeam} ${hasScores(fixture) ? scoreDisplay(fixture) : 'vs'} ${fixture.awayTeam}`;
  const canComment = !!isLoggedIn && (isCompleted || hasVoted);

  function handleChat() {
    if (!isLoggedIn) return requireLogin(handleChat);
    onChatClick?.(fixture);
  }

  function handleVote() {
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

  const placeholder = !isLoggedIn
    ? 'Log in to comment'
    : canComment
      ? 'Add a comment…'
      : 'Vote to comment';

  const styles: Record<string, CSSProperties> = {
    card: { position: 'relative' },
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
      marginBottom: 10,
      minHeight: 24,
      position: 'relative',
      zIndex: 2,
    },
    channelLabel: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
      flex: 1,
      minWidth: 0,
    },
    channelAvatar: {
      width: 24,
      height: 24,
      borderRadius: 0,
      border: 0,
      background: colors.background,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0,
    },
    channelAvatarImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    channelName: {
      ...fanText('competition', colors, colors.textPrimary),
      fontWeight: 'normal',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    leagueName: {
      ...fanText('competition', colors, '#FFFFFF'),
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    date: fanText('tag', colors, colors.textTertiary),
    secondaryRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: FAN_SPACING.sm,
      width: '100%', padding: 0, marginBottom: 8, textAlign: 'left', background: colors.background,
      color: colors.textSecondary, cursor: 'pointer', fontSize: 12,
    },
    secondaryText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    previewRow: { marginBottom: 0 },
    previewText: {
      ...fanText('caption', colors, COMMENT_STYLE_COLOR(colors)),
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    minute: fanText('tag', colors, colors.textTertiary),
    resultRow: { marginTop: 8 },
    resultText: fanText('caption', colors, COMMENT_STYLE_COLOR(colors)),
    stackRow: { marginTop: 10 },
    bottomRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
      marginTop: 12,
      position: 'relative',
      zIndex: 2,
    },
    actions: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.base,
    },
    inputCell: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
    },
    input: {
      flex: 1,
      minWidth: 0,
      border: 0,
      background: 'transparent',
    },
    captionButton: {
      flexShrink: 0,
      maxWidth: '40%',
      minHeight: 32,
      border: 0,
      background: 'transparent',
      cursor: 'pointer',
      padding: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      ...fanText('tag', colors, colors.textTertiary),
    },
  };

  return (
    <FeedItem colors={colors}>
      <div className="match-card" style={styles.card}>
        {/* Layer 1 — invisible full-card tap target -> Chat */}
        <button
          type="button"
          onClick={handleChat}
          aria-label={`Open chat for ${fixtureLabel}`}
          className="match-card-open"
          style={styles.openTarget}
        />

        {/* Layer 2 — content */}
        <div style={styles.content}>
          {/* Meta: league or channel on the left, date / live on the right */}
          <div style={styles.metaRow}>
            {channel ? (
              <div style={styles.channelLabel}>
                <span style={styles.channelAvatar}>
                  {channel.imageUrl && failedUri !== channel.imageUrl ? (
                    <img
                      src={channel.imageUrl}
                      alt=""
                      onError={() => setFailedUri(channel.imageUrl ?? null)}
                      style={styles.channelAvatarImage}
                    />
                  ) : (
                    <span style={fanText('tag', colors, colors.primary)}>
                      {(channel.name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <span style={styles.channelName}>{channel.name}</span>
              </div>
            ) : (
              <span style={styles.leagueName}>
                {fixture.league || 'Unknown league'}
              </span>
            )}

            {isLive ? (
              <LiveBadge colors={colors} />
            ) : (
              <span style={styles.date}>{kickoffLabel(fixture.date)}</span>
            )}
          </div>

          <button type="button" onClick={handleLineups} style={styles.secondaryRow}
            aria-label={`Open match details: ${fixtureLabel}`}>
            <span style={styles.secondaryText}>{fixture.league || 'Unknown league'}</span>
            <span style={styles.secondaryText}>{captionLabel}</span>
          </button>

          {/* Comment preview / live commentary */}
          <div style={{ ...styles.lineRow, ...styles.previewRow }}>
            {isLive && liveCommentary ? (
              <>
                <Radio size={ICON.sm} color={colors.live} />
                <span style={styles.previewText}>{liveCommentary.text}</span>
                <span style={styles.minute}>{liveCommentary.minute}&apos;</span>
              </>
            ) : (
              <>
                <MessageCircle size={ICON.sm} color={colors.textTertiary} />
                <span style={styles.previewText}>
                  {preview
                    ? `${preview.username}: ${preview.comment}`
                    : 'Be the first to comment on this match'}
                </span>
              </>
            )}
          </div>

          {/* Result / vote state */}
          {isCompleted ? (
            <div style={{ ...styles.resultRow }}>
              <span style={styles.resultText}>
                Winner: {fixtureWinner(fixture)}
              </span>
            </div>
          ) : hasVoted ? (
            <div style={{ ...styles.lineRow, ...styles.resultRow }}>
              <Check size={ICON.sm} color={colors.primary} />
              <span style={styles.resultText}>Vote recorded</span>
            </div>
          ) : null}

          {/* Voter stack */}
          <div style={styles.stackRow}>
            <VoterList
              colors={colors}
              voters={voterItems}
              emptyLabel={isCompleted ? 'No votes were cast' : emptyPrompt}
            />
          </div>
        </div>

        {/* One line: actions, comment box, teams + score */}
        <div style={styles.bottomRow}>
          <div style={styles.actions}>
            <ActionButton
              icon={Vote}
              label={isCompleted ? 'Results' : 'Vote'}
              count={fixture.votes}
              colors={colors}
              onPress={handleVote}
            />
            <ActionButton
              icon={Heart}
              label={liked ? 'Unlike' : 'Like'}
              count={likesCount}
              active={liked}
              activeColor={colors.away}
              colors={colors}
              onPress={handleLike}
            />
            <ActionButton
              icon={MessageCircle}
              label="Comments"
              count={commentsCount ?? pool.length}
              colors={colors}
              onPress={handleChat}
            />
          </div>

          {/* Middle: comment box */}
          <div style={styles.inputCell}>
            {!canComment && (
              <Lock size={ICON.sm} color={colors.textTertiary} />
            )}
            <Input
              colors={colors}
              variant="inline"
              value={draft}
              onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                setDraft(event.target.value)
              }
              disabled={!canComment}
              placeholder={placeholder}
              aria-label={placeholder}
              onKeyDown={handleCommentKeyDown}
              style={styles.input}
            />
          </div>


        </div>
      </div>
    </FeedItem>
  );
}
