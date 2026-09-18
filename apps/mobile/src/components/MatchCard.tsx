// RN "Arena" card — React Native port of the finalized web MatchCard.
//
// Behaviour:
//  - No border / shadow — blends into the screen background.
//  - Compact team row: avatar+name — score — name+avatar.
//  - Live commentary block replaces the "Fan zone" placeholder when live.
//  - "🔴 ON AIR" / "▶ watch" row — watch navigates to FixtureDetail.
//  - 3 voters laid out horizontally as mini cards (real voters if any,
//    otherwise 3 deterministic fan fillers).
//  - The 👥 votes footer pill — and the voters row itself — call
//    `onOpenVoteModal(fixture)`, so the parent can render
//    <SwipeableVotePledgeModal> with that fixture.
//  - 💬 comment prompt and 💬 footer pill both navigate to Chat.
//
// Watch != vote: `▶ watch` stays a route to the fixture detail screen,
// the vote modal is opened only by the vote-related affordances.

import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Fixture,
  scoreDisplay,
  hasScores,
  winnerOutcome,
  winner as fixtureWinner,
  outcomeColor,
  FanColorPalette,
  FAN_SPACING,
  FAN_RADIUS,
} from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { RootStackParamList } from '@/navigation/RootNavigator';

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (date.getTime() - now.getTime()) / 36e5;

    if (diffHours <= 2 && diffHours >= -2) return 'LIVE';
    if (date.getTime() > now.getTime()) return `In ${Math.round(diffHours)}h`;
    return `${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  } catch {
    return 'TBD';
  }
}

function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// Extracts a leading emoji from a username so the voter avatar can show
// the icon glyph, falling back to plain initials for names with no emoji.
const EMOJI_RE = /^(\p{Extended_Pictographic}\uFE0F?)\s*/u;
function splitFanName(username: string): { icon: string; name: string } {
  const match = username.match(EMOJI_RE);
  if (match) {
    return {
      icon: match[1],
      name: username.slice(match[0].length).trim() || username,
    };
  }
  return { icon: '', name: username };
}

// Deterministic fillers, seeded off the fixture id — same fixture always
// shows the same 3 fillers, no reshuffling on re-render.
const SAMPLE_FAN_NAMES = [
  '⚡ LightningBolt',
  '🔥 FireStriker',
  '🛡️ DefenseWall',
  '🎯 Sniper',
  '💪 PowerShot',
  '✨ MagicFeet',
  '🏃 SpeedDemon',
  '🧠 TacticalGenius',
  '🌟 StarPlayer',
  '🎭 FalseNine',
  '🎪 CircusSave',
  '🏆 ChampionMind',
  '📊 AnalystPro',
];

function seededHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface DisplayVoter {
  userId: string;
  userName: string;
  selection: 'home_team' | 'away_team' | 'draw' | string;
}

function fillVotersTo3(fixture: Fixture): DisplayVoter[] {
  const real: DisplayVoter[] = fixture.voters ?? [];
  if (real.length > 0) return real.slice(0, 3);

  const seed = fixture.matchId || fixture.id;
  const base = seededHash(seed);
  const picks = ['home_team', 'away_team', 'draw'] as const;

  return Array.from({ length: 3 }, (_, i) => ({
    userId: `mock_${seed}_${i}`,
    userName: SAMPLE_FAN_NAMES[(base + i * 7) % SAMPLE_FAN_NAMES.length],
    selection: picks[(base + i * 13) % picks.length],
  }));
}

function pickOutcome(selection: string): 'home' | 'away' | 'draw' {
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
  channelId,
  latestComment,
  liveCommentary,
  commentsCount = 0,
  likesCount = 0,
  onOpenVoteModal,
}: {
  fixture: Fixture;
  channelId?: string;
  latestComment?: LatestComment;
  liveCommentary?: LiveCommentaryEntry;
  commentsCount?: number;
  likesCount?: number;
  /** Called when the user taps the votes pill or the voters row. The
   *  parent owns the modal instance and passes the fixture back in. */
  onOpenVoteModal?: (fixture: Fixture) => void;
}) {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userId, isLoggedIn } = useAuth();

  const badge = formatDate(fixture.date);
  const isLive = badge === 'LIVE';
  const hasVoted = (fixture.voters ?? []).some((v) => v.userId === userId);
  const matchId = fixture.matchId || fixture.id;

  function openMatchDetail() {
    navigation.navigate('FixtureDetail', { matchId });
  }

  function openChat() {
    navigation.navigate(
      'Chat',
      { channelId, fixtureId: matchId } as never,
    );
  }

  function openVoteModal() {
    onOpenVoteModal?.(fixture);
  }

  return (
    <View style={styles.card}>
      {/* Header: league icon + name, LIVE/date pill */}
      <View style={styles.headerRow}>
        <View style={styles.leagueRow}>
          <View style={styles.leagueIcon}>
            <Text style={fanText('tag', colors, colors.primary)}>
              {(fixture.league || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text
            style={[
              fanText('competition', colors, colors.textSecondary),
              { textTransform: 'uppercase' },
            ]}
            numberOfLines={1}
          >
            {fixture.league || 'Unknown League'}
          </Text>
        </View>
        {isLive ? (
          <View style={[styles.badge, { backgroundColor: colors.awayDim }]}>
            <View style={styles.liveDot} />
            <Text style={fanText('tag', colors, colors.live)}>LIVE</Text>
          </View>
        ) : (
          <Text style={fanText('tag', colors, colors.textTertiary)}>
            {badge}
          </Text>
        )}
      </View>

      {/* Compact team row */}
      <View style={styles.teamsRow}>
        <View style={styles.teamSideLeft}>
          <Text
            style={[
              fanText('caption', colors, colors.textPrimary),
              { fontWeight: '600', flexShrink: 1 },
            ]}
            numberOfLines={1}
          >
            {fixture.homeTeam}
          </Text>
          <View
            style={[styles.teamAvatar, { borderColor: `${colors.primary}40` }]}
          >
            <Text style={fanText('tag', colors, colors.primary)}>
              {initials(fixture.homeTeam)[0]}
            </Text>
          </View>
        </View>

        <Text
          style={[
            fanText('title', colors, outcomeColor(winnerOutcome(fixture), colors)),
            { fontWeight: '700', marginHorizontal: FAN_SPACING.sm },
          ]}
        >
          {hasScores(fixture) ? scoreDisplay(fixture) : 'vs'}
        </Text>

        <View style={styles.teamSideRight}>
          <View
            style={[
              styles.teamAvatar,
              { borderColor: `${colors.scoreAway}40` },
            ]}
          >
            <Text style={fanText('tag', colors, colors.scoreAway)}>
              {initials(fixture.awayTeam)[0]}
            </Text>
          </View>
          <Text
            style={[
              fanText('caption', colors, colors.textPrimary),
              { fontWeight: '600', flexShrink: 1 },
            ]}
            numberOfLines={1}
          >
            {fixture.awayTeam}
          </Text>
        </View>
      </View>

      {/* Live commentary or fan-zone preview */}
      <View style={styles.commentaryRow}>
        <Text
          style={[
            fanText('tag', colors, colors.textTertiary),
            { marginTop: 1 },
          ]}
        >
          ⓘ
        </Text>
        <View style={{ flex: 1, marginLeft: FAN_SPACING.sm }}>
          {isLive && liveCommentary ? (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: FAN_SPACING.sm,
                }}
              >
                <Text
                  style={[
                    fanText('caption', colors, colors.textPrimary),
                    { flex: 1 },
                  ]}
                >
                  {liveCommentary.text}
                </Text>
                <Text style={fanText('tag', colors, colors.textTertiary)}>
                  {liveCommentary.minute}&apos;
                </Text>
              </View>
              {liveCommentary.timestamp && (
                <Text
                  style={[
                    fanText('tag', colors, colors.textTertiary),
                    { marginTop: FAN_SPACING.xs },
                  ]}
                >
                  {liveCommentary.timestamp}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={fanText('tag', colors, colors.textSecondary)}>
                Fan zone
              </Text>
              <Text
                style={[
                  fanText('caption', colors, colors.textTertiary),
                  { fontStyle: 'italic' },
                ]}
                numberOfLines={1}
              >
                {latestComment
                  ? `${latestComment.username}: ${latestComment.comment}`
                  : 'Say something about this match 💬'}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* ON AIR / watch row */}
      {isLive && (
        <View style={styles.onAirRow}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: FAN_SPACING.xs,
            }}
          >
            <View style={styles.onAirDot} />
            <Text style={fanText('tag', colors, colors.away)}>ON AIR</Text>
          </View>
          <Pressable onPress={openMatchDetail}>
            <Text style={fanText('tag', colors, colors.primary)}>▶ watch</Text>
          </Pressable>
        </View>
      )}

      {/* Result / vote-recorded state */}
      {fixture.status === 'completed' ? (
        <Text
          style={[
            fanText('caption', colors, colors.textSecondary),
            { textAlign: 'center', marginBottom: FAN_SPACING.base },
          ]}
        >
          Winner: {fixtureWinner(fixture)}
        </Text>
      ) : hasVoted ? (
        <Text
          style={[
            fanText('caption', colors, colors.primary),
            { textAlign: 'center', marginBottom: FAN_SPACING.base },
          ]}
        >
          ✓ Vote recorded
        </Text>
      ) : null}

      {/* 3 voters — whole row opens the vote modal */}
      <Pressable
        onPress={openVoteModal}
        style={({ pressed }) => [
          styles.votersRow,
          pressed && { opacity: 0.75 },
        ]}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        {fillVotersTo3(fixture).map((v) => {
          const { icon, name } = splitFanName(v.userName);
          const pickColor = outcomeColor(pickOutcome(v.selection), colors);
          const pickLabel =
            v.selection === 'home_team'
              ? fixture.homeTeam
              : v.selection === 'away_team'
                ? fixture.awayTeam
                : 'draw';
          return (
            <View key={v.userId} style={styles.voterItem}>
              <View style={styles.voterAvatar}>
                {icon ? (
                  <Text style={fanText('body', colors)}>{icon}</Text>
                ) : (
                  <Text style={fanText('tag', colors, colors.primary)}>
                    {initials(name)}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  fanText('tag', colors, colors.textPrimary),
                  { fontWeight: '600' },
                ]}
                numberOfLines={1}
              >
                {name}
              </Text>
              <Text style={fanText('tag', colors, colors.textTertiary)}>
                fan
              </Text>
              <Text
                style={[
                  fanText('tag', colors, pickColor),
                  { fontWeight: '700' },
                ]}
                numberOfLines={1}
              >
                {pickLabel}
              </Text>
            </View>
          );
        })}
      </Pressable>

      {/* Comment prompt */}
      <Pressable
        onPress={openChat}
        disabled={!isLoggedIn}
        style={styles.commentPrompt}
      >
        <Text style={fanText('tag', colors, colors.textTertiary)}>
          {isLoggedIn ? '💬' : '🔒'}
        </Text>
        <Text
          style={[
            fanText('caption', colors, colors.textTertiary),
            { fontStyle: 'italic', marginLeft: FAN_SPACING.sm },
          ]}
          numberOfLines={1}
        >
          {isLoggedIn ? 'Write a comment...' : 'Log in to comment'}
        </Text>
      </Pressable>

      {/* Footer icon row */}
      <View style={styles.footerRow}>
        {/* 👥 votes — opens the modal */}
        <Pressable
          onPress={openVoteModal}
          style={({ pressed }) => [
            styles.footerItem,
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={fanText('tag', colors, colors.textTertiary)}>👥</Text>
          <Text style={fanText('tag', colors, colors.textTertiary)}>
            {fixture.votes}
          </Text>
          <Text
            style={[
              fanText('tag', colors, colors.textTertiary),
              { marginLeft: 2 },
            ]}
          >
            ›
          </Text>
        </Pressable>

        {/* ♡ likes — informational only for now */}
        <View style={styles.footerItem}>
          <Text style={fanText('tag', colors, colors.textTertiary)}>♡</Text>
          <Text style={fanText('tag', colors, colors.textTertiary)}>
            {likesCount}
          </Text>
        </View>

        {/* 💬 comments — opens chat */}
        <Pressable
          onPress={openChat}
          style={({ pressed }) => [
            styles.footerItem,
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={fanText('tag', colors, colors.textTertiary)}>💬</Text>
          <Text style={fanText('tag', colors, colors.textTertiary)}>
            {commentsCount}
          </Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        {isLive ? (
          <View style={[styles.badge, { backgroundColor: colors.awayDim }]}>
            <Text style={fanText('tag', colors, colors.live)}>live</Text>
          </View>
        ) : (
          <Text style={fanText('tag', colors, colors.textTertiary)}>
            {fixture.date}
          </Text>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: FanColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.background,
      paddingHorizontal: FAN_SPACING.md,
      paddingVertical: FAN_SPACING.lg,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: FAN_SPACING.base,
    },
    leagueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
      flex: 1,
      marginRight: FAN_SPACING.sm,
    },
    leagueIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.surfaceSunken,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.xs,
      borderRadius: FAN_RADIUS.pill,
      paddingHorizontal: FAN_SPACING.sm,
      paddingVertical: 1,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.live,
    },
    onAirDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.live,
    },
    teamsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: FAN_SPACING.base,
    },
    teamSideLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: FAN_SPACING.sm,
    },
    teamSideRight: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.sm,
    },
    teamAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.surfaceSunken,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentaryRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: FAN_SPACING.base,
    },
    onAirRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: FAN_SPACING.base,
    },
    votersRow: {
      flexDirection: 'row',
      gap: FAN_SPACING.md,
      marginBottom: FAN_SPACING.base,
    },
    voterItem: { flex: 1, alignItems: 'center', minWidth: 0 },
    voterAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: `${colors.primary}4D`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: FAN_SPACING.xs,
    },
    commentPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: FAN_SPACING.base,
      paddingVertical: FAN_SPACING.sm,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.lg,
    },
    footerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FAN_SPACING.xs,
    },
  });
}