// apps/web/lib/api/vote-modal-shims.ts
// Extracted from app/(app)/home/page.tsx so ChatPage (and anything else
// that opens SwipeableVotePledgeModal) can reuse the same fetchers.

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'https://clash-api-m5mr.onrender.com/api';

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