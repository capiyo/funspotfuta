// Ported 1:1 (field-for-field, same JSON key fallbacks) from
// funspot/lib/models/fixture_models.dart

export type SubFixtureType =
  | 'firstYellowCard'
  | 'firstGoal'
  | 'firstCorner'
  | 'firstOffside';

export type SubFixtureFormat = 'teamVsTeam' | 'threeWay';

function parseDouble(value: unknown): number {
  if (value == null) return 0.0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0.0;
  return 0.0;
}

function parseNullableInt(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Math.trunc(value);
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function parseMongoDate(value: unknown): Date {
  if (value == null) return new Date();
  try {
    if (typeof value === 'object' && value !== null && '$date' in (value as any)) {
      const dateObj: any = (value as any)['$date'];
      if (dateObj && typeof dateObj === 'object' && '$numberLong' in dateObj) {
        const ts = parseInt(dateObj['$numberLong'], 10);
        if (!Number.isNaN(ts)) return new Date(ts);
      }
      if (typeof dateObj === 'string') return new Date(dateObj);
    }
    if (typeof value === 'string') return new Date(value);
    return new Date();
  } catch {
    return new Date();
  }
}

// ---------------------------------------------------------------------------
// Voter — matches Voter class
// ---------------------------------------------------------------------------
export interface Voter {
  userId: string;
  userName: string;
  selection: string;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  isComrade: boolean;
  votedAt: Date;
}

export function voterFromJson(json: any): Voter {
  return {
    userId: (json.user_id ?? json.userId ?? '').toString(),
    userName: (json.user_name ?? json.userName ?? 'Anonymous').toString(),
    selection: (json.selection ?? '').toString(),
    isCorrect: (json.is_correct ?? json.isCorrect) ?? null,
    pointsAwarded: (json.points_awarded ?? json.pointsAwarded) ?? null,
    isComrade: (json.is_comrade ?? json.isComrade) ?? false,
    votedAt: parseMongoDate(json.voted_at ?? json.votedAt),
  };
}

export function voterSelectionDisplay(v: Pick<Voter, 'selection'>): string {
  if (v.selection === 'home_team') return '🏠 Home';
  if (v.selection === 'away_team') return '✈️ Away';
  if (v.selection === 'draw') return '🤝 Draw';
  return v.selection;
}

// ---------------------------------------------------------------------------
// Bettor — matches Bettor class (open bets / pledges / matched bets)
// ---------------------------------------------------------------------------
export interface Bettor {
  userId: string;
  userName: string;
  selection: string;
  amount: number;
  opponentId: string | null;
  opponentName: string | null;
  opponentSelection: string | null;
  opponentAmount: number | null;
  totalPot: number | null;
  betId: string;
  status: string | null;
  winner: boolean | null;
  payout: number | null;
  matchedAt: Date;
  resolvedAt: Date | null;
  createdAt: Date | null;
}

function mapSelection(selection: string): string {
  switch (selection) {
    case 'home':
      return 'home_team';
    case 'away':
      return 'away_team';
    case 'draw':
      return 'draw';
    default:
      return selection;
  }
}

function extractBetId(json: any): string {
  const idValue = json._id;
  if (typeof idValue === 'string') return idValue;
  if (idValue && typeof idValue === 'object' && idValue['$oid']) return idValue['$oid'].toString();
  if (json.id != null) return json.id.toString();
  return '';
}

export function bettorFromOpenBet(json: any): Bettor {
  return {
    userId: (json.starter_id ?? '').toString(),
    userName: (json.starter_name ?? 'Anonymous').toString(),
    selection: mapSelection((json.starter_selection ?? '').toString()),
    amount: parseDouble(json.starter_amount),
    opponentId: null,
    opponentName: null,
    opponentSelection: null,
    opponentAmount: null,
    totalPot: null,
    betId: extractBetId(json),
    status: 'open',
    winner: null,
    payout: null,
    matchedAt: parseMongoDate(json.created_at),
    resolvedAt: null,
    createdAt: parseMongoDate(json.created_at),
  };
}

export function bettorFromMatchedBet(json: any, userId: string): Bettor {
  const isStarter = (json.starter_id ?? '').toString() === userId;
  const starterAmount = parseDouble(json.starter_amount);
  const finisherAmount = parseDouble(json.finisher_amount);
  return {
    userId: (isStarter ? json.starter_id : json.finisher_id ?? '').toString(),
    userName: (isStarter ? json.starter_name : json.finisher_name ?? 'Anonymous').toString(),
    selection: mapSelection((isStarter ? json.starter_selection : json.finisher_selection ?? '').toString()),
    amount: isStarter ? starterAmount : finisherAmount,
    opponentId: (isStarter ? json.finisher_id : json.starter_id) ?? null,
    opponentName: (isStarter ? json.finisher_name : json.starter_name) ?? null,
    opponentSelection: mapSelection((isStarter ? json.finisher_selection : json.starter_selection ?? '').toString()),
    opponentAmount: isStarter ? finisherAmount : starterAmount,
    totalPot: starterAmount + finisherAmount,
    betId: extractBetId(json),
    status: (json.status ?? 'open').toString(),
    winner: (json.winner_id ?? '').toString() === (json.starter_id ?? '').toString(),
    payout: null,
    matchedAt: parseMongoDate(json.matched_at),
    resolvedAt: json.settled_at != null ? parseMongoDate(json.settled_at) : null,
    createdAt: parseMongoDate(json.created_at),
  };
}

export function bettorFromJson(json: any): Bettor {
  const isOpenBet = json.finisher_id == null || (json.finisher_id ?? '').toString() === '';
  if (isOpenBet) return bettorFromOpenBet(json);
  const userId = (json.userId ?? json.starter_id ?? '').toString();
  return bettorFromMatchedBet(json, userId);
}

export function bettorStatusDisplay(b: Pick<Bettor, 'status' | 'winner'>): string {
  const isOpen = b.status === 'open' || b.status == null;
  if (isOpen) return '💰 Open';
  if (b.winner === true) return '🏆 Won';
  if (b.winner === false) return '💔 Lost';
  return '⚡ Active';
}

export function bettorSelectionDisplay(selection: string): string {
  if (selection === 'home_team') return '🏠 Home';
  if (selection === 'away_team') return '✈️ Away';
  if (selection === 'draw') return '🤝 Draw';
  return selection;
}

export const isOpen = (b: Pick<Bettor, 'status'>) => b.status === 'open' || b.status == null;
export const isMatched = (b: Pick<Bettor, 'status'>) => b.status === 'matched';
export const isSettled = (b: Pick<Bettor, 'status'>) => b.status === 'settled';
export const isActive = (b: Pick<Bettor, 'status'>) => b.status === 'open' || b.status === 'matched';
export const isWon = (b: Pick<Bettor, 'winner'>) => b.winner === true;
export const isLost = (b: Pick<Bettor, 'winner'>) => b.winner === false;
export const isResolved = (b: Pick<Bettor, 'resolvedAt'>) => b.resolvedAt != null;
export const isPledge = (b: Pick<Bettor, 'opponentId' | 'status'>) => b.opponentId == null && b.status === 'open';
export const potentialWinnings = (b: Pick<Bettor, 'totalPot' | 'amount'>) => b.totalPot ?? b.amount;

// ---------------------------------------------------------------------------
// SubFixture — matches SubFixture class
// ---------------------------------------------------------------------------
export interface SubFixture {
  id: string;
  parentFixtureId: string;
  type: SubFixtureType;
  format: SubFixtureFormat;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string | null;
  oddsA: number;
  oddsB: number;
  oddsC: number | null;
  isActive: boolean;
  displayOrder: number;
}

function parseSubFixtureType(type: string | undefined): SubFixtureType {
  switch (type) {
    case 'first_yellow':
    case 'first_yellow_card':
      return 'firstYellowCard';
    case 'first_goal':
      return 'firstGoal';
    case 'first_corner':
      return 'firstCorner';
    case 'first_offside':
      return 'firstOffside';
    default:
      return 'firstYellowCard';
  }
}

function parseSubFixtureFormat(format: string | undefined): SubFixtureFormat {
  return format === 'three_way' ? 'threeWay' : 'teamVsTeam';
}

export function subFixtureFromJson(json: any): SubFixture {
  return {
    id: json.sub_fixture_id ?? json.id ?? '',
    parentFixtureId: json.parent_fixture_id ?? json.parentFixtureId ?? '',
    type: parseSubFixtureType(json.type ?? json.fixture_type ?? 'first_yellow'),
    format: parseSubFixtureFormat(json.format),
    question: json.question ?? '',
    optionA: json.option_a ?? json.optionA ?? '',
    optionB: json.option_b ?? json.optionB ?? '',
    optionC: json.option_c ?? json.optionC ?? null,
    oddsA: parseDouble(json.odds_a ?? json.oddsA ?? 0.0),
    oddsB: parseDouble(json.odds_b ?? json.oddsB ?? 0.0),
    oddsC: json.odds_c ?? json.oddsC ?? null,
    isActive: json.is_active ?? json.isActive ?? true,
    displayOrder: json.display_order ?? json.displayOrder ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Fixture — matches Fixture class (the core match/vote entity)
// ---------------------------------------------------------------------------
export interface Fixture {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  homeWin: number;
  awayWin: number;
  draw: number;
  date: string;
  time: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  isLive: boolean;
  availableForVoting: boolean;
  source: string;
  scrapedAt: Date;
  dateIso: string;
  result: string | null;
  votes: number;
  voters: Voter[];
  pledges: number;
  pledgers: Bettor[];
  bets: number;
  bettors: Bettor[];
  subFixtures: SubFixture[];
  timeElapsed: number | null;
}

export function fixtureFromJson(json: any): Fixture {
  let id: string;
  if (typeof json._id === 'string') {
    id = json._id;
  } else if (json._id && typeof json._id === 'object') {
    id = json._id['$oid']?.toString() ?? json._id.oid?.toString() ?? '';
  } else {
    id = (json._id ?? '').toString();
  }

  const voters: Voter[] = Array.isArray(json.voters)
    ? json.voters.map((v: any) => voterFromJson(v))
    : [];
  const pledgers: Bettor[] = Array.isArray(json.pledgers)
    ? json.pledgers.map((p: any) => bettorFromOpenBet(p))
    : [];
  const bettors: Bettor[] = Array.isArray(json.bettors)
    ? json.bettors.map((b: any) => bettorFromJson(b))
    : [];
  const subFixtures: SubFixture[] = Array.isArray(json.subFixtures)
    ? json.subFixtures.map((s: any) => subFixtureFromJson(s))
    : [];

  const timeElapsed =
    json.timeElapsed != null
      ? parseDouble(json.timeElapsed)
      : json.time_elapsed != null
      ? parseDouble(json.time_elapsed)
      : null;

  return {
    id,
    matchId: (json.matchId ?? json.match_id ?? '').toString(),
    homeTeam: (json.homeTeam ?? json.home_team ?? '').toString(),
    awayTeam: (json.awayTeam ?? json.away_team ?? '').toString(),
    league: (json.league ?? '').toString(),
    homeWin: parseDouble(json.homeWin ?? json.home_win),
    awayWin: parseDouble(json.awayWin ?? json.away_win),
    draw: parseDouble(json.draw),
    date: (json.date ?? '').toString(),
    time: (json.time ?? '').toString(),
    homeScore: parseNullableInt(json.homeScore ?? json.home_score),
    awayScore: parseNullableInt(json.awayScore ?? json.away_score),
    status: (json.status ?? 'upcoming').toString(),
    isLive: json.isLive ?? json.is_live ?? false,
    availableForVoting: json.availableForVoting ?? json.available_for_voting ?? true,
    source: (json.source ?? '').toString(),
    scrapedAt: parseMongoDate(json.scrapedAt ?? json.scraped_at),
    dateIso: (json.dateIso ?? json.date_iso ?? '').toString(),
    result: json.result ?? null,
    votes: json.votes ?? 0,
    voters,
    pledges: json.pledges ?? 0,
    pledgers,
    bets: json.bets ?? 0,
    bettors,
    subFixtures,
    timeElapsed,
  };
}

// ---- Derived getters (ported from the `Fixture` instance getters and the
// `GameExtension` extension in fixture_models.dart) ----

export const isUpcoming = (f: Fixture) => f.status === 'upcoming';
export const isSoon = (f: Fixture) => f.status === 'soon';
export const isCompleted = (f: Fixture) => f.status === 'completed';
export const hasScores = (f: Fixture) => f.homeScore != null && f.awayScore != null;
export const scoreDisplay = (f: Fixture) => (hasScores(f) ? `${f.homeScore} - ${f.awayScore}` : '');
export const formattedDateTime = (f: Fixture) => `${f.date} ${f.time}`.trim();
export const displayDate = (f: Fixture) => (f.dateIso.length > 0 ? f.dateIso : `${f.date} ${f.time}`);

export const totalPledgedAmount = (f: Fixture) => f.pledgers.reduce((s, p) => s + p.amount, 0);
export const totalBetAmount = (f: Fixture) => f.bettors.reduce((s, b) => s + b.amount, 0);
export const totalBetPot = (f: Fixture) => f.bettors.reduce((s, b) => s + (b.totalPot ?? 0), 0);

export function winner(f: Fixture): string {
  if (hasScores(f)) {
    if (f.homeScore! > f.awayScore!) return f.homeTeam;
    if (f.awayScore! > f.homeScore!) return f.awayTeam;
    return 'Draw';
  }
  return 'Unknown';
}

// Semantic outcome, not a hardcoded hex — the real colors
// (FanColors.primary/scoreAway/draw) are theme-dependent (light vs
// dark), so the UI layer maps this to an actual color via the shared
// theme tokens in theme.ts. An earlier version of this function baked
// in hardcoded hex values from the wrong palette; this replaces it.
export type MatchOutcome = 'home' | 'away' | 'draw' | 'unknown';

export function winnerOutcome(f: Fixture): MatchOutcome {
  if (hasScores(f)) {
    if (f.homeScore! > f.awayScore!) return 'home';
    if (f.awayScore! > f.homeScore!) return 'away';
    return 'draw';
  }
  return 'unknown';
}

export function getFormattedMinuteDisplay(f: Fixture): string {
  if (f.timeElapsed == null) return '';
  const minutes = Math.floor(f.timeElapsed);
  const seconds = Math.round((f.timeElapsed % 1) * 60);

  if (f.status === 'half_time' || minutes === 45) return 'Half Time';
  if (minutes >= 90 && minutes < 120) {
    const etMinutes = minutes - 90;
    if (etMinutes === 0) return 'Full Time';
    return `ET ${etMinutes}'`;
  }
  if (minutes >= 120) return 'Penalties';
  if (seconds > 0) return `${minutes}'${seconds.toString().padStart(2, '0')}`;
  return `${minutes}'`;
}

export const minutesPlayed = (f: Fixture) => (f.timeElapsed != null ? Math.floor(f.timeElapsed) : 0);
export const isHalfTime = (f: Fixture) =>
  f.status === 'half_time' || (f.timeElapsed != null && Math.floor(f.timeElapsed) === 45);
export const isExtraTime = (f: Fixture) => f.timeElapsed != null && f.timeElapsed >= 90 && f.timeElapsed < 120;
export const isPenalties = (f: Fixture) => f.timeElapsed != null && f.timeElapsed >= 120;
export const isFullTime = (f: Fixture) => f.status === 'completed' || (f.timeElapsed != null && f.timeElapsed >= 90);
