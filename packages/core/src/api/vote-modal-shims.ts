// apps/web/lib/api/vote-modal-shims.ts
// Extracted from app/(app)/home/page.tsx so ChatPage (and anything else
// that opens SwipeableVotePledgeModal) can reuse the same fetchers.
import { API_BASE as API_BASE_URL } from './config';

export async function fetchVoters(
  fixtureId: string,
  authToken?: string | null,
) {
  const res = await fetch(
    `${API_BASE_URL}/actions/vote/fixture/${fixtureId}/voters`,
    { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.voters ?? []) as any[];
}

export async function fetchPledges(
  channelId: string,
  fixtureId: string,
  authToken?: string | null,
) {
  const res = await fetch(
    `${API_BASE_URL}/actions/channel/${channelId}/${fixtureId}/pledges`,
    { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.pledges ?? []).map((p: any) => ({
    betId: p.bet_id ?? p._id ?? '',
    userId: p.user_id ?? p.userId ?? '',
    userName: p.user_name ?? p.userName ?? '',
    selection: p.selection ?? '',
    selectionDisplay:
      p.selection === 'home_team' || p.selection === 'home'
        ? 'Home'
        : p.selection === 'away_team' || p.selection === 'away'
          ? 'Away'
          : p.selection ?? '',
    amount: p.amount ?? 0,
    isOpen: p.status === 'open' || p.is_open === true,
  }));
}

export async function fetchSubFixtures(
  fixtureId: string,
  authToken?: string | null,
) {
  const res = await fetch(`${API_BASE_URL}/sub_fixtures/markets/${fixtureId}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.markets ?? []) as any[];
}

export async function fetchSubFixturePledges(
  marketId: string,
  fixtureId: string,
  authToken?: string | null,
) {
  const res = await fetch(
    `${API_BASE_URL}/sub_fixtures/bets/${marketId}?matchId=${fixtureId}`,
    { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.bets ?? []) as any[];
}

export async function fetchBets(
  channelId: string,
  fixtureId: string,
  authToken?: string | null,
) {
  const res = await fetch(
    `${API_BASE_URL}/actions/channel/${channelId}/${fixtureId}/bettors`,
    { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.bettors ?? []) as any[];
}

export async function fetchBalance(
  userId: string,
  authToken?: string | null,
  opts?: { forceRefresh?: boolean },
) {
  const res = await fetch(
    `${API_BASE_URL}/payment/balance/${userId}${opts?.forceRefresh ? `?_=${Date.now()}` : ''
    }`,
    { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
  );
  if (!res.ok) return 0;
  const data = await res.json();
  return Number(data?.balance ?? data?.wallet_balance ?? 0);
}

export async function topUp(
  amount: number,
  phone: string,
  purpose: string,
) {
  try {
    const res = await fetch(`${API_BASE_URL}/payment/stk-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, phone, purpose }),
    });
    const data = await res.json();
    return {
      success: data?.success === true,
      newBalance: data?.new_balance,
      error: data?.message,
    };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Network error' };
  }
}

export async function withdraw(amount: number, phone: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/payment/b2c`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, phone }),
    });
    const data = await res.json();
    return {
      success: data?.success === true,
      newBalance: data?.new_balance,
      error: data?.message,
    };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Network error' };
  }
}

export async function getSavedPhone(_kind: 'topup' | 'withdraw') {
  return null;
}

export async function savePhone(_kind: 'topup' | 'withdraw', _phone: string) {
  return true;
}

export async function getUserPhone() {
  return '';
}

export async function placeSubFixturePledge(args: {
  fixtureId: string;
  marketId: string;
  starterId: string;
  starterName: string;
  selection: string;
  amount: number;
}) {
  try {
    const res = await fetch(`${API_BASE_URL}/sub_fixtures/sub-fixture/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_id: args.fixtureId,
        market_id: args.marketId,
        starter_id: args.starterId,
        starter_name: args.starterName,
        selection: args.selection,
        amount: args.amount,
      }),
    });
    const data = await res.json();
    return { success: data?.success === true, message: data?.message };
  } catch (e: any) {
    return { success: false, message: e?.message ?? 'Network error' };
  }
}

export async function matchSubFixturePledge(args: {
  betId: string;
  matchId: string;
  marketId: string;
  finisherId: string;
  finisherName: string;
  selection: string;
  amount: number;
}) {
  try {
    const res = await fetch(`${API_BASE_URL}/sub_fixtures/bet/fill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bet_id: args.betId,
        match_id: args.matchId,
        market_id: args.marketId,
        finisher_id: args.finisherId,
        finisher_name: args.finisherName,
        selection: args.selection,
        amount: args.amount,
      }),
    });
    const data = await res.json();
    return { success: data?.success === true, message: data?.message };
  } catch (e: any) {
    return { success: false, message: e?.message ?? 'Network error' };
  }
}

export async function matchMainPledge(args: {
  betId: string;
  finisherId: string;
  finisherName: string;
  finisherSelection: 'home' | 'away';
  amount: number;
}) {
  try {
    const res = await fetch(`${API_BASE_URL}/actions/bet/fill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bet_id: args.betId,
        finisher_id: args.finisherId,
        finisher_name: args.finisherName,
        finisher_selection: args.finisherSelection,
        amount: args.amount,
      }),
    });
    const data = await res.json();
    return { success: data?.success === true, message: data?.message };
  } catch (e: any) {
    return { success: false, message: e?.message ?? 'Network error' };
  }
}

// ─────────────────────────────────────────────────────────────
//  ARCHIVE — activity history for a single user
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
        headers: authToken
          ? { Authorization: `Bearer ${authToken}` }
          : {},
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