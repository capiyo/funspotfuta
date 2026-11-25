// components/MatchDetailsModal/LineupsTab.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    LayoutChangeEvent,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    Pressable,
} from 'react-native';
import { AlertCircle, CircleDot } from 'lucide-react-native';

import { FAN_SPACING } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import type { Fixture } from '../../../../../packages/core/src/types/fixture';
import type { LineupsData } from '../../../../../packages/core/src/types/matchDetails';
import { BenchColumn, PitchView } from './pitchView';
import { TeamCrest } from '@/components/TeamCrest';

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
    const [showSquads, setShowSquads] = useState(false);
    const crestFixture = {
      homeTeamImageUrl: fixture.homeTeamImageUrl,
      awayTeamImageUrl: fixture.awayTeamImageUrl,
      homeCompetitorId: fixture.homeCompetitorId,
      awayCompetitorId: fixture.awayCompetitorId,
    };
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
            <View style={styles.toggleRow}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showSquads }}
                    onPress={() => setShowSquads((current) => !current)}
                    style={[styles.toggleButton, { backgroundColor: hexWithAlpha(colors.primary, 0.14) }]}
                >
                    <Text style={[styles.toggleText, { color: colors.primary }]}>
                        {showSquads ? 'Less' : 'More'}
                    </Text>
                </Pressable>
            </View>
            {!showSquads ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8, gap: 8 }}>
                    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TeamCrest name={fixture.homeTeam} fixture={crestFixture} side="home" size={20} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text numberOfLines={1} style={[fanText('caption', colors), { color: colors.textPrimary }]}>{fixture.homeTeam}</Text>
                            <Text style={[fanText('tag', colors), { color: colors.textSecondary }]}>{lineups.homeFormation}</Text>
                        </View>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
                            <Text numberOfLines={1} style={[fanText('caption', colors), { color: colors.textPrimary }]}>{fixture.awayTeam}</Text>
                            <Text style={[fanText('tag', colors), { color: colors.textSecondary }]}>{lineups.awayFormation}</Text>
                        </View>
                        <TeamCrest name={fixture.awayTeam} fixture={crestFixture} side="away" size={20} />
                    </View>
                </View>
            ) : null}
            {showSquads ? (
                <ScrollView
                    style={styles.pitchScroller}
                    contentContainerStyle={styles.squadContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.squadColumn}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TeamCrest name={fixture.homeTeam} fixture={crestFixture} side="home" size={20} />
                            <Text style={[fanText('body', colors), styles.teamHeading, { color: colors.textPrimary }]}>{fixture.homeTeam}</Text>
                        </View>
                        <Text style={[fanText('caption', colors), styles.coachText, { color: colors.textSecondary }]}>Coach: {lineups.homeCoach}</Text>
                        <BenchColumn players={lineups.homeBench} color={colors.primary} />
                    </View>
                    <View style={styles.squadColumn}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TeamCrest name={fixture.awayTeam} fixture={crestFixture} side="away" size={20} />
                            <Text style={[fanText('body', colors), styles.teamHeading, { color: colors.textPrimary }]}>{fixture.awayTeam}</Text>
                        </View>
                        <Text style={[fanText('caption', colors), styles.coachText, { color: colors.textSecondary }]}>Coach: {lineups.awayCoach}</Text>
                        <BenchColumn players={lineups.awayBench} color={colors.away} />
                    </View>
                </ScrollView>
            ) : (
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
            )}
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
    toggleRow: {
        alignItems: 'flex-end',
        paddingHorizontal: FAN_SPACING.sm,
        paddingBottom: FAN_SPACING.xs,
    },
    toggleButton: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 999,
    },
    toggleText: {
        fontSize: 11,
        fontWeight: '700',
    },
    squadContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: FAN_SPACING.sm,
        paddingBottom: FAN_SPACING.md,
        gap: FAN_SPACING.sm,
    },
    squadColumn: {
        flex: 1,
        minWidth: 0,
    },
    teamHeading: {
        fontWeight: '700',
        marginBottom: 5,
    },
    coachText: {
        marginBottom: 8,
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