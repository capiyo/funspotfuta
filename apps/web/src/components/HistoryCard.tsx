import { useState } from 'react';
import { Heart, Lock, MessageCircle, Vote } from 'lucide-react';
import { FAN_SPACING } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '@/modals/Login-modal-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { ICON, PRESSED_OPACITY } from '@/theme/layout';
import { FeedItem } from './ui/FeedItem';
import { ActionButton } from './ui/ActionButton';
import { Input } from './ui/input';
import { ScoreLine } from './ui/Scoreline';
import { VoterList } from './ui/Voterstack';

export interface VoterMini {
  id: string; name: string; role: 'voted' | 'commented' | 'pledged'; pick: string; pickKind: 'home' | 'away' | 'draw';
}
export interface HistoryComment { username: string; text: string }
export interface HistoryCardData {
  id: string; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; timeAgo: string;
  league?: string; people?: VoterMini[]; voteCount?: number; comments?: HistoryComment[];
  latestComment?: HistoryComment | null; commentCount?: number; likesCount?: number; liked?: boolean;
}
export function HistoryCard({ data, onOpenResults, onOpenChat, onLike, onSubmitComment }: {
  data: HistoryCardData; onOpenResults?: (id: string) => void; onOpenChat?: (id: string) => void;
  onLike?: (id: string) => void; onSubmitComment?: (id: string, text: string) => void;
}) {
  const colors = useFanColors();
  const { isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  const [draft, setDraft] = useState('');
  const { id, homeTeam, awayTeam, homeScore, awayScore, timeAgo, league, people = [], voteCount, comments, latestComment, commentCount, likesCount = 0, liked = false } = data;
  const [seed] = useState(() => Math.random());
  const pool = comments?.length ? comments : latestComment ? [latestComment] : [];
  const preview = pool.length ? pool[Math.floor(seed * pool.length)] : null;
  const homeWon = homeScore > awayScore, awayWon = awayScore > homeScore;
  const winnerName = homeWon ? homeTeam : awayWon ? awayTeam : 'Draw';
  const pickColor = (kind: VoterMini['pickKind']) => kind === 'home' ? colors.primary : kind === 'away' ? colors.away : colors.draw;
  function handleSubmit() {
    if (!isLoggedIn) return requireLogin(handleSubmit);
    const text = draft.trim();
    if (!text) return;
    onSubmitComment?.(id, text);
    setDraft('');
  }
  const grow = { flex: 1, minWidth: 0 } as const;
  return <FeedItem colors={colors}>
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 flex-1 truncate" style={fanText('competition', colors, '#FFFFFF')}>{league || 'Full time'}</span>
      <span style={fanText('tag', colors, colors.textTertiary)}>{timeAgo}</span>
    </div>
    <button type="button" onClick={() => onOpenChat?.(id)} className="w-full text-left" onMouseDown={(e) => { e.currentTarget.style.opacity = String(PRESSED_OPACITY); }} onMouseUp={(e) => { e.currentTarget.style.opacity = '1'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
      <ScoreLine colors={colors} crests homeTeam={homeTeam} awayTeam={awayTeam} center={`${homeScore} : ${awayScore}`} homeWon={homeWon} awayWon={awayWon} />
    </button>
    <div className="flex items-center gap-2">
      <MessageCircle size={ICON.sm} color={colors.textTertiary} />
      <span className="truncate" style={{ ...fanText('caption', colors, colors.textSecondary), ...grow }}>{preview ? `${preview.username}: ${preview.text}` : 'No comments on this match yet'}</span>
    </div>
    <p style={fanText('caption', colors, colors.textSecondary)}>Winner: {winnerName}</p>
    <VoterList colors={colors} emptyLabel="No votes were cast" voters={people.slice(0, 3).map((p) => ({ id: p.id, name: p.name, team: p.pick, color: pickColor(p.pickKind) }))} onPress={() => onOpenResults?.(id)} />
    <div className="flex items-center">
      <div className="flex flex-1 items-center gap-2">
        <ActionButton icon={Vote} label="Results" count={voteCount ?? people.length} colors={colors} onPress={() => onOpenResults?.(id)} />
        <ActionButton icon={Heart} label={liked ? 'Unlike' : 'Like'} count={likesCount} active={liked} activeColor={colors.away} colors={colors} onPress={() => onLike?.(id)} />
        <ActionButton icon={MessageCircle} label="Comments" count={commentCount ?? pool.length} colors={colors} onPress={() => onOpenChat?.(id)} />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {!isLoggedIn && <Lock size={ICON.sm} color={colors.textTertiary} />}
        <Input style={{ ...grow, border: 0, borderBottom: 0, background: 'transparent', ...fanText('caption', colors, colors.textSecondary) }} colors={colors} variant="inline"
          value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!isLoggedIn}
          placeholder={isLoggedIn ? 'Add a comment…' : 'Log in to comment'} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleSubmit(); } }} />
      </div>
    </div>
  </FeedItem>;
}
