// screens/LeaderboardScreen.tsx
//
// RN port of funspot-next/app/(app)/leaderboard/page.tsx, extended to
// cover the leaderboard + voters halves of the Flutter ComradeModal.
//
// What's ported from the Flutter modal:
//   - Two tabs (LEADERBOARD / VOTES) — VOTES only when a fixture is passed
//   - Champion card (rank 1) + member cards (ranks 2+)
//   - Full stat grid on member cards
//   - Per-fixture voters list, filtered to comrades + you
//   - Vote summary bar + All/Home/Draw/Away filter chips
//   - Drill-down: tapping a member opens their Activity History sheet
//
// What's deliberately NOT ported:
//   - Carousel + ads (Flutter-specific; no ad SDK in this app)
//   - Exit Channel button + 30-point confirmation (belongs in a
//     channel-settings surface, not the leaderboard)
//
// The channel picker is kept (the Flutter modal doesn't have one) so
// the user can hop channels from inside this modal.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  X,
  Trophy,
  Star,
  Flame,
  Target,
  Users,
  Vote,
  MessageCircle,
  Heart,
  Inbox,
} from 'lucide-react-native';
import {
  FAN_SPACING,
  FAN_RADIUS,
  Fixture,
  ComradeChannel,
  ComradeWithStats,
  comradeWithStatsFromChannelMember,
  getUserChannels,
  getChannelLeaderboard,
  getUserComrades,
} from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { PRESSED_OPACITY } from '@/theme/layout';
// TODO: export these from @funspot/core instead of reaching into its src.
import {
  fetchVoters,
  fetchUserActivityHistory,
} from '../../../../packages/core/src/api/vote-modal-shims';

type FanColors = ReturnType<typeof useFanColors>;

// ═══════════════════════════════════════════════════════════════
//  RANK HELPERS
// ═══════════════════════════════════════════════════════════════

// Gold / silver / bronze — not in the design-token palette (theme
// colors, not rank colors), so they live here as named constants
// rather than invented tokens.
const RANK_COLORS = {
  gold: '#FFD700',
  silver: '#B0B0B0',
  bronze: '#CD7F32',
};

function rankColor(rank: number, colors: FanColors): string {
  if (rank === 1) return RANK_COLORS.gold;
  if (rank === 2) return RANK_COLORS.silver;
  if (rank === 3) return RANK_COLORS.bronze;
  return colors.textTertiary;
}

function rankLabel(rank: number): string {
  if (rank === 1) return 'CHAMPION';
  if (rank === 2) return 'RUNNER UP';
  if (rank === 3) return '3RD PLACE';
  return `#${rank}`;
}

function medalFor(rank: number): string | null {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

function initials(name: string): string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && parts[0][0] && parts[1][0]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0][0].toUpperCase();
}

// ═══════════════════════════════════════════════════════════════
//  VOTER / VOTE-STATS TYPES  (local — Voters tab only)
// ═══════════════════════════════════════════════════════════════

interface VoterRow {
  userId: string;
  username: string;
  selection: 'home_team' | 'away_team' | 'draw' | string;
  isComrade: boolean;
}

type VoteFilter = 'all' | 'home' | 'draw' | 'away';

// ═══════════════════════════════════════════════════════════════
//  LEADERBOARD SCREEN
// ═══════════════════════════════════════════════════════════════

export default function LeaderboardScreen({
  visible,
  onClose,
  fixture = null,
  channelId,
  channelName,
}: {
  visible: boolean;
  onClose: () => void;
  /** Optional. When provided, the VOTES tab is rendered. */
  fixture?: Fixture | null;
  /** Optional override. Falls back to the channel picker's selection. */
  channelId?: string;
  channelName?: string;
}) {
  const colors = useFanColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { userId, authToken } = useAuth();

  const [channels, setChannels] = useState<ComradeChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    channelId ?? null,
  );
  const [rows, setRows] = useState<ComradeWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Two-tab layout when a fixture is present, single-tab otherwise.
  const [tab, setTab] = useState<'leaderboard' | 'votes'>('leaderboard');
  const hasFixture = !!fixture;

  // Reset to leaderboard tab whenever the modal re-opens, so a
  // dismissed-on-votes state doesn't leak into the next open.
  useEffect(() => {
    if (visible) setTab('leaderboard');
  }, [visible]);

  useEffect(() => {
    if (channelId) setActiveChannelId(channelId);
  }, [channelId]);

  useEffect(() => {
    if (!visible || !userId || !authToken) return;
    getUserChannels(userId, authToken).then((c) => {
      setChannels(c);
      setActiveChannelId((prev) => prev ?? c[0]?.id ?? null);
    });
  }, [visible, userId, authToken]);

  useEffect(() => {
    if (!visible || !activeChannelId || !authToken || !userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [board, comrades] = await Promise.all([
        getChannelLeaderboard(activeChannelId, authToken),
        getUserComrades(userId, authToken),
      ]);
      if (cancelled) return;
      const comradesList = new Set(comrades.map((c) => c.comrade_id));
      const list: any[] = board?.leaderboard ?? [];
      setRows(
        list
          .map((item) => comradeWithStatsFromChannelMember(item, comradesList))
          .sort((a, b) => a.rank - b.rank),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, activeChannelId, authToken, userId]);

  const champion = rows.length > 0 ? rows[0] : null;
  const members = rows.length > 1 ? rows.slice(1) : [];

  const resolvedChannelName =
    channelName ??
    channels.find((c) => c.id === activeChannelId)?.name ??
    'Leaderboard';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <Trophy size={16} color={colors.primary} />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {resolvedChannelName.toUpperCase()}
              </Text>
              <Text style={styles.headerSub}>{rows.length} members</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <X size={14} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Channel picker — only shown when the parent didn't lock us
              to a channel via the `channelId` prop. */}
          {!channelId && channels.length > 0 && (
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={activeChannelId}
                onValueChange={(v) => setActiveChannelId(v)}
                style={{ color: colors.textPrimary }}
                dropdownIconColor={colors.textSecondary}
              >
                {channels.map((c) => (
                  <Picker.Item key={c.id} label={c.name} value={c.id} />
                ))}
              </Picker>
            </View>
          )}

          {/* Tab bar — only when a fixture is present */}
          {hasFixture && (
            <View style={styles.tabBar}>
              <TabButton
                colors={colors}
                styles={styles}
                active={tab === 'leaderboard'}
                label="LEADERBOARD"
                onPress={() => setTab('leaderboard')}
              />
              <TabButton
                colors={colors}
                styles={styles}
                active={tab === 'votes'}
                label="VOTES"
                onPress={() => setTab('votes')}
              />
            </View>
          )}

          {/* Content */}
          {channels.length === 0 && !loading ? (
            <View style={styles.center}>
              <Text style={styles.empty}>
                Join or create a channel to see its leaderboard.
              </Text>
            </View>
          ) : tab === 'leaderboard' || !hasFixture ? (
            <ScrollView
              style={styles.screen}
              contentContainerStyle={styles.content}
            >
              {loading ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={{ marginTop: 40 }}
                />
              ) : rows.length === 0 ? (
                <Text style={styles.empty}>No leaderboard data yet.</Text>
              ) : (
                <>
                  {champion && (
                    <ChampionCard
                      colors={colors}
                      styles={styles}
                      row={champion}
                      isCurrentUser={champion.id === userId}
                      onPress={() =>
                        openActivityHistory({
                          userId: champion.id,
                          userName: champion.username,
                          displayName: champion.nickname || champion.username,
                          clubFan: champion.clubFan,
                          authToken,
                        })
                      }
                    />
                  )}
                  {members.map((row) => (
                    <MemberCard
                      key={row.id}
                      colors={colors}
                      styles={styles}
                      row={row}
                      isCurrentUser={row.id === userId}
                      onPress={() =>
                        openActivityHistory({
                          userId: row.id,
                          userName: row.username,
                          displayName: row.nickname || row.username,
                          clubFan: row.clubFan,
                          authToken,
                        })
                      }
                    />
                  ))}
                </>
              )}
            </ScrollView>
          ) : (
            <VotersTab
              colors={colors}
              styles={styles}
              fixture={fixture!}
              userId={userId}
              channelId={activeChannelId}
              authToken={authToken}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TAB BUTTON
// ═══════════════════════════════════════════════════════════════

function TabButton({
  colors,
  styles,
  active,
  label,
  onPress,
}: {
  colors: FanColors;
  styles: ReturnType<typeof createStyles>;
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabButton,
        active && styles.tabButtonActive,
        pressed && { opacity: PRESSED_OPACITY },
      ]}
    >
      <Text
        style={[
          styles.tabButtonText,
          { color: active ? colors.textPrimary : colors.textTertiary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CHAMPION CARD  (rank 1)
// ═══════════════════════════════════════════════════════════════

function ChampionCard({
  colors,
  styles,
  row,
  isCurrentUser,
  onPress,
}: {
  colors: FanColors;
  styles: ReturnType<typeof createStyles>;
  row: ComradeWithStats;
  isCurrentUser: boolean;
  onPress: () => void;
}) {
  const accent = rankColor(row.rank, colors);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.championCard,
        {
          backgroundColor: hexWithAlpha(accent, 0.06),
          borderColor: hexWithAlpha(accent, 0.25),
        },
        pressed && { opacity: PRESSED_OPACITY },
      ]}
    >
      <View style={styles.championTopRow}>
        <View
          style={[
            styles.championPill,
            { backgroundColor: hexWithAlpha(accent, 0.15) },
          ]}
        >
          <Trophy size={11} color={accent} />
          <Text style={[styles.championPillText, { color: accent }]}>
            {rankLabel(row.rank)}
          </Text>
        </View>
        <View
          style={[
            styles.rankChip,
            { backgroundColor: hexWithAlpha(accent, 0.1) },
          ]}
        >
          <Text style={[styles.rankChipText, { color: accent }]}>
            #{row.rank}
          </Text>
        </View>
      </View>

      <View style={styles.championIdentity}>
        <View
          style={[
            styles.championAvatar,
            {
              backgroundColor: hexWithAlpha(accent, 0.08),
              borderColor: hexWithAlpha(accent, 0.35),
            },
          ]}
        >
          <Text style={[styles.championAvatarText, { color: accent }]}>
            {initials(row.nickname || row.username)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.championName} numberOfLines={1}>
              {row.nickname || row.username}
            </Text>
            {isCurrentUser && (
              <View
                style={[
                  styles.mePill,
                  { backgroundColor: hexWithAlpha(colors.primary, 0.15) },
                ]}
              >
                <Text style={[styles.mePillText, { color: colors.primary }]}>
                  YOU
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.championHandle} numberOfLines={1}>
            @{row.username}
          </Text>
          {!!row.clubFan && (
            <Text style={styles.championClub} numberOfLines={1}>
              {row.clubFan}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.championStats}>
        <ChampionStat
          colors={colors}
          styles={styles}
          icon={<Target size={12} color={colors.primary} />}
          value={`${row.accuracyPercentage.toFixed(1)}%`}
          label="ACCURACY"
        />
        <ChampionStat
          colors={colors}
          styles={styles}
          icon={<Star size={12} color={colors.primary} />}
          value={`${row.totalPoints}`}
          label="POINTS"
        />
        <ChampionStat
          colors={colors}
          styles={styles}
          icon={<Flame size={12} color={colors.draw} />}
          value={`${row.currentStreak}`}
          label="STREAK"
        />
      </View>
    </Pressable>
  );
}

function ChampionStat({
  colors,
  styles,
  icon,
  value,
  label,
}: {
  colors: FanColors;
  styles: ReturnType<typeof createStyles>;
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.championStat}>
      {icon}
      <Text style={[styles.championStatValue, { color: colors.textPrimary }]}>
        {value}
      </Text>
      <Text
        style={[styles.championStatLabel, { color: colors.textTertiary }]}
      >
        {label}
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MEMBER CARD  (ranks 2+)
// ═══════════════════════════════════════════════════════════════

function MemberCard({
  colors,
  styles,
  row,
  isCurrentUser,
  onPress,
}: {
  colors: FanColors;
  styles: ReturnType<typeof createStyles>;
  row: ComradeWithStats;
  isCurrentUser: boolean;
  onPress: () => void;
}) {
  const accent = rankColor(row.rank, colors);
  const medal = medalFor(row.rank);
  const correctPct =
    row.totalVotes > 0 ? (row.correctVotes / row.totalVotes) * 100 : 0;
  const wrongPct = row.totalVotes > 0 ? 100 - correctPct : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.memberCard,
        {
          borderColor: isCurrentUser
            ? hexWithAlpha(colors.primary, 0.5)
            : colors.border,
          backgroundColor: isCurrentUser
            ? hexWithAlpha(colors.primary, 0.06)
            : colors.surface,
        },
        pressed && { opacity: PRESSED_OPACITY },
      ]}
    >
      <View style={styles.memberHeader}>
        <View
          style={[
            styles.memberAvatar,
            { backgroundColor: hexWithAlpha(colors.primary, 0.12) },
          ]}
        >
          <Text style={[styles.memberAvatarText, { color: colors.primary }]}>
            {initials(row.nickname || row.username)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.memberName} numberOfLines={1}>
              {row.nickname || row.username}
            </Text>
            {isCurrentUser && (
              <View
                style={[
                  styles.mePill,
                  { backgroundColor: hexWithAlpha(colors.primary, 0.15) },
                ]}
              >
                <Text style={[styles.mePillText, { color: colors.primary }]}>
                  YOU
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.memberSub} numberOfLines={1}>
            #{row.rank}
            {row.clubFan ? ` · ${row.clubFan}` : ''}
          </Text>
        </View>
        {medal ? (
          <Text style={styles.memberMedal}>{medal}</Text>
        ) : (
          <View
            style={[
              styles.rankChip,
              { backgroundColor: hexWithAlpha(colors.textTertiary, 0.1) },
            ]}
          >
            <Text style={[styles.rankChipText, { color: colors.textTertiary }]}>
              #{row.rank}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.statGrid}>
        <StatRow
          colors={colors}
          styles={styles}
          label="Rating"
          trailing={
            <View style={styles.ratingRow}>
              {Array.from({ length: 5 }).map((_, i) => {
                const filled = row.accuracyPercentage / 20 > i;
                return (
                  <Star
                    key={i}
                    size={11}
                    color={filled ? accent : colors.border}
                    fill={filled ? accent : 'transparent'}
                  />
                );
              })}
              <Text style={[styles.statMuted, { color: colors.textTertiary }]}>
                ({row.totalPoints})
              </Text>
            </View>
          }
        />
        <StatRow
          colors={colors}
          styles={styles}
          label="Votes"
          trailing={
            <View style={styles.ratingRow}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {row.totalVotes}
              </Text>
              <Text
                style={[
                  styles.statMuted,
                  {
                    color:
                      row.accuracyPercentage >= 70
                        ? colors.primary
                        : colors.textTertiary,
                  },
                ]}
              >
                {row.accuracyPercentage.toFixed(0)}%
              </Text>
            </View>
          }
        />
        <StatRow
          colors={colors}
          styles={styles}
          label="Accuracy"
          trailing={
            <View style={styles.ratingRow}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {row.correctVotes}
              </Text>
              <Text style={[styles.statMuted, { color: colors.primary }]}>
                {correctPct.toFixed(0)}%
              </Text>
              <Text style={[styles.statMuted, { color: colors.away }]}>
                /{wrongPct.toFixed(0)}%
              </Text>
            </View>
          }
        />
        <StatRow
          colors={colors}
          styles={styles}
          label="Streak"
          trailing={
            <View style={styles.ratingRow}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {row.currentStreak}
              </Text>
              <Text style={[styles.statMuted, { color: colors.textTertiary }]}>
                best {row.bestStreak}
              </Text>
            </View>
          }
        />
      </View>

      <View style={styles.memberFooter}>
        <View
          style={[
            styles.onlinePill,
            {
              backgroundColor: row.isOnline
                ? colors.primary
                : hexWithAlpha(colors.textTertiary, 0.5),
            },
          ]}
        >
          <Text style={styles.onlinePillText}>
            {row.isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
        <View style={styles.accuracyBarTrack}>
          <View
            style={[
              styles.accuracyBarFill,
              {
                width: `${Math.max(
                  0,
                  Math.min(100, row.accuracyPercentage),
                )}%`,
                backgroundColor: accent,
              },
            ]}
          />
        </View>
      </View>
    </Pressable>
  );
}

function StatRow({
  colors,
  styles,
  label,
  trailing,
}: {
  colors: FanColors;
  styles: ReturnType<typeof createStyles>;
  label: string;
  trailing: React.ReactNode;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      {trailing}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  VOTERS TAB
//  Per-fixture voters list, filtered to comrades + you (matches the
//  Flutter ComradeModal's VOTES tab behaviour).
// ═══════════════════════════════════════════════════════════════

function VotersTab({
  colors,
  styles,
  fixture,
  userId,
  channelId,
  authToken,
}: {
  colors: FanColors;
  styles: ReturnType<typeof createStyles>;
  fixture: Fixture;
  userId: string | null;
  channelId: string | null;
  authToken: string | null;
}) {
  const [voters, setVoters] = useState<VoterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<VoteFilter>('all');
  const requestSeq = useRef(0);

  const load = async (showSpinner: boolean) => {
    if (!userId) return;
    const seq = ++requestSeq.current;
    if (showSpinner) setLoading(true);

    const fixtureId = fixture.matchId || fixture.id;
    try {
      const [rawVoters, comrades] = await Promise.all([
        fetchVoters(fixtureId),
        getUserComrades(userId, authToken ?? undefined),
      ]);
      if (seq !== requestSeq.current) return;
      const comradesList = new Set(comrades.map((c) => c.comrade_id));
      const list: VoterRow[] = (Array.isArray(rawVoters) ? rawVoters : [])
        .map((v: any) => ({
          userId: v.userId ?? v.user_id ?? '',
          username: v.username ?? v.userName ?? 'Anonymous',
          selection: v.selection ?? '',
          isComrade: comradesList.has(v.userId ?? v.user_id ?? ''),
        }))
        // Filter to comrades + self, same as the Flutter modal.
        .filter((v) => v.isComrade || v.userId === userId)
        // Current user first, then alphabetical.
        .sort((a, b) => {
          if (a.userId === userId) return -1;
          if (b.userId === userId) return 1;
          return a.username.localeCompare(b.username);
        });
      setVoters(list);
    } catch {
      if (seq === requestSeq.current) setVoters([]);
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture.matchId ?? fixture.id, userId, channelId]);

  const stats = useMemo(() => {
    let home = 0,
      away = 0,
      draw = 0;
    for (const v of voters) {
      if (v.selection === 'home_team') home++;
      else if (v.selection === 'away_team') away++;
      else if (v.selection === 'draw') draw++;
    }
    const total = home + away + draw;
    return {
      home,
      away,
      draw,
      total,
      homePct: total > 0 ? (home / total) * 100 : 0,
      awayPct: total > 0 ? (away / total) * 100 : 0,
      drawPct: total > 0 ? (draw / total) * 100 : 0,
    };
  }, [voters]);

  const filtered = useMemo(() => {
    if (filter === 'all') return voters;
    if (filter === 'home')
      return voters.filter((v) => v.selection === 'home_team');
    if (filter === 'away')
      return voters.filter((v) => v.selection === 'away_team');
    return voters.filter((v) => v.selection === 'draw');
  }, [voters, filter]);

  const voteColor = (sel: string) => {
    if (sel === 'home_team') return colors.primary;
    if (sel === 'away_team') return colors.away;
    if (sel === 'draw') return colors.draw;
    return colors.textTertiary;
  };

  const displayVote = (sel: string) => {
    if (sel === 'home_team') return fixture.homeTeam;
    if (sel === 'away_team') return fixture.awayTeam;
    if (sel === 'draw') return 'Draw';
    return sel;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.grow}>
      {/* Vote summary bar */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <SummaryStat
            colors={colors}
            styles={styles}
            label={fixture.homeTeam}
            count={stats.home}
            pct={stats.homePct}
            color={colors.primary}
          />
          <SummaryStat
            colors={colors}
            styles={styles}
            label="Draw"
            count={stats.draw}
            pct={stats.drawPct}
            color={colors.draw}
          />
          <SummaryStat
            colors={colors}
            styles={styles}
            label={fixture.awayTeam}
            count={stats.away}
            pct={stats.awayPct}
            color={colors.away}
          />
        </View>
        <View style={styles.summaryBarTrack}>
          {stats.total === 0 ? (
            <View
              style={[
                styles.summaryBarFill,
                { flex: 1, backgroundColor: colors.border },
              ]}
            />
          ) : (
            <>
              {stats.home > 0 && (
                <View
                  style={[
                    styles.summaryBarFill,
                    {
                      flex: Math.max(stats.homePct, 1),
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              )}
              {stats.draw > 0 && (
                <View
                  style={[
                    styles.summaryBarFill,
                    {
                      flex: Math.max(stats.drawPct, 1),
                      backgroundColor: colors.draw,
                    },
                  ]}
                />
              )}
              {stats.away > 0 && (
                <View
                  style={[
                    styles.summaryBarFill,
                    {
                      flex: Math.max(stats.awayPct, 1),
                      backgroundColor: colors.away,
                    },
                  ]}
                />
              )}
            </>
          )}
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <FilterChip
          colors={colors}
          styles={styles}
          label="All"
          count={stats.total}
          active={filter === 'all'}
          color={colors.primary}
          onPress={() => setFilter('all')}
        />
        <FilterChip
          colors={colors}
          styles={styles}
          label={fixture.homeTeam}
          count={stats.home}
          active={filter === 'home'}
          color={colors.primary}
          onPress={() => setFilter('home')}
        />
        <FilterChip
          colors={colors}
          styles={styles}
          label="Draw"
          count={stats.draw}
          active={filter === 'draw'}
          color={colors.draw}
          onPress={() => setFilter('draw')}
        />
        <FilterChip
          colors={colors}
          styles={styles}
          label={fixture.awayTeam}
          count={stats.away}
          active={filter === 'away'}
          color={colors.away}
          onPress={() => setFilter('away')}
        />
      </ScrollView>

      {/* Voters list */}
      <FlatList
        style={styles.grow}
        contentContainerStyle={styles.votersContent}
        data={filtered}
        keyExtractor={(v) => v.userId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(false);
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Users size={32} color={hexWithAlpha(colors.textTertiary, 0.4)} />
            <Text style={[styles.empty, { marginTop: FAN_SPACING.sm }]}>
              {filter === 'all'
                ? 'No votes yet'
                : 'No votes for this selection'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMe = item.userId === userId;
          const vc = voteColor(item.selection);
          return (
            <View style={styles.voterRow}>
              <View
                style={[
                  styles.voterAvatar,
                  { backgroundColor: hexWithAlpha(vc, 0.1) },
                ]}
              >
                <Text style={[styles.voterAvatarText, { color: vc }]}>
                  {initials(item.username)}
                </Text>
              </View>
              <View style={styles.voterTextWrap}>
                <View style={styles.nameRow}>
                  <Text
                    style={[
                      styles.voterName,
                      {
                        color: isMe ? colors.primary : colors.textPrimary,
                      },
                    ]}
                  >
                    {isMe ? 'You' : item.username}
                  </Text>
                  {item.isComrade && !isMe && (
                    <View
                      style={[
                        styles.mePill,
                        {
                          backgroundColor: hexWithAlpha(colors.primary, 0.15),
                        },
                      ]}
                    >
                      <Text
                        style={[styles.mePillText, { color: colors.primary }]}
                      >
                        COMRADE
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.voterSub}>
                  Voted for {displayVote(item.selection)}
                </Text>
              </View>
              <View
                style={[
                  styles.voterChip,
                  { backgroundColor: hexWithAlpha(vc, 0.1) },
                ]}
              >
                <Text style={[styles.voterChipText, { color: vc }]}>
                  {displayVote(item.selection)}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

function SummaryStat({
  colors,
  styles,
  label,
  count,
  pct,
  color,
}: {
  colors: FanColors;
  styles: ReturnType<typeof createStyles>;
  label: string;
  count: number;
  pct: number;
  color: string;
}) {
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.summaryStatValue, { color }]}>{count}</Text>
      <Text style={[styles.summaryStatLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[
          styles.summaryStatPct,
          { color: hexWithAlpha(color, 0.7) },
        ]}
      >
        {pct.toFixed(0)}%
      </Text>
    </View>
  );
}

function FilterChip({
  colors,
  styles,
  label,
  count,
  active,
  color,
  onPress,
}: {
  colors: FanColors;
  styles: ReturnType<typeof createStyles>;
  label: string;
  count: number;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        {
          backgroundColor: active ? color : hexWithAlpha(color, 0.06),
          borderColor: active ? 'transparent' : hexWithAlpha(color, 0.15),
        },
        pressed && { opacity: PRESSED_OPACITY },
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          { color: active ? '#FFFFFF' : color },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count > 0 && (
        <Text
          style={[
            styles.filterChipCount,
            {
              color: active
                ? 'rgba(255,255,255,0.85)'
                : hexWithAlpha(color, 0.85),
            },
          ]}
        >
          {count}
        </Text>
      )}
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ACTIVITY HISTORY SHEET  (drill-down)
// ═══════════════════════════════════════════════════════════════

interface ActivityHistoryParams {
  userId: string;
  userName: string;
  displayName: string;
  clubFan: string;
  authToken: string | null;
}

interface ArchiveActivity {
  id: string;
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  activityType: 'vote' | 'comment' | 'like';
  selectedTeam: string;
  comment?: string;
  timestamp: Date;
}

function openActivityHistory(params: ActivityHistoryParams) {
  // The activity history sheet is a nested Modal, so it's simplest to
  // keep its open/close state in a module-level event rather than
  // threading another context. For now it's rendered inline below
  // within the same Modal — see ActivityHistorySheet usage below.
  ActivityHistoryController.open(params);
}

// Tiny module-level controller so ChampionCard/MemberCard can trigger
// the sheet without prop-drilling an open function through every layer.
const ActivityHistoryController = (() => {
  let handler: ((p: ActivityHistoryParams) => void) | null = null;
  return {
    bind(fn: (p: ActivityHistoryParams) => void) {
      handler = fn;
    },
    open(p: ActivityHistoryParams) {
      handler?.(p);
    },
  };
})();

function ActivityHistorySheet({
  params,
  onClose,
  colors,
}: {
  params: ActivityHistoryParams | null;
  onClose: () => void;
  colors: FanColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activities, setActivities] = useState<ArchiveActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Votes' | 'Comments' | 'Likes'>(
    'All',
  );

  useEffect(() => {
    if (!params) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const raw = await fetchUserActivityHistory(
          params.userId,
          params.authToken ?? undefined,
        );
        if (cancelled) return;
        const list: ArchiveActivity[] = (
          Array.isArray(raw) ? raw : []
        ).map((item: any) => ({
          id: item._id?.toString() ?? String(Math.random()),
          fixtureId: item.fixture_id?.toString() ?? '',
          homeTeam: item.home_team?.toString() ?? '',
          awayTeam: item.away_team?.toString() ?? '',
          activityType: (item.activity_type?.toString() ??
            'vote') as ArchiveActivity['activityType'],
          selectedTeam:
            item.selection === 'home_team'
              ? item.home_team ?? 'Home'
              : item.selection === 'away_team'
                ? item.away_team ?? 'Away'
                : 'Draw',
          comment: item.comment?.toString(),
          timestamp: item.timestamp
            ? new Date(item.timestamp)
            : new Date(),
        }));
        list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setActivities(list);
      } catch {
        if (!cancelled) setActivities([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const filtered = useMemo(() => {
    if (filter === 'All') return activities;
    const want =
      filter === 'Votes' ? 'vote' : filter === 'Comments' ? 'comment' : 'like';
    return activities.filter((a) => a.activityType === want);
  }, [activities, filter]);

  if (!params) return null;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View
              style={[
                styles.memberAvatar,
                { backgroundColor: hexWithAlpha(colors.primary, 0.12) },
              ]}
            >
              <Text style={[styles.memberAvatarText, { color: colors.primary }]}>
                {initials(params.displayName)}
              </Text>
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {params.displayName}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                @{params.userName}
                {params.clubFan ? ` · ${params.clubFan}` : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <X size={14} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Filter tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {(['All', 'Votes', 'Comments', 'Likes'] as const).map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={({ pressed }) => [
                  styles.filterTab,
                  pressed && { opacity: PRESSED_OPACITY },
                ]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    {
                      color:
                        filter === f ? colors.primary : colors.textTertiary,
                      fontWeight: filter === f ? '600' : '400',
                    },
                  ]}
                >
                  {f}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Content */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.center}>
              <Inbox
                size={32}
                color={hexWithAlpha(colors.textTertiary, 0.4)}
              />
              <Text style={[styles.empty, { marginTop: FAN_SPACING.sm }]}>
                No activities yet
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.grow}
              contentContainerStyle={styles.content}
            >
              {filtered.map((a) => (
                <ActivityCard key={a.id} activity={a} colors={colors} styles={styles} />
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActivityCard({
  activity,
  colors,
  styles,
}: {
  activity: ArchiveActivity;
  colors: FanColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const accent =
    activity.activityType === 'vote'
      ? colors.primary
      : activity.activityType === 'comment'
        ? colors.draw
        : colors.textTertiary;

  const Icon =
    activity.activityType === 'vote'
      ? Vote
      : activity.activityType === 'comment'
        ? MessageCircle
        : Heart;

  return (
    <View
      style={[
        styles.activityCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.activityHeaderRow}>
        <Icon size={12} color={accent} />
        <Text style={[styles.activityType, { color: accent }]}>
          {activity.activityType.toUpperCase()}
        </Text>
        <Text style={styles.activityDot}>•</Text>
        <Text style={styles.activityTime}>
          {timeAgo(activity.timestamp)}
        </Text>
      </View>
      <View style={styles.activityTeams}>
        <Text
          style={[styles.activityTeam, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {activity.homeTeam}
        </Text>
        <Text style={styles.activityVs}>vs</Text>
        <Text
          style={[styles.activityTeam, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {activity.awayTeam}
        </Text>
      </View>
      <View style={styles.activityBody}>
        <View style={[styles.activityBar, { backgroundColor: accent }]} />
        {activity.activityType === 'comment' ? (
          <Text
            style={[styles.activityText, { color: colors.textPrimary }]}
            numberOfLines={2}
          >
            {activity.comment ?? 'No comment'}
          </Text>
        ) : activity.activityType === 'vote' ? (
          <Text style={[styles.activityText, { color: colors.primary }]}>
            {activity.selectedTeam}
          </Text>
        ) : (
          <Text style={[styles.activityText, { color: colors.textTertiary }]}>
            Showed support
          </Text>
        )}
      </View>
    </View>
  );
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

/** Convert a hex color (#RRGGBB) + alpha fraction into rgba(). */
function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

function createStyles(colors: FanColors) {
  return StyleSheet.create({
    grow: { flex: 1 },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '85%',
      borderTopLeftRadius: FAN_RADIUS.xl,
      borderTopRightRadius: FAN_RADIUS.xl,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    handleWrap: {
      alignItems: 'center',
      paddingTop: FAN_SPACING.sm,
      paddingBottom: FAN_SPACING.xs,
    },
    handle: {
      width: 32,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.borderActive,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: FAN_SPACING.lg,
      paddingVertical: FAN_SPACING.sm,
    },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexWithAlpha(colors.primary, 0.12),
    },
    headerTextWrap: { flex: 1, marginLeft: FAN_SPACING.sm },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    headerSub: {
      color: colors.textTertiary,
      fontSize: 10,
      marginTop: 1,
    },
    closeBtn: {
      borderRadius: 999,
      padding: 6,
      backgroundColor: colors.surfaceSunken,
    },
    screen: { backgroundColor: colors.background },
    content: {
      paddingHorizontal: FAN_SPACING.md,
      paddingBottom: FAN_SPACING.xxl,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: FAN_SPACING.lg,
    },
    empty: {
      color: colors.textTertiary,
      fontSize: 12,
      textAlign: 'center',
    },
    pickerWrap: {
      borderRadius: FAN_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginHorizontal: FAN_SPACING.md,
      marginBottom: FAN_SPACING.xs,
      overflow: 'hidden',
    },

    // ── Tab bar ─────────────────────────────────────────
    tabBar: {
      flexDirection: 'row',
      marginHorizontal: FAN_SPACING.md,
      marginTop: FAN_SPACING.xs,
      marginBottom: FAN_SPACING.sm,
      padding: 3,
      borderRadius: FAN_RADIUS.md,
      backgroundColor: colors.surfaceSunken,
      borderWidth: 0.5,
      borderColor: colors.border,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: FAN_SPACING.xs,
      borderRadius: FAN_RADIUS.sm,
    },
    tabButtonActive: {
      backgroundColor: colors.surface,
    },
    tabButtonText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
    },

    // ── Champion card ──────────────────────────────────
    championCard: {
      borderRadius: FAN_RADIUS.lg,
      borderWidth: 1,
      padding: FAN_SPACING.md,
      marginBottom: FAN_SPACING.md,
    },
    championTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    championPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    championPillText: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    rankChip: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    rankChipText: {
      fontSize: 10,
      fontWeight: '700',
    },
    championIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: FAN_SPACING.sm,
    },
    championAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: FAN_SPACING.sm,
    },
    championAvatarText: {
      fontSize: 17,
      fontWeight: '700',
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    championName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      flexShrink: 1,
    },
    championHandle: {
      color: colors.textTertiary,
      fontSize: 10,
      marginTop: 1,
    },
    championClub: {
      color: colors.textTertiary,
      fontSize: 9,
      marginTop: 1,
    },
    mePill: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 6,
    },
    mePillText: {
      fontSize: 7,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    championStats: {
      flexDirection: 'row',
      marginTop: FAN_SPACING.md,
      justifyContent: 'space-around',
    },
    championStat: {
      alignItems: 'center',
      gap: 3,
    },
    championStatValue: {
      fontSize: 16,
      fontWeight: '700',
    },
    championStatLabel: {
      fontSize: 8,
      letterSpacing: 0.6,
    },

    // ── Member card ────────────────────────────────────
    memberCard: {
      borderRadius: FAN_RADIUS.md,
      borderWidth: 1,
      padding: FAN_SPACING.md,
      marginBottom: FAN_SPACING.sm,
    },
    memberHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: FAN_SPACING.sm,
    },
    memberAvatarText: {
      fontSize: 14,
      fontWeight: '700',
    },
    memberName: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '600',
      flexShrink: 1,
    },
    memberSub: {
      color: colors.textTertiary,
      fontSize: 9,
      marginTop: 1,
    },
    memberMedal: {
      fontSize: 22,
    },
    statGrid: {
      marginTop: FAN_SPACING.sm,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 3,
    },
    statLabel: {
      fontSize: 10,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    statValue: {
      fontSize: 10,
      fontWeight: '600',
    },
    statMuted: {
      fontSize: 9,
    },
    memberFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: FAN_SPACING.sm,
      gap: FAN_SPACING.sm,
    },
    onlinePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    onlinePillText: {
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: '#FFFFFF',
    },
    accuracyBarTrack: {
      flex: 1,
      height: 4,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    accuracyBarFill: {
      height: 4,
      borderRadius: 3,
    },

    // ── Voters tab ─────────────────────────────────────
    summaryCard: {
      marginHorizontal: FAN_SPACING.md,
      marginBottom: FAN_SPACING.xs,
      paddingHorizontal: FAN_SPACING.md,
      paddingVertical: FAN_SPACING.sm,
      borderRadius: FAN_RADIUS.md,
      backgroundColor: colors.surfaceSunken,
      borderWidth: 0.5,
      borderColor: colors.border,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryStat: {
      flex: 1,
      alignItems: 'center',
    },
    summaryStatValue: {
      fontSize: 14,
      fontWeight: '700',
    },
    summaryStatLabel: {
      fontSize: 8,
      fontWeight: '500',
      marginTop: 1,
    },
    summaryStatPct: {
      fontSize: 7,
      marginTop: 1,
    },
    summaryBarTrack: {
      flexDirection: 'row',
      height: 3,
      borderRadius: 2,
      overflow: 'hidden',
      marginTop: FAN_SPACING.xs,
      backgroundColor: colors.border,
    },
    summaryBarFill: {
      height: 3,
    },
    filterRow: {
      paddingHorizontal: FAN_SPACING.md,
      paddingVertical: FAN_SPACING.xs,
      gap: FAN_SPACING.xs,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 14,
      borderWidth: 0.5,
      maxWidth: 160,
    },
    filterChipText: {
      fontSize: 9,
      fontWeight: '600',
    },
    filterChipCount: {
      fontSize: 8,
      fontWeight: '700',
    },
    votersContent: {
      paddingHorizontal: FAN_SPACING.md,
      paddingBottom: FAN_SPACING.xxl,
    },
    voterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: FAN_SPACING.sm,
    },
    voterAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: FAN_SPACING.sm,
    },
    voterAvatarText: {
      fontSize: 11,
      fontWeight: '600',
    },
    voterTextWrap: { flex: 1 },
    voterName: {
      fontSize: 11,
      fontWeight: '500',
      flexShrink: 1,
    },
    voterSub: {
      fontSize: 8,
      color: colors.textTertiary,
      marginTop: 1,
    },
    voterChip: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
    },
    voterChipText: {
      fontSize: 9,
      fontWeight: '500',
    },

    // ── Activity sheet ─────────────────────────────────
    filterTab: {
      paddingHorizontal: FAN_SPACING.sm,
      paddingVertical: FAN_SPACING.xs,
    },
    filterTabText: {
      fontSize: 10,
    },
    activityCard: {
      borderRadius: FAN_RADIUS.sm,
      borderWidth: 0.5,
      padding: FAN_SPACING.sm,
      marginBottom: FAN_SPACING.sm,
    },
    activityHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    activityType: {
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    activityDot: {
      color: colors.textTertiary,
      fontSize: 8,
    },
    activityTime: {
      color: colors.textTertiary,
      fontSize: 8,
    },
    activityTeams: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: FAN_SPACING.xs,
    },
    activityTeam: {
      fontSize: 10,
      fontWeight: '500',
      flexShrink: 1,
    },
    activityVs: {
      fontSize: 9,
      color: colors.textTertiary,
    },
    activityBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: FAN_SPACING.xs,
    },
    activityBar: {
      width: 2,
      height: 12,
      borderRadius: 1,
    },
    activityText: {
      fontSize: 10,
      flex: 1,
    },
  });
}