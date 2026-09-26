// components/VoterList.tsx
// Replaces VoterStack. Lists up to three REAL voters side by side, each with
// a small avatar, their name and the team they picked:
//
//   (A) Kim          (B) Otieno       (C) Amina
//       Arsenal          Draw             Chelsea
//
// The avatar ring and the team text share the pick colour
// (home / away / draw), so the pick reads at a glance.
// Used by MatchCard and HistoryCard.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Users } from 'lucide-react-native';
import { FanColorPalette, FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';
import { HIT_SLOP, ICON, PRESSED_OPACITY } from '@/theme/layout';
import { Avatar } from './Avatar';

export interface VoterItem {
    id: string;
    /** May start with an emoji, e.g. "🔥 FireStriker" */
    name: string;
    /** Team (or "Draw") this person picked */
    team: string;
    /** Pick colour, used for the avatar ring and the team text */
    color: string;
}

const EMOJI_RE = /^(\p{Extended_Pictographic}\uFE0F?)\s*/u;

export function splitFanName(raw: string): { icon: string; name: string } {
    const match = raw.match(EMOJI_RE);
    if (!match) return { icon: '', name: raw };
    return { icon: match[1], name: raw.slice(match[0].length).trim() || raw };
}

export function initials(name: string): string {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

const SLOTS = 3;

export function VoterList({
    colors,
    voters,
    emptyLabel,
    onPress,
}: {
    colors: FanColorPalette;
    voters: VoterItem[];
    emptyLabel: string;
    onPress?: () => void;
}) {
    const shown = voters.slice(0, SLOTS);

    return (
        <Pressable
            onPress={onPress}
            hitSlop={HIT_SLOP}
            style={({ pressed }) => [styles.row, pressed && { opacity: PRESSED_OPACITY }]}
        >
            {shown.length === 0 ? (
                <View style={styles.empty}>
                    <Users size={ICON.sm} color={colors.textTertiary} />
                    <Text style={fanText('caption', colors, colors.textSecondary)}>{emptyLabel}</Text>
                </View>
            ) : (
                Array.from({ length: SLOTS }, (_, i) => {
                    const v = shown[i];
                    // Empty slots keep the columns aligned when fewer than 3 voted.
                    if (!v) return <View key={`empty-${i}`} style={styles.slot} />;
                    const { icon, name } = splitFanName(v.name);
                    return (
                        <View key={v.id} style={styles.slot}>
                            <Avatar
                                colors={colors}
                                size="sm"
                                label={icon || initials(name)}
                                borderColor={v.color}
                            />
                            <View style={styles.text}>
                                <Text
                                    style={fanText('caption', colors, colors.textPrimary)}
                                    numberOfLines={1}
                                >
                                    {name}
                                </Text>
                                <Text style={fanText('tag', colors, v.color)} numberOfLines={1}>
                                    {v.team}
                                </Text>
                            </View>
                        </View>
                    );
                })
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.md },
    // minWidth: 0 lets long names truncate instead of pushing the row wider
    slot: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.sm, minWidth: 0 },
    text: { flex: 1, minWidth: 0 },
    empty: { flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.sm },
});