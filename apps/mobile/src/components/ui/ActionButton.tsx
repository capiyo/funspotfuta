// components/ui/ActionButton.tsx
// Icon + optional count. Replaces FooterPill in PostCard AND the three
// emoji footer items in MatchCard, so every card's footer is the same
// component with the same icons, sizes and pressed state.
//
// When `onPress` is undefined the button renders as a static View:
// no Pressable, no pressed opacity, no button a11y role. Used for
// display-only counts like the Comments pill on MatchCard.

import { Pressable, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { FanColorPalette, FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';
import { HIT_SLOP, ICON, PRESSED_OPACITY } from '@/theme/layout';

export function ActionButton({
    icon: Icon,
    count,
    active = false,
    activeColor,
    colors,
    label,
    onPress,
}: {
    icon: LucideIcon;
    count?: number;
    active?: boolean;
    activeColor?: string;
    colors: FanColorPalette;
    /** Accessibility label, e.g. "Like" */
    label: string;
    onPress?: () => void;
}) {
    const color = active ? activeColor ?? colors.primary : colors.textSecondary;

    const content = (
        <>
            <Icon size={ICON.sm} color={color} fill={active ? color : 'none'} />
            {count !== undefined && (
                <Text style={fanText('caption', colors, color)}>{count}</Text>
            )}
        </>
    );

    const baseStyle = {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: FAN_SPACING.xs,
    };

    // Display-only: no touch target, no pressed state, no button role.
    if (!onPress) {
        return (
            <View
                style={baseStyle}
                accessibilityRole="text"
                accessibilityLabel={`${label}${count !== undefined ? `: ${count}` : ''}`}
            >
                {content}
            </View>
        );
    }

    return (
        <Pressable
            onPress={onPress}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => ({
                ...baseStyle,
                opacity: pressed ? PRESSED_OPACITY : 1,
            })}
        >
            {content}
        </Pressable>
    );
}