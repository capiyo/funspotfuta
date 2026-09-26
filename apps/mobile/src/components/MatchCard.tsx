// components/MatchCard.tsx
//
//   league (white)                            Live | kickoff        <- date untouched
//   Home  (H)      2 : 1      (A)  Away            <- lives in ui/Scoreline (not included)
//   [icon] one random comment (or live commentary)  <- reference style for all other text
//   news / lineups  (green link)                    <- NEW: opens MatchDetailsModal
//   (A) Kim      (B) Otieno    (C) Amina           <- lives in ui/Voterstack (not included)
//   Arsenal      Draw          Chelsea
//   vote  heart  comment   |   Add a comment…      <- footer, untouched
//
// STYLE PASS: every in-card text uses the same small caption font/family
// and colors.textSecondary color as the comment-preview line, EXCEPT:
//   - the league label, which keeps its own size/weight and is forced white
//   - the footer action row (ActionButton/Input) — left exactly as-is
//   - the kickoff date label — left exactly as-is
//   - the new news/lineups link — same caption font, but colored
//     colors.primary so it reads as tappable

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Check,
  Heart,
  Lock,
  MessageCircle,
  Radio,
  Vote,
} from 'lucide-react-native';
import {
  Fixture,
  scoreDisplay,
  hasScores,
  winnerOutcome,
  winner as fixtureWinner,
  outcomeColor,
  FAN_SPACING,
} from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '../modals/Login-modal-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { ICON, PRESSED_OPACITY } from '@/theme/layout';
import { FeedItem } from './ui/FeedItem';
import { LiveBadge } from './ui/LiveBadge';
import { ActionButton } from './ui/ActionButton';
import { Input } from './ui/input';
import { ScoreLine } from './ui/Scoreline';
import { VoterList } from './ui/Voterstack';

// Same color as the comment-preview line, reused everywhere the rest
// of the card's text matches it.
const COMMENT_STYLE_COLOR = (colors: ReturnType<typeof useFanColors>) =>
  colors.textSecondary;

function kickoffLabel(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return 'TBD';
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  if (mins > 0 && mins < 60) return `In ${mins}m`;
  if (mins >= 60 && mins < 24 * 60) return `In ${Math.round(mins / 60)}h`;
  return d.toLocaleString(undefined, {
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

export interface LatestComment {
  username: string;
  comment: string;
}

export interface LiveCommentaryEntry {
  text: string;
  minute: number;
  timestamp?: string;
}

export function MatchCard({
  fixture,
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
  channelId?: string;
  /** Real comments on this match. The preview line shows one AT RANDOM. */
  comments?: LatestComment[];
  /** Fallback when only one comment is known. */
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
  /**
   * Opens the match details modal. The label above the voters list
   * ("news" for upcoming, "lineups" for soon/live) taps into this.
   */
  onOpenLineups?: (fixture: Fixture) => void;
}) {
  const colors = useFanColors();
  const { userId, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  const [draft, setDraft] = useState('');

  // Random pick, fixed for this card's lifetime. Re-picking on every render
  // would make the line flicker on each keystroke in the comment box.
  const [seed] = useState(() => Math.random());
  const pool = comments?.length
    ? comments
    : latestComment
      ? [latestComment]
      : [];
  const preview = pool.length ? pool[Math.floor(seed * pool.length)] : null;

  const isLive = !!fixture.isLive || fixture.status === 'live';
  const isCompleted =
    fixture.status === 'completed' || fixture.status === 'finished';
  const requiresVote =
    fixture.status === 'upcoming' || fixture.status === 'soon';
  const voters = fixture.voters ?? [];
  const hasVoted = voters.some((v) => v.userId === userId);

  const canChat = isLoggedIn && (isCompleted || hasVoted || !requiresVote);
  const placeholder = !isLoggedIn
    ? 'Log in to comment'
    : requiresVote && !hasVoted
      ? 'Vote to comment'
      : 'Add a comment…';

  const outcome = isCompleted ? winnerOutcome(fixture) : null;

  // ── Lineups / news label ─────────────────────────────────────
  // Mirrors the Flutter _buildMatchCard pill's branching:
  //   live                 → 'lineups'  (opens MatchDetailsModal)
  //   upcoming / soon      → 'news'     (opens MatchDetailsModal)
  //   completed / finished → hidden     (no equivalent in Flutter pill)
  const lineupsLabel: string | null = isCompleted
    ? null
    : isLive
      ? 'lineups'
      : 'news';

  const voterItems = useMemo(
    () =>
      voters.slice(0, 3).map((v) => {
        const kind = pickKind(v.selection);
        return {
          id: v.userId,
          name: v.userName,
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

  // ── Gated handlers ─────────────────────────────────────────
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
  function handleSubmit() {
    if (!isLoggedIn) return requireLogin(handleSubmit);
    const text = draft.trim();
    if (!text) return;
    onSubmitComment?.(fixture, text);
    setDraft('');
  }
  function handleLineups() {
    if (!isLoggedIn) return requireLogin(handleLineups);
    onOpenLineups?.(fixture);
  }

  return (
    <FeedItem colors={colors}>
      {/* Meta */}
      <View style={styles.metaRow}>
        {/* League: kept its own size/weight, forced white per request. */}
        <Text
          style={[fanText('competition', colors, '#FFFFFF'), styles.grow]}
          numberOfLines={1}
        >
          {fixture.league || 'Unknown league'}
        </Text>
        {isLive ? (
          <LiveBadge colors={colors} />
        ) : (
          // Date — left untouched.
          <Text style={fanText('tag', colors, colors.textTertiary)}>
            {kickoffLabel(fixture.date)}
          </Text>
        )}
      </View>

      {/* Scoreboard: the whole row opens chat. */}
      <Pressable
        onPress={handleChat}
        style={({ pressed }) => pressed && { opacity: PRESSED_OPACITY }}
      >
        <ScoreLine
          colors={colors}
          crests
          homeTeam={fixture.homeTeam}
          awayTeam={fixture.awayTeam}
          center={hasScores(fixture) ? scoreDisplay(fixture) : 'vs'}
          homeWon={outcome === 'home'}
          awayWon={outcome === 'away'}
        />
      </Pressable>

      {/* Live commentary, else one random comment — this is the reference style */}
      <View style={styles.lineRow}>
        {isLive && liveCommentary ? (
          <>
            <Radio size={ICON.sm} color={colors.live} />
            <Text
              style={[
                fanText('caption', colors, COMMENT_STYLE_COLOR(colors)),
                styles.grow,
              ]}
              numberOfLines={1}
            >
              {liveCommentary.text}
            </Text>
            <Text style={fanText('tag', colors, colors.textTertiary)}>
              {liveCommentary.minute}&apos;
            </Text>
          </>
        ) : (
          <>
            <MessageCircle size={ICON.sm} color={colors.textTertiary} />
            <Text
              style={[
                fanText('caption', colors, COMMENT_STYLE_COLOR(colors)),
                styles.grow,
              ]}
              numberOfLines={1}
            >
              {preview
                ? `${preview.username}: ${preview.comment}`
                : 'Be the first to comment on this match'}
            </Text>
          </>
        )}
      </View>

      {/* News / lineups link — same caption font as the preview line,
          but in colors.primary (the green used on the avatar ring) so
          it reads as an actionable link, not muted metadata. Taps
          through to onOpenLineups → MatchDetailsModal. */}
      {lineupsLabel ? (
        <Pressable
          onPress={handleLineups}
          hitSlop={8}
          style={({ pressed }) => [
            styles.lineRow,
            pressed && { opacity: PRESSED_OPACITY },
          ]}
        >
          <Text
            style={[
              fanText('caption', colors, colors.primary),
              styles.lineupsText,
            ]}
          >
            {lineupsLabel}
          </Text>
        </Pressable>
      ) : null}

      {/* Result / vote state — same caption style as the comment preview */}
      {isCompleted ? (
        <Text style={fanText('caption', colors, COMMENT_STYLE_COLOR(colors))}>
          Winner: {fixtureWinner(fixture)}
        </Text>
      ) : hasVoted ? (
        <View style={styles.lineRow}>
          <Check size={ICON.sm} color={colors.primary} />
          <Text style={fanText('caption', colors, COMMENT_STYLE_COLOR(colors))}>
            Vote recorded
          </Text>
        </View>
      ) : null}

      {/* Up to 3 real voters */}
      <VoterList
        colors={colors}
        voters={voterItems}
        emptyLabel={
          isCompleted ? 'No votes were cast' : 'Be the first to call it'
        }
        onPress={handleVote}
      />

      {/* Footer — left exactly as-is per request */}
      <View style={styles.bottomRow}>
        <View style={styles.half}>
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
        </View>

        <View style={[styles.half, styles.inputHalf]}>
          {!canChat && <Lock size={ICON.sm} color={colors.textTertiary} />}
          <Input
            style={[
              styles.grow,
              styles.noBorderInput,
              fanText('caption', colors, colors.textSecondary),
            ]}
            colors={colors}
            variant="inline"
            value={draft}
            onChangeText={setDraft}
            editable={canChat}
            placeholder={placeholder}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
          />
        </View>
      </View>
    </FeedItem>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FAN_SPACING.sm,
  },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  // Two equal columns: the input starts at the centre and runs to the right edge.
  half: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: FAN_SPACING.base,
  },
  inputHalf: { gap: FAN_SPACING.sm },
  // No line/border under the input — just fades into the card background.
  noBorderInput: {
    borderWidth: 0,
    borderBottomWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  // Underline is the only decoration that makes a single lowercase word
  // read as a link rather than as muted metadata. Remove this line if you
  // prefer a bare colored word.
  lineupsText: { textDecorationLine: 'underline' },
});