// components/ui/LiveBadge.tsx
// The ONE live indicator. MatchCard previously showed live status three
// times (header pill, "ON AIR" row, footer "live" pill).

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FanColorPalette, FAN_RADIUS, FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';

export function LiveBadge({ colors }: { colors: FanColorPalette }) {
    const styles = useMemo(
        () =>
            StyleSheet.create({
                root: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: FAN_SPACING.xs,
                    borderRadius: FAN_RADIUS.pill,
                    paddingHorizontal: FAN_SPACING.sm,
                    paddingVertical: 1,
                    backgroundColor: colors.awayDim,
                },
                dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live },
            }),
        [colors],
    );

    return (
        <View style={styles.root}>
            <View style={styles.dot} />
            <Text style={fanText('tag', colors, colors.live)}>Live</Text>
        </View>
    );
}