import { ReactNode } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useFanColors } from '@/theme/use-fan-colors';

export function FooterPill({
    icon,
    label,
    onPress,
    active = false,
    activeColor,
    disabled = false,
}: {
    icon: ReactNode;
    label?: string | number;
    onPress?: () => void;
    active?: boolean;
    activeColor?: string;
    disabled?: boolean;
}) {
    const colors = useFanColors();
    const styles = createStyles(colors);

    const displayLabel = typeof label === 'number' ? formatCount(label) : label;

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.pill,
                active && { backgroundColor: colors.primaryDim },
                pressed && { opacity: 0.85 },
                disabled && { opacity: 0.5 },
            ]}
        >
            <Text style={styles.icon}>{icon}</Text>
            {displayLabel != null && displayLabel !== '' && (
                <Text
                    style={[
                        styles.label,
                        active && { color: activeColor ?? colors.primary },
                    ]}
                >
                    {displayLabel}
                </Text>
            )}
        </Pressable>
    );
}

function formatCount(n: number): string {
    if (n < 1000) return `${n}`;
    if (n < 1_000_000) {
        const v = n / 1000;
        return `${v >= 100 ? Math.round(v) : v.toFixed(v < 10 ? 1 : 0).replace(/\.0$/, '')}K`;
    }
    const v = n / 1_000_000;
    return `${v.toFixed(v < 10 ? 1 : 0).replace(/\.0$/, '')}M`;
}

function createStyles(colors: ReturnType<typeof useFanColors>) {
    return StyleSheet.create({
        pill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            borderRadius: 999,
            backgroundColor: colors.surfaceSunken,
            paddingHorizontal: 10,
            paddingVertical: 4,
        },
        icon: { fontSize: 12, color: colors.textSecondary },
        label: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
    });
}