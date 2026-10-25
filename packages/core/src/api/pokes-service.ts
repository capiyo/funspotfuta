/**
 * Pokes are point-staked matches. All calls use the Rust Axum actions routes;
 * these are deliberately separate from money bets and sub-fixture bet routes.
 */
const API = 'https://clash-api-m5mr.onrender.com/api/actions';
const headers = (token?: string | null): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});
export interface Poke {
  id: string; matchId: string; userId: string; userName: string;
  selection: 'home' | 'away'; amount: number; status: string;
  finisherId?: string | null; finisherName?: string | null;
  finisherSelection?: string | null; finisherAmount?: number | null;
  createdAt?: string;
}
function fromJson(value: Record<string, unknown>): Poke {
  return {
    id: String(value.poke_id ?? value.id ?? value._id ?? ''),
    matchId: String(value.fixture_id ?? value.match_id ?? value.matchId ?? ''),
    userId: String(value.starter_id ?? value.user_id ?? value.userId ?? ''),
    userName: String(value.starter_name ?? value.user_name ?? value.userName ?? 'Fan'),
    selection: String(value.starter_selection ?? value.selection ?? 'home').toLowerCase().includes('away') ? 'away' : 'home',
    amount: Number(value.stake ?? value.starter_amount ?? value.amount ?? 0),
    status: String(value.status ?? 'open').toLowerCase(),
    finisherId: value.finisher_id == null ? null : String(value.finisher_id),
    finisherName: value.finisher_name == null ? null : String(value.finisher_name),
    finisherSelection: value.finisher_selection == null ? null : String(value.finisher_selection),
    finisherAmount: value.finisher_stake == null ? (value.finisher_amount == null ? null : Number(value.finisher_amount)) : Number(value.finisher_stake),
    createdAt: value.created_at == null ? undefined : String(value.created_at),
  };
}
function rows(payload: unknown): Poke[] {
  if (Array.isArray(payload)) return payload.map((row) => fromJson(row as Record<string, unknown>));
  if (!payload || typeof payload !== 'object') throw new Error('Poke response was not a list');
  const value = payload as Record<string, unknown>;
  const data = value.data;
  const pokes = value.pokes;
  const dataObject = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : undefined;
  const pokeObject = pokes && typeof pokes === 'object' && !Array.isArray(pokes) ? pokes as Record<string, unknown> : undefined;
  const list = value.open_pokes ?? value.openPokes ?? value.open
    ?? (Array.isArray(pokes) ? pokes : undefined)
    ?? pokeObject?.open ?? pokeObject?.open_pokes ?? pokeObject?.items
    ?? (Array.isArray(data) ? data : undefined)
    ?? dataObject?.open ?? dataObject?.open_pokes ?? dataObject?.openPokes
    ?? dataObject?.pokes ?? dataObject?.items;
  if (!Array.isArray(list)) throw new Error('Poke response did not contain an open-pokes list');
  return list.map((row) => fromJson(row as Record<string, unknown>));
}
async function request(path: string, token?: string, body?: unknown): Promise<any> {
  const response = await fetch(`${API}${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: headers(token),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) throw new Error(String(payload?.message ?? payload?.error ?? 'Poke request failed'));
  return payload;
}
export async function getOpenPokes(matchId: string, token: string | undefined, channelId: string | undefined, marketId?: string): Promise<Poke[]> {
  // Open pokes are scoped to a channel and fixture by the Axum API. There is
  // no global "__open__" user endpoint, so never call a guessed fallback URL.
  if (!channelId) return [];
  const suffix = marketId && marketId !== 'main_fixture' ? `?market_id=${encodeURIComponent(marketId)}` : '';
  const payload = await request(`/channel/${encodeURIComponent(channelId)}/${encodeURIComponent(matchId)}/pokes${suffix}`, token);
  const open = rows(payload);
  // The endpoint is already scoped to this fixture. Some API responses omit
  // the fixture identifier on each row; preserve the route's fixture context
  // rather than turning those valid rows into invisible entries in the UI.
  return open.map((poke) => ({ ...poke, matchId: poke.matchId || String(matchId) }));
}
export async function getUserPokes(userId: string, token?: string): Promise<Poke[]> {
  return rows(await request(`/poke/user/${encodeURIComponent(userId)}`, token));
}
export interface CreatePokeParams {
  matchId: string; userId: string; userName: string; selection: 'home' | 'away';
  amount: number; token?: string; marketId?: string; channelId?: string;
}
export async function createPoke(p: CreatePokeParams): Promise<Poke> {
  const payload = await request('/poke/create', p.token, {
    fixture_id: p.matchId,
    ...(p.marketId && p.marketId !== 'main_fixture' ? { market_id: p.marketId } : {}),
    ...(p.channelId ? { channel_id: p.channelId } : {}),
    starter_id: p.userId, starter_name: p.userName,
    starter_selection: p.selection, stake: p.amount,
  });
  return fromJson(payload?.poke ?? payload?.data ?? payload);
}
export interface MatchPokeParams {
  pokeId: string; userId: string; userName: string; selection: 'home' | 'away';
  amount?: number; token?: string;
}
export async function matchPoke(p: MatchPokeParams): Promise<Poke> {
  const payload = await request('/poke/fill', p.token, {
    poke_id: p.pokeId, finisher_id: p.userId, finisher_name: p.userName,
    finisher_selection: p.selection,
  });
  return fromJson(payload?.poke ?? payload?.data ?? payload);
}
export async function getUserPoints(userId: string, token?: string): Promise<number> {
  const payload = await request(`/poke/points/${encodeURIComponent(userId)}`, token);
  const value = payload?.points ?? payload?.balance ?? payload?.data?.points;
  if (typeof value !== 'number') throw new Error('Points balance was not included in the response');
  return value;
}
