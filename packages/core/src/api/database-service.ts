// packages/core/src/api/database-service.ts
//
// Ported from funspot/lib/services/database_service.dart.
//
// IMPORTANT: functions used as React Query queryFns must THROW on failure.
// The old versions caught every error and returned [], which React Query
// treats as a successful fetch: no retry, stale-for-5-minutes empty data,
// and the empty array got persisted over the good on-disk cache.

import { API_BASE } from './config';
import { Fixture, fixtureFromJson } from '../types/fixture';

const REQUEST_TIMEOUT_MS = 8000;

/** GET + JSON with a timeout. Throws on network error, timeout or non-2xx. */
async function fetchJson(url: string, ms: number = REQUEST_TIMEOUT_MS): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function asArray(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.data)) return json.data;
  return [];
}

// ── Fixtures (queryFn: throws on failure) ──────────────────────

export async function getAllFixtures(): Promise<Fixture[]> {
  const json = await fetchJson(`${API_BASE}/games`);
  return asArray(json).map(fixtureFromJson);
}

// ── Votes / comments by user ───────────────────────────────────
// Strict versions throw; the exported ones keep the old tolerant
// behaviour (return []) for any existing callers that rely on it.

async function fetchVotesByUser(userId: string): Promise<Record<string, any>[]> {
  return asArray(await fetchJson(`${API_BASE}/votes/votes/user/${userId}`));
}

async function fetchCommentsByUser(userId: string): Promise<Record<string, any>[]> {
  return asArray(await fetchJson(`${API_BASE}/votes/comments/user/${userId}`));
}

export async function getVotesByUser(userId: string): Promise<Record<string, any>[]> {
  try {
    return await fetchVotesByUser(userId);
  } catch (e) {
    console.error('Error fetching votes:', e);
    return [];
  }
}

export async function getCommentsByUser(userId: string): Promise<Record<string, any>[]> {
  try {
    return await fetchCommentsByUser(userId);
  } catch (e) {
    console.error('Error fetching comments:', e);
    return [];
  }
}

// ── Chat stats (per fixture, tolerant: one bad fixture shouldn't fail all) ──

export interface ChatStats {
  participants: number;
  messages: number;
  lastMessage: string;
  lastMessageTime: Date | null;
}

export async function getChatStats(fixtureId: string): Promise<ChatStats> {
  try {
    const [votesRes, commentsRes] = await Promise.all([
      fetch(`${API_BASE}/votes/votes/fixture/${fixtureId}`),
      fetch(`${API_BASE}/votes/comments/fixture/${fixtureId}`),
    ]);

    let participants = 0;
    let messages = 0;
    let lastMessage = '';
    let lastMessageTime: Date | null = null;

    if (votesRes.ok) {
      const votesData = await votesRes.json();
      participants = Array.isArray(votesData) ? votesData.length : 0;
    }

    if (commentsRes.ok) {
      const commentsData: any[] = await commentsRes.json();
      messages = commentsData.length;
      if (commentsData.length > 0) {
        commentsData.sort((a, b) => {
          const timeA = new Date(a.created_at ?? 0).getTime();
          const timeB = new Date(b.created_at ?? 0).getTime();
          return timeB - timeA;
        });
        const latest = commentsData[0];
        lastMessage = latest.comment?.toString() ?? '';
        lastMessageTime = latest.created_at ? new Date(latest.created_at) : null;
      }
    }

    return { participants, messages, lastMessage, lastMessageTime };
  } catch (e) {
    console.error('Error fetching chat stats:', e);
    return { participants: 0, messages: 0, lastMessage: '', lastMessageTime: null };
  }
}

export interface ChatHistoryEntry {
  fixture: Fixture;
  participants: number;
  messages: number;
  lastMessage: string;
  lastMessageTime: Date | null;
}

// Fixtures the user voted on or commented on, enriched with chat stats.
// Throws if the three base requests fail, so the query errors (and retries)
// instead of caching an empty history.
export async function getUserParticipatedGames(userId: string): Promise<ChatHistoryEntry[]> {
  const [fixtures, userVotes, userComments] = await Promise.all([
    getAllFixtures(),
    fetchVotesByUser(userId),
    fetchCommentsByUser(userId),
  ]);

  const participatedFixtureIds = new Set<string>();
  for (const vote of userVotes) {
    if (vote.fixture_id != null) participatedFixtureIds.add(vote.fixture_id.toString());
  }
  for (const comment of userComments) {
    if (comment.fixture_id != null) participatedFixtureIds.add(comment.fixture_id.toString());
  }

  const participatedFixtures = fixtures.filter((f) => participatedFixtureIds.has(f.matchId));

  return Promise.all(
    participatedFixtures.map(async (fixture) => {
      const stats = await getChatStats(fixture.matchId);
      return { fixture, ...stats };
    }),
  );
}