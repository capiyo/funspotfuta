// components/ui/Chip.tsx
//
// Single source for every pill-shaped tag/filter/selector in the app.
// Before this component existed, three places each hand-rolled their
// own version with different literal numbers:
//   HomeScreen.chip        — FAN_RADIUS.pill, FAN_SPACING.base/sm, surfaceSunken
//   ArenaScreen.filterChip — FAN_RADIUS.pill, FAN_SPACING.base/md, surfaceSunken
//   PostCard.pillPrimary/pillMuted — raw borderRadius:999, raw padding 6/1
//
// One component, two variants (selectable filter/chip vs. small inline
// tag), covers all three use cases. Do not add a fourth hand-rolled
// pill anywhere else — extend this component instead.

import { Pressable, Text, StyleSheet } from 'react-native';
import { FanColorPalette, FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';

export function Chip({
    label,
    colors,
    active = false,
    variant = 'filter',
    activeTextColor,
    /** 'tag' variant only — e.g. PostCard's primary-tinted "NEW" pill vs. its neutral type-tag pill. Ignored for 'filter'. */
    tone = 'neutral',
    onPress,
}: {
    label: string;
    colors: FanColorPalette;
    active?: boolean;
    /**
     * 'filter'  — HomeScreen channel chips, ArenaScreen status filters:
     *             larger tap target, meant to be pressed/toggled.
     * 'tag'     — PostCard's NEW/type-tag pills: small, informational,
     *             not necessarily interactive (onPress optional).
     */
    variant?: 'filter' | 'tag';
    activeTextColor?: string;
    tone?: 'neutral' | 'primary';
    onPress?: () => void;
}) {
    const styles = createStyles(colors, variant, tone);

    return (
        <Pressable
            onPress={onPress}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityState={onPress ? { selected: active } : undefined}
            style={[styles.chip, active && styles.chipActive]}
        >
            <Text
                style={fanText(
                    variant === 'tag' ? 'tag' : 'caption',
                    colors,
                    active
                        ? activeTextColor ?? colors.textInverse
                        : tone === 'primary'
                            ? colors.primary
                            : colors.textSecondary,
                )}
            >
                {label}
            </Text>
        </Pressable>
    );
}

function createStyles(
    colors: FanColorPalette,
    variant: 'filter' | 'tag',
    tone: 'neutral' | 'primary',
) {
    return StyleSheet.create({
        chip: {
            borderRadius: FAN_RADIUS.pill,
            backgroundColor:
                variant === 'tag' && tone === 'primary' ? colors.primaryDim : colors.surfaceSunken,
            paddingHorizontal: variant === 'tag' ? FAN_SPACING.md : FAN_SPACING.base,
            paddingVertical: variant === 'tag' ? FAN_SPACING.xs : FAN_SPACING.sm,
        },
        chipActive: {
            backgroundColor: colors.primary,
        },
    });
}