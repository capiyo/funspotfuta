// apps/mobile/src/modals/ProfileModal/ChannelLeaderboard.tsx
//
// Per-channel leaderboard tabs from funspot/lib/modals/profile/
// swipeable_profile_modal.dart (_buildChannelTabBar + _buildChannelFragment
// + _LeaderboardMemberCard).
//
// Channel + ChannelMember are imported from their canonical location in
// @funspot/core. There are two `Channel` interfaces in the barrel
// (comrade-service and channels-service), so we reach for the one with
// `members: ChannelMember[]` explicitly via the `Channel` re-export that
// types/channel.ts provides.

import { useMemo, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    FlatList,
} from 'react-native';
import { Star, Users, Crown, Award } from 'lucide-react-native';
import {
    FAN_SPACING,
    FAN_RADIUS,
    type Channel,
    type ChannelMember,
    memberVoteAccuracy,
} from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';

type FanColors = ReturnType<typeof useFanColors>;

// Rank colors — medal gold/silver/bronze. Not design tokens.
const RANK_GOLD = '#FFC107';
const RANK_SILVER = '#B0BEC5';
const RANK_BRONZE = '#CD7F32';

function rankColor(rank: number, colors: FanColors): string {
    if (rank === 1) return RANK_GOLD;
    if (rank === 2) return RANK_SILVER;
    if (rank === 3) return RANK_BRONZE;
    return colors.textTertiary;
}

function rankBadge(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
}

function hexWithAlpha(hex: string, alpha: number): string {
    const c = hex.replace('#', '');
    if (c.length !== 6) return hex;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ═══════════════════════════════════════════════════════════════
//  MEMBER CARD
// ═══════════════════════════════════════════════════════════════

function MemberCard({
    colors,
    styles,
    member,
    rank,
    maxPoints,
    isYou,
    onViewProfile,
}: {
    colors: FanColors;
    styles: ReturnType<typeof createStyles>;
    member: ChannelMember;
    rank: number;
    maxPoints: number;
    isYou: boolean;
    onViewProfile?: () => void;
}) {
    const winRate = memberVoteAccuracy(member) / 100;
    const starCount = Math.min(Math.max(Math.round(winRate * 5), 0), 5);
    const pointsFraction =
        maxPoints > 0
            ? Math.min(Math.max(member.seasonPoints / maxPoints, 0), 1)
            : 0;
    const accent = rankColor(rank, colors);

    return (
        <View style={styles.memberCard}>
            <View style={styles.memberRow}>
                {/* Avatar + rank number badge */}
                <View
                    style={[
                        styles.memberAvatar,
                        { backgroundColor: colors.primaryDim },
                    ]}
                >
                    <Text style={[styles.memberAvatarText, { color: colors.primary }]}>
                        {(member.username?.[0] ?? '?').toUpperCase()}
                    </Text>
                    <Text
                        style={[
                            styles.memberAvatarRank,
                            { color: hexWithAlpha(colors.primary, 0.6) },
                        ]}
                    >
                        {rank}
                    </Text>
                </View>

                <View style={styles.memberBody}>
                    {/* Name + You pill + View link */}
                    <View style={styles.nameRow}>
                        <Text
                            style={[styles.memberName, { color: colors.textPrimary }]}
                            numberOfLines={1}
                        >
                            {member.username}
                        </Text>
                        {isYou && (
                            <View
                                style={[
                                    styles.youPill,
                                    { backgroundColor: colors.primaryMuted },
                                ]}
                            >
                                <Text style={[styles.youPillText, { color: colors.primary }]}>
                                    You
                                </Text>
                            </View>
                        )}
                        <View style={{ flex: 1 }} />
                        {onViewProfile && (
                            <Pressable onPress={onViewProfile} hitSlop={6}>
                                <Text style={[styles.viewLink, { color: colors.primary }]}>
                                    View
                                </Text>
                            </Pressable>
                        )}
                    </View>

                    {/* Rating row */}
                    <View style={styles.statRow}>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                            Rating
                        </Text>
                        <View style={styles.starsRow}>
                            {[0, 1, 2, 3, 4].map((i) => (
                                <Star
                                    key={i}
                                    size={10}
                                    color={i < starCount ? RANK_GOLD : colors.border}
                                    fill={i < starCount ? RANK_GOLD : 'transparent'}
                                />
                            ))}
                            <Text
                                style={[styles.statValueMuted, { color: colors.textTertiary }]}
                            >
                                ({member.totalVotes})
                            </Text>
                        </View>
                    </View>

                    {/* Votes row */}
                    <View style={styles.statRow}>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                            Votes
                        </Text>
                        <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                            {member.totalVotes}
                        </Text>
                        <View style={{ flex: 1 }} />
                        <Text
                            style={[styles.statValueMuted, { color: colors.textTertiary }]}
                        >
                            {Math.round(winRate * 100)}%
                        </Text>
                    </View>

                    {/* Messages row */}
                    <View style={styles.statRow}>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                            Messages
                        </Text>
                        <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                            {member.msgCount}
                        </Text>
                    </View>

                    {/* Points row */}
                    <View style={styles.statRow}>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                            Points
                        </Text>
                        <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                            {member.seasonPoints}
                        </Text>
                    </View>

                    {/* Rank badge + progress bar */}
                    <View style={styles.footerRow}>
                        <View
                            style={[
                                styles.rankPill,
                                { backgroundColor: hexWithAlpha(accent, 0.15) },
                            ]}
                        >
                            <Text style={[styles.rankPillText, { color: accent }]}>
                                {rankBadge(rank)}
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.progressTrack,
                                { backgroundColor: hexWithAlpha(colors.border, 0.3) },
                            ]}
                        >
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: `${pointsFraction * 100}%`,
                                        backgroundColor: accent,
                                    },
                                ]}
                            />
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  CHANNEL LEADERBOARD
// ═══════════════════════════════════════════════════════════════

export interface ChannelLeaderboardProps {
    channels: Channel[];
    currentUserId: string;
    onViewMember: (member: ChannelMember) => void;
}

export function ChannelLeaderboard({
    channels,
    currentUserId,
    onViewMember,
}: ChannelLeaderboardProps) {
    const colors = useFanColors();
    const styles = createStyles(colors);
    const [activeTab, setActiveTab] = useState(0);

    // Cap at 3 tabs — matches the Flutter source's
    // `_userChannels.length.clamp(0, 3)`.
    const visibleChannels = useMemo(() => channels.slice(0, 3), [channels]);

    if (visibleChannels.length === 0) {
        return (
            <View style={styles.emptyWrap}>
                <Users size={32} color={hexWithAlpha(colors.textTertiary, 0.4)} />
                <Text style={[styles.emptyTitle, { color: colors.textTertiary }]}>
                    No channels joined
                </Text>
                <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
                    Join a channel to see members
                </Text>
            </View>
        );
    }

    const activeChannel = visibleChannels[activeTab] ?? visibleChannels[0];
    const sortedMembers = [...activeChannel.members].sort(
        (a, b) => b.seasonPoints - a.seasonPoints,
    );
    const maxPoints = sortedMembers[0]?.seasonPoints ?? 0;

    return (
        <View style={styles.wrap}>
            {/* Tab bar */}
            <View
                style={[
                    styles.tabBar,
                    {
                        backgroundColor: colors.surfaceSunken,
                        borderColor: colors.border,
                    },
                ]}
            >
                {visibleChannels.map((channel, idx) => {
                    const isActive = idx === activeTab;
                    const label =
                        channel.name.length > 8
                            ? `${channel.name.substring(0, 8)}…`
                            : channel.name;
                    return (
                        <Pressable
                            key={channel.channelId || idx}
                            onPress={() => setActiveTab(idx)}
                            style={[
                                styles.tab,
                                isActive && { backgroundColor: colors.surface },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    {
                                        color: isActive
                                            ? colors.textPrimary
                                            : colors.textTertiary,
                                        fontWeight: isActive ? '700' : '400',
                                    },
                                ]}
                                numberOfLines={1}
                            >
                                {label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Channel header */}
            <View
                style={[
                    styles.channelHeader,
                    {
                        backgroundColor: colors.primaryDim,
                        borderColor: colors.borderActive,
                    },
                ]}
            >
                <View
                    style={[
                        styles.channelAvatar,
                        { backgroundColor: colors.primary },
                    ]}
                >
                    <Text style={styles.channelAvatarText}>
                        {(activeChannel.name?.[0] ?? '?').toUpperCase()}
                    </Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text
                        style={[styles.channelName, { color: colors.textPrimary }]}
                        numberOfLines={1}
                    >
                        {activeChannel.name}
                    </Text>
                    <View style={styles.channelMeta}>
                        <Users size={9} color={colors.textTertiary} />
                        <Text
                            style={[styles.channelMetaText, { color: colors.textTertiary }]}
                        >
                            {activeChannel.memberCount}
                        </Text>
                        <Award size={9} color={colors.textTertiary} />
                        <Text
                            style={[styles.channelMetaText, { color: colors.textTertiary }]}
                        >
                            S{activeChannel.season}
                        </Text>
                        {activeChannel.isAdmin && (
                            <View
                                style={[
                                    styles.adminPill,
                                    { backgroundColor: colors.primaryMuted },
                                ]}
                            >
                                <Crown size={8} color={colors.primary} />
                                <Text style={[styles.adminPillText, { color: colors.primary }]}>
                                    Admin
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* Members list */}
            <FlatList
                data={sortedMembers}
                keyExtractor={(m) => m.userId}
                contentContainerStyle={styles.membersList}
                ListEmptyComponent={
                    <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
                        No members yet
                    </Text>
                }
                renderItem={({ item, index }) => (
                    <MemberCard
                        colors={colors}
                        styles={styles}
                        member={item}
                        rank={index + 1}
                        maxPoints={maxPoints}
                        isYou={item.userId === currentUserId}
                        onViewProfile={
                            item.userId !== currentUserId
                                ? () => onViewMember(item)
                                : undefined
                        }
                    />
                )}
            />
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

function createStyles(colors: FanColors) {
    return StyleSheet.create({
        wrap: { flex: 1 },

        emptyWrap: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: FAN_SPACING.sm,
        },
        emptyTitle: { fontSize: 12, fontWeight: '600', marginTop: FAN_SPACING.sm },
        emptyHint: { fontSize: 10, textAlign: 'center' },

        // Tab bar
        tabBar: {
            flexDirection: 'row',
            marginHorizontal: FAN_SPACING.md,
            padding: 2,
            borderRadius: FAN_RADIUS.md,
            borderWidth: 0.5,
        },
        tab: {
            flex: 1,
            paddingVertical: 5,
            alignItems: 'center',
            borderRadius: FAN_RADIUS.sm,
        },
        tabText: { fontSize: 9 },

        // Channel header
        channelHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.md,
            marginHorizontal: FAN_SPACING.xs,
            marginTop: FAN_SPACING.sm,
            paddingHorizontal: FAN_SPACING.md,
            paddingVertical: FAN_SPACING.md,
            borderRadius: FAN_RADIUS.md,
            borderWidth: 0.5,
        },
        channelAvatar: {
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        channelAvatarText: {
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '700',
        },
        channelName: { fontSize: 11, fontWeight: '700' },
        channelMeta: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            marginTop: 2,
        },
        channelMetaText: { fontSize: 9 },
        adminPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            marginLeft: FAN_SPACING.sm,
            paddingHorizontal: 4,
            paddingVertical: 1,
            borderRadius: FAN_RADIUS.sm,
        },
        adminPillText: { fontSize: 7, fontWeight: '600' },

        // Members
        membersList: { paddingVertical: FAN_SPACING.md },
        memberCard: {
            backgroundColor: colors.surface,
            borderRadius: FAN_RADIUS.md,
            borderWidth: 0.5,
            borderColor: hexWithAlpha(colors.border, 0.3),
            padding: FAN_SPACING.md,
            marginBottom: FAN_SPACING.sm,
        },
        memberRow: { flexDirection: 'row', gap: FAN_SPACING.md },

        memberAvatar: {
            width: 36,
            height: 36,
            borderRadius: FAN_RADIUS.md,
            alignItems: 'center',
            justifyContent: 'center',
        },
        memberAvatarText: { fontSize: 14, fontWeight: '700' },
        memberAvatarRank: {
            position: 'absolute',
            bottom: 2,
            left: 2,
            fontSize: 9,
            fontWeight: '700',
        },

        memberBody: { flex: 1 },

        nameRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
        },
        memberName: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
        youPill: {
            paddingHorizontal: 4,
            paddingVertical: 1,
            borderRadius: FAN_RADIUS.sm,
        },
        youPillText: { fontSize: 7, fontWeight: '600' },
        viewLink: { fontSize: 9, fontWeight: '600' },

        statRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 1.5,
        },
        statLabel: { width: 60, fontSize: 9 },
        statValue: { fontSize: 10, fontWeight: '600' },
        statValueMuted: { fontSize: 9, fontWeight: '600' },
        starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },

        footerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.md,
            marginTop: FAN_SPACING.sm,
        },
        rankPill: {
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: FAN_RADIUS.md,
        },
        rankPillText: { fontSize: 9, fontWeight: '700' },
        progressTrack: {
            flex: 1,
            height: 3,
            borderRadius: 2,
            overflow: 'hidden',
        },
        progressFill: { height: '100%' },
    });
}