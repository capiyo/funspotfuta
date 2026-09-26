// components/ui/CountryCodePicker.tsx
//
// Minimal stand-in for Flutter's CountryCodePicker: a pressable dial-code
// chip that opens a short list. Same favorites list and default (Kenya) as
// login_modal.dart's `favorite: ['+254','US','GB','NG','GH','ZA','TZ','UG']`
// / `initialSelection: 'KE'`. No external package dependency — if the repo
// already has react-native-country-picker-modal or similar wired up
// elsewhere, swap this out for that instead of adding a second library.

import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { FanColorPalette, FAN_RADIUS, FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';
import { ICON } from '@/theme/layout';

export interface CountryOption {
    code: string; // ISO 3166-1 alpha-2
    dialCode: string; // e.g. "+254"
    flag: string;
    name: string;
}

// Same favorites/order as the Flutter picker, Kenya first as the default.
export const COUNTRY_OPTIONS: CountryOption[] = [
    { code: 'KE', dialCode: '+254', flag: '🇰🇪', name: 'Kenya' },
    { code: 'US', dialCode: '+1', flag: '🇺🇸', name: 'United States' },
    { code: 'GB', dialCode: '+44', flag: '🇬🇧', name: 'United Kingdom' },
    { code: 'NG', dialCode: '+234', flag: '🇳🇬', name: 'Nigeria' },
    { code: 'GH', dialCode: '+233', flag: '🇬🇭', name: 'Ghana' },
    { code: 'ZA', dialCode: '+27', flag: '🇿🇦', name: 'South Africa' },
    { code: 'TZ', dialCode: '+255', flag: '🇹🇿', name: 'Tanzania' },
    { code: 'UG', dialCode: '+256', flag: '🇺🇬', name: 'Uganda' },
];

export const DEFAULT_COUNTRY = COUNTRY_OPTIONS[0]; // KE

export function CountryCodePicker({
    colors,
    value,
    onChange,
}: {
    colors: FanColorPalette;
    value: CountryOption;
    onChange: (c: CountryOption) => void;
}) {
    const [open, setOpen] = useState(false);
    const styles = createStyles(colors);

    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
                hitSlop={6}
            >
                <Text style={styles.flag}>{value.flag}</Text>
                <Text style={fanText('body', colors, colors.textPrimary)}>{value.dialCode}</Text>
                <ChevronDown size={ICON.sm} color={colors.textTertiary} />
            </Pressable>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
                    <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                        <Text style={[fanText('caption', colors, colors.textSecondary), styles.sheetTitle]}>
                            SELECT COUNTRY
                        </Text>
                        <FlatList
                            data={COUNTRY_OPTIONS}
                            keyExtractor={(item) => item.code}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                                    onPress={() => {
                                        onChange(item);
                                        setOpen(false);
                                    }}
                                >
                                    <Text style={styles.flag}>{item.flag}</Text>
                                    <Text style={[fanText('body', colors, colors.textPrimary), styles.grow]}>
                                        {item.name}
                                    </Text>
                                    <Text style={fanText('caption', colors, colors.textTertiary)}>
                                        {item.dialCode}
                                    </Text>
                                </Pressable>
                            )}
                        />
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

function createStyles(colors: FanColorPalette) {
    return StyleSheet.create({
        chip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.xs,
            paddingHorizontal: FAN_SPACING.base,
            borderRightWidth: 1,
            borderRightColor: colors.border,
        },
        flag: { fontSize: 16 },
        grow: { flex: 1 },
        backdrop: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            paddingHorizontal: FAN_SPACING.xxl,
        },
        sheet: {
            backgroundColor: colors.background,
            borderRadius: FAN_RADIUS.md,
            borderWidth: 1,
            borderColor: colors.border,
            maxHeight: '60%',
            paddingVertical: FAN_SPACING.sm,
        },
        sheetTitle: {
            paddingHorizontal: FAN_SPACING.lg,
            paddingVertical: FAN_SPACING.sm,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: FAN_SPACING.base,
            paddingHorizontal: FAN_SPACING.lg,
            paddingVertical: FAN_SPACING.base,
        },
        separator: { height: 1, backgroundColor: colors.border, marginLeft: FAN_SPACING.lg },
    });
}