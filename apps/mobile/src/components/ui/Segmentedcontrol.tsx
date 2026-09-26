// components/ui/SegmentedControl.tsx
// Status filter (All / Live / Upcoming / Completed).
// Previously the channel row (Home) and the status row (Arena) were BOTH
// pill chips stacked on top of each other, so nothing told the user which
// row switched the channel and which one filtered the list. Channels stay
// as scrolling chips; status becomes this control.

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FanColorPalette, FAN_RADIUS, FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';

export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    colors,
}: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (next: T) => void;
    colors: FanColorPalette;
}) {
    const styles = useMemo(
        () =>
            StyleSheet.create({
                track: {
                    flexDirection: 'row',
                    padding: FAN_SPACING.xs,
                    borderRadius: FAN_RADIUS.md,
                    backgroundColor: colors.surfaceSunken,
                },
                segment: {
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: FAN_SPACING.sm,
                    borderRadius: FAN_RADIUS.md,
                },
                segmentActive: { backgroundColor: colors.surfaceElevated },
            }),
        [colors],
    );

    return (
        <View style={styles.track} accessibilityRole="tablist">
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <Pressable
                        key={o.value}
                        onPress={() => onChange(o.value)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        style={[styles.segment, active && styles.segmentActive]}
                    >
                        <Text
                            numberOfLines={1}
                            style={fanText(
                                'button',
                                colors,
                                active ? colors.textPrimary : colors.textSecondary,
                            )}
                        >
                            {o.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}