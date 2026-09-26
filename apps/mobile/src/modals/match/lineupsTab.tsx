// components/MatchDetailsModal/LineupsTab.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Animated,
    ScrollView,
    Easing,
} from 'react-native';
import { AlertCircle, CircleDot, X, ArrowLeftRight } from 'lucide-react-native';

import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import type { Fixture } from '../../../../../packages/core/src/types/fixture';
import type { LineupsData } from '../../../../../packages/core/src/types/matchDetails';
import { BenchColumn, PitchView } from './pitchView';

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
//  FORMATION PILL
// ═══════════════════════════════════════════════════════════════

interface FormationPillProps {
    teamName: string;
    formation: string;
    color: string;
    alignRight?: boolean;
}

function FormationPill({
    teamName,
    formation,
    color,
    alignRight = false,
}: FormationPillProps) {
    const colors = useFanColors();
    return (
        <View style={{ alignItems: alignRight ? 'flex-end' : 'flex-start' }}>
            <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[fanText('tag', colors), { color }]}
            >
                {teamName}
            </Text>
            <View style={{ height: 3 }} />
            <View
                style={[
                    styles.formationPill,
                    {
                        backgroundColor: hexWithAlpha(color, 0.12),
                        borderColor: hexWithAlpha(color, 0.3),
                    },
                ]}
            >
                <Text style={[styles.formationPillText, { color }]}>{formation}</Text>
            </View>
        </View>
    );
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
    const [showBench, setShowBench] = useState(false);
    const benchAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(benchAnim, {
            toValue: showBench ? 1 : 0,
            duration: 280,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
        }).start();
    }, [showBench, benchAnim]);

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

    const hasBench =
        lineups.homeBench.length > 0 || lineups.awayBench.length > 0;

    // Animate both scaleY and opacity so the drawer reads as a
    // SizeTransition rather than a flat grow. RN has no `transformOrigin`
    // style prop on older versions, so we pair scaleY with a top-anchored
    // layout (the drawer sits directly below the header row) instead.
    const benchScaleY = benchAnim;

    return (
        <View style={{ flex: 1 }}>
            {/* Formation header row with Bench button */}
            <View style={styles.formationRow}>
                <FormationPill
                    teamName={fixture.homeTeam}
                    formation={lineups.homeFormation}
                    color={colors.primary}
                />
                <View style={{ flex: 1 }} />
                {hasBench ? (
                    <Pressable onPress={() => setShowBench((v) => !v)}>
                        <View
                            style={[
                                styles.benchToggle,
                                {
                                    backgroundColor: showBench
                                        ? colors.primary
                                        : colors.background,
                                    borderColor: showBench
                                        ? colors.primary
                                        : colors.borderActive,
                                },
                            ]}
                        >
                            {showBench ? (
                                <X size={15} color="#FFFFFF" />
                            ) : (
                                <ArrowLeftRight size={15} color={colors.textSecondary} />
                            )}
                            <View style={{ width: 5 }} />
                            <Text
                                style={[
                                    styles.benchToggleText,
                                    {
                                        color: showBench ? '#FFFFFF' : colors.textSecondary,
                                    },
                                ]}
                            >
                                Bench
                            </Text>
                        </View>
                    </Pressable>
                ) : null}
                <View style={{ flex: 1 }} />
                <FormationPill
                    teamName={fixture.awayTeam}
                    formation={lineups.awayFormation}
                    color={colors.away}
                    alignRight
                />
            </View>

            {/* Bench animated drawer — mirrors Flutter's SizeTransition
          (sizeFactor driven by _benchAnimation, axisAlignment -1) */}
            <Animated.View
                style={{
                    transform: [{ scaleY: benchScaleY }],
                    opacity: benchAnim,
                }}
            >
                <View
                    style={[
                        styles.benchDrawer,
                        {
                            backgroundColor: colors.background,
                            borderBottomColor: hexWithAlpha(colors.primary, 0.25),
                        },
                    ]}
                >
                    <View style={styles.benchHeader}>
                        <View
                            style={[
                                styles.benchHeaderBar,
                                { backgroundColor: colors.primary },
                            ]}
                        />
                        <View style={{ width: 7 }} />
                        <Text
                            style={[
                                fanText('tag', colors),
                                { color: colors.primary, letterSpacing: 1.0 },
                            ]}
                        >
                            BENCH
                        </Text>
                    </View>
                    <View style={{ height: 10 }} />
                    <View style={styles.benchColumns}>
                        <View style={{ flex: 1 }}>
                            <BenchColumn
                                players={lineups.homeBench}
                                color={colors.primary}
                            />
                        </View>
                        <View
                            style={{
                                width: 0.5,
                                height: 160,
                                backgroundColor: colors.borderActive,
                                marginHorizontal: 10,
                            }}
                        />
                        <View style={{ flex: 1 }}>
                            <BenchColumn
                                players={lineups.awayBench}
                                color={colors.away}
                            />
                        </View>
                    </View>
                </View>
            </Animated.View>

            {/* Pitch */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.pitchScroll}
            >
                <PitchView
                    homeTeam={fixture.homeTeam}
                    awayTeam={fixture.awayTeam}
                    homeFormation={lineups.homeFormation}
                    awayFormation={lineups.awayFormation}
                    homePlayers={lineups.homeStartingXI}
                    awayPlayers={lineups.awayStartingXI}
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
    formationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: FAN_SPACING.base,
        paddingRight: FAN_SPACING.base,
        paddingTop: 10,
        paddingBottom: FAN_SPACING.xs,
    },
    formationPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
    },
    formationPillText: {
        fontSize: 11,
        fontWeight: '700',
    },
    benchToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: FAN_RADIUS.pill,
        borderWidth: 1.2,
    },
    benchToggleText: {
        fontSize: 12,
        fontWeight: '600',
    },
    benchDrawer: {
        borderBottomWidth: 0.8,
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 10,
        paddingBottom: 12,
    },
    benchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    benchHeaderBar: {
        width: 3,
        height: 13,
        borderRadius: 2,
    },
    benchColumns: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    pitchScroll: {
        paddingLeft: FAN_SPACING.base,
        paddingRight: FAN_SPACING.base,
        paddingTop: FAN_SPACING.sm,
        paddingBottom: FAN_SPACING.base,
    },
});