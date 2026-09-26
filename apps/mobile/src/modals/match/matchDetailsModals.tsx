// components/MatchDetailsModal.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    useWindowDimensions,
} from 'react-native';

import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import type { Fixture } from '../../../../../packages/core/src/types/fixture';

import type { MatchStatistics, LineupsData } from '../../../../../packages/core/src/types/matchDetails';
import {
    parseMatchStatistics,
    parseLineupsData,
} from '../../../../../packages/core/src/types/matchDetails';
import { LineupsTab } from './lineupsTab';
import { StatsTab } from './statsTab';

// ═══════════════════════════════════════════════════════════════
//  API  (same URLs + two-tier fallback as the Flutter source)
// ═══════════════════════════════════════════════════════════════

const API_BASE = 'https://clash-api-m5mr.onrender.com/api';

// ═══════════════════════════════════════════════════════════════
//  PROPS
// ═══════════════════════════════════════════════════════════════

export interface MatchDetailsModalProps {
    visible: boolean;
    fixture: Fixture;
    userId: string;
    username: string;
    authToken?: string | null;
    onClose: () => void;
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function formatTime(dateTime: string): string {
    try {
        const date = new Date(dateTime);
        if (isNaN(date.getTime())) return '';
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    } catch {
        return '';
    }
}

function hasValidStatistics(data: any): boolean {
    const stats = data?.data ?? data;

    if (Array.isArray(stats?.statistics)) {
        const snapshots = stats.statistics;
        if (snapshots.length > 0) {
            const latest = snapshots[snapshots.length - 1];
            const s = latest?.statistics ?? latest;
            const home = s?.home ?? {};
            const away = s?.away ?? {};
            return (
                (home?.possession ?? 0) > 0 ||
                (away?.possession ?? 0) > 0 ||
                (home?.shots ?? 0) > 0 ||
                (away?.shots ?? 0) > 0
            );
        }
        return false;
    }

    return (
        (stats?.ball_possession_home ?? 0) > 0 ||
        (stats?.ball_possession_away ?? 0) > 0 ||
        (stats?.total_shots_home ?? 0) > 0 ||
        (stats?.total_shots_away ?? 0) > 0
    );
}

// ═══════════════════════════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════════════════════════

export function MatchDetailsModal({
    visible,
    fixture,
    userId,
    username,
    authToken,
    onClose,
}: MatchDetailsModalProps) {
    const colors = useFanColors();
    const { height: windowHeight } = useWindowDimensions();

    const [activeTab, setActiveTab] = useState<'lineups' | 'stats'>('lineups');

    const [statistics, setStatistics] = useState<MatchStatistics | null>(null);
    const [lineups, setLineups] = useState<LineupsData | null>(null);

    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingLineups, setLoadingLineups] = useState(true);

    const [statsError, setStatsError] = useState('');
    const [lineupsError, setLineupsError] = useState('');

    const [hasStats, setHasStats] = useState(false);

    const headers = authToken
        ? { Authorization: `Bearer ${authToken}` }
        : undefined;

    // ── Fetch lineups (independent of stats) ─────────────────────

    const fetchLineups = useCallback(async () => {
        setLoadingLineups(true);
        setLineupsError('');
        try {
            const res = await fetch(
                `${API_BASE}/games/${fixture.matchId}/lineups`,
                { headers },
            );

            if (res.status === 200) {
                const data = await res.json();
                if (data?.success === true && data?.data != null) {
                    setLineups(parseLineupsData(data.data));
                    setLoadingLineups(false);
                    return;
                }
            }

            const fallbackRes = await fetch(
                `${API_BASE}/games/${fixture.matchId}/lineups/simplified`,
                { headers },
            );

            if (fallbackRes.status === 200) {
                const data = await fallbackRes.json();
                if (data?.success === true && data?.data != null) {
                    setLineups(parseLineupsData(data.data));
                    setLoadingLineups(false);
                    return;
                }
            }

            setLineupsError('No lineup available');
            setLoadingLineups(false);
        } catch (e) {
            console.warn('❌ Error fetching lineups:', e);
            setLineupsError('No network error');
            setLoadingLineups(false);
        }
    }, [fixture.matchId, authToken]);

    // ── Fetch statistics (independent of lineups) ────────────────

    const fetchStatistics = useCallback(async () => {
        setLoadingStats(true);
        setStatsError('');
        try {
            const res = await fetch(
                `${API_BASE}/games/${fixture.matchId}/statistics/latest`,
                { headers },
            );

            if (res.status === 200) {
                const data = await res.json();
                if (hasValidStatistics(data)) {
                    setStatistics(parseMatchStatistics(data));
                    setHasStats(true);
                    setLoadingStats(false);
                    return;
                }
            }

            const fullRes = await fetch(
                `${API_BASE}/games/${fixture.matchId}/statistics`,
                { headers },
            );

            if (fullRes.status === 200) {
                const data = await fullRes.json();
                if (data?.success === true) {
                    const stats = data?.data ?? data;
                    if (hasValidStatistics(stats)) {
                        setStatistics(parseMatchStatistics(stats));
                        setHasStats(true);
                        setLoadingStats(false);
                        return;
                    }
                }
            }

            setHasStats(false);
            setStatistics(null);
            setStatsError('Statistics available after match starts');
            setLoadingStats(false);
        } catch (e) {
            console.warn('❌ Error fetching statistics:', e);
            setHasStats(false);
            setStatistics(null);
            setStatsError('Statistics coming soon');
            setLoadingStats(false);
        }
    }, [fixture.matchId, authToken]);

    // ── Kick off both fetches in parallel, independent of each other ──

    useEffect(() => {
        if (!visible) return;
        // Reset state each time the modal is opened so a reopened modal
        // doesn't flash the previous match's lineups/stats.
        setActiveTab('lineups');
        setStatistics(null);
        setLineups(null);
        setLoadingStats(true);
        setLoadingLineups(true);
        setStatsError('');
        setLineupsError('');
        setHasStats(false);

        // Independent loading — mirror Future.wait([_fetchLineups(), _fetchStatistics()])
        // which in the original awaits both but neither gates the other's UI.
        fetchLineups();
        fetchStatistics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, fixture.matchId]);

    if (!fixture) return null;

    const home = fixture.homeScore ?? 0;
    const away = fixture.awayScore ?? 0;
    const isLive = fixture.status === 'live';
    const modalHeight = windowHeight * 0.88;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable
                    style={[
                        styles.sheet,
                        {
                            height: modalHeight,
                            backgroundColor: colors.surface,
                        },
                    ]}
                    onPress={() => { }}
                >
                    {/* Handle */}
                    <View style={styles.handleWrapper}>
                        <View
                            style={[
                                styles.handle,
                                { backgroundColor: colors.borderActive },
                            ]}
                        />
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text
                                numberOfLines={2}
                                ellipsizeMode="tail"
                                style={[
                                    fanText('title', colors),
                                    { textAlign: 'center', color: colors.textPrimary },
                                ]}
                            >
                                {fixture.homeTeam}
                            </Text>
                            {isLive ? (
                                <>
                                    <View style={{ height: 4 }} />
                                    <View style={styles.livePill}>
                                        <Text style={styles.livePillText}>LIVE</Text>
                                    </View>
                                </>
                            ) : null}
                        </View>

                        <View
                            style={[
                                styles.scoreBox,
                                { backgroundColor: colors.background },
                            ]}
                        >
                            <Text
                                style={[
                                    fanText('scoreHero', colors),
                                    { color: colors.textPrimary },
                                ]}
                            >
                                {home} - {away}
                            </Text>
                        </View>

                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text
                                numberOfLines={2}
                                ellipsizeMode="tail"
                                style={[
                                    fanText('title', colors),
                                    { textAlign: 'center', color: colors.textPrimary },
                                ]}
                            >
                                {fixture.awayTeam}
                            </Text>
                            {fixture.date ? (
                                <>
                                    <View style={{ height: 4 }} />
                                    <Text
                                        style={[
                                            fanText('caption', colors),
                                            { color: colors.textSecondary },
                                        ]}
                                    >
                                        {formatTime(fixture.date)}
                                    </Text>
                                </>
                            ) : null}
                        </View>
                    </View>

                    {/* Conditional tab bar */}
                    {hasStats ? (
                        <View style={styles.tabBar}>
                            <Pressable
                                style={styles.tab}
                                onPress={() => setActiveTab('lineups')}
                            >
                                <Text
                                    style={[
                                        styles.tabLabel,
                                        {
                                            color:
                                                activeTab === 'lineups'
                                                    ? colors.primary
                                                    : colors.textSecondary,
                                        },
                                    ]}
                                >
                                    LINEUPS
                                </Text>
                                {activeTab === 'lineups' ? (
                                    <View
                                        style={[
                                            styles.tabIndicator,
                                            { backgroundColor: colors.primary },
                                        ]}
                                    />
                                ) : (
                                    <View style={styles.tabIndicatorEmpty} />
                                )}
                            </Pressable>
                            <Pressable
                                style={styles.tab}
                                onPress={() => setActiveTab('stats')}
                            >
                                <Text
                                    style={[
                                        styles.tabLabel,
                                        {
                                            color:
                                                activeTab === 'stats'
                                                    ? colors.primary
                                                    : colors.textSecondary,
                                        },
                                    ]}
                                >
                                    STATS
                                </Text>
                                {activeTab === 'stats' ? (
                                    <View
                                        style={[
                                            styles.tabIndicator,
                                            { backgroundColor: colors.primary },
                                        ]}
                                    />
                                ) : (
                                    <View style={styles.tabIndicatorEmpty} />
                                )}
                            </Pressable>
                        </View>
                    ) : null}

                    {/* Content */}
                    <View style={{ flex: 1 }}>
                        {activeTab === 'lineups' ? (
                            <LineupsTab
                                fixture={fixture}
                                lineups={lineups}
                                loading={loadingLineups}
                                error={lineupsError}
                            />
                        ) : hasStats && statistics ? (
                            <StatsTab
                                homeTeam={fixture.homeTeam}
                                awayTeam={fixture.awayTeam}
                                statistics={statistics}
                            />
                        ) : null}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 20, // Flutter used Radius.circular(20); FAN_RADIUS.xl is 18.
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    handleWrapper: {
        paddingTop: 12,
        paddingBottom: 8,
        alignItems: 'center',
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 4,
        paddingBottom: 12,
    },
    livePill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        backgroundColor: 'rgba(255,0,0,0.12)', // red.withValues(alpha:0.12) — no token for "live red"
    },
    livePillText: {
        fontSize: 10,
        fontWeight: '600',
        color: 'red', // Flutter used Colors.red — there is no token for this.
    },
    scoreBox: {
        marginHorizontal: 12,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: FAN_RADIUS.sm,
    },
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)', // Flutter dividerColor: transparent; we add a subtle bottom border for the RN tab look.
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
    },
    tabLabel: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    tabIndicator: {
        height: 2,
        width: '100%',
        marginTop: 8,
        borderRadius: 1,
    },
    tabIndicatorEmpty: {
        height: 2,
        width: '100%',
        marginTop: 8,
    },
});