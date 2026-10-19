// components/MatchCard.tsx
//
// Same design as HistoryCard, row for row:
//
//   league / channel (white)                          date  <- or LiveBadge
//   [icon] one random comment / live commentary
//   Winner: Home   |   Vote recorded
//   (A) Kim      (B) Otieno
//   Vote  heart  comment  | Add a comment… | Arsenal 2 : 1 Chelsea
//   ^ one line, flush with the card floor; "vs" instead of the score
//     before kickoff
//
// TAP MODEL:
//   - Vote / Results button  → vote modal (only vote entry)
//   - Like button            → like handler
//   - Home vs Away caption   → MatchDetailsModal (onOpenLineups)
//   - Comment box            → real, login-gated; on a match that isn't
//                              finished you must have voted first
//   - EVERYTHING ELSE        → open Chat
//
// STRUCTURE PRESERVED: same props, same callbacks, same login gates.
// `channel` is optional; when given, a small avatar + channel name replaces
// the league label in the top-left. Without it the card shows the league.

import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
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
  hasScores,
  scoreDisplay,
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
import { VoterList } from './ui/Voterstack';

// How far the footer is pulled down to reach the card floor (cancels
// FeedItem's bottom padding). Raise it if there is still a gap.
const FOOTER_BLEED = 12;

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
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return 'TBD';
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  if (mins > 0 && mins < 60) return `in ${mins}m`;
  if (mins >= 60 && mins < 24 * 60) return `in ${Math.round(mins / 60)}h`;
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
      EMPTY_VOTE_PROMPTS[Math.floor(Math.random() * EMPTY_VOTE_PROMPTS.length)],
  );

  const isLive = !!fixture.isLive || fixture.status === 'live';
  const isCompleted =
    fixture.status === 'completed' || fixture.status === 'finished';
  const voters = fixture.voters ?? [];
  const hasVoted = voters.some((v) => v.userId === userId);


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

  const fixtureLabel = `${fixture.homeTeam} vs ${fixture.awayTeam}`;
  // Teams with the score between them, or "vs" before kickoff.
  const captionLabel = `${fixture.homeTeam} ${hasScores(fixture) ? scoreDisplay(fixture) : 'vs'
    } ${fixture.awayTeam}`;
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

  const placeholder = !isLoggedIn
    ? 'Log in to comment'
    : canComment
      ? 'Add a comment…'
      : 'Vote to comment';

  return (
    <FeedItem colors={colors}>
      {/* Layer 1 — invisible full-card tap target → Chat */}
      <Pressable
        onPress={handleChat}
        style={StyleSheet.absoluteFill}
        android_ripple={{ color: colors.border, borderless: false }}
        accessibilityRole="button"
        accessibilityLabel={`Open chat for ${fixtureLabel}`}
      />

      {/* Layer 2 — content */}
      <View pointerEvents="box-none">
        {/* Meta: league or channel on the left, date / live on the right */}
        <View style={styles.metaRow} pointerEvents="none">
          {channel ? (
            <View style={[styles.channelLabel, styles.grow]}>
              <View
                style={[
                  styles.channelAvatar,
                  {
                    backgroundColor: colors.surfaceSunken,
                    borderColor: colors.border,
                  },
                ]}
              >
                {channel.imageUrl && failedUri !== channel.imageUrl ? (
                  <Image
                    source={{ uri: channel.imageUrl }}
                    style={styles.channelAvatarImage}
                    resizeMode="cover"
                    onError={() => setFailedUri(channel.imageUrl ?? null)}
                  />
                ) : (
                  <Text style={fanText('tag', colors, colors.primary)}>
                    {(channel.name || '?').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  fanText('competition', colors, '#FFFFFF'),
                  styles.channelName,
                  styles.grow,
                ]}
                numberOfLines={1}
              >
                {channel.name}
              </Text>
            </View>
          ) : (
            <Text
              style={[fanText('competition', colors, '#FFFFFF'), styles.grow]}
              numberOfLines={1}
            >
              {fixture.league || 'Unknown league'}
            </Text>
          )}
          {isLive ? (
            <LiveBadge colors={colors} />
          ) : (
            <Text style={fanText('tag', colors, colors.textTertiary)}>
              {kickoffLabel(fixture.date)}
            </Text>
          )}
        </View>

        {/* Comment preview / live commentary */}
        <View style={[styles.lineRow, styles.previewRow]} pointerEvents="none">
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

        {/* Result / vote state */}
        {isCompleted ? (
          <View style={styles.resultRow} pointerEvents="none">
            <Text style={fanText('caption', colors, COMMENT_STYLE_COLOR(colors))}>
              Winner: {fixtureWinner(fixture)}
            </Text>
          </View>
        ) : hasVoted ? (
          <View style={[styles.lineRow, styles.resultRow]} pointerEvents="none">
            <Check size={ICON.sm} color={colors.primary} />
            <Text
              style={fanText('caption', colors, COMMENT_STYLE_COLOR(colors))}
            >
              Vote recorded
            </Text>
          </View>
        ) : null}

        {/* Voter stack */}
        <View style={styles.stackRow}>
          <VoterList
            colors={colors}
            voters={voterItems}
            emptyLabel={isCompleted ? 'No votes were cast' : emptyPrompt}
          />
        </View>

        {/* One line: actions, comment box, teams + score */}
        <View style={styles.bottomRow}>
          <View style={styles.actions}>
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

          {/* Middle: comment box */}
          <View style={styles.inputCell}>
            {!canComment && (
              <Lock size={ICON.sm} color={colors.textTertiary} />
            )}
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
              editable={canComment}
              placeholder={placeholder}
              onSubmitEditing={handleSubmit}
              returnKeyType="send"
            />
          </View>

          {/* Right: Home vs Away + score → match details */}
          <Pressable
            onPress={handleLineups}
            hitSlop={8}
            style={({ pressed }) => [
              styles.caption,
              pressed && { opacity: PRESSED_OPACITY },
            ]}
            accessibilityRole="link"
            accessibilityLabel={`Open match details: ${fixtureLabel}`}
          >
            <Text
              style={fanText('tag', colors, colors.textTertiary)}
              numberOfLines={1}
            >
              {captionLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </FeedItem>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  // Vertical rhythm between the card's sections.
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  previewRow: { marginBottom: 0 },
  resultRow: { marginTop: 10 },
  stackRow: { marginTop: 14 },
  channelLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FAN_SPACING.sm,
  },
  channelAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  channelAvatarImage: { width: '100%', height: '100%' },
  channelName: { fontWeight: 'normal' },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FAN_SPACING.sm,
  },
  // One horizontal line: actions | comment box | teams + score.
  // Negative bottom margin cancels FeedItem's bottom padding so the row
  // sits on the card floor. Tune FOOTER_BLEED if a gap remains.
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FAN_SPACING.sm,
    marginTop: 18,
    marginBottom: -FOOTER_BLEED,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FAN_SPACING.base,
  },
  inputCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: FAN_SPACING.sm,
  },
  caption: {
    flexShrink: 0,
    maxWidth: '40%',
    minHeight: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  // No line under the input — it fades into the card background.
  noBorderInput: {
    borderWidth: 0,
    borderBottomWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
});