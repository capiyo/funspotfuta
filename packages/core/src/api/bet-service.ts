// Ported from funspot/lib/services/bet_service.dart — BetService
// (whole-match pledge/bet flow, distinct from the per-market
// SubFixtureService in sub-fixture-service.ts).

import { Bet, betFromJson } from '../types/betting';

const API_BASE_URL = 'https://clash-api-m5mr.onrender.com/api';

function headers(authToken?: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

export interface CreateBetParams {
  fixtureId: string;
  starterId: string;
  starterName: string;
  starterSelection: string;
  amount: number;
  channelId: string;
  voteId: string;
  authToken?: string;
}

// POST /api/actions/bet/create (with vote_id — the current, non-deprecated path)
export async function createBetWithVoteId(p: CreateBetParams): Promise<Record<string, any>> {
  try {
    const res = await fetch(`${API_BASE_URL}/actions/bet/create`, {
      method: 'POST',
      headers: headers(p.authToken),
      body: JSON.stringify({
        fixture_id: p.fixtureId,
        starter_id: p.starterId,
        starter_name: p.starterName,
        starter_selection: p.starterSelection,
        amount: p.amount,
        channel_id: p.channelId,
        vote_id: p.voteId,
      }),
    });
    if (res.ok) return await res.json();
    return { success: false, message: `Server error: ${res.status}` };
  } catch (e: any) {
    return { success: false, message: `Network error: ${e?.message ?? e}` };
  }
}

// GET /api/actions/bet/open/:channelId/:fixtureId
export async function getOpenBets(channelId: string, fixtureId: string, authToken?: string): Promise<Bet[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/actions/bet/open/${channelId}/${fixtureId}`, {
      headers: headers(authToken),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const bets: any[] = data.open_bets ?? [];
    return bets.map(betFromJson);
  } catch {
    return [];
  }
}

// GET /api/actions/bet/channel/:channelId/:fixtureId
export async function getChannelBettors(channelId: string, fixtureId: string, authToken?: string): Promise<Bet[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/actions/bet/channel/${channelId}/${fixtureId}`, {
      headers: headers(authToken),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const bets: any[] = data.bettors ?? [];
    return bets.map(betFromJson);
  } catch {
    return [];
  }
}

export interface FillBetParams {
  betId: string;
  finisherId: string;
  finisherName: string;
  finisherSelection: string;
  amount: number;
  channelId: string;
  authToken?: string;
}

// POST /api/actions/bet/fill
export async function fillBet(p: FillBetParams): Promise<Record<string, any>> {
  try {
    const res = await fetch(`${API_BASE_URL}/actions/bet/fill`, {
      method: 'POST',
      headers: headers(p.authToken),
      body: JSON.stringify({
        bet_id: p.betId,
        finisher_id: p.finisherId,
        finisher_name: p.finisherName,
        finisher_selection: p.finisherSelection,
        amount: p.amount,
        channel_id: p.channelId,
      }),
    });
    if (res.ok) return await res.json();
    return { success: false, message: `Server error: ${res.status}` };
  } catch (e: any) {
    return { success: false, message: `Network error: ${e?.message ?? e}` };
  }
}
