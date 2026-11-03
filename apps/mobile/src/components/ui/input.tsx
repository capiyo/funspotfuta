// components/ui/Input.tsx
//
// Single source for every text input in the app. Before this component
// existed, HistoryScreen's league filter (full pill: border + sunken
// background + radius) and FeedScreen's caption composer (no border, no
// background, no radius — just a bare TextInput) were two visually
// unrelated treatments of the same idea, in two tabs of the same app.
// MatchCard's inline comment box and HistoryCard's comment box each
// built a third, borderless-with-bottom-hairline variant.
//
// Three variants below cover all of them. Pick by role, not by copying
// whichever screen you're closest to.

import { TextInput, StyleSheet, TextInputProps } from 'react-native';
import { FanColorPalette, FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';

export function Input({
    colors,
    variant = 'pill',
    style,
    ...rest
}: {
    colors: FanColorPalette;
    /**
     * 'pill'    — bordered, sunken-background, fully rounded. Standalone
     *             filters/search (was HistoryScreen's league filter).
     * 'plain'   — no border/background, just text. Composer-style inputs
     *             that sit inside their own bordered container (was
     *             FeedScreen's caption input).
     * 'inline'  — bottom-hairline only. Comment boxes inside a card (was
     *             MatchCard/HistoryCard's inline comment prompt).
     */
    variant?: 'pill' | 'plain' | 'inline';
} & TextInputProps) {
    const styles = createStyles(colors, variant);

    return (
        <TextInput
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, fanText('body', colors, colors.textPrimary), style]}
            {...rest}
        />
    );
}

function createStyles(colors: FanColorPalette, variant: 'pill' | 'plain' | 'inline') {
    return StyleSheet.create({
        input:
            variant === 'pill'
                ? {
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSunken,
                    borderRadius: FAN_RADIUS.pill,
                    paddingHorizontal: FAN_SPACING.lg,
                    paddingVertical: FAN_SPACING.base,
                }
                : variant === 'inline'
                    ? {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                        paddingVertical: FAN_SPACING.sm,
                    }
                    : {
                        minHeight: 44,
                    },
    });
}