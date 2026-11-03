// apps/mobile/src/modals/ComradeListModal/ComradeCard.tsx
//
// The per-comrade row: avatar, nickname, @username, club + country,
// vote count badge, and the Profile + Add/Invite action buttons.
//
// The Add/Invite label depends on whether the current user is an admin of
// any channel — same as the Flutter source's _hasAdminChannels check.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
    User as UserIcon,
    UserPlus,
    Send,
    Lock,
    CheckCircle2,
    Trophy,
    Globe2,
    type LucideIcon,
} from 'lucide-react-native';
import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import type { ComradeProfile } from './types';

type FanColors = ReturnType<typeof useFanColors>;

function hexWithAlpha(hex: string, alpha: number): string {
    const c = hex.replace('#', '');
    if (c.length !== 6) return hex;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function initials(name: string): string {
    return name.length > 0 ? name[0].toUpperCase() : '?';
}

export interface ComradeCardProps {
    comrade: ComradeProfile;
    isAdded: boolean;
    isFull: boolean;
    hasAdminChannels: boolean;
    onProfile: () => void;
    onAction: () => void;
}

export function ComradeCard({
    comrade,
    isAdded,
    isFull,
    hasAdminChannels,
    onProfile,
    onAction,
}: ComradeCardProps) {
    const colors = useFanColors();
    const styles = createStyles(colors);

    const actionLabel = isFull
        ? 'Full'
        : hasAdminChannels
            ? 'Add'
            : 'Invite';
    const actionColor = isFull ? colors.away : colors.primary;

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: hexWithAlpha(colors.surface, 0.5),
                    borderColor: hexWithAlpha(colors.border, 0.15),
                },
            ]}
        >
            {/* Main row */}
            <View style={styles.mainRow}>
                {/* Avatar */}
                <View
                    style={[
                        styles.avatar,
                        {
                            backgroundColor: colors.primaryDim,
                            borderColor: hexWithAlpha(colors.primary, 0.3),
                        },
                    ]}
                >
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                        {initials(comrade.nickname)}
                    </Text>
                </View>

                <View style={{ width: FAN_SPACING.base }} />

                {/* Info */}
                <View style={styles.infoCol}>
                    <View style={styles.nameRow}>
                        <Text
                            style={[styles.nickname, { color: colors.textPrimary }]}
                            numberOfLines={1}
                        >
                            {comrade.nickname}
                        </Text>
                        {isAdded && (
                            <>
                                <View style={{ width: FAN_SPACING.md }} />
                                <View
                                    style={[
                                        styles.addedPill,
                                        { backgroundColor: colors.primaryDim },
                                    ]}
                                >
                                    <Text
                                        style={[styles.addedPillText, { color: colors.primary }]}
                                    >
                                        ✓ Added
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>

                    <Text
                        style={[styles.username, { color: colors.textSecondary }]}
                        numberOfLines={1}
                    >
                        @{comrade.username}
                    </Text>

                    <View style={styles.metaRow}>
                        <Trophy size={10} color={colors.textTertiary} />
                        <View style={{ width: 4 }} />
                        <Text
                            style={[styles.metaText, { color: colors.textTertiary }]}
                            numberOfLines={1}
                        >
                            {comrade.clubFan}
                        </Text>
                        <View style={{ width: FAN_SPACING.md }} />
                        <Globe2 size={10} color={colors.textTertiary} />
                        <View style={{ width: 4 }} />
                        <Text
                            style={[styles.metaText, { color: colors.textTertiary }]}
                            numberOfLines={1}
                        >
                            {comrade.countryFan}
                        </Text>
                    </View>
                </View>

                {/* Votes badge */}
                <View
                    style={[
                        styles.votesBadge,
                        {
                            backgroundColor: colors.surfaceSunken,
                            borderColor: hexWithAlpha(colors.border, 0.3),
                        },
                    ]}
                >
                    <Text style={[styles.votesBadgeText, { color: colors.textSecondary }]}>
                        {comrade.numberOfBets} votes
                    </Text>
                </View>
            </View>

            {/* Actions row */}
            <View style={styles.actionsRow}>
                <ActionPill
                    label="Profile"
                    Icon={UserIcon}
                    color={colors.textSecondary}
                    onPress={onProfile}
                />
                <View style={{ width: FAN_SPACING.md }} />
                {!isAdded && (
                    <ActionPill
                        label={actionLabel}
                        Icon={isFull ? Lock : hasAdminChannels ? UserPlus : Send}
                        color={actionColor}
                        onPress={isFull ? undefined : onAction}
                    />
                )}
            </View>
        </View>
    );
}

function ActionPill({
    label,
    Icon,
    color,
    onPress,
}: {
    label: string;
    Icon: LucideIcon;
    color: string;
    onPress?: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={!onPress}
            style={({ pressed }) => [
                {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 20,
                    borderWidth: 0.5,
                    backgroundColor: hexWithAlpha(color, 0.08),
                    borderColor: hexWithAlpha(color, 0.3),
                    opacity: pressed && onPress ? 0.7 : 1,
                },
            ]}
        >
            <Icon size={14} color={color} />
            <Text style={{ fontSize: 11, fontWeight: '600', color }}>{label}</Text>
        </Pressable>
    );
}

function createStyles(colors: FanColors) {
    return StyleSheet.create({
        card: {
            marginHorizontal: FAN_SPACING.lg,
            marginVertical: FAN_SPACING.sm,
            padding: FAN_SPACING.base,
            borderRadius: FAN_RADIUS.lg,
            borderWidth: 0.5,
        },
        mainRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        avatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
        },
        avatarText: { fontSize: 18, fontWeight: '700' },
        infoCol: { flex: 1 },
        nameRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        nickname: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
        addedPill: {
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 8,
        },
        addedPillText: { fontSize: 8, fontWeight: '600' },
        username: { fontSize: 11, marginTop: 2 },
        metaRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 2,
        },
        metaText: { fontSize: 10 },
        votesBadge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            borderWidth: 1,
        },
        votesBadgeText: { fontSize: 10, fontWeight: '600' },
        actionsRow: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginTop: 10,
        },
    });
}