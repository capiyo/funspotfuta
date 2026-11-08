// components/MatchDetailsModal/LineupsTab.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    LayoutChangeEvent,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { AlertCircle, CircleDot } from 'lucide-react-native';

import { FAN_SPACING } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import type { Fixture } from '../../../../../packages/core/src/types/fixture';
import type { LineupsData } from '../../../../../packages/core/src/types/matchDetails';
import { PitchView } from './pitchView';

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function hexWithAlpha(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return hex;
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ═══════════════════════════════════════════════════════════════
//  EMPTY STATE
// ═══════════════════════════════════════════════════════════════

interface EmptyStateProps {
    icon: 'error' | 'soccer';
    message: string;
}

function EmptyState({ icon, message }: EmptyStateProps) {
    const colors = useFanColors();
    return (
        <View style={styles.emptyState}>
            {icon === 'error' ? (
                <AlertCircle size={48} color={hexWithAlpha(colors.textTertiary, 0.5)} />
            ) : (
                <CircleDot size={48} color={hexWithAlpha(colors.textTertiary, 0.5)} />
            )}
            <View style={{ height: FAN_SPACING.md }} />
            <Text style={[fanText('body', colors), { color: colors.textSecondary }]}>
                {message}
            </Text>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  LINEUPS TAB
// ═══════════════════════════════════════════════════════════════

export interface LineupsTabProps {
    fixture: Fixture;
    lineups: LineupsData | null;
    loading: boolean;
    error: string;
}

export function LineupsTab({
    fixture,
    lineups,
    loading,
    error,
}: LineupsTabProps) {
    const colors = useFanColors();
    const [availableHeight, setAvailableHeight] = useState(0);
    const onLayout = (event: LayoutChangeEvent) => setAvailableHeight(event.nativeEvent.layout.height);


    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    if (error) {
        return <EmptyState icon="error" message={error} />;
    }

    if (!lineups) {
        return <EmptyState icon="soccer" message="No lineup available" />;
    }


    return (
        <View style={{ flex: 1 }} onLayout={onLayout}>
            {/* Pitch */}
            <ScrollView
                style={styles.pitchScroller}
                contentContainerStyle={styles.pitchScroll}
                showsVerticalScrollIndicator={false}
                contentInsetAdjustmentBehavior="never"
            >
                <PitchView
                    homeTeam={fixture.homeTeam}
                    awayTeam={fixture.awayTeam}
                    homeFormation={lineups.homeFormation}
                    awayFormation={lineups.awayFormation}
                    homePlayers={lineups.homeStartingXI}
                    awayPlayers={lineups.awayStartingXI}
                    maxHeight={Math.max(1, availableHeight)}
                />
            </ScrollView>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: FAN_SPACING.lg,
    },
    pitchScroller: {
        flex: 1,
        minHeight: 0,
    },
    pitchScroll: {
        flexGrow: 1,
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        paddingLeft: FAN_SPACING.sm,
        paddingRight: FAN_SPACING.sm,
        paddingTop: 0,
        paddingBottom: FAN_SPACING.sm,
    },
});