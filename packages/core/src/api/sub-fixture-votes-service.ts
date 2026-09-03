// Ported from the "SUB-FIXTURE (PROP BETS)" section of
// funspot/lib/services/api_services.dart — voting on prop markets
// (first goal / first corner / first yellow / etc), distinct from the
// money-betting endpoints in sub-fixture-service.ts.

import { API_BASE } from './config';
import { SubFixture, subFixtureFromJson } from '../types/fixture';

function authHeaders(authToken?: string | null): HeadersInit {
  return { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) };
}

// GET /api/votes/sub-fixtures?parent_fixture_id=...&fixtureType=...&isActive=...
export async function getSubFixtures(
  parentFixtureId: string,
  opts?: { fixtureType?: string; isActive?: boolean; authToken?: string }
): Promise<SubFixture[]> {
  try {
    const params = new URLSearchParams({ parent_fixture_id: parentFixtureId });
    if (opts?.fixtureType) params.set('fixtureType', opts.fixtureType);
    if (opts?.isActive != null) params.set('isActive', String(opts.isActive));
    const res = await fetch(`${API_BASE}/votes/sub-fixtures?${params.toString()}`, {
      headers: authHeaders(opts?.authToken),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data as any[]).map(subFixtureFromJson);
  } catch (e) {
    console.error('getSubFixtures failed:', e);
    return [];
  }
}

// GET /api/votes/sub-fixture/:id
export async function getSubFixtureById(subFixtureId: string, authToken?: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API_BASE}/votes/sub-fixture/${subFixtureId}`, { headers: authHeaders(authToken) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// GET /api/votes/sub-fixture/:id/stats
export async function getSubFixtureStats(subFixtureId: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API_BASE}/votes/sub-fixture/${subFixtureId}/stats`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// GET /api/votes/sub-fixture/:id/voters?selection=...&limit=...&offset=...
export async function getSubFixtureVoters(
  subFixtureId: string,
  opts?: { selection?: string; limit?: number; offset?: number }
): Promise<Record<string, any>[]> {
  try {
    const params = new URLSearchParams();
    if (opts?.selection) params.set('selection', opts.selection);
    if (opts?.limit != null) params.set('limit', String(opts.limit));
    if (opts?.offset != null) params.set('offset', String(opts.offset));
    const res = await fetch(`${API_BASE}/votes/sub-fixture/${subFixtureId}/voters?${params.toString()}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export interface SubmitSubFixtureVoteParams {
  voterId: string;
  username: string;
  subFixtureId: string;
  parentFixtureId: string;
  selection: string;
  authToken?: string;
  question?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  icon?: string;
  fixtureType?: string;
}

// POST /api/votes/sub-fixture
export async function submitSubFixtureVote(p: SubmitSubFixtureVoteParams): Promise<Record<string, any> | null> {
  const res = await fetch(`${API_BASE}/votes/sub-fixture`, {
    method: 'POST',
    headers: authHeaders(p.authToken),
    body: JSON.stringify({
      voter_id: p.voterId,
      username: p.username,
      sub_fixture_id: p.subFixtureId,
      parent_fixture_id: p.parentFixtureId,
      selection: p.selection,
      question: p.question,
      optionA: p.optionA,
      optionB: p.optionB,
      optionC: p.optionC,
      icon: p.icon,
      fixtureType: p.fixtureType,
    }),
  });

  if (res.status === 200 || res.status === 201) return await res.json();
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Validation error: ${body.message ?? 'Invalid data'}`);
  }
  return null;
}

// GET /api/votes/sub-fixture/:id/user/:userId
export async function checkUserSubFixtureVote(subFixtureId: string, userId: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API_BASE}/votes/sub-fixture/${subFixtureId}/user/${userId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// GET /api/votes/user/:userId/fixture/:fixtureId/sub-votes
export async function getUserSubFixtureVotes(userId: string, fixtureId: string): Promise<Record<string, any>[]> {
  try {
    const res = await fetch(`${API_BASE}/votes/user/${userId}/fixture/${fixtureId}/sub-votes`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// GET /api/votes/sub-fixtures/fixture/:fixtureId/user/:userId
export async function getSubFixturesWithUserVotes(fixtureId: string, userId: string): Promise<Record<string, any>[]> {
  try {
    const res = await fetch(`${API_BASE}/votes/sub-fixtures/fixture/${fixtureId}/user/${userId}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// GET /api/votes/sub-fixture/:id/counts
export async function getSubFixtureVoteCounts(subFixtureId: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API_BASE}/votes/sub-fixture/${subFixtureId}/counts`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// GET /api/votes/sub-fixture/:id/all-votes
export async function getAllSubFixtureVotes(subFixtureId: string, authToken?: string): Promise<Record<string, any>[]> {
  try {
    const res = await fetch(`${API_BASE}/votes/sub-fixture/${subFixtureId}/all-votes`, {
      headers: authHeaders(authToken),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// GET /api/votes/stats/sub-fixtures/trending?limit=...
export async function getTrendingSubFixtures(limit = 10): Promise<Record<string, any>[]> {
  try {
    const res = await fetch(`${API_BASE}/votes/stats/sub-fixtures/trending?limit=${limit}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('getTrendingSubFixtures failed:', e);
    return [];
  }
}

// POST /api/votes/stats/sub-fixtures/bulk
export async function getBulkSubFixtureStats(
  subFixtureIds: string[],
  authToken?: string
): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API_BASE}/votes/stats/sub-fixtures/bulk`, {
      method: 'POST',
      headers: authHeaders(authToken),
      body: JSON.stringify({ sub_fixture_ids: subFixtureIds }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('getBulkSubFixtureStats failed:', e);
    return null;
  }
}
