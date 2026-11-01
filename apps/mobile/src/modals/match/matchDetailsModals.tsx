// components/MatchDetailsModal.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Video, ResizeMode } from 'expo-av';
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
    presentation?: 'details' | 'watch';
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
    presentation = 'details',
    onClose,
}: MatchDetailsModalProps) {
    const colors = useFanColors();
    const { height: windowHeight } = useWindowDimensions();

    const [activeTab, setActiveTab] = useState<'lineups' | 'stats' | 'video'>('lineups');
    const [videoUrl, setVideoUrl] = useState('');
    const [videoLoading, setVideoLoading] = useState(false);
    const [videoError, setVideoError] = useState('');

    const [statistics, setStatistics] = useState<MatchStatistics | null>(null);
    const [lineups, setLineups] = useState<LineupsData | null>(null);
    const [lineupsMatchId, setLineupsMatchId] = useState<string | null>(null);

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
        if (lineupsMatchId !== fixture.matchId) setLoadingLineups(true);
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
                    setLineupsMatchId(fixture.matchId);
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
                    setLineupsMatchId(fixture.matchId);
                    setLoadingLineups(false);
                    return;
                }
            }

            setLineupsMatchId(fixture.matchId);
            setLineupsError('No lineup available');
            setLoadingLineups(false);
        } catch (e) {
            console.warn('❌ Error fetching lineups:', e);
            setLineupsMatchId(fixture.matchId);
            setLineupsError('No network error');
            setLoadingLineups(false);
        }
    }, [fixture.matchId, authToken, lineupsMatchId]);

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
        setActiveTab(presentation === 'watch' ? 'video' : 'lineups');
        setStatistics(null);
        setLoadingStats(true);
        if (lineupsMatchId !== fixture.matchId) setLoadingLineups(true);
        setStatsError('');
        setLineupsError('');
        setHasStats(false);

        // Independent loading — mirror Future.wait([_fetchLineups(), _fetchStatistics()])
        // which in the original awaits both but neither gates the other's UI.
        if (presentation === 'details') {
            fetchLineups();
            fetchStatistics();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, fixture.matchId, presentation]);

    useEffect(() => {
        setVideoUrl('');
        setVideoError('');
        if (!visible || fixture.status !== 'live') return;
        if (!authToken) {
            setVideoError('Sign in to watch this live fixture.');
            return;
        }
        const controller = new AbortController();
        setVideoLoading(true);
        void fetch(`${API_BASE}/video/fixtures/${encodeURIComponent(fixture.matchId)}/grant`, {
            headers: { Authorization: `Bearer ${authToken}` },
            signal: controller.signal,
        }).then(async response => {
            const payload = await response.json().catch(() => null);
            if (!response.ok || payload?.success !== true || typeof payload?.hls_url !== 'string') {
                throw new Error(payload?.error || 'Live playback is not available.');
            }
            setVideoUrl(payload.hls_url);
        }).catch(error => {
            if (!controller.signal.aborted) {
                setVideoError(error instanceof Error ? error.message : 'Unable to load live playback.');
            }
        }).finally(() => {
            if (!controller.signal.aborted) setVideoLoading(false);
        });
        return () => controller.abort();
    }, [visible, fixture.matchId, fixture.status, authToken]);

    if (!fixture) return null;

    const home = fixture.homeScore ?? 0;
    const away = fixture.awayScore ?? 0;
    const isLive = fixture.status === 'live';
    const watchMode = presentation === 'watch';
    const modalHeight = windowHeight * (watchMode ? 0.85 : 0.88);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close match details"
                    onPress={onClose}
                    style={StyleSheet.absoluteFill}
                />
                <View
                    style={[
                        styles.sheet,
                        {
                            height: modalHeight,
                            backgroundColor: colors.surface,
                        },
                    ]}
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
                                    fanText('body', colors),
                                    { textAlign: 'center', color: colors.textPrimary, fontSize: 11, fontWeight: '400', lineHeight: 14 },
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
                                    { color: colors.textPrimary, fontSize: 18, lineHeight: 22, fontWeight: '400' },
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
                                    { textAlign: 'center', color: colors.textPrimary, fontSize: 12, fontWeight: '400', lineHeight: 16 },
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
                    <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close live viewer" style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><Text style={{ color: colors.textSecondary, fontSize: 24, lineHeight: 28 }}>×</Text></Pressable>

                    {/* Fixture-scoped match tabs */}
                    {!watchMode && <View style={styles.tabBar}>
                        {(['lineups', ...(hasStats ? ['stats' as const] : []), 'video'] as const).map(tab => (
                            <Pressable key={tab} style={styles.tab} onPress={() => setActiveTab(tab)}>
                                <Text style={[styles.tabLabel, { color: activeTab === tab ? colors.primary : colors.textSecondary }]}>
                                    {tab.toUpperCase()}
                                </Text>
                                {activeTab === tab ? (
                                    <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />
                                ) : <View style={styles.tabIndicatorEmpty} />}
                            </Pressable>
                        ))}
                    </View>}

                    {/* Content */}
                    <View style={{ flex: 1, minHeight: 0, justifyContent: watchMode ? 'flex-start' : activeTab === 'video' ? 'center' : 'flex-start', padding: watchMode ? 12 : activeTab === 'video' ? 12 : 0 }}>
                        {activeTab === 'lineups' ? (
                            <LineupsTab
                                fixture={fixture}
                                lineups={lineupsMatchId === fixture.matchId ? lineups : null}
                                loading={loadingLineups || lineupsMatchId !== fixture.matchId}
                                error={lineupsMatchId === fixture.matchId ? lineupsError : ''}
                            />
                        ) : activeTab === 'stats' ? (
                            hasStats && statistics ? (
                                <StatsTab homeTeam={fixture.homeTeam} awayTeam={fixture.awayTeam} statistics={statistics} />
                            ) : null
                        ) : (
                            <View style={{ width: '100%', flex: watchMode ? 1 : undefined, aspectRatio: watchMode ? undefined : 16 / 9, minHeight: watchMode ? 0 : undefined, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                                {videoUrl ? (
                                    <Video
                                        key={videoUrl}
                                        source={{ uri: videoUrl }}
                                        style={{ width: '100%', height: '100%' }}
                                        useNativeControls
                                        resizeMode={ResizeMode.CONTAIN}
                                        shouldPlay
                                    />
                                ) : (
                                    <Text style={{ color: '#fff', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 }}>
                                        {videoLoading ? 'Connecting to live stream…' : videoError || 'No live stream is available for this fixture.'}
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </View>
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
        paddingHorizontal: 10,
        paddingVertical: 4,
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