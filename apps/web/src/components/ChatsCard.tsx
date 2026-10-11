import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Check, Heart, Lock, MessageCircle, Radio, Vote } from 'lucide-react';
import {
  type Fixture, hasScores, scoreDisplay, winner as fixtureWinner, outcomeColor, FAN_SPACING,
} from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '@/modals/Login-modal-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { ICON } from '@/theme/layout';
import { FeedItem } from './ui/FeedItem';
import { LiveBadge } from './ui/LiveBadge';
import { ActionButton } from './ui/ActionButton';
import { Input } from './ui/input';
import { VoterList } from './ui/Voterstack';

const FOOTER_BLEED = 12;
const COMMENT_STYLE_COLOR = (colors: ReturnType<typeof useFanColors>) => colors.textSecondary;
const EMPTY_VOTE_PROMPTS = ['Be the first to call it','Who takes this one?','Make your prediction','No calls yet, go first','Where do you stand?','Pick your winner','Be the first to pick'];

export interface ChannelHeaderData {
  id?: string;
  name: string;
  imageUrl?: string | null;
  leaderName?: string | null;
  leaderPoints?: number | null;
  unreadCount?: number;
}
export interface LatestComment { username: string; comment: string; }
export interface LiveCommentaryEntry { text: string; minute: number; timestamp?: string; }

function kickoffLabel(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'TBD';
  const mins = Math.round((date.getTime() - Date.now()) / 60000);
  if (mins > 0 && mins < 60) return `in ${mins}m`;
  if (mins >= 60 && mins < 24 * 60) return `in ${Math.round(mins / 60)}h`;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function pickKind(selection: string): 'home' | 'away' | 'draw' {
  if (selection === 'home_team') return 'home';
  if (selection === 'away_team') return 'away';
  return 'draw';
}

export function MatchCard({ fixture, channel, comments, latestComment, liveCommentary, commentsCount, likesCount = 0, liked = false, onOpenVoteModal, onOpenResults, onChatClick, onLike, onSubmitComment, onOpenLineups }: {
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
  const [seed] = useState(() => Math.random());
  const pool = comments?.length ? comments : latestComment ? [latestComment] : [];
  const preview = pool.length ? pool[Math.floor(seed * pool.length)] : null;
  const [emptyPrompt] = useState(() => EMPTY_VOTE_PROMPTS[Math.floor(Math.random() * EMPTY_VOTE_PROMPTS.length)]);
  const isLive = !!fixture.isLive || fixture.status === 'live';
  const isCompleted = fixture.status === 'completed' || fixture.status === 'finished';
  const voters = fixture.voters ?? [];
  const hasVoted = voters.some((v) => v.userId === userId);
  const voterItems = useMemo(() => voters.slice(0, 3).map((v) => {
    const kind = pickKind(v.selection);
    return { id: v.userId, name: v.userName, team: kind === 'home' ? fixture.homeTeam : kind === 'away' ? fixture.awayTeam : 'Draw', color: outcomeColor(kind, colors) };
  }), [voters, fixture.homeTeam, fixture.awayTeam, colors]);
  const fixtureLabel = `${fixture.homeTeam} vs ${fixture.awayTeam}`;
  const captionLabel = `${fixture.homeTeam} ${hasScores(fixture) ? scoreDisplay(fixture) : 'vs'} ${fixture.awayTeam}`;
  const canComment = !!isLoggedIn && (isCompleted || hasVoted);
  function handleChat() { if (!isLoggedIn) return requireLogin(handleChat); onChatClick?.(fixture); }
  function handleVote() { if (!isLoggedIn) return requireLogin(handleVote); if (isCompleted) onOpenResults?.(fixture); else onOpenVoteModal?.(fixture); }
  function handleLike() { if (!isLoggedIn) return requireLogin(handleLike); onLike?.(fixture); }
  function handleLineups() { if (!isLoggedIn) return requireLogin(handleLineups); onOpenLineups?.(fixture); }
  function handleSubmit() {
    if (!isLoggedIn) return requireLogin(handleSubmit);
    const text = draft.trim();
    if (!text || !canComment) return;
    onSubmitComment?.(fixture, text);
    setDraft('');
  }
  const placeholder = !isLoggedIn ? 'Log in to comment' : canComment ? 'Add a comment…' : 'Vote to comment';
  const line: CSSProperties = { display: 'flex', alignItems: 'center', gap: FAN_SPACING.sm };
  const bottom: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: FAN_SPACING.sm, marginTop: 18, marginBottom: -FOOTER_BLEED };
  return <FeedItem colors={colors}>
    <div className="match-card" style={{ position: 'relative' }}>
      <button type="button" onClick={handleChat} aria-label={`Open chat for ${fixtureLabel}`} className="match-card-open" style={{ position: 'absolute', inset: 0, zIndex: 0, width: '100%', height: '100%', padding: 0, border: 0, background: 'transparent' }} />
      <div style={{ position: 'relative', zIndex: 1, pointerEvents: 'none' }}>
        <div style={{ ...line, justifyContent: 'space-between', marginBottom: 16 }}>
          {channel ? <div style={{ ...line, flex: 1, minWidth: 0 }}>
            <span style={{ width: 24, height: 24, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surfaceSunken, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {channel.imageUrl && failedUri !== channel.imageUrl ? <img src={channel.imageUrl} alt="" onError={() => setFailedUri(channel.imageUrl ?? null)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={fanText('tag', colors, colors.primary)}>{(channel.name || '?').charAt(0).toUpperCase()}</span>}
            </span>
            <span style={{ ...fanText('competition', colors, '#FFFFFF'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{channel.name}</span>
          </div> : <span style={{ ...fanText('competition', colors, '#FFFFFF'), flex: 1 }}>{fixture.league || 'Unknown league'}</span>}
          {isLive ? <LiveBadge colors={colors} /> : <span style={fanText('tag', colors, colors.textTertiary)}>{kickoffLabel(fixture.date)}</span>}
        </div>
        <div style={{ ...line, marginBottom: 0 }}>
          {isLive && liveCommentary ? <><Radio size={ICON.sm} color={colors.live} /><span style={{ ...fanText('caption', colors, COMMENT_STYLE_COLOR(colors)), flex: 1 }}>{liveCommentary.text}</span><span style={fanText('tag', colors, colors.textTertiary)}>{liveCommentary.minute}&apos;</span></> : <><MessageCircle size={ICON.sm} color={colors.textTertiary} /><span style={{ ...fanText('caption', colors, COMMENT_STYLE_COLOR(colors)), flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview ? `${preview.username}: ${preview.comment}` : 'Be the first to comment on this match'}</span></>}
        </div>
        {isCompleted ? <div style={{ marginTop: 10 }}><span style={fanText('caption', colors, COMMENT_STYLE_COLOR(colors))}>Winner: {fixtureWinner(fixture)}</span></div> : hasVoted ? <div style={{ ...line, marginTop: 10 }}><Check size={ICON.sm} color={colors.primary} /><span style={fanText('caption', colors, COMMENT_STYLE_COLOR(colors))}>Vote recorded</span></div> : null}
        <div style={{ marginTop: 14 }}><VoterList colors={colors} voters={voterItems} emptyLabel={isCompleted ? 'No votes were cast' : emptyPrompt} /></div>
      </div>
      <div style={{ ...bottom, position: 'relative', zIndex: 2 }}>
        <div style={{ ...line, gap: FAN_SPACING.base }}>
          <ActionButton icon={Vote} label={isCompleted ? 'Results' : 'Vote'} count={fixture.votes} colors={colors} onPress={handleVote} />
          <ActionButton icon={Heart} label={liked ? 'Unlike' : 'Like'} count={likesCount} active={liked} activeColor={colors.away} colors={colors} onPress={handleLike} />
          <ActionButton icon={MessageCircle} label="Comments" count={commentsCount ?? pool.length} colors={colors} onPress={handleChat} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: FAN_SPACING.sm }}>
          {!canComment && <Lock size={ICON.sm} color={colors.textTertiary} />}
          <Input colors={colors} variant="inline" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!canComment} placeholder={placeholder} aria-label={placeholder} onKeyDown={(event) => { if (event.key === 'Enter') handleSubmit(); }} />
        </div>
        <button type="button" onClick={handleLineups} aria-label={`Open match details: ${fixtureLabel}`} style={{ flexShrink: 0, maxWidth: '40%', minHeight: 32, border: 0, background: 'transparent', cursor: 'pointer', ...fanText('tag', colors, colors.textTertiary), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{captionLabel}</button>
      </div>
    </div>
  </FeedItem>;
}
