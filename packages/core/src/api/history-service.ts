// Ported from funspot/lib/models/fixture_models.dart — HistoryGame (a
// completed match with the extra scraper/commentary/lineups metadata that
// live Fixtures don't carry) and HistoryQueryParams/HistoryService.

import { Fixture, MatchOutcome } from '../types/fixture';

function parseMongoDate(value: unknown): Date | null {
  if (value == null) return null;
  try {
    if (value instanceof Date) return value;
    if (typeof value === 'string') return new Date(value);
    if (typeof value === 'object') {
      const v: any = value;
      const dateObj = v['$date'];
      if (dateObj != null) {
        if (typeof dateObj === 'object' && dateObj['$numberLong']) {
          return new Date(parseInt(dateObj['$numberLong'], 10));
        }
        if (typeof dateObj === 'string') return new Date(dateObj);
      }
      if (v['$numberLong']) return new Date(parseInt(v['$numberLong'], 10));
    }
  } catch {
    /* fall through */
  }
  return null;
}

function detectSource(json: any): string {
  if (json.threesixtyfiveGameId != null || json.threesixtyfive_game_id != null) return 'fixtures_history';
  if (json.source != null) {
    const src = String(json.source).toLowerCase();
    if (src === '365scores' || src.includes('fixture') || src.includes('national')) return 'fixtures_history';
  }
  if (json.league != null) {
    const league = String(json.league).toLowerCase();
    if (
      league.includes('world cup') ||
      league.includes('euro') ||
      league.includes('copa') ||
      league.includes('nations') ||
      league.includes('friendlies')
    ) {
      return 'fixtures_history';
    }
  }
  return 'games_history';
}

export interface HistoryGame {
  id: string;
  matchId: string;
  threesixtyfiveGameId: string | null;
  homeTeam: string;
  awayTeam: string;
  league: string;
  homeWin: number | null;
  awayWin: number | null;
  draw: number | null;
  date: string;
  time: string;
  dateIso: string;
  kickoffUtc: Date;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  isLive: boolean;
  availableForVoting: boolean;
  timeElapsed: number | null;
  result: string | null;
  source: string | null;
  scrapedAt: Date | null;
  lastScrapedAt: Date | null;
  lastPolledAt: Date | null;
  commentary: any[];
  lastCommentaryAt: Date | null;
  lineups: any;
  lineupsFetched: boolean | null;
  lineupsFetchedAt: Date | null;
  statistics: any[];
  lastStatisticsMinute: number | null;
  forwardedEventSignatures: string[];
  completedAt: Date;
  movedToHistory: boolean;
  createdAt: Date;
}

function toIntOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Math.trunc(v);
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}
function toBool(v: unknown, fallback: boolean): boolean {
  if (v == null) return fallback;
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true';
}

export function historyGameFromJson(json: any): HistoryGame {
  const homeScore = toIntOrNull(json.homeScore);
  const awayScore = toIntOrNull(json.awayScore);
  const completedAt = parseMongoDate(json.completedAt ?? json.completed_at) ?? new Date();
  const movedToHistory = toBool(json.movedToHistory ?? json.moved_to_history, true);
  const timeElapsed = json.timeElapsed != null ? Number(json.timeElapsed) : json.time_elapsed != null ? Number(json.time_elapsed) : null;

  return {
    id: (json._id ?? json.id ?? '').toString(),
    matchId: (json.matchId ?? json.match_id ?? '').toString(),
    threesixtyfiveGameId: (json.threesixtyfiveGameId ?? json.threesixtyfive_game_id)?.toString() ?? null,
    homeTeam: (json.homeTeam ?? json.home_team ?? '').toString(),
    awayTeam: (json.awayTeam ?? json.away_team ?? '').toString(),
    league: (json.league ?? '').toString(),
    homeWin: json.homeWin != null ? Number(json.homeWin) : json.home_win != null ? Number(json.home_win) : null,
    awayWin: json.awayWin != null ? Number(json.awayWin) : json.away_win != null ? Number(json.away_win) : null,
    draw: json.draw != null ? Number(json.draw) : null,
    date: (json.date ?? '').toString(),
    time: (json.time ?? '').toString(),
    dateIso: (json.dateIso ?? json.date_iso ?? '').toString(),
    kickoffUtc: parseMongoDate(json.kickoffUtc ?? json.kickoff_utc) ?? new Date(),
    homeScore,
    awayScore,
    status: (json.status ?? 'completed').toString(),
    isLive: json.isLive ?? json.is_live ?? false,
    availableForVoting: json.availableForVoting ?? json.available_for_voting ?? false,
    timeElapsed,
    result: json.result?.toString() ?? null,
    source: detectSource(json),
    scrapedAt: parseMongoDate(json.scrapedAt ?? json.scraped_at),
    lastScrapedAt: parseMongoDate(json.lastScrapedAt ?? json.last_scraped_at),
    lastPolledAt: parseMongoDate(json.lastPolledAt ?? json.last_polled_at),
    commentary: json.commentary ?? [],
    lastCommentaryAt: parseMongoDate(json.lastCommentaryAt ?? json.last_commentary_at),
    lineups: json.lineups ?? null,
    lineupsFetched: json.lineupsFetched ?? json.lineups_fetched ?? false,
    lineupsFetchedAt: parseMongoDate(json.lineupsFetchedAt ?? json.lineups_fetched_at),
    statistics: json.statistics ?? [],
    lastStatisticsMinute:
      json.lastStatisticsMinute != null
        ? Number(json.lastStatisticsMinute)
        : json.last_statistics_minute != null
        ? Number(json.last_statistics_minute)
        : null,
    forwardedEventSignatures: json.forwardedEventSignatures ?? json.forwarded_event_signatures ?? [],
    completedAt,
    movedToHistory,
    createdAt: parseMongoDate(json.createdAt ?? json.created_at) ?? new Date(),
  };
}

export const isFromFixtures = (g: Pick<HistoryGame, 'source' | 'threesixtyfiveGameId'>) =>
  g.source === 'fixtures_history' || g.threesixtyfiveGameId != null;
export const isFromGames = (g: Pick<HistoryGame, 'source' | 'threesixtyfiveGameId'>) =>
  g.source === 'games_history' || g.threesixtyfiveGameId == null;
export const sourceIcon = (g: Pick<HistoryGame, 'source' | 'threesixtyfiveGameId'>) => (isFromFixtures(g) ? '🌍' : '⚽');
export const sourceLabel = (g: Pick<HistoryGame, 'source' | 'threesixtyfiveGameId'>) => (isFromFixtures(g) ? 'National' : 'League');

export function historyScoreDisplay(g: Pick<HistoryGame, 'homeScore' | 'awayScore'>): string {
  return g.homeScore != null && g.awayScore != null ? `${g.homeScore} - ${g.awayScore}` : 'VS';
}

export function historyResultDisplay(g: Pick<HistoryGame, 'homeScore' | 'awayScore' | 'homeTeam' | 'awayTeam'>): string {
  if (g.homeScore == null || g.awayScore == null) return '?';
  if (g.homeScore > g.awayScore) return `🏆 ${g.homeTeam} wins`;
  if (g.awayScore > g.homeScore) return `🏆 ${g.awayTeam} wins`;
  return '🤝 Draw';
}

// Semantic outcome (see MatchOutcome in types/fixture.ts) — the actual
// color is theme-dependent, mapped by the UI layer.
export function historyResultOutcome(g: Pick<HistoryGame, 'homeScore' | 'awayScore'>): MatchOutcome {
  if (g.homeScore == null || g.awayScore == null) return 'unknown';
  if (g.homeScore > g.awayScore) return 'home';
  if (g.awayScore > g.homeScore) return 'away';
  return 'draw';
}

export function historyGameToFixture(g: HistoryGame): Fixture {
  return {
    id: g.id,
    matchId: g.matchId,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    league: g.league,
    homeWin: g.homeWin ?? 2.0,
    awayWin: g.awayWin ?? 2.0,
    draw: g.draw ?? 3.0,
    date: g.date,
    time: g.time,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    status: 'completed',
    isLive: false,
    availableForVoting: false,
    source: g.source ?? '',
    scrapedAt: g.completedAt,
    dateIso: g.dateIso,
    result: g.result,
    votes: 0,
    voters: [],
    pledges: 0,
    pledgers: [],
    bets: 0,
    bettors: [],
    subFixtures: [],
    timeElapsed: g.timeElapsed,
  };
}

// ---------------------------------------------------------------------------
// HistoryService
// ---------------------------------------------------------------------------

export interface HistoryQueryParams {
  limit?: number;
  skip?: number;
  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  fromDate?: string;
  toDate?: string;
}

function toQueryParams(p?: HistoryQueryParams): URLSearchParams {
  const params = new URLSearchParams();
  if (p?.limit != null) params.set('limit', String(p.limit));
  if (p?.skip != null) params.set('skip', String(p.skip));
  if (p?.league) params.set('league', p.league);
  if (p?.homeTeam) params.set('home_team', p.homeTeam);
  if (p?.awayTeam) params.set('away_team', p.awayTeam);
  if (p?.fromDate) params.set('from_date', p.fromDate);
  if (p?.toDate) params.set('to_date', p.toDate);
  return params;
}

const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';

function headers(authToken?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

// GET /api/games/history
export async function fetchHistoryGames(params?: HistoryQueryParams, authToken?: string): Promise<HistoryGame[]> {
  try {
    const qs = toQueryParams(params).toString();
    const res = await fetch(`${API_BASE_URL}/games/history${qs ? `?${qs}` : ''}`, { headers: headers(authToken) });
    if (!res.ok) return [];
    const data = await res.json();
    const games: any[] = data.data ?? [];
    return games.map(historyGameFromJson);
  } catch (e) {
    console.error('fetchHistoryGames failed:', e);
    return [];
  }
}

// GET /api/games/history/:matchId
export async function fetchHistoryGameById(matchId: string, authToken?: string): Promise<HistoryGame | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/games/history/${matchId}`, { headers: headers(authToken) });
    if (!res.ok) return null;
    const data = await res.json();
    return historyGameFromJson(data.data);
  } catch (e) {
    console.error('fetchHistoryGameById failed:', e);
    return null;
  }
}

// GET /api/games/history/count
export async function getTotalHistoryCount(authToken?: string): Promise<number> {
  try {
    const res = await fetch(`${API_BASE_URL}/games/history/count`, { headers: headers(authToken) });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.total ?? 0;
  } catch (e) {
    console.error('getTotalHistoryCount failed:', e);
    return 0;
  }
}
