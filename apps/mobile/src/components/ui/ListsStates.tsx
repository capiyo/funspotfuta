// components/ui/ListStates.tsx
// Loading / empty / error / paging states shared by Arena, Feed and History.
// Before: Arena had skeleton cards, Feed and History had a bare spinner
// with marginTop:40, and "Load more" was duplicated per screen.

import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FanColorPalette, FAN_RADIUS, FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';
import { AVATAR_LG, GUTTER } from '@/theme/layout';

export function SkeletonRows({
    colors,
    count = 4,
}: {
    colors: FanColorPalette;
    count?: number;
}) {
    const styles = useMemo(
        () =>
            StyleSheet.create({
                row: {
                    flexDirection: 'row',
                    gap: FAN_SPACING.md,
                    paddingHorizontal: GUTTER,
                    paddingVertical: FAN_SPACING.lg,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                },
                avatar: {
                    width: AVATAR_LG,
                    height: AVATAR_LG,
                    borderRadius: AVATAR_LG / 2,
                    backgroundColor: colors.surfaceSunken,
                },
                lines: { flex: 1, gap: FAN_SPACING.sm },
                line: {
                    height: 10,
                    borderRadius: FAN_RADIUS.md,
                    backgroundColor: colors.surfaceSunken,
                },
            }),
        [colors],
    );

    return (
        <View>
            {Array.from({ length: count }, (_, i) => (
                <View key={i} style={styles.row}>
                    <View style={styles.avatar} />
                    <View style={styles.lines}>
                        <View style={[styles.line, { width: '40%' }]} />
                        <View style={[styles.line, { width: '90%' }]} />
                        <View style={[styles.line, { width: '70%' }]} />
                    </View>
                </View>
            ))}
        </View>
    );
}

export function EmptyState({
    colors,
    title,
    hint,
}: {
    colors: FanColorPalette;
    title: string;
    hint?: string;
}) {
    return (
        <View
            style={{
                alignItems: 'center',
                gap: FAN_SPACING.sm,
                paddingHorizontal: GUTTER,
                paddingTop: FAN_SPACING.xxxl,
            }}
        >
            <Text style={[fanText('title', colors, colors.textPrimary), { textAlign: 'center' }]}>
                {title}
            </Text>
            {hint && (
                <Text style={[fanText('body', colors, colors.textSecondary), { textAlign: 'center' }]}>
                    {hint}
                </Text>
            )}
        </View>
    );
}

export function ErrorBanner({
    colors,
    message,
}: {
    colors: FanColorPalette;
    message: string;
}) {
    return (
        <View
            style={{
                marginTop: FAN_SPACING.md,
                padding: FAN_SPACING.base,
                borderRadius: FAN_RADIUS.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSunken,
            }}
        >
            <Text style={fanText('caption', colors, colors.textPrimary)}>{message}</Text>
        </View>
    );
}

/** Footer spinner for onEndReached paging (replaces the "Load more" buttons). */
export function PagingFooter({
    colors,
    loading,
}: {
    colors: FanColorPalette;
    loading: boolean;
}) {
    if (!loading) return null;
    return (
        <View style={{ paddingVertical: FAN_SPACING.lg }}>
            <ActivityIndicator color={colors.primary} />
        </View>
    );
}