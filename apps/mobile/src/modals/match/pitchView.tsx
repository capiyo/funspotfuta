// components/MatchDetailsModal/PitchView.tsx
import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    LayoutChangeEvent,
} from 'react-native';
import Svg, {
    Rect,
    Line,
    Circle,
    Path,
    Defs,
    LinearGradient as SvgLinearGradient,
    Stop,
} from 'react-native-svg';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { FAN_SPACING, FAN_RADIUS } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';
import { fanShadowStyle } from '../../theme/use-fan-shadow';
import type { SimplifiedPlayer } from '../../../../../packages/core/src/types/matchDetails';
import { PositionRank, shortName } from '../../../../../packages/core/src/types/matchDetails';

// ═══════════════════════════════════════════════════════════════
//  POSITIONING ENGINE
//  Plain module-level TS functions — no Flutter-specific state
//  dependency, so these are not methods on a component.
// ═══════════════════════════════════════════════════════════════

export const NEUTRAL_GAP_FRACTION = 0.09;

export function getPositionRank(pos: string): PositionRank {
    const p = pos.toLowerCase().trim();

    if (p.includes('goalkeeper') || p === 'gk' || p === 'g') {
        return PositionRank.goalkeeper;
    }

    if (
        p.includes('back') ||
        p.includes('defend') ||
        p.includes('def') ||
        p === 'd' ||
        p === 'cb' ||
        p === 'lb' ||
        p === 'rb' ||
        p === 'lwb' ||
        p === 'rwb' ||
        p === 'cwb' ||
        p === 'sw' ||
        p === 'dc' ||
        p === 'dl' ||
        p === 'dr'
    ) {
        return PositionRank.defender;
    }

    if (
        p.includes('forward') ||
        p.includes('striker') ||
        p.includes('winger') ||
        p.includes('attack') ||
        p === 'f' ||
        p === 'cf' ||
        p === 'st' ||
        p === 'lw' ||
        p === 'rw' ||
        p === 'ss' ||
        p === 'fw' ||
        p === 'lf' ||
        p === 'rf'
    ) {
        return PositionRank.forward;
    }

    return PositionRank.midfielder;
}

export function parseFormation(formation: string): number[] {
    try {
        const parsed = formation
            .split('-')
            .map((s) => parseInt(s.trim(), 10) || 0)
            .filter((n) => n > 0);
        return parsed.length ? parsed : [4, 4, 2];
    } catch {
        return [4, 4, 2];
    }
}

export function groupByFormation(
    players: SimplifiedPlayer[],
    formation: string,
): SimplifiedPlayer[][] {
    const formationRows = parseFormation(formation);

    const gks: SimplifiedPlayer[] = [];
    const defs: SimplifiedPlayer[] = [];
    const mids: SimplifiedPlayer[] = [];
    const fwds: SimplifiedPlayer[] = [];

    for (const player of players) {
        switch (getPositionRank(player.position)) {
            case PositionRank.goalkeeper:
                gks.push(player);
                break;
            case PositionRank.defender:
                defs.push(player);
                break;
            case PositionRank.midfielder:
                mids.push(player);
                break;
            case PositionRank.forward:
                fwds.push(player);
                break;
        }
    }

    const sortByPosition = (list: SimplifiedPlayer[]) => {
        list.sort((a, b) => {
            const rankA = getPositionRank(a.position);
            const rankB = getPositionRank(b.position);
            if (rankA !== rankB) {
                return rankA.localeCompare(rankB);
            }
            return a.number - b.number;
        });
    };

    sortByPosition(gks);
    sortByPosition(defs);
    sortByPosition(mids);
    sortByPosition(fwds);

    const result: SimplifiedPlayer[][] = [];
    result.push(gks.slice(0, 1));

    const outfield = [...defs, ...mids, ...fwds];
    let outfieldIndex = 0;

    for (const rowCount of formationRows) {
        const row: SimplifiedPlayer[] = [];
        for (let i = 0; i < rowCount && outfieldIndex < outfield.length; i++) {
            row.push(outfield[outfieldIndex++]);
        }
        result.push(row);
    }

    while (outfieldIndex < outfield.length) {
        if (result.length > 0) {
            result[result.length - 1].push(outfield[outfieldIndex++]);
        } else {
            break;
        }
    }

    return result;
}

export function rowCurveDepth(
    count: number,
    rowIndex: number,
    totalRows: number,
): number {
    if (count <= 1) return 0.0;

    const isDefenseRow = rowIndex === 1;
    const isMidfieldRow = rowIndex >= 2 && rowIndex < totalRows - 1;
    const isForwardRow = rowIndex === totalRows - 1;

    switch (count) {
        case 2:
            if (isDefenseRow) return 0.020;
            if (isMidfieldRow) return 0.025;
            return 0.015;
        case 3:
            if (isDefenseRow) return 0.035;
            if (isMidfieldRow) return 0.070;
            if (isForwardRow) return 0.050;
            return 0.060;
        case 4:
            if (isDefenseRow) return 0.025;
            if (isMidfieldRow) return 0.045;
            return 0.035;
        case 5:
            if (isMidfieldRow) return 0.060;
            return 0.045;
        default:
            return 0.040;
    }
}

export function getRowWidth(
    count: number,
    rowIndex: number,
    totalRows: number,
): number {
    if (count <= 1) return 0.0;

    const isDefenseRow = rowIndex === 1;
    const isMidfieldRow = rowIndex >= 2 && rowIndex < totalRows - 1;
    const isForwardRow = rowIndex === totalRows - 1;

    let baseWidth: number;
    if (isDefenseRow) baseWidth = 0.55;
    else if (isMidfieldRow) baseWidth = 0.62;
    else if (isForwardRow) baseWidth = 0.58;
    else baseWidth = 0.55;

    const countFactor = Math.min(Math.max(count / 4.0, 0.7), 1.3);
    return Math.min(Math.max(baseWidth * countFactor, 0.25), 0.75);
}

export interface PitchPosition {
    x: number;
    y: number;
}

export function calculatePositions(
    players: SimplifiedPlayer[],
    formation: string,
    opts: { isHome: boolean; width: number; height: number },
): PitchPosition[] {
    const { isHome, width, height } = opts;
    if (players.length === 0) return [];

    const groups = groupByFormation(players, formation);
    const positions: PitchPosition[] = [];

    const edgeMargin = height * 0.06;
    const halfGap = height * (NEUTRAL_GAP_FRACTION / 2);
    const halfwayY = height / 2;

    const gkY = isHome ? height - edgeMargin : edgeMargin;
    const forwardY = isHome ? halfwayY + halfGap : halfwayY - halfGap;

    for (let rowIndex = 0; rowIndex < groups.length; rowIndex++) {
        const row = groups[rowIndex];
        if (row.length === 0) continue;

        const totalRows = groups.length > 1 ? groups.length - 1 : 1;
        const t = totalRows > 0 ? rowIndex / totalRows : 0.5;
        const yPos = gkY + t * (forwardY - gkY);

        const curveDepth = rowCurveDepth(row.length, rowIndex, groups.length);
        const rowWidth = getRowWidth(row.length, rowIndex, groups.length);
        const rowStart = 0.50 - rowWidth / 2;

        const sortedRow = [...row];
        sortedRow.sort((a, b) => {
            const rankA = getPositionRank(a.position);
            const rankB = getPositionRank(b.position);
            if (rankA !== rankB) return rankA.localeCompare(rankB);
            return a.number - b.number;
        });

        const playerCount = sortedRow.length;
        const center = playerCount > 1 ? (playerCount - 1) / 2 : 0;

        for (let i = 0; i < playerCount; i++) {
            const xPos =
                playerCount === 1
                    ? 0.50
                    : rowStart + (rowWidth * i) / (playerCount - 1);

            let d = 0.0;
            if (playerCount > 1 && center > 0) {
                d = (i - center) / center;
            }

            const advance = curveDepth * (d * d - 0.35);
            const yPosCurved = isHome ? yPos - advance : yPos + advance;

            const clampMin = isHome ? halfwayY + halfGap * 0.4 : edgeMargin * 0.5;
            const clampMax = isHome
                ? height - edgeMargin * 0.5
                : halfwayY - halfGap * 0.4;

            positions.push({
                x: xPos * width,
                y: Math.min(Math.max(yPosCurved, clampMin), clampMax),
            });
        }
    }

    return positions;
}

// ═══════════════════════════════════════════════════════════════
//  SVG PITCH
//  Port of _PitchPainter.paint(). Every visual element from the
//  Flutter canvas has a corresponding SVG node below.
// ═══════════════════════════════════════════════════════════════

interface PitchSvgProps {
    width: number;
    height: number;
    homeColor: string;
    awayColor: string;
}

// Flutter used Color(0xFF0D5E1A) / Color(0xFF0A5218) — literal grass
// greens with no design-token equivalent, so they stay as constants.
const GRASS_EVEN = '#0D5E1A';
const GRASS_ODD = '#0A5218';

function PitchSvg({ width, height, homeColor, awayColor }: PitchSvgProps) {
    const w = width;
    const h = height;
    const stripeCount = 12;
    const stripeH = h / stripeCount;

    const gapH = h * NEUTRAL_GAP_FRACTION;

    const penW = w * 0.55;
    const penH = h * 0.16;
    const gW = w * 0.30;
    const gH = h * 0.06;
    const cr = 10;

    const lineColor = 'rgba(255,255,255,0.35)';
    const spotColor = 'rgba(255,255,255,0.35)';
    const cornerColor = 'rgba(255,255,255,0.25)';

    return (
        <Svg width={w} height={h}>
            <Defs>
                <SvgLinearGradient id="awayWash" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={awayColor} stopOpacity="0.16" />
                    <Stop offset="1" stopColor={awayColor} stopOpacity="0" />
                </SvgLinearGradient>
                <SvgLinearGradient id="homeWash" x1="0" y1="1" x2="0" y2="0">
                    <Stop offset="0" stopColor={homeColor} stopOpacity="0.16" />
                    <Stop offset="1" stopColor={homeColor} stopOpacity="0" />
                </SvgLinearGradient>
            </Defs>

            {/* Grass stripes */}
            {Array.from({ length: stripeCount }).map((_, i) => (
                <Rect
                    key={`stripe-${i}`}
                    x={0}
                    y={i * stripeH}
                    width={w}
                    height={stripeH}
                    fill={i % 2 === 0 ? GRASS_EVEN : GRASS_ODD}
                />
            ))}

            {/* Team-colour washes */}
            <Rect x={0} y={0} width={w} height={h * 0.5} fill="url(#awayWash)" />
            <Rect x={0} y={h * 0.5} width={w} height={h * 0.5} fill="url(#homeWash)" />

            {/* Neutral separation band */}
            <Rect
                x={0}
                y={h / 2 - gapH / 2}
                width={w}
                height={gapH}
                fill="rgba(0,0,0,0.18)"
            />

            {/* Pitch outline */}
            <Rect
                x={6}
                y={6}
                width={w - 12}
                height={h - 12}
                rx={4}
                ry={4}
                stroke={lineColor}
                strokeWidth={1.1}
                fill="none"
            />

            {/* Two-tone halfway line */}
            <Line
                x1={6}
                y1={h / 2}
                x2={w / 2}
                y2={h / 2}
                stroke={awayColor}
                strokeOpacity={0.9}
                strokeWidth={2.2}
            />
            <Line
                x1={w / 2}
                y1={h / 2}
                x2={w - 6}
                y2={h / 2}
                stroke={homeColor}
                strokeOpacity={0.9}
                strokeWidth={2.2}
            />

            {/* Center circle + dot */}
            <Circle
                cx={w / 2}
                cy={h / 2}
                r={w * 0.13}
                stroke={lineColor}
                strokeWidth={1.1}
                fill="none"
            />
            <Circle cx={w / 2} cy={h / 2} r={3} fill={spotColor} />

            {/* Penalty areas */}
            <Rect
                x={(w - penW) / 2}
                y={6}
                width={penW}
                height={penH}
                stroke={lineColor}
                strokeWidth={1.1}
                fill="none"
            />
            <Rect
                x={(w - penW) / 2}
                y={h - 6 - penH}
                width={penW}
                height={penH}
                stroke={lineColor}
                strokeWidth={1.1}
                fill="none"
            />

            {/* Goal areas */}
            <Rect
                x={(w - gW) / 2}
                y={6}
                width={gW}
                height={gH}
                stroke={lineColor}
                strokeWidth={1.1}
                fill="none"
            />
            <Rect
                x={(w - gW) / 2}
                y={h - 6 - gH}
                width={gW}
                height={gH}
                stroke={lineColor}
                strokeWidth={1.1}
                fill="none"
            />

            {/* Penalty spots */}
            <Circle cx={w / 2} cy={h * 0.13} r={2.5} fill={spotColor} />
            <Circle cx={w / 2} cy={h * 0.87} r={2.5} fill={spotColor} />

            {/* Corner arcs */}
            <Path
                d={`M ${6 + cr} 6 A ${cr} ${cr} 0 0 1 ${6} ${6 + cr}`}
                stroke={cornerColor}
                strokeWidth={1}
                fill="none"
            />
            <Path
                d={`M ${w - 6 - cr} 6 A ${cr} ${cr} 0 0 1 ${w - 6} ${6 + cr}`}
                stroke={cornerColor}
                strokeWidth={1}
                fill="none"
            />
            <Path
                d={`M ${6} ${h - 6 - cr} A ${cr} ${cr} 0 0 0 ${6 + cr} ${h - 6}`}
                stroke={cornerColor}
                strokeWidth={1}
                fill="none"
            />
            <Path
                d={`M ${w - 6} ${h - 6 - cr} A ${cr} ${cr} 0 0 1 ${w - 6 - cr} ${h - 6}`}
                stroke={cornerColor}
                strokeWidth={1}
                fill="none"
            />
        </Svg>
    );
}

// ═══════════════════════════════════════════════════════════════
//  PITCH LABEL
// ═══════════════════════════════════════════════════════════════

interface PitchLabelProps {
    label: string;
    color: string;
}

function PitchLabel({ label, color }: PitchLabelProps) {
    const colors = useFanColors();
    return (
        <View style={[styles.pitchLabel, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
            <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[fanText('tag', colors), { color, letterSpacing: 0.4 }]}
            >
                {label}
            </Text>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  PLAYER DOT
// ═══════════════════════════════════════════════════════════════

interface PlayerDotProps {
    player: SimplifiedPlayer;
    position: PitchPosition;
    color: string;
    isHome: boolean;
}

const DOT_SIZE = 34;
// Approximate height of the [gap + name chip] block below/above the dot.
const LABEL_BLOCK_HEIGHT = 21;

function PlayerDot({ player, position, color, isHome }: PlayerDotProps) {
    const colors = useFanColors();

    const dot = (
        <View
            style={[
                styles.playerDot,
                {
                    backgroundColor: color,
                    borderColor: '#FFFFFF',
                },
                fanShadowStyle('card', false),
            ]}
        >
            <Text style={styles.playerDotText}>{player.number}</Text>
        </View>
    );

    const label = (
        <View
            style={[styles.playerLabel, { backgroundColor: 'rgba(0,0,0,0.75)' }]}
        >
            <Text
                numberOfLines={1}
                style={[fanText('tag', colors), { color: '#FFFFFF' }]}
            >
                {shortName(player.name)}
            </Text>
            {player.captain ? (
                <Text style={[styles.playerCaptain, { color }]}>C</Text>
            ) : null}
        </View>
    );

    const topOffset = isHome
        ? position.y - DOT_SIZE / 2
        : position.y - DOT_SIZE / 2 - LABEL_BLOCK_HEIGHT;

    return (
        <View
            style={[
                styles.playerDotWrapper,
                {
                    left: position.x - DOT_SIZE / 2,
                    top: topOffset,
                },
            ]}
        >
            <View style={styles.playerDotColumn}>
                {isHome ? (
                    <>
                        {dot}
                        <View style={{ height: 3 }} />
                        {label}
                    </>
                ) : (
                    <>
                        {label}
                        <View style={{ height: 3 }} />
                        {dot}
                    </>
                )}
            </View>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  OVERFLOW BUTTON
// ═══════════════════════════════════════════════════════════════

interface OverflowButtonProps {
    label: string;
    count: number;
    color: string;
    expanded: boolean;
    onTap: () => void;
}

function OverflowButton({
    label,
    count,
    color,
    expanded,
    onTap,
}: OverflowButtonProps) {
    const colors = useFanColors();
    const shortLabel = label.length > 12 ? `${label.substring(0, 11)}…` : label;

    return (
        <Pressable onPress={onTap}>
            <View
                style={[
                    styles.overflowButton,
                    {
                        backgroundColor: expanded
                            ? hexWithAlpha(color, 0.15)
                            : colors.background,
                        borderColor: expanded ? color : colors.borderActive,
                    },
                ]}
            >
                <View
                    style={[
                        styles.overflowBadge,
                        {
                            backgroundColor: expanded
                                ? hexWithAlpha(color, 0.9)
                                : hexWithAlpha(color, 0.15),
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.overflowBadgeText,
                            { color: expanded ? '#FFFFFF' : color },
                        ]}
                    >
                        {count}
                    </Text>
                </View>
                <View style={{ width: 5 }} />
                <Text
                    style={[
                        fanText('tag', colors),
                        { color: expanded ? color : colors.textSecondary },
                    ]}
                >
                    {shortLabel}
                </Text>
                <View style={{ width: 4 }} />
                {expanded ? (
                    <ChevronUp size={14} color={color} />
                ) : (
                    <ChevronDown size={14} color={colors.textTertiary} />
                )}
            </View>
        </Pressable>
    );
}

// ═══════════════════════════════════════════════════════════════
//  OVERFLOW PANEL
// ═══════════════════════════════════════════════════════════════

interface OverflowPanelProps {
    homePlayers: SimplifiedPlayer[];
    awayPlayers: SimplifiedPlayer[];
    showHome: boolean;
    showAway: boolean;
}

function OverflowPanel({
    homePlayers,
    awayPlayers,
    showHome,
    showAway,
}: OverflowPanelProps) {
    const colors = useFanColors();
    if (!showHome && !showAway) return null;

    const maxLen = Math.max(homePlayers.length, awayPlayers.length);

    return (
        <View
            style={[
                styles.overflowPanel,
                {
                    backgroundColor: colors.background,
                    borderColor: colors.borderActive,
                },
            ]}
        >
            <View style={styles.overflowHeader}>
                <View
                    style={[
                        styles.overflowHeaderBar,
                        { backgroundColor: colors.textTertiary },
                    ]}
                />
                <View style={{ width: 6 }} />
                <Text
                    style={[
                        fanText('tag', colors),
                        { color: colors.textTertiary, letterSpacing: 0.8 },
                    ]}
                >
                    EXTRA PLAYERS
                </Text>
            </View>
            <View style={{ height: 8 }} />
            <View style={styles.overflowRow}>
                {showHome ? (
                    <View style={{ flex: 1 }}>
                        <BenchColumn players={homePlayers} color={colors.primary} />
                    </View>
                ) : null}
                {showHome && showAway ? (
                    <View
                        style={{
                            width: 0.5,
                            height: maxLen * 32,
                            backgroundColor: colors.borderActive,
                            marginHorizontal: 8,
                        }}
                    />
                ) : null}
                {showAway ? (
                    <View style={{ flex: 1 }}>
                        <BenchColumn players={awayPlayers} color={colors.away} />
                    </View>
                ) : null}
            </View>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  BENCH COLUMN  (exported — reused by LineupsTab)
// ═══════════════════════════════════════════════════════════════

interface BenchColumnProps {
    players: SimplifiedPlayer[];
    color: string;
}

export function BenchColumn({ players, color }: BenchColumnProps) {
    const colors = useFanColors();

    if (players.length === 0) {
        return (
            <View style={{ alignItems: 'center' }}>
                <Text
                    style={[fanText('caption', colors), { color: colors.textTertiary }]}
                >
                    No data
                </Text>
            </View>
        );
    }

    return (
        <View>
            {players.slice(0, 9).map((p, idx) => (
                <View
                    key={`${p.number}-${p.name}-${idx}`}
                    style={[
                        styles.benchRow,
                        { backgroundColor: hexWithAlpha(color, 0.06) },
                    ]}
                >
                    <View
                        style={[
                            styles.benchNumber,
                            { backgroundColor: hexWithAlpha(color, 0.18) },
                        ]}
                    >
                        <Text style={[styles.benchNumberText, { color }]}>{p.number}</Text>
                    </View>
                    <View style={{ width: 6 }} />
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[
                            fanText('caption', colors),
                            { flex: 1, color: colors.textPrimary },
                        ]}
                    >
                        {shortName(p.name)}
                    </Text>
                    <Text style={[fanText('tag', colors), { color: colors.textTertiary }]}>
                        {p.position.toUpperCase()}
                    </Text>
                    {p.captain ? (
                        <>
                            <View style={{ width: 4 }} />
                            <Text style={[styles.benchCaptain, { color }]}>C</Text>
                        </>
                    ) : null}
                </View>
            ))}
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

/** Convert a hex color (#RRGGBB) + alpha fraction into an rgba() string.
 *  Flutter's Color.withValues(alpha:) has no direct RN equivalent; the
 *  design-token palette returns hex strings, so this converts at the
 *  call site rather than hardcoding rgba() everywhere. */
function hexWithAlpha(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return hex;
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ═══════════════════════════════════════════════════════════════
//  PITCH VIEW
// ═══════════════════════════════════════════════════════════════

export interface PitchViewProps {
    homeTeam: string;
    awayTeam: string;
    homeFormation: string;
    awayFormation: string;
    homePlayers: SimplifiedPlayer[];
    awayPlayers: SimplifiedPlayer[];
}

const PITCH_ASPECT_RATIO = 0.68;

export function PitchView({
    homeTeam,
    awayTeam,
    homeFormation,
    awayFormation,
    homePlayers,
    awayPlayers,
}: PitchViewProps) {
    const colors = useFanColors();
    const [showHomeOverflow, setShowHomeOverflow] = useState(false);
    const [showAwayOverflow, setShowAwayOverflow] = useState(false);
    const [pitchSize, setPitchSize] = useState<{ width: number; height: number }>({
        width: 0,
        height: 0,
    });

    const cappedHome = homePlayers.slice(0, 11);
    const cappedAway = awayPlayers.slice(0, 11);
    const homeOverflow = homePlayers.slice(11);
    const awayOverflow = awayPlayers.slice(11);
    const hasOverflow = homeOverflow.length > 0 || awayOverflow.length > 0;

    const homePositions = useMemo(
        () =>
            pitchSize.width > 0
                ? calculatePositions(cappedHome, homeFormation, {
                    isHome: true,
                    width: pitchSize.width,
                    height: pitchSize.height,
                })
                : [],
        [cappedHome, homeFormation, pitchSize.width, pitchSize.height],
    );

    const awayPositions = useMemo(
        () =>
            pitchSize.width > 0
                ? calculatePositions(cappedAway, awayFormation, {
                    isHome: false,
                    width: pitchSize.width,
                    height: pitchSize.height,
                })
                : [],
        [cappedAway, awayFormation, pitchSize.width, pitchSize.height],
    );

    const onPitchLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== pitchSize.width || height !== pitchSize.height) {
            setPitchSize({ width, height });
        }
    };

    const { width, height } = pitchSize;

    return (
        <View>
            {hasOverflow ? (
                <View style={styles.overflowButtonRow}>
                    {homeOverflow.length > 0 ? (
                        <OverflowButton
                            label={homeTeam}
                            count={homeOverflow.length}
                            color={colors.primary}
                            expanded={showHomeOverflow}
                            onTap={() => setShowHomeOverflow((v) => !v)}
                        />
                    ) : null}
                    {homeOverflow.length > 0 && awayOverflow.length > 0 ? (
                        <View style={{ flex: 1 }} />
                    ) : null}
                    {awayOverflow.length > 0 ? (
                        <OverflowButton
                            label={awayTeam}
                            count={awayOverflow.length}
                            color={colors.away}
                            expanded={showAwayOverflow}
                            onTap={() => setShowAwayOverflow((v) => !v)}
                        />
                    ) : null}
                </View>
            ) : null}

            {hasOverflow ? (
                <OverflowPanel
                    homePlayers={homeOverflow}
                    awayPlayers={awayOverflow}
                    showHome={showHomeOverflow && homeOverflow.length > 0}
                    showAway={showAwayOverflow && awayOverflow.length > 0}
                />
            ) : null}

            <View
                style={[styles.pitchContainer, { aspectRatio: PITCH_ASPECT_RATIO }]}
                onLayout={onPitchLayout}
            >
                <View style={styles.pitchClip}>
                    {width > 0 && height > 0 ? (
                        <>
                            <PitchSvg
                                width={width}
                                height={height}
                                homeColor={colors.primary}
                                awayColor={colors.away}
                            />

                            {/* Team labels, sitting inside each team's own zone */}
                            <View
                                style={[
                                    styles.pitchLabelWrapper,
                                    { bottom: height * 0.03, left: 0, right: 0 },
                                ]}
                                pointerEvents="none"
                            >
                                <PitchLabel label={homeTeam} color={colors.primary} />
                            </View>
                            <View
                                style={[
                                    styles.pitchLabelWrapper,
                                    { top: height * 0.03, left: 0, right: 0 },
                                ]}
                                pointerEvents="none"
                            >
                                <PitchLabel label={awayTeam} color={colors.away} />
                            </View>

                            {/* Player dots */}
                            {cappedHome.map((p, i) =>
                                i < homePositions.length ? (
                                    <PlayerDot
                                        key={`home-${i}-${p.number}`}
                                        player={p}
                                        position={homePositions[i]}
                                        color={colors.primary}
                                        isHome
                                    />
                                ) : null,
                            )}
                            {cappedAway.map((p, i) =>
                                i < awayPositions.length ? (
                                    <PlayerDot
                                        key={`away-${i}-${p.number}`}
                                        player={p}
                                        position={awayPositions[i]}
                                        color={colors.away}
                                        isHome={false}
                                    />
                                ) : null,
                            )}
                        </>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    overflowButtonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: FAN_SPACING.xs,
    },
    overflowButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: FAN_RADIUS.pill,
        borderWidth: 1.2,
    },
    overflowBadge: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    overflowBadgeText: {
        fontSize: 9,
        fontWeight: '700',
    },
    overflowPanel: {
        marginTop: FAN_SPACING.sm,
        marginBottom: FAN_SPACING.xs,
        borderRadius: 10,
        borderWidth: 0.8,
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: 12,
    },
    overflowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    overflowHeaderBar: {
        width: 3,
        height: 12,
        borderRadius: 2,
    },
    overflowRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    benchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
        paddingHorizontal: 7,
        paddingVertical: 5,
        borderRadius: 6,
    },
    benchNumber: {
        width: 22,
        height: 22,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    benchNumberText: {
        fontSize: 9,
        fontWeight: '700',
    },
    benchCaptain: {
        fontSize: 9,
        fontWeight: '700',
    },
    pitchContainer: {
        width: '100%',
    },
    pitchClip: {
        flex: 1,
        borderRadius: 14,
        overflow: 'hidden',
    },
    pitchLabelWrapper: {
        position: 'absolute',
        alignItems: 'center',
    },
    pitchLabel: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    playerDotWrapper: {
        position: 'absolute',
    },
    playerDotColumn: {
        alignItems: 'center',
    },
    playerDot: {
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        borderWidth: 2.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playerDotText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    playerLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
    },
    playerCaptain: {
        fontSize: 8,
        fontWeight: '700',
        marginLeft: 2,
    },
});