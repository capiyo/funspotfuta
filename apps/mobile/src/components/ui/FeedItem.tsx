// components/ui/FeedItem.tsx
// The single container for MatchCard, HistoryCard and PostCard.
// It owns the horizontal gutter, vertical rhythm and the hairline divider,
// so items stop blending into each other and stop double-padding inside
// screens.

import { ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { FanColorPalette, FAN_SPACING } from '@funspot/core';
import { GUTTER } from '@/theme/layout';

export function FeedItem({
    colors,
    onPress,
    style,
    children,
}: {
    colors: FanColorPalette;
    onPress?: () => void;
    style?: ViewStyle;
    children: ReactNode;
}) {
    const styles = useMemo(
        () =>
            StyleSheet.create({
                root: {
                    backgroundColor: colors.background,
                    paddingHorizontal: GUTTER,
                    paddingVertical: FAN_SPACING.lg,
                    gap: FAN_SPACING.md,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                },
            }),
        [colors],
    );

    if (!onPress) return <View style={[styles.root, style]}>{children}</View>;

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.root, style, pressed && { opacity: 0.85 }]}
        >
            {children}
        </Pressable>
    );
}