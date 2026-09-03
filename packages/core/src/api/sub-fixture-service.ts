// Ported from funspot/lib/services/bet_service.dart — SubFixtureService
// (per-market bets: first goal / first corner / first yellow card / etc).
// Endpoint paths match the Rust backend routes exactly, as commented in the
// original.

import { SubFixturePledge, subFixturePledgeFromBetJson } from '../types/betting';

const API = 'https://clash-api-m5mr.onrender.com/api';

function headers(authToken?: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

// GET /api/sub_fixtures/sub-fixture/bets/open/:match_id
export async function getOpenSubFixtureBets(matchId: string, authToken?: string): Promise<SubFixturePledge[]> {
  try {
    const res = await fetch(`${API}/sub_fixtures/sub-fixture/bets/open/${matchId}`, { headers: headers(authToken) });
    if (!res.ok) return [];
    const data = await res.json();
    const bets: any[] = data.bets ?? [];
    return bets.map(subFixturePledgeFromBetJson);
  } catch (e) {
    console.error('getOpenSubFixtureBets failed:', e);
    return [];
  }
}

// GET /api/sub_fixtures/sub-fixture/bets/market/:match_id/:market_id
export async function getMarketBets(matchId: string, marketId: string, authToken?: string): Promise<SubFixturePledge[]> {
  try {
    const res = await fetch(`${API}/sub_fixtures/sub-fixture/bets/market/${matchId}/${marketId}`, {
      headers: headers(authToken),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const bets: any[] = data.bets ?? [];
    return bets.map(subFixturePledgeFromBetJson);
  } catch (e) {
    console.error('getMarketBets failed:', e);
    return [];
  }
}

// GET /api/sub_fixtures/sub-fixture/bets/user/:user_id
export async function getUserSubFixtureBets(userId: string, authToken?: string): Promise<SubFixturePledge[]> {
  try {
    const res = await fetch(`${API}/sub_fixtures/sub-fixture/bets/user/${userId}`, { headers: headers(authToken) });
    if (!res.ok) return [];
    const data = await res.json();
    const bets: any[] = data.bets ?? [];
    return bets.map(subFixturePledgeFromBetJson);
  } catch (e) {
    console.error('getUserSubFixtureBets failed:', e);
    return [];
  }
}

export interface PlaceSubFixtureBetParams {
  matchId: string;
  marketId: string;
  userId: string;
  userName: string;
  selection: string;
  amount: number;
  authToken?: string;
}

// POST /api/sub_fixtures/sub-fixture/bet
export async function placeSubFixtureBet(p: PlaceSubFixtureBetParams): Promise<Record<string, any>> {
  try {
    const res = await fetch(`${API}/sub_fixtures/sub-fixture/bet`, {
      method: 'POST',
      headers: headers(p.authToken),
      body: JSON.stringify({
        match_id: p.matchId,
        market_id: p.marketId,
        starter_id: p.userId,
        starter_name: p.userName,
        selection: p.selection,
        amount: p.amount,
      }),
    });
    return await res.json();
  } catch (e: any) {
    console.error('placeSubFixtureBet failed:', e);
    return { success: false, message: e?.message ?? String(e) };
  }
}

export interface FillSubFixtureBetParams {
  betId: string;
  matchId: string;
  marketId: string;
  finisherId: string;
  finisherName: string;
  selection: string;
  amount: number;
  authToken?: string;
}

// POST /api/sub_fixtures/sub-fixture/bet/:bet_id/fill
export async function fillSubFixtureBet(p: FillSubFixtureBetParams): Promise<Record<string, any>> {
  try {
    const res = await fetch(`${API}/sub_fixtures/sub-fixture/bet/${p.betId}/fill`, {
      method: 'POST',
      headers: headers(p.authToken),
      body: JSON.stringify({
        match_id: p.matchId,
        market_id: p.marketId,
        finisher_id: p.finisherId,
        finisher_name: p.finisherName,
        selection: p.selection,
        amount: p.amount,
      }),
    });
    return await res.json();
  } catch (e: any) {
    console.error('fillSubFixtureBet failed:', e);
    return { success: false, message: e?.message ?? String(e) };
  }
}

// GET /api/sub_fixtures/markets/:match_id/:market_id
export async function getMarketDetails(matchId: string, marketId: string, authToken?: string): Promise<Record<string, any>> {
  try {
    const res = await fetch(`${API}/sub_fixtures/markets/${matchId}/${marketId}`, { headers: headers(authToken) });
    if (!res.ok) return {};
    return await res.json();
  } catch (e) {
    console.error('getMarketDetails failed:', e);
    return {};
  }
}
