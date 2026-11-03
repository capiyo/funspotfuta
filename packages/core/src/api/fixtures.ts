const API_BASE = 'https://clash-api-m5mr.onrender.com/api';

export interface Fixture {
  id: string;
  matchId?: string;
  status: 'upcoming' | 'live' | 'completed' | 'finished' | string;
  homeScore?: number;
  awayScore?: number;
  timeElapsed?: number;
  isLive?: boolean;
  [key: string]: unknown;
}

export interface FixturesResponse {
  data: Fixture[];
}

/**
 * Same fetch function used by both the Next.js app (server or client
 * component) and the React Native app. No platform APIs used here —
 * that's what makes it shareable.
 */
export async function fetchFixtures(): Promise<Fixture[]> {
  const res = await fetch(`${API_BASE}/games?_=${Date.now()}`, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch fixtures: ${res.status}`);
  }

  const json: FixturesResponse = await res.json();
  const active = (json.data ?? []).filter(
    (f) => f.status !== 'completed' && f.status !== 'finished',
  );

  return active;
}

export async function fetchHistoryGames(authToken?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}/games/history?limit=100&_=${Date.now()}`, {
    headers,
  });
  if (!res.ok) throw new Error(`Failed to fetch history: ${res.status}`);
  const json = await res.json();
  return json.data ?? [];
}
