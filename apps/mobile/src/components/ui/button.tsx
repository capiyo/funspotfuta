// components/ui/Button.tsx
//
// Single source for every button in the app. Before this component
// existed, the same "pill, primary-colored, POST-style CTA" was built
// twice with different literal values (FeedScreen.postButton), and the
// exact same "bordered, sunken-background, outline CTA" (the
// "Load more" button) was copy-pasted verbatim between FeedScreen and
// HistoryScreen — meaning a future edit to one would silently drift
// from the other. Both are now this one component.

import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { FanColorPalette, FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';

export function Button({
    label,
    colors,
    variant = 'primary',
    onPress,
    disabled = false,
    loading = false,
}: {
    label: string;
    colors: FanColorPalette;
    /**
     * 'primary' — solid, primary-colored pill CTA (was FeedScreen.postButton)
     * 'outline' — bordered, sunken-background CTA (was the duplicated
     *             "Load more" button in FeedScreen + HistoryScreen)
     */
    variant?: 'primary' | 'outline';
    onPress?: () => void;
    disabled?: boolean;
    loading?: boolean;
}) {
    const styles = createStyles(colors, variant);
    const isDisabled = disabled || loading;

    return (
        <Pressable
            style={({ pressed }) => [
                styles.button,
                isDisabled && styles.disabled,
                pressed && !isDisabled && { opacity: 0.85 },
            ]}
            onPress={onPress}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={variant === 'primary' ? colors.textInverse : colors.textSecondary}
                />
            ) : (
                <Text
                    style={fanText(
                        'button',
                        colors,
                        variant === 'primary' ? colors.textInverse : colors.textSecondary,
                    )}
                >
                    {label}
                </Text>
            )}
        </Pressable>
    );
}

function createStyles(colors: FanColorPalette, variant: 'primary' | 'outline') {
    return StyleSheet.create({
        button: {
            borderRadius: FAN_RADIUS.pill,
            paddingHorizontal: FAN_SPACING.lg,
            paddingVertical: FAN_SPACING.md,
            alignItems: 'center',
            justifyContent: 'center',
            ...(variant === 'primary'
                ? { backgroundColor: colors.primary }
                : {
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSunken,
                }),
        },
        disabled: {
            opacity: 0.5,
        },
    });
}