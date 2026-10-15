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
import type { CSSProperties, ReactNode } from 'react';
const StyleSheet = { create: <T extends Record<string, unknown>>(styles: T): T => styles };
import { Star, Users, Crown, Award } from 'lucide-react';
import {
    FAN_SPACING,
    FAN_RADIUS,
    type Channel,
    type ChannelMember,
    memberVoteAccuracy,
} from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';

type FanColors = ReturnType<typeof useFanColors>;

function rankColor(rank: number, colors: FanColors): string {
    if (rank === 1) return colors.primary;
    if (rank === 2) return colors.textSecondary;
    if (rank === 3) return colors.textTertiary;
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
        <div style={styles.memberCard}>
            <div style={styles.memberRow}>
                {/* Avatar + rank number badge */}
                <div
                    className="home-avatar"
                    style={{ ...Object.assign({}, 
                        styles.memberAvatar,
                        { backgroundColor: colors.primaryDim },
                    ) }}
                >
                    <span style={{ ...Object.assign({}, styles.memberAvatarText, { color: colors.primary }) }}>
                        {(member.username?.[0] ?? '?').toUpperCase()}
                    </span>
                    <span
                        style={{ ...Object.assign({}, 
                            styles.memberAvatarRank,
                            { color: hexWithAlpha(colors.primary, 0.6) },
                        ) }}
                    >
                        {rank}
                    </span>
                </div>

                <div style={styles.memberBody}>
                    {/* Name + You pill + View link */}
                    <div style={styles.nameRow}>
                        <span
                            style={{ ...Object.assign({}, styles.memberName, { color: colors.textPrimary }) }}
                            className="profile-ellipsis"
                        >
                            {member.username}
                        </span>
                        {isYou && (
                            <div
                                style={{ ...Object.assign({}, 
                                    styles.youPill,
                                    { backgroundColor: colors.primaryMuted },
                                ) }}
                            >
                                <span style={{ ...Object.assign({}, styles.youPillText, { color: colors.primary }) }}>
                                    You
                                </span>
                            </div>
                        )}
                        <div style={{ flex: 1 }} />
                        {onViewProfile && (
                            <button type="button" onClick={onViewProfile} >
                                <span style={{ ...Object.assign({}, styles.viewLink, { color: colors.primary }) }}>
                                    View
                                </span>
                            </button>
                        )}
                    </div>

                    {/* Rating row */}
                    <div style={styles.statRow}>
                        <span style={{ ...Object.assign({}, styles.statLabel, { color: colors.textTertiary }) }}>
                            Rating
                        </span>
                        <div style={styles.starsRow}>
                            {[0, 1, 2, 3, 4].map((i) => (
                                <Star
                                    key={i}
                                    size={10}
                                    color={i < starCount ? colors.primary : colors.border}
                                    fill={i < starCount ? colors.primary : 'transparent'}
                                />
                            ))}
                            <span
                                style={{ ...Object.assign({}, styles.statValueMuted, { color: colors.textTertiary }) }}
                            >
                                ({member.totalVotes})
                            </span>
                        </div>
                    </div>

                    {/* Votes row */}
                    <div style={styles.statRow}>
                        <span style={{ ...Object.assign({}, styles.statLabel, { color: colors.textTertiary }) }}>
                            Votes
                        </span>
                        <span style={{ ...Object.assign({}, styles.statValue, { color: colors.textPrimary }) }}>
                            {member.totalVotes}
                        </span>
                        <div style={{ flex: 1 }} />
                        <span
                            style={{ ...Object.assign({}, styles.statValueMuted, { color: colors.textTertiary }) }}
                        >
                            {Math.round(winRate * 100)}%
                        </span>
                    </div>

                    {/* Messages row */}
                    <div style={styles.statRow}>
                        <span style={{ ...Object.assign({}, styles.statLabel, { color: colors.textTertiary }) }}>
                            Messages
                        </span>
                        <span style={{ ...Object.assign({}, styles.statValue, { color: colors.textPrimary }) }}>
                            {member.msgCount}
                        </span>
                    </div>

                    {/* Points row */}
                    <div style={styles.statRow}>
                        <span style={{ ...Object.assign({}, styles.statLabel, { color: colors.textTertiary }) }}>
                            Points
                        </span>
                        <span style={{ ...Object.assign({}, styles.statValue, { color: colors.textPrimary }) }}>
                            {member.seasonPoints}
                        </span>
                    </div>

                    {/* Rank badge + progress bar */}
                    <div style={styles.footerRow}>
                        <div
                            style={{ ...Object.assign({}, 
                                styles.rankPill,
                                { backgroundColor: hexWithAlpha(accent, 0.15) },
                            ) }}
                        >
                            <span style={{ ...Object.assign({}, styles.rankPillText, { color: accent }) }}>
                                {rankBadge(rank)}
                            </span>
                        </div>
                        <div
                            style={{ ...Object.assign({}, 
                                styles.progressTrack,
                                { backgroundColor: hexWithAlpha(colors.border, 0.3) },
                            ) }}
                        >
                            <div
                                style={{ ...Object.assign({}, 
                                    styles.progressFill,
                                    {
                                        width: `${pointsFraction * 100}%`,
                                        backgroundColor: accent,
                                    },
                                ) }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
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
            <div style={styles.emptyWrap}>
                <Users size={32} color={hexWithAlpha(colors.textTertiary, 0.4)} />
                <span style={{ ...Object.assign({}, styles.emptyTitle, { color: colors.textTertiary }) }}>
                    No channels joined
                </span>
                <span style={{ ...Object.assign({}, styles.emptyHint, { color: colors.textTertiary }) }}>
                    Join a channel to see members
                </span>
            </div>
        );
    }

    const activeChannel = visibleChannels[activeTab] ?? visibleChannels[0];
    const sortedMembers = [...activeChannel.members].sort(
        (a, b) => b.seasonPoints - a.seasonPoints,
    );
    const maxPoints = sortedMembers[0]?.seasonPoints ?? 0;

    return (
        <div style={styles.wrap}>
            {/* Tab bar */}
            <div
                style={{ ...Object.assign({}, 
                    styles.tabBar,
                    {
                        backgroundColor: colors.surfaceSunken,
                        borderColor: colors.border,
                    },
                ) }}
            >
                {visibleChannels.map((channel, idx) => {
                    const isActive = idx === activeTab;
                    const label =
                        channel.name.length > 8
                            ? `${channel.name.substring(0, 8)}…`
                            : channel.name;
                    return (
                        <button type="button"
                            key={channel.channelId || idx}
                            onClick={() => setActiveTab(idx)}
                            style={{ ...Object.assign({}, 
                                styles.tab,
                                isActive && { backgroundColor: colors.surface },
                            ) }}
                        >
                            <span
                                style={{ ...Object.assign({}, 
                                    styles.tabText,
                                    {
                                        color: isActive
                                            ? colors.textPrimary
                                            : colors.textTertiary,
                                        fontWeight: isActive ? '700' : '400',
                                    },
                                ) }}
                                className="profile-ellipsis"
                            >
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Channel header */}
            <div
                style={{ ...Object.assign({}, 
                    styles.channelHeader,
                    {
                        backgroundColor: colors.primaryDim,
                        borderColor: colors.borderActive,
                    },
                ) }}
            >
                <div
                    style={{ ...Object.assign({}, 
                        styles.channelAvatar,
                        { backgroundColor: colors.primary },
                    ) }}
                >
                    <span style={styles.channelAvatarText}>
                        {(activeChannel.name?.[0] ?? '?').toUpperCase()}
                    </span>
                </div>
                <div style={{ flex: 1 }}>
                    <span
                        style={{ ...Object.assign({}, styles.channelName, { color: colors.textPrimary }) }}
                        className="profile-ellipsis"
                    >
                        {activeChannel.name}
                    </span>
                    <div style={styles.channelMeta}>
                        <Users size={9} color={colors.textTertiary} />
                        <span
                            style={{ ...Object.assign({}, styles.channelMetaText, { color: colors.textTertiary }) }}
                        >
                            {activeChannel.memberCount}
                        </span>
                        <Award size={9} color={colors.textTertiary} />
                        <span
                            style={{ ...Object.assign({}, styles.channelMetaText, { color: colors.textTertiary }) }}
                        >
                            S{activeChannel.season}
                        </span>
                        {activeChannel.isAdmin && (
                            <div
                                style={{ ...Object.assign({}, 
                                    styles.adminPill,
                                    { backgroundColor: colors.primaryMuted },
                                ) }}
                            >
                                <Crown size={8} color={colors.primary} />
                                <span style={{ ...Object.assign({}, styles.adminPillText, { color: colors.primary }) }}>
                                    Admin
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Members list */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {sortedMembers.map((member, index) => (
                    <MemberCard
                        key={member.userId || index}
                        colors={colors}
                        styles={styles}
                        member={member}
                        rank={index + 1}
                        maxPoints={maxPoints}
                        isYou={member.userId === currentUserId}
                        onViewProfile={() => onViewMember(member)}
                    />
                ))}
            </div>
        </div>
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
            color: colors.textPrimary,
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
            backgroundColor: 'transparent',
            borderRadius: 0,
            borderWidth: 0,
            borderBottomWidth: 1,
            borderBottomColor: hexWithAlpha(colors.border, 0.3),
            padding: FAN_SPACING.md,
            marginBottom: 0,
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