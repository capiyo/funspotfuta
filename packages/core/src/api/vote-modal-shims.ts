// packages/core/src/api/vote-modal-shims.ts
//
// Rewritten against the Flutter app (fixture_page.dart / payment_service.dart),
// which is the source of truth for endpoints and payloads.
//
// What was wrong with the previous version:
//   - fetchBalance called /payment/balance/:id (does not exist). Flutter reads
//     GET /auth/user/id/:id -> user.balance. Every failure became 0.
//   - topUp / withdraw hit /payment/stk-push and /payment/b2c with no user id,
//     no auth header, and no waiting for the STK result. They are now thin
//     wrappers over payment-service.ts (initiateSTKPush / initiateB2CPayment).
//   - getSavedPhone / savePhone / getUserPhone were stubs returning ''. An empty
//     phone made the dialog's submit return silently, which is why "add money"
//     and "withdraw" appeared to do nothing.
//   - fetchPledges read p.user_id / p.amount / p.bet_id; the API returns
//     starter_id / starter_amount / _id, so every pledge showed zero and no
//     pledge was ever "yours".
//   - fetchBets returned raw snake_case rows; the modal reads camelCase.
//   - Sub-fixture pledge and match calls used paths that differ from
//     sub-fixture-service.ts. They now reuse that file.
//   - No call sent the auth token. Every call here does.
//   - Failures are THROWN (not turned into [] / 0) so the modal can show why.
//
// All user-scoped functions take userId / authToken explicitly. ArenaScreen
// binds them (see modalApi there).

import { bettorFromOpenBet } from '../types/fixture';
import { initiateSTKPush, initiateB2CPayment } from './payment-service';
import {
  getMarketBets,
  placeSubFixtureBet,
  fillSubFixtureBet,
} from './sub-fixture-service';

export const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';

type Token = string | null | undefined;

// ── Local types (mirror the modal's prop types) ─────────────────────

export interface SubFixtureMarket {
  id: string;
  matchId: string;
  marketType: string;
  options: string[];
  line?: number;
  status: string;
  lockAt?: string;
  pledgeCounts: Record<string, number>;
  pledgeTotals: Record<string, number>;
  result?: string;
  isVisible: boolean;
}

export interface SubFixturePledge {
  id: string;
  userId: string;
  userName: string;
  selection: string;
  amount: number;
  status: string;
  selectionColor?: string;
}

export interface Bettor {
  betId: string;
  userId: string;
  userName: string;
  selection: string;
  selectionDisplay: string;
  amount: number;
  isOpen: boolean;
}

export type PayResult = {
  success: boolean;
  newBalance?: number;
  error?: string;
  message?: string;
};

// ── Helpers ─────────────────────────────────────────────────────────

function authHeader(authToken?: Token): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function jsonHeaders(authToken?: Token): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...authHeader(authToken),
  };
}

// Render free instances cold-start slowly; a short timeout turns that into a
// fake "0 balance" / failed action.
async function fetchT(url: string, init: RequestInit = {}, ms = 45_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Request timed out. The server may be waking up, try again.');
    }
    throw new Error(`Network error: ${e?.message ?? e}`);
  } finally {
    clearTimeout(timer);
  }
}

/** GET json. 404 -> null (treated as "nothing there yet"); other failures throw. */
async function getJson(url: string, authToken?: Token, ms?: number): Promise<any | null> {
  const res = await fetchT(url, { headers: jsonHeaders(authToken) }, ms);
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) {
    throw new Error('Session expired, please sign in again');
  }
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

const str = (v: any): string => (v == null ? '' : String(v));
const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Mongo extended JSON: { $oid: '...' }
function oid(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v.$oid) return String(v.$oid);
  return String(v);
}

// Mongo extended JSON dates: { $date: '...' } | { $date: { $numberLong } } | ISO string
function parseDate(v: any): Date | undefined {
  if (v == null) return undefined;
  let d: Date;
  if (typeof v === 'object' && '$date' in v) {
    const inner = v.$date;
    d = new Date(inner?.$numberLong != null ? Number(inner.$numberLong) : inner);
  } else {
    d = new Date(v);
  }
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// ── Voters ──────────────────────────────────────────────────────────
// GET /actions/vote/fixture/:fixtureId/voters -> { voters: [{ userId, userName, selection, votedAt }] }

export async function fetchVoters(
  fixtureId: string,
  authToken?: Token,
): Promise<any[]> {
  const data = await getJson(`${API_BASE_URL}/actions/vote/fixture/${fixtureId}/voters`, authToken);
  const list: any[] = data?.voters ?? [];
  return list.map((v) => ({
    ...v,
    userId: str(v.userId ?? v.user_id),
    userName: str(v.userName ?? v.user_name ?? v.username ?? 'Anonymous'),
    selection: str(v.selection),
    isComrade: v.isComrade ?? v.is_comrade ?? false,
  }));
}

// ── Pledges (main fixture) ──────────────────────────────────────────
// GET /actions/channel/:channelId/:fixtureId/pledges -> { pledges: [...], count }
// Rows are open bets: starter_id, starter_name, starter_selection, starter_amount, _id

export async function fetchPledges(
  channelId: string,
  fixtureId: string,
  authToken?: Token,
): Promise<Bettor[]> {
  const data = await getJson(
    `${API_BASE_URL}/actions/channel/${channelId}/${fixtureId}/pledges`,
    authToken,
  );
  const list: any[] = data?.pledges ?? [];
  return list.map((row): Bettor => {
    const b = bettorFromOpenBet(row);
    return {
      betId: b.betId,
      userId: b.userId,
      userName: b.userName,
      selection: b.selection,
      selectionDisplay:
        b.selection === 'home_team' ? 'Home' : b.selection === 'away_team' ? 'Away' : b.selection,
      amount: b.amount,
      isOpen: true,
    };
  });
}

// ── Sub-fixture markets ─────────────────────────────────────────────
// NOTE: this list endpoint is the one I could not verify against the Flutter
// source. Field names are read tolerantly (snake_case or camelCase).

export async function fetchSubFixtures(
  fixtureId: string,
  authToken?: Token,
): Promise<SubFixtureMarket[]> {
  const data = await getJson(`${API_BASE_URL}/sub_fixtures/markets/${fixtureId}`, authToken);
  const list: any[] = Array.isArray(data) ? data : data?.markets ?? [];
  return list.map((m): SubFixtureMarket => ({
    id: str(m.market_id ?? m.id ?? oid(m._id)),
    matchId: str(m.match_id ?? m.matchId ?? fixtureId),
    marketType: str(m.market_type ?? m.marketType ?? m.type),
    options: m.options ?? [],
    line: m.line ?? undefined,
    status: str(m.status ?? 'open'),
    lockAt: m.lock_at ?? m.lockAt ?? undefined,
    pledgeCounts: m.pledge_counts ?? m.pledgeCounts ?? {},
    pledgeTotals: m.pledge_totals ?? m.pledgeTotals ?? {},
    result: m.result ?? undefined,
    isVisible: m.is_visible ?? m.isVisible ?? true,
  }));
}

// ── Sub-fixture pledges ─────────────────────────────────────────────
// Reuses sub-fixture-service.getMarketBets:
//   GET /sub_fixtures/sub-fixture/bets/market/:matchId/:marketId

export async function fetchSubFixturePledges(
  marketId: string,
  fixtureId: string,
  authToken?: Token,
): Promise<SubFixturePledge[]> {
  return getMarketBets(fixtureId, marketId, authToken ?? undefined);
}

// ── Bets (matched bets list) ────────────────────────────────────────
// GET /actions/channel/:channelId/:fixtureId/bettors -> { bettors: [...] }
// Flutter keeps only rows that have a finisher (matched bets).

export async function fetchBets(
  channelId: string,
  fixtureId: string,
  authToken?: Token,
): Promise<any[]> {
  const data = await getJson(
    `${API_BASE_URL}/actions/channel/${channelId}/${fixtureId}/bettors`,
    authToken,
  );
  const list: any[] = data?.bettors ?? [];
  return list
    .filter((b) => b?.finisher_id != null && str(b.finisher_id) !== '')
    .map((b) => {
      const starterAmount = num(b.starter_amount);
      const finisherAmount = num(b.finisher_amount);
      return {
        id: oid(b._id ?? b.id),
        starterId: str(b.starter_id),
        starterName: str(b.starter_name),
        starterSelection: str(b.starter_selection),
        starterAmount,
        finisherId: str(b.finisher_id),
        finisherName: str(b.finisher_name),
        finisherSelection: str(b.finisher_selection),
        finisherAmount,
        totalPot: starterAmount + finisherAmount,
        status: str(b.status ?? 'matched'),
        createdAt: parseDate(b.created_at),
      };
    });
}

// ── Balance ─────────────────────────────────────────────────────────
// GET /auth/user/id/:id -> { success, user: { balance } }
// THROWS on any failure so the modal can show the reason instead of "KES 0.00".

export async function fetchBalance(
  userId: string,
  authToken?: Token,
  opts?: { forceRefresh?: boolean },
): Promise<number> {
  if (!userId || userId === 'guest') throw new Error('Not signed in');
  // Cache-busting via query param (custom Cache-Control headers trigger a CORS
  // preflight on Expo web).
  const url = `${API_BASE_URL}/auth/user/id/${userId}${opts?.forceRefresh ? `?_=${Date.now()}` : ''}`;
  const res = await fetchT(url, { headers: jsonHeaders(authToken) });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Session expired, please sign in again');
  }
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  const data = await res.json();
  if (data?.success !== true) throw new Error(data?.message ?? 'Could not load balance');
  const b = Number(data?.user?.balance);
  if (!Number.isFinite(b)) throw new Error('Balance missing from server response');
  return b;
}

// ── Top-up (M-Pesa STK push) ────────────────────────────────────────
// payment-service.initiateSTKPush does the real work, including waiting for the
// STK result (up to ~3 minutes), like Flutter's PaymentService.

export async function topUp(args: {
  userId: string;
  username: string;
  authToken?: Token;
  amount: number;
  phone: string;
  purpose: string;
}): Promise<PayResult> {
  try {
    const r: any = await initiateSTKPush({
      userId: args.userId,
      username: args.username,
      amount: args.amount,
      phoneNumber: args.phone,
      authToken: args.authToken ?? undefined,
      purpose: args.purpose,
    });
    const ok = (r?.success ?? r?.isSuccess) === true;
    return {
      success: ok,
      newBalance: r?.newBalance != null ? Number(r.newBalance) : undefined,
      error: ok ? undefined : r?.error ?? r?.message ?? 'Payment failed',
      message: r?.message,
    };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Network error' };
  }
}

// ── Withdraw (M-Pesa B2C) ───────────────────────────────────────────
// Flutter sends channelId '' for user withdrawals.

export async function withdraw(args: {
  userId: string;
  username: string;
  authToken?: Token;
  amount: number;
  phone: string;
}): Promise<PayResult> {
  try {
    const r: any = await initiateB2CPayment({
      userId: args.userId,
      username: args.username,
      channelId: '',
      amount: args.amount,
      phoneNumber: args.phone,
      authToken: args.authToken ?? undefined,
      remarks: 'User withdrawal',
      occasion: 'Withdrawal',
    });
    const ok = (r?.success ?? r?.isSuccess) === true;
    return {
      success: ok,
      newBalance: r?.newBalance != null ? Number(r.newBalance) : undefined,
      error: ok ? undefined : r?.error ?? r?.message ?? 'Withdrawal failed',
      message: r?.message,
    };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Network error' };
  }
}

// ── Phone helpers ───────────────────────────────────────────────────
// GET/POST /auth/user/:userId/{topup|withdraw}-phone ; GET /auth/user/id/:id -> user.phone

export async function getSavedPhone(
  userId: string,
  kind: 'topup' | 'withdraw',
  authToken?: Token,
): Promise<string | null> {
  if (!userId) return null;
  try {
    const data = await getJson(`${API_BASE_URL}/auth/user/${userId}/${kind}-phone`, authToken, 8_000);
    const phone = data?.success === true ? str(data?.phone) : '';
    return phone || null;
  } catch {
    return null; // non-fatal: the dialog falls back to the profile phone
  }
}

export async function savePhone(
  userId: string,
  kind: 'topup' | 'withdraw',
  phone: string,
  authToken?: Token,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const res = await fetchT(
      `${API_BASE_URL}/auth/user/${userId}/${kind}-phone`,
      { method: 'POST', headers: jsonHeaders(authToken), body: JSON.stringify({ phone }) },
      8_000,
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data?.success === true;
  } catch {
    return false;
  }
}

export async function getUserPhone(userId: string, authToken?: Token): Promise<string> {
  if (!userId) return '';
  try {
    const data = await getJson(`${API_BASE_URL}/auth/user/id/${userId}`, authToken, 10_000);
    return data?.success === true ? str(data?.user?.phone) : '';
  } catch {
    return '';
  }
}

// ── Place / match sub-fixture pledge ────────────────────────────────
// Reuse sub-fixture-service so the paths match the Rust routes exactly.

export async function placeSubFixturePledge(args: {
  fixtureId: string;
  marketId: string;
  starterId: string;
  starterName: string;
  selection: string;
  amount: number;
  authToken?: Token;
}): Promise<{ success: boolean; message?: string }> {
  const data = await placeSubFixtureBet({
    matchId: args.fixtureId,
    marketId: args.marketId,
    userId: args.starterId,
    userName: args.starterName,
    selection: args.selection,
    amount: args.amount,
    authToken: args.authToken ?? undefined,
  });
  return { success: data?.success === true, message: data?.message };
}

export async function matchSubFixturePledge(args: {
  betId: string;
  matchId: string;
  marketId: string;
  finisherId: string;
  finisherName: string;
  selection: string;
  amount: number;
  authToken?: Token;
}): Promise<{ success: boolean; message?: string }> {
  const data = await fillSubFixtureBet({
    betId: args.betId,
    matchId: args.matchId,
    marketId: args.marketId,
    finisherId: args.finisherId,
    finisherName: args.finisherName,
    selection: args.selection,
    amount: args.amount,
    authToken: args.authToken ?? undefined,
  });
  return { success: data?.success === true, message: data?.message };
}

// ── Match a main-fixture pledge ─────────────────────────────────────
// Lives in vote-actions.ts now (voting, pledging and matching are in one file).
// Re-exported so existing importers keep working.

export { matchMainPledge } from './vote-actions';

// ─────────────────────────────────────────────────────────────
//  ARCHIVE — activity history for a single user (unchanged)
// ─────────────────────────────────────────────────────────────

export interface ArchiveActivityDto {
  _id: string;
  fixture_id: string;
  home_team: string;
  away_team: string;
  activity_type: 'vote' | 'comment' | 'like';
  selection: string | null;
  comment: string | null;
  is_liked: boolean | null;
  timestamp: string;
}

/**
 * Fetches the archive activity history for a user.
 *
 * Ported from the Flutter _ActivityHistorySheetState._fetchActivities:
 *   GET /api/archive/user/:userId
 *
 * The endpoint returns a bare JSON array. Non-array bodies are treated
 * as "no activity" rather than an error. On network failure we return
 * an empty array — the sheet already has a "No activities yet" empty
 * state, and reproducing Flutter's mock fallback (which injected fake
 * activities) would be worse than showing nothing.
 */
export async function fetchUserActivityHistory(
  userId: string,
  authToken?: string | null,
  timeoutMs = 10_000,
): Promise<ArchiveActivityDto[]> {
  if (!userId) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(
      `${API_BASE_URL}/archive/user/${encodeURIComponent(userId)}`,
      {
        headers: authHeader(authToken),
        signal: controller.signal,
      },
    );

    if (!res.ok) return [];

    const body: unknown = await res.json();
    const list: unknown[] = Array.isArray(body)
      ? body
      : Array.isArray((body as { data?: unknown })?.data)
        ? (body as { data: unknown[] }).data
        : [];

    return list
      .filter(
        (item: unknown): item is Record<string, unknown> =>
          !!item && typeof item === 'object',
      )
      .map((item: Record<string, unknown>): ArchiveActivityDto => ({
        _id: String(item._id ?? ''),
        fixture_id: String(item.fixture_id ?? ''),
        home_team: String(item.home_team ?? ''),
        away_team: String(item.away_team ?? ''),
        activity_type:
          item.activity_type === 'vote' ||
            item.activity_type === 'comment' ||
            item.activity_type === 'like'
            ? item.activity_type
            : 'vote',
        selection: item.selection != null ? String(item.selection) : null,
        comment: item.comment != null ? String(item.comment) : null,
        is_liked: typeof item.is_liked === 'boolean' ? item.is_liked : null,
        timestamp: String(item.timestamp ?? new Date().toISOString()),
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}