import { API_BASE, authHeaders } from './config';
import type {
  PossessionActionResult,
  PossessionMarket,
  PossessionSide,
} from '../types/possession';

const POSSESSION_BASE = `${API_BASE}/actions/posseions`;

async function request<T>(path: string, token?: string | null, init?: RequestInit): Promise<T> {
  const response = await fetch(`${POSSESSION_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(token),
      ...(init?.headers ?? {}),
    },
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

export interface PossessionContext {
  fixtureId: string;
  channelId: string;
  authToken?: string | null;
}

export async function fetchPossessionMarket(context: PossessionContext): Promise<PossessionMarket> {
  const query = new URLSearchParams({ channel_id: context.channelId });
  return request<PossessionMarket>(`/${encodeURIComponent(context.fixtureId)}?${query.toString()}`, context.authToken);
}

export async function castPossessionVote(
  context: PossessionContext & { userId: string; username: string; selection: PossessionSide },
): Promise<PossessionActionResult> {
  return request<PossessionActionResult>('/votes', context.authToken, {
    method: 'POST',
    body: JSON.stringify({
      fixture_id: context.fixtureId,
      channel_id: context.channelId,
      user_id: context.userId,
      username: context.username,
      selection: context.selection,
    }),
  });
}

export async function createPossessionPoke(
  context: PossessionContext & { userId: string; username: string; selection: PossessionSide; amount: number },
): Promise<PossessionActionResult> {
  return request<PossessionActionResult>('/pokes', context.authToken, {
    method: 'POST',
    body: JSON.stringify({
      fixture_id: context.fixtureId,
      channel_id: context.channelId,
      user_id: context.userId,
      username: context.username,
      selection: context.selection,
      amount: context.amount,
    }),
  });
}

export async function matchPossessionPoke(
  context: PossessionContext & { pokeId: string; userId: string },
): Promise<PossessionActionResult> {
  return request<PossessionActionResult>('/pokes/match', context.authToken, {
    method: 'POST',
    body: JSON.stringify({
      fixture_id: context.fixtureId,
      channel_id: context.channelId,
      poke_id: context.pokeId,
      user_id: context.userId,
    }),
  });
}

/** Server-side settlement endpoint. The app exposes the contract but never auto-settles a market. */
export async function settlePossessionMarket(
  context: PossessionContext & { settlementKey?: string },
): Promise<PossessionActionResult> {
  return request<PossessionActionResult>('/settlement', context.authToken, {
    method: 'POST',
    body: JSON.stringify({
      fixture_id: context.fixtureId,
      channel_id: context.channelId,
      ...(context.settlementKey ? { settlement_key: context.settlementKey } : {}),
    }),
  });
}
