// Ported from funspot/lib/services/database_service.dart.
// Same endpoints, same fallback-to-empty-array-on-error behavior.

import { API_BASE } from './config';
import { Fixture, fixtureFromJson } from '../types/fixture';

export async function getAllFixtures(): Promise<Fixture[]> {
  try {
    const res = await fetch(`${API_BASE}/games`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Failed to load fixtures: ${res.status}`);
    const data = await res.json();
    return (data as any[]).map(fixtureFromJson);
  } catch (e) {
    console.error('Error fetching fixtures:', e);
    return [];
  }
}

export async function getVotesByUser(userId: string): Promise<Record<string, any>[]> {
  try {
    const res = await fetch(`${API_BASE}/votes/votes/user/${userId}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('Error fetching votes:', e);
    return [];
  }
}

export async function getCommentsByUser(userId: string): Promise<Record<string, any>[]> {
  try {
    const res = await fetch(`${API_BASE}/votes/comments/user/${userId}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('Error fetching comments:', e);
    return [];
  }
}

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

// Ported from getUserParticipatedGames(): fixtures the user voted on or
// commented on, enriched with chat stats.
export async function getUserParticipatedGames(userId: string): Promise<ChatHistoryEntry[]> {
  try {
    const [fixtures, userVotes, userComments] = await Promise.all([
      getAllFixtures(),
      getVotesByUser(userId),
      getCommentsByUser(userId),
    ]);

    const participatedFixtureIds = new Set<string>();
    for (const vote of userVotes) {
      if (vote.fixture_id != null) participatedFixtureIds.add(vote.fixture_id.toString());
    }
    for (const comment of userComments) {
      if (comment.fixture_id != null) participatedFixtureIds.add(comment.fixture_id.toString());
    }

    const participatedFixtures = fixtures.filter((f) => participatedFixtureIds.has(f.matchId));

    return await Promise.all(
      participatedFixtures.map(async (fixture) => {
        const stats = await getChatStats(fixture.matchId);
        return { fixture, ...stats };
      })
    );
  } catch (e) {
    console.error('Error fetching participated games:', e);
    return [];
  }
}
