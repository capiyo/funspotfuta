// components/MatchDetailsModal/StatsTab.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import { FAN_SPACING } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import type { MatchStatistics } from '../../../../../packages/core/src/types/matchDetails';

// ═══════════════════════════════════════════════════════════════
//  STAT ROW
// ═══════════════════════════════════════════════════════════════

interface StatItem {
    label: string;
    home: number;
    away: number;
    suffix: string;
}

interface StatRowProps {
    stat: StatItem;
}

function StatRow({ stat }: StatRowProps) {
    const colors = useFanColors();
    const total = stat.home + stat.away;
    const homePercent = total > 0 ? stat.home / total : 0.5;
    const homeFlex = Math.max(Math.round(homePercent * 100), 1);
    const awayFlex = Math.max(100 - homeFlex, 1);

    return (
        <View style= { styles.statRowContainer } >
        <View style={ styles.statRow }>
            <Text
          style={
        [
            fanText('statValue', colors),
            {
                width: 48,
                textAlign: 'right',
                color:
                    stat.home > stat.away
                        ? colors.primary
                        : colors.textSecondary,
            },
        ]
    }
        >
        { stat.home }
    { stat.suffix }
    </Text>
        < Text
    style = {
        [
        fanText('caption', colors),
        { flex: 1, textAlign: 'center', color: colors.textTertiary },
          ]}
        >
        { stat.label }
        </Text>
        < Text
    style = {
        [
        fanText('statValue', colors),
        {
            width: 48,
            color:
                stat.away > stat.home ? colors.away : colors.textSecondary,
        },
          ]}
        >
        { stat.away }
    { stat.suffix }
    </Text>
        </View>
        < View style = {{ height: 6 }
} />
    < View style = { styles.statBarTrack } >
        <View
          style={
    [
        styles.statBarFill,
        {
            flex: homeFlex,
            backgroundColor: colors.primary,
        },
    ]
}
        />
    < View
style = {
    [
    styles.statBarFill,
    {
        flex: awayFlex,
        backgroundColor: colors.away,
    },
          ]}
    />
    </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STATS TAB
// ═══════════════════════════════════════════════════════════════

export interface StatsTabProps {
    homeTeam: string;
    awayTeam: string;
    statistics: MatchStatistics | null;
}

export function StatsTab({ homeTeam, awayTeam, statistics }: StatsTabProps) {
    const colors = useFanColors();
    if (!statistics) return null;

    const statsItems: StatItem[] = [
        {
            label: 'Possession',
            home: statistics.ballPossessionHome,
            away: statistics.ballPossessionAway,
            suffix: '%',
        },
        {
            label: 'Total Shots',
            home: statistics.totalShotsHome,
            away: statistics.totalShotsAway,
            suffix: '',
        },
        {
            label: 'Shots on Target',
            home: statistics.shotsOnTargetHome,
            away: statistics.shotsOnTargetAway,
            suffix: '',
        },
        {
            label: 'Pass Accuracy',
            home: statistics.passAccuracyHome,
            away: statistics.passAccuracyAway,
            suffix: '%',
        },
        {
            label: 'Corners',
            home: statistics.cornersHome,
            away: statistics.cornersAway,
            suffix: '',
        },
        {
            label: 'Fouls',
            home: statistics.foulsHome,
            away: statistics.foulsAway,
            suffix: '',
        },
        {
            label: 'Yellow Cards',
            home: statistics.yellowCardsHome,
            away: statistics.yellowCardsAway,
            suffix: '',
        },
    ];

    return (
        <ScrollView contentContainerStyle= { styles.statsScroll } >
        <View style={ styles.statsTeamHeader }>
            <Text
          style={
        [
            fanText('title', colors),
            {
                flex: 1,
                textAlign: 'center',
                color: colors.primary,
            },
        ]
    }
        >
        { homeTeam }
        </Text>
        < View style = {{ width: 16 }
} />
    < Text
style = {
    [
    fanText('title', colors),
    {
        flex: 1,
        textAlign: 'center',
        color: colors.away,
    },
          ]}
    >
    { awayTeam }
    </Text>
    </View>
{
    statsItems.map((s) => (
        <StatRow key= { s.label } stat = { s } />
      ))
}
</ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    statsScroll: {
        padding: FAN_SPACING.base,
    },
    statsTeamHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: FAN_SPACING.base,
    },
    statRowContainer: {
        marginBottom: FAN_SPACING.base,
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statBarTrack: {
        flexDirection: 'row',
        height: 4,
        borderRadius: 4,
        overflow: 'hidden',
    },
    statBarFill: {
        height: 4,
    },
});