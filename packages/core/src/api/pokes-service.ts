/**
 * Whole-match Pokes API.
 *
 * Pokes are point-staked peer matches and intentionally use a separate route
 * namespace from sub-fixture bets. The API server must expose these routes:
 * GET /api/pokes/open/:match_id
 * GET /api/pokes/user/:user_id
 * POST /api/pokes
 * POST /api/pokes/:poke_id/match
 */
const API = 'https://clash-api-m5mr.onrender.com/api';
const headers = (token?: string | null): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export interface Poke {
  id: string;
  matchId: string;
  userId: string;
  userName: string;
  selection: 'home' | 'away';
  amount: number;
  status: string;
  finisherId?: string | null;
  finisherName?: string | null;
  finisherSelection?: string | null;
  finisherAmount?: number | null;
  createdAt?: string;
}

function fromJson(value: Record<string, unknown>): Poke {
  return {
    id: String(value.id ?? value._id ?? ''),
    matchId: String(value.match_id ?? value.matchId ?? ''),
    userId: String(value.starter_id ?? value.user_id ?? value.userId ?? ''),
    userName: String(value.starter_name ?? value.user_name ?? value.userName ?? 'Fan'),
    selection: (String(value.starter_selection ?? value.selection ?? 'home').toLowerCase().includes('away') ? 'away' : 'home'),
    amount: Number(value.starter_amount ?? value.amount ?? 0),
    status: String(value.status ?? 'open').toLowerCase(),
    finisherId: value.finisher_id == null ? null : String(value.finisher_id),
    finisherName: value.finisher_name == null ? null : String(value.finisher_name),
    finisherSelection: value.finisher_selection == null ? null : String(value.finisher_selection),
    finisherAmount: value.finisher_amount == null ? null : Number(value.finisher_amount),
    createdAt: value.created_at == null ? undefined : String(value.created_at),
  };
}

async function readList(url: string, token?: string): Promise<Poke[]> {
  const response = await fetch(url, { headers: headers(token) });
  const payload = await response.json();
  if (!response.ok) throw new Error(String(payload?.message ?? payload?.error ?? 'Could not load pokes'));
  const rows = Array.isArray(payload) ? payload : (payload.pokes ?? payload.data ?? []);
  return rows.map((row: Record<string, unknown>) => fromJson(row));
}

export function getOpenPokes(matchId: string, token?: string): Promise<Poke[]> {
  return readList(`${API}/pokes/open/${encodeURIComponent(matchId)}`, token);
}

export function getUserPokes(userId: string, token?: string): Promise<Poke[]> {
  return readList(`${API}/pokes/user/${encodeURIComponent(userId)}`, token);
}

export interface CreatePokeParams {
  matchId: string;
  userId: string;
  userName: string;
  selection: 'home' | 'away';
  amount: number;
  token?: string;
}

export async function createPoke(p: CreatePokeParams): Promise<Poke> {
  const response = await fetch(`${API}/pokes`, {
    method: 'POST',
    headers: headers(p.token),
    body: JSON.stringify({
      match_id: p.matchId,
      starter_id: p.userId,
      starter_name: p.userName,
      starter_selection: p.selection,
      starter_amount: p.amount,
      stake_type: 'points',
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error(String(payload?.message ?? payload?.error ?? 'Could not create poke'));
  }
  return fromJson(payload.poke ?? payload.data ?? payload);
}

export interface MatchPokeParams {
  pokeId: string;
  userId: string;
  userName: string;
  selection: 'home' | 'away';
  amount: number;
  token?: string;
}

export async function matchPoke(p: MatchPokeParams): Promise<Poke> {
  const response = await fetch(`${API}/pokes/${encodeURIComponent(p.pokeId)}/match`, {
    method: 'POST',
    headers: headers(p.token),
    body: JSON.stringify({
      finisher_id: p.userId,
      finisher_name: p.userName,
      finisher_selection: p.selection,
      finisher_amount: p.amount,
      stake_type: 'points',
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error(String(payload?.message ?? payload?.error ?? 'Could not match poke'));
  }
  return fromJson(payload.poke ?? payload.data ?? payload);
}
