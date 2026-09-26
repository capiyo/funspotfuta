// components/ScoreLine.tsx
// Home | score | Away. MatchCard and HistoryCard each hand-built this with
// different type roles (MatchCard: 'caption' + raw fontWeight, score in
// 'title' + raw fontWeight 700; HistoryCard: 'title'/'body', score in
// 'statValue'). One component; team names are plain 'body' text.
//
// STYLE PASS: team names and the center "vs"/score now use the same small
// caption font/family + colors.textSecondary as the comment-preview line,
// for consistency with the rest of the card. This drops the old
// winner-vs-loser color distinction (primary vs secondary) — the "Winner: X"
// line under the scoreboard on completed matches already carries that info,
// but say the word if you'd rather keep some visual emphasis on the winning
// side (e.g. via weight instead of color) and I'll add it back.

import { StyleSheet, Text, View } from 'react-native';
import { FanColorPalette, FAN_SPACING } from '@funspot/core';
import { fanText } from '@/theme/use-fan-typography';
import { Avatar } from './Avatar';

export function ScoreLine({
    colors,
    homeTeam,
    awayTeam,
    center,
    homeWon = false,
    awayWon = false,
    crests = false,
}: {
    colors: FanColorPalette;
    homeTeam: string;
    awayTeam: string;
    /** "2 : 1", or "vs" before kickoff */
    center: string;
    homeWon?: boolean;
    awayWon?: boolean;
    /** Show the initial-in-a-circle placeholders (swap for real crests later). */
    crests?: boolean;
}) {
    // Team names: same caption size/family/color as the comment preview,
    // for every side, win or lose.
    const teamStyle = fanText('caption', colors, colors.textSecondary);

    return (
        <View style={styles.row}>
            <View style={[styles.side, styles.sideHome]}>
                <Text style={[teamStyle, styles.name]} numberOfLines={1}>
                    {homeTeam}
                </Text>
                {crests && (
                    <Avatar
                        colors={colors}
                        size="sm"
                        label={homeTeam.charAt(0).toUpperCase()}
                        borderColor={colors.primary}
                    />
                )}
            </View>

            {/* "vs" / score — same caption style, not the old bigger statValue */}
            <Text style={[fanText('caption', colors, colors.textSecondary), styles.center]}>
                {center}
            </Text>

            <View style={[styles.side, styles.sideAway]}>
                {crests && (
                    <Avatar
                        colors={colors}
                        size="sm"
                        label={awayTeam.charAt(0).toUpperCase()}
                        borderColor={colors.away}
                    />
                )}
                <Text style={[teamStyle, styles.name]} numberOfLines={1}>
                    {awayTeam}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: FAN_SPACING.sm },
    sideHome: { justifyContent: 'flex-end' },
    sideAway: { justifyContent: 'flex-start' },
    name: { flexShrink: 1 },
    center: { paddingHorizontal: FAN_SPACING.base, textAlign: 'center' },
});