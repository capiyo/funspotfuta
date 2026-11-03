// components/MatchDetailsModal/types.ts
//
// Shared types + JSON parsers for MatchDetailsModal. Ported from
// funspot/lib/models/fixture_models.dart's `SimplifiedPlayer` and
// `MatchStatistics` classes, plus the LineupsData wrapper that the
// lineups endpoint returns.

// ═══════════════════════════════════════════════════════════════
//  ENUM
// ═══════════════════════════════════════════════════════════════

/** Position ranks for sorting players by position. Matches the
 *  Dart `PositionRank` enum in the Flutter source. Because Dart enums
 *  carry an implicit integer index used for sorting, this is a plain
 *  TS string enum whose members are compared via `localeCompare` in
 *  the positioning engine — same ordering, no `.index` needed. */
export enum PositionRank {
    goalkeeper = 'goalkeeper',
    defender = 'defender',
    midfielder = 'midfielder',
    forward = 'forward',
}

// ═══════════════════════════════════════════════════════════════
//  SIMPLIFIED PLAYER
//  Field-for-field port of the Dart SimplifiedPlayer.fromJson.
// ═══════════════════════════════════════════════════════════════

export interface SimplifiedPlayer {
    name: string;
    number: number;
    position: string;
    captain: boolean;
}

export function parseSimplifiedPlayer(json: any): SimplifiedPlayer {
    const name =
        json?.name?.toString() ??
        json?.displayName?.toString() ??
        json?.fullName?.toString() ??
        `Player ${json?.competitorId ?? json?.id ?? ''}`;

    const rawNumber =
        json?.number ??
        json?.jerseyNumber ??
        json?.jersey_number ??
        json?.shirtNumber ??
        json?.shirt_number ??
        json?.squadNumber ??
        json?.squad_number ??
        json?.shirtNo ??
        json?.jerseyNo ??
        json?.competitorId ??
        0;
    const number =
        typeof rawNumber === 'number'
            ? rawNumber
            : parseInt(String(rawNumber), 10) || 0;

    const posField = json?.position;
    const position =
        posField && typeof posField === 'object'
            ? posField.shortName?.toString() ?? posField.name?.toString() ?? ''
            : posField?.toString() ?? '';

    const captain = json?.captain === true;

    return { name, number, position, captain };
}

// ═══════════════════════════════════════════════════════════════
//  SHARED SHORT-NAME HELPER
//  Flutter duplicated this in _BenchColumn and _PlayerDot; the task
//  brief asks that it be factored into one place in the port.
//
//  Behavior (must match the Flutter source exactly):
//    - multi-word name → "F. Lastname" (first-initial + last name)
//    - single-word name ≤12 chars → returned as-is
//    - single-word name >12 chars → ellipsis-truncated to 11 chars
// ═══════════════════════════════════════════════════════════════

export function shortName(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
        return name.length > 12 ? `${name.substring(0, 11)}…` : name;
    }
    return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

// ═══════════════════════════════════════════════════════════════
//  LINEUPS DATA
// ═══════════════════════════════════════════════════════════════

export interface LineupsData {
    homeFormation: string;
    awayFormation: string;
    homeCoach: string;
    awayCoach: string;
    homeStartingXI: SimplifiedPlayer[];
    homeBench: SimplifiedPlayer[];
    awayStartingXI: SimplifiedPlayer[];
    awayBench: SimplifiedPlayer[];
}

export function parseLineupsData(json: any): LineupsData {
    const data = json?.data && typeof json.data === 'object' ? json.data : json;

    const parseList = (raw: any): SimplifiedPlayer[] => {
        if (!Array.isArray(raw)) return [];
        return raw
            .filter((p) => p && typeof p === 'object')
            .map((p) => parseSimplifiedPlayer(p));
    };

    return {
        homeFormation: data?.home_formation?.toString() ?? '4-3-3',
        awayFormation: data?.away_formation?.toString() ?? '4-3-3',
        homeCoach: data?.home_coach?.toString() ?? 'TBD',
        awayCoach: data?.away_coach?.toString() ?? 'TBD',
        homeStartingXI: parseList(data?.home_starting_xi),
        homeBench: parseList(data?.home_bench),
        awayStartingXI: parseList(data?.away_starting_xi),
        awayBench: parseList(data?.away_bench),
    };
}

// ═══════════════════════════════════════════════════════════════
//  MATCH STATISTICS
// ═══════════════════════════════════════════════════════════════

export interface MatchStatistics {
    ballPossessionHome: number;
    ballPossessionAway: number;
    totalShotsHome: number;
    totalShotsAway: number;
    shotsOnTargetHome: number;
    shotsOnTargetAway: number;
    cornersHome: number;
    cornersAway: number;
    foulsHome: number;
    foulsAway: number;
    offsidesHome: number;
    offsidesAway: number;
    yellowCardsHome: number;
    yellowCardsAway: number;
    passAccuracyHome: number;
    passAccuracyAway: number;
}

function getInt(obj: any, field1: string, field2?: string): number {
    const v1 = obj?.[field1];
    const v2 = field2 ? obj?.[field2] : undefined;
    const v = v1 ?? v2 ?? 0;
    return typeof v === 'number' ? v : parseInt(String(v), 10) || 0;
}

function getPercent(obj: any, field1: string, field2?: string): number {
    const v = obj?.[field1] ?? (field2 ? obj?.[field2] : undefined);
    if (typeof v === 'number') {
        // Dart: if (val is double) return (val * 100).round(); if int return val
        return Number.isInteger(v) ? v : Math.round(v * 100);
    }
    return 0;
}

export function parseMatchStatistics(json: any): MatchStatistics {
    const data = json?.data ?? json;
    let stats: any;

    if (Array.isArray(data?.statistics) && data.statistics.length > 0) {
        const latest = data.statistics[data.statistics.length - 1];
        stats = latest?.statistics ?? latest;
    } else if (data?.statistics && typeof data.statistics === 'object') {
        stats = data.statistics;
    } else {
        stats = data;
    }

    const home = stats?.home ?? {};
    const away = stats?.away ?? {};

    return {
        ballPossessionHome: getPercent(home, 'possession', 'ball_possession'),
        ballPossessionAway: getPercent(away, 'possession', 'ball_possession'),
        totalShotsHome: getInt(home, 'shots', 'total_shots'),
        totalShotsAway: getInt(away, 'shots', 'total_shots'),
        shotsOnTargetHome: getInt(home, 'shotsOnTarget', 'shots_on_target'),
        shotsOnTargetAway: getInt(away, 'shotsOnTarget', 'shots_on_target'),
        cornersHome: getInt(home, 'corners'),
        cornersAway: getInt(away, 'corners'),
        foulsHome: getInt(home, 'fouls'),
        foulsAway: getInt(away, 'fouls'),
        offsidesHome: getInt(home, 'offsides'),
        offsidesAway: getInt(away, 'offsides'),
        yellowCardsHome: getInt(home, 'yellowCards', 'yellow_cards'),
        yellowCardsAway: getInt(away, 'yellowCards', 'yellow_cards'),
        passAccuracyHome: getPercent(home, 'passAccuracy', 'pass_accuracy'),
        passAccuracyAway: getPercent(away, 'passAccuracy', 'pass_accuracy'),
    };
}