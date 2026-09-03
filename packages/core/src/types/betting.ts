// Ported from funspot/lib/services/bet_service.dart — the Bet and
// SubFixturePledge models as used by BetService/SubFixtureService
// (distinct from, but structurally similar to, the copies embedded in
// fixture_models.dart — see lib/types/fixture.ts for those).

function parseDate(value: unknown, fallbackNow = true): Date | null {
  if (value == null) return fallbackNow ? new Date() : null;
  try {
    return new Date(value as string);
  } catch {
    return fallbackNow ? new Date() : null;
  }
}

// --- Bet (whole-match, channel-scoped bets) ---------------------------------
export interface Bet {
  id: string | null;
  fixtureId: string;
  starterId: string;
  starterName: string;
  starterSelection: string;
  starterAmount: number;
  finisherId: string | null;
  finisherName: string | null;
  finisherSelection: string | null;
  finisherAmount: number | null;
  voteId: string | null;
  channelId: string;
  status: string;
  winnerId: string | null;
  starterResult: string | null;
  finisherResult: string | null;
  createdAt: Date;
  matchedAt: Date | null;
  settledAt: Date | null;
}

export function betFromJson(json: any): Bet {
  return {
    id: json._id?.toString() ?? json.id?.toString() ?? null,
    fixtureId: json.fixture_id ?? '',
    starterId: json.starter_id ?? '',
    starterName: json.starter_name ?? '',
    starterSelection: json.starter_selection ?? '',
    starterAmount: Number(json.starter_amount ?? 0),
    finisherId: json.finisher_id?.toString() ?? null,
    finisherName: json.finisher_name?.toString() ?? null,
    finisherSelection: json.finisher_selection?.toString() ?? null,
    finisherAmount: json.finisher_amount != null ? Number(json.finisher_amount) : null,
    voteId: json.vote_id?.toString() ?? null,
    channelId: json.channel_id ?? '',
    status: json.status ?? 'open',
    winnerId: json.winner_id?.toString() ?? null,
    starterResult: json.starter_result?.toString() ?? null,
    finisherResult: json.finisher_result?.toString() ?? null,
    createdAt: parseDate(json.created_at)!,
    matchedAt: parseDate(json.matched_at, false),
    settledAt: parseDate(json.settled_at, false),
  };
}

export const betIsOpen = (b: Pick<Bet, 'status'>) => b.status === 'open';
export const betIsMatched = (b: Pick<Bet, 'status'>) => b.status === 'matched';
export const betIsSettled = (b: Pick<Bet, 'status'>) => b.status === 'settled';
export const betTotalPot = (b: Pick<Bet, 'starterAmount' | 'finisherAmount'>) =>
  b.starterAmount + (b.finisherAmount ?? 0);

// --- SubFixturePledge (per-market bets: first goal / corner / yellow etc.) --
export interface SubFixturePledge {
  id: string;
  userId: string;
  userName: string;
  marketId: string;
  matchId: string;
  selection: string;
  amount: number;
  status: string;
  createdAt: Date;
  settledAt: Date | null;
  result: string | null;
  finisherId: string | null;
  finisherName: string | null;
  finisherSelection: string | null;
  finisherAmount: number | null;
  totalPot: number;
}

// Matches SubFixturePledge.fromBetJson — the shape returned by the Rust
// sub_fixtures endpoints (snake_case, starter_*/finisher_* fields).
export function subFixturePledgeFromBetJson(json: any): SubFixturePledge {
  const starterId = (json.starter_id ?? json.starterId ?? '').toString();
  const starterName = (json.starter_name ?? json.starterName ?? 'Unknown').toString();
  const starterSelection = (json.starter_selection ?? json.starterSelection ?? '').toString();
  const starterAmount = Number(json.starter_amount ?? json.starterAmount ?? 0);
  const finisherId = (json.finisher_id ?? json.finisherId ?? '').toString();
  const finisherName = (json.finisher_name ?? json.finisherName ?? '').toString();
  const finisherSelection = (json.finisher_selection ?? json.finisherSelection ?? '').toString();
  const finisherAmount = Number(json.finisher_amount ?? json.finisherAmount ?? 0);
  const totalPot = Number(json.total_pot ?? json.totalPot ?? starterAmount + finisherAmount);
  const status = (json.status ?? 'open').toString();

  return {
    id: (json._id ?? json.id ?? '').toString(),
    userId: starterId,
    userName: starterName,
    marketId: (json.market_id ?? json.marketId ?? '').toString(),
    matchId: (json.match_id ?? json.matchId ?? '').toString(),
    selection: starterSelection,
    amount: starterAmount,
    status,
    createdAt: parseDate(json.created_at ?? json.createdAt)!,
    settledAt: parseDate(json.settled_at ?? json.settledAt, false),
    result: json.result?.toString() ?? null,
    finisherId: finisherId.length > 0 ? finisherId : null,
    finisherName: finisherName.length > 0 ? finisherName : null,
    finisherSelection: finisherSelection.length > 0 ? finisherSelection : null,
    finisherAmount: finisherAmount > 0 ? finisherAmount : null,
    totalPot,
  };
}

export function subFixturePledgeSelectionLabel(selection: string): string {
  switch (selection) {
    case 'home':
      return 'Home';
    case 'away':
      return 'Away';
    case 'none':
      return 'None';
    case 'over':
      return 'Over';
    case 'under':
      return 'Under';
    default:
      return selection;
  }
}

// Hex colors ported from SubFixturePledge.selectionColor
export function subFixturePledgeSelectionColorHex(selection: string): string {
  switch (selection) {
    case 'home':
      return '#00A86B';
    case 'away':
      return '#E74C3C';
    case 'over':
      return '#00A86B';
    case 'under':
      return '#E74C3C';
    case 'none':
    default:
      return '#9E9E9E';
  }
}
