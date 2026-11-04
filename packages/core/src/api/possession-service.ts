import { API_BASE, authHeaders } from './config';
import type {
  PossessionActionResult,
  PossessionMarket,
  PossessionSide,
  PossessionVote,
  PossessionPoke,
} from '../types/possession';

const POSSESSION_BASE = `${API_BASE}/actions/posseions`;

async function request<T>(path: string, token?: string | null, init?: RequestInit): Promise<T> {
  const headers = new Headers(authHeaders(token));
  if (init?.headers) {
    new Headers(init.headers).forEach((value: string, key: string) => headers.set(key, value));
  }
  const response = await fetch(`${POSSESSION_BASE}${path}`, {
    ...init,
    headers,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      && typeof payload.message === 'string'
      ? payload.message
      : `Possession request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function pick(record: JsonRecord, ...keys: string[]): unknown {
  for (const key of keys) if (record[key] !== undefined && record[key] !== null) return record[key];
  return undefined;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeVote(value: unknown): PossessionVote {
  const row = asRecord(value);
  return {
    id: asString(pick(row, 'id', 'vote_id', '_id')),
    userId: asString(pick(row, 'userId', 'user_id')),
    username: asString(pick(row, 'username', 'user_name', 'userName'), 'Fan'),
    selection: pick(row, 'selection') === 'away' ? 'away' : 'home',
    createdAt: asString(pick(row, 'createdAt', 'created_at', 'voted_at')),
  };
}

function normalizePoke(value: unknown): PossessionPoke {
  const row = asRecord(value);
  const finisherAmount = pick(row, 'finisherAmount', 'finisher_amount', 'finisher_stake');
  const finisherSelection = pick(row, 'finisherSelection', 'finisher_selection');
  return {
    id: asString(pick(row, 'id', 'poke_id', '_id')),
    userId: asString(pick(row, 'userId', 'user_id', 'starter_id')),
    username: asString(pick(row, 'username', 'user_name', 'starter_name'), 'Fan'),
    selection: pick(row, 'selection', 'starter_selection') === 'away' ? 'away' : 'home',
    amount: asNumber(pick(row, 'amount', 'stake', 'starter_amount')),
    status: asString(pick(row, 'status'), 'open').toLowerCase() as PossessionPoke['status'],
    createdAt: asString(pick(row, 'createdAt', 'created_at')),
    finisherId: pick(row, 'finisherId', 'finisher_id') == null ? null : asString(pick(row, 'finisherId', 'finisher_id')),
    finisherName: pick(row, 'finisherName', 'finisher_name') == null ? null : asString(pick(row, 'finisherName', 'finisher_name')),
    finisherSelection: finisherSelection === 'home' || finisherSelection === 'away' ? finisherSelection : null,
    finisherAmount: finisherAmount == null ? null : asNumber(finisherAmount),
    totalPot: pick(row, 'totalPot', 'total_pot') == null ? undefined : asNumber(pick(row, 'totalPot', 'total_pot')),
    settledAt: pick(row, 'settledAt', 'settled_at') == null ? null : asString(pick(row, 'settledAt', 'settled_at')),
  };
}

function normalizeMarket(value: unknown): PossessionMarket {
  const outer = asRecord(value);
  const row = asRecord(pick(outer, 'market', 'data') ?? outer);
  const voteRows = pick(row, 'votes');
  const pokeRows = pick(row, 'pokes');
  const homeVotes = pick(row, 'homeVotes', 'home_votes');
  const awayVotes = pick(row, 'awayVotes', 'away_votes');
  const counts = asRecord(pick(row, 'voteCounts', 'vote_counts'));
  return {
    fixtureId: asString(pick(row, 'fixtureId', 'fixture_id')),
    channelId: asString(pick(row, 'channelId', 'channel_id')),
    status: asString(pick(row, 'status'), 'open').toLowerCase() as PossessionMarket['status'],
    homePossession: pick(row, 'homePossession', 'home_possession') == null ? null : asNumber(pick(row, 'homePossession', 'home_possession')),
    awayPossession: pick(row, 'awayPossession', 'away_possession') == null ? null : asNumber(pick(row, 'awayPossession', 'away_possession')),
    homeVotes: asNumber(homeVotes ?? counts.home),
    awayVotes: asNumber(awayVotes ?? counts.away),
    userSelection: pick(row, 'userSelection', 'user_selection') === 'home' || pick(row, 'userSelection', 'user_selection') === 'away' ? pick(row, 'userSelection', 'user_selection') as PossessionSide : null,
    votes: Array.isArray(voteRows) ? voteRows.map(normalizeVote) : [],
    pokes: Array.isArray(pokeRows) ? pokeRows.map(normalizePoke) : [],
    settlement: pick(row, 'settlement') == null ? null : asRecord(pick(row, 'settlement')) as PossessionMarket['settlement'],
  };
}

function normalizeActionResult(value: unknown): PossessionActionResult {
  const row = asRecord(value);
  const market = pick(row, 'market', 'data');
  const vote = pick(row, 'vote');
  const poke = pick(row, 'poke');
  return {
    success: pick(row, 'success') === true,
    message: typeof pick(row, 'message') === 'string' ? asString(pick(row, 'message')) : undefined,
    market: market == null ? undefined : normalizeMarket(market),
    vote: vote == null ? undefined : normalizeVote(vote),
    poke: poke == null ? undefined : normalizePoke(poke),
  };
}

export interface PossessionContext {
  fixtureId: string;
  channelId: string;
  userId: string;
  authToken?: string | null;
}

export async function fetchPossessionMarket(context: PossessionContext): Promise<PossessionMarket> {
  const query = new URLSearchParams({ fixture_id: context.fixtureId, channel_id: context.channelId, user_id: context.userId });
  return normalizeMarket(await request<unknown>(`?${query.toString()}`, context.authToken));
}

export async function fetchPossessionVotes(context: PossessionContext): Promise<PossessionVote[]> {
  const query = new URLSearchParams({ fixture_id: context.fixtureId, channel_id: context.channelId });
  const result = asRecord(await request<unknown>(`/votes?${query.toString()}`, context.authToken));
  const rows = pick(result, 'votes') ?? pick(asRecord(pick(result, 'data')), 'votes');
  return Array.isArray(rows) ? rows.map(normalizeVote) : [];
}

export async function fetchPossessionPokes(context: PossessionContext): Promise<PossessionPoke[]> {
  const query = new URLSearchParams({ fixture_id: context.fixtureId, channel_id: context.channelId });
  const result = asRecord(await request<unknown>(`/poking?${query.toString()}`, context.authToken));
  const rows = pick(result, 'pokes') ?? pick(asRecord(pick(result, 'data')), 'pokes');
  return Array.isArray(rows) ? rows.map(normalizePoke) : [];
}

export async function castPossessionVote(
  context: PossessionContext & { userId: string; username: string; selection: PossessionSide },
): Promise<PossessionActionResult> {
  return normalizeActionResult(await request<unknown>('/votes', context.authToken, {
    method: 'POST',
    body: JSON.stringify({
      fixture_id: context.fixtureId,
      channel_id: context.channelId,
      user_id: context.userId,
      username: context.username,
      selection: context.selection,
    }),
  }));
}

export async function createPossessionPoke(
  context: PossessionContext & { userId: string; username: string; selection: PossessionSide; amount: number },
): Promise<PossessionActionResult> {
  return normalizeActionResult(await request<unknown>('/poking', context.authToken, {
    method: 'POST',
    body: JSON.stringify({
      fixture_id: context.fixtureId,
      channel_id: context.channelId,
      user_id: context.userId,
      username: context.username,
      selection: context.selection,
      amount: context.amount,
    }),
  }));
}

export async function matchPossessionPoke(
  context: PossessionContext & { pokeId: string; userId: string },
): Promise<PossessionActionResult> {
  return normalizeActionResult(await request<unknown>('/poking/match', context.authToken, {
    method: 'POST',
    body: JSON.stringify({
      fixture_id: context.fixtureId,
      channel_id: context.channelId,
      poke_id: context.pokeId,
      user_id: context.userId,
    }),
  }));
}

/** Server-side settlement endpoint. The app exposes the contract but never auto-settles a market. */
export async function settlePossessionMarket(
  context: PossessionContext & { settlementKey?: string },
): Promise<PossessionActionResult> {
  return normalizeActionResult(await request<unknown>('/settlement', context.authToken, {
    method: 'POST',
    body: JSON.stringify({
      fixture_id: context.fixtureId,
      channel_id: context.channelId,
      ...(context.settlementKey ? { settlement_key: context.settlementKey } : {}),
    }),
  }));
}
