// components/MatchDetailsModal/types.ts
import type { Fixture } from './fixture';

// ═══════════════════════════════════════════════════════════════
//  ENUM
// ═══════════════════════════════════════════════════════════════

export enum PositionRank {
    goalkeeper = 'goalkeeper',
    defender = 'defender',
    midfielder = 'midfielder',
    forward = 'forward',
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

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonRecord
        : {};
}

function asText(value: unknown, fallback = ''): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return fallback;
}

function getInt(obj: unknown, field1: string, field2?: string): number {
    const record = asRecord(obj);
    const v1 = record[field1];
    const v2 = field2 ? record[field2] : undefined;
    const v = v1 ?? v2 ?? 0;
    return typeof v === 'number' ? v : parseInt(String(v), 10) || 0;
}

function getPercent(obj: unknown, field1: string, field2?: string): number {
    const record = asRecord(obj);
    const v = record[field1] ?? (field2 ? record[field2] : undefined);
    if (typeof v === 'number' && Number.isFinite(v)) {
        // Providers may send percentages as either 0..1 ratios or 0..100 values.
        // The live backend validates/stores the latter, including decimal values.
        return v > 0 && v < 1 ? Math.round(v * 100) : Math.round(v);
    }
    return 0;
}

export function parseMatchStatistics(json: unknown): MatchStatistics {
    const root = asRecord(json);
    const data = asRecord(root.data ?? json);
    const rawStatistics = data.statistics;
    let stats: JsonRecord;

    if (Array.isArray(rawStatistics) && rawStatistics.length > 0) {
        const latest = asRecord(rawStatistics[rawStatistics.length - 1]);
        stats = asRecord(latest.statistics ?? latest);
    } else if (rawStatistics && typeof rawStatistics === 'object') {
        stats = asRecord(rawStatistics);
    } else {
        stats = data;
    }

    const home = asRecord(stats.home ?? {
        possession: stats.ball_possession_home,
        shots: stats.total_shots_home,
        shotsOnTarget: stats.shots_on_target_home,
        shotsOffTarget: stats.shots_off_target_home,
        corners: stats.corners_home,
        fouls: stats.fouls_home,
        offsides: stats.offsides_home,
        yellowCards: stats.yellow_cards_home,
        redCards: stats.red_cards_home,
        passAccuracy: stats.pass_accuracy_home,
    });
    const away = asRecord(stats.away ?? {
        possession: stats.ball_possession_away,
        shots: stats.total_shots_away,
        shotsOnTarget: stats.shots_on_target_away,
        shotsOffTarget: stats.shots_off_target_away,
        corners: stats.corners_away,
        fouls: stats.fouls_away,
        offsides: stats.offsides_away,
        yellowCards: stats.yellow_cards_away,
        redCards: stats.red_cards_away,
        passAccuracy: stats.pass_accuracy_away,
    });

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

// ═══════════════════════════════════════════════════════════════
//  SIMPLIFIED PLAYER
// ═══════════════════════════════════════════════════════════════

export interface SimplifiedPlayer {
    name: string;
    number: number;
    position: string;
    captain: boolean;
    /** Stable ID from the lineup provider, when supplied. */
    providerId?: string | null;
    /** 365Scores image cache version for this athlete portrait. */
    imageVersion?: string | null;
    /** Existing provider headshot URL, when supplied with the lineup. */
    photoUrl?: string | null;
    /** Team identity supplied by the lineup payload, when available. */
    teamName?: string | null;
    rating?: number | null;
    imageUrl?: string | null;
}

export function parseSimplifiedPlayer(json: unknown): SimplifiedPlayer {
    const record = asRecord(json);
    const player = asRecord(record.player);
    const athlete = asRecord(record.athlete);
    const name = asText(
        record.name ?? player.name ?? athlete.name ?? record.displayName ?? record.fullName,
        `Player ${asText(record.competitorId ?? record.id)}`,
    );

    const rawNumber = record.number ?? player.number ?? player.jerseyNumber ?? athlete.jerseyNumber ??
        record.jerseyNumber ?? record.jersey_number ?? record.shirtNumber ?? record.shirt_number ??
        record.squadNumber ?? record.squad_number ?? record.shirtNo ?? record.jerseyNo ??
        record.competitorId ?? 0;
    const number = typeof rawNumber === 'number' ? rawNumber : parseInt(String(rawNumber), 10) || 0;

    const positionValue = record.position ?? player.position ?? athlete.position;
    const positionRecord = asRecord(positionValue);
    const position = positionValue && typeof positionValue === 'object'
        ? asText(positionRecord.shortName ?? positionRecord.name)
        : asText(positionValue);

    const captain = record.captain === true;
    const rawProviderId = record.athleteId ?? record.athlete_id ?? record.player_id ??
        record.playerId ?? player.id ?? athlete.id ?? record.id ?? null;
    const providerId = rawProviderId == null ? null : String(rawProviderId).trim() || null;
    const rawImageVersion = record.imageVersion ?? record.image_version ?? player.imageVersion ??
        player.image_version ?? athlete.imageVersion ?? athlete.image_version ?? null;
    const imageVersion = rawImageVersion == null ? null : String(rawImageVersion).trim().replace(/^v/i, '') || null;
    const photoCandidate = record.photoUrl ?? record.photo_url ?? record.headshotUrl ?? record.headshot_url ??
        record.imageUrl ?? record.image_url ?? player.photoUrl ?? player.photo_url ?? player.headshotUrl ??
        player.imageUrl ?? player.photo ?? player.image ?? athlete.photoUrl ?? athlete.photo_url ??
        athlete.imageUrl ?? athlete.photo ?? athlete.image ?? player.img ?? athlete.img ?? record.img ??
        record.photo ?? record.image ?? record.picture ?? null;
    const photoUrl = typeof photoCandidate === 'string' && photoCandidate.startsWith('https://') ? photoCandidate : null;
    const rawRating = record.rating ?? record.ranking ?? record.playerRating ?? null;
    const rating = typeof rawRating === 'number' && Number.isFinite(rawRating) ? rawRating : null;
    const teamRecord = asRecord(record.team);
    const teamCandidate = record.teamName ?? record.team_name ?? teamRecord.name ?? null;
    const teamName = typeof teamCandidate === 'string' ? teamCandidate : null;

    return { name, number, position, captain, providerId, imageVersion, photoUrl, teamName, rating, imageUrl: photoUrl };
}

// ═══════════════════════════════════════════════════════════════
//  LINEUPS
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

export function parseLineupsData(json: unknown): LineupsData {
    const root = asRecord(json);
    const rootData = asRecord(root.data ?? json);
    const envelope = asRecord(rootData.lineups ?? rootData);
    const teams = asRecord(envelope.teams);
    const starting = asRecord(envelope.starting_xi ?? envelope.startingXI);
    const home = asRecord(envelope.home ?? teams.home);
    const away = asRecord(envelope.away ?? teams.away);

    const first = (...values: unknown[]): unknown =>
        values.find((value) => value !== undefined && value !== null);
    const parseList = (...candidates: unknown[]): SimplifiedPlayer[] => {
        const arrays = candidates.filter(Array.isArray) as unknown[][];
        const raw = arrays.find((items) => items.length > 0) ?? arrays[0];
        if (!raw) return [];
        return raw
            .filter((item) => item !== null && typeof item === 'object' && !Array.isArray(item))
            .map((item) => parseSimplifiedPlayer(item));
    };

    return {
        homeFormation: asText(first(envelope.home_formation, envelope.homeFormation, home.formation), '4-3-3'),
        awayFormation: asText(first(envelope.away_formation, envelope.awayFormation, away.formation), '4-3-3'),
        homeCoach: asText(first(envelope.home_coach, envelope.homeCoach, home.coach), 'TBD'),
        awayCoach: asText(first(envelope.away_coach, envelope.awayCoach, away.coach), 'TBD'),
        homeStartingXI: parseList(
            envelope.home_starting_xi, envelope.homeStartingXI, envelope.home_starting_xi_players,
            home.starting_xi, home.startingXI, home.starting, home.players, starting.home,
        ),
        homeBench: parseList(envelope.home_bench, envelope.homeBench, home.bench, home.substitutes),
        awayStartingXI: parseList(
            envelope.away_starting_xi, envelope.awayStartingXI, envelope.away_starting_xi_players,
            away.starting_xi, away.startingXI, away.starting, away.players, starting.away,
        ),
        awayBench: parseList(envelope.away_bench, envelope.awayBench, away.bench, away.substitutes),
    };
}

// ═══════════════════════════════════════════════════════════════
//  SHARED SHORT-NAME HELPER  (was duplicated in Flutter: _BenchColumn
//  and _PlayerDot — factored into one place per the task brief)
// ═══════════════════════════════════════════════════════════════

export function shortName(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
        return name.length > 12 ? `${name.substring(0, 11)}…` : name;
    }
    return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}