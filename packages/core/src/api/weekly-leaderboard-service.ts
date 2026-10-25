import { API_BASE, authHeaders } from './config';

export interface WeeklyChannelLeader {
  rank: number;
  user_id: string;
  username: string;
  weekly_points: number;
}

export interface WeeklyLeaderboardResponse {
  success: boolean;
  week: string;
  leaderboard: WeeklyChannelLeader[];
  count: number;
  me: (WeeklyChannelLeader & { rank: number | null }) | null;
  channel_id?: string;
  channel_name?: string;
}

/**
 * Fetch the current ISO-week leaderboard for one channel.
 * Backend route: GET /api/channels/:channel_id/leaderboard/weekly?user_id=...
 */
export async function getChannelWeeklyLeaderboard(
  channelId: string,
  authToken?: string | null,
  userId?: string | null,
): Promise<WeeklyChannelLeader[]> {
  if (!channelId.trim()) return [];

  const params = new URLSearchParams();
  if (userId?.trim()) params.set('user_id', userId.trim());
  const query = params.size ? `?${params.toString()}` : '';

  try {
    const response = await fetch(
      `${API_BASE}/channels/${encodeURIComponent(channelId)}/leaderboard/weekly${query}`,
      { method: 'GET', headers: authHeaders(authToken) },
    );
    if (!response.ok) {
      throw new Error(`Weekly leaderboard request failed (${response.status})`);
    }

    const payload = (await response.json()) as Partial<WeeklyLeaderboardResponse>;
    if (!Array.isArray(payload.leaderboard)) return [];

    return payload.leaderboard
      .filter((row): row is WeeklyChannelLeader => Boolean(row && typeof row === 'object'))
      .map((row) => ({
        rank: Number(row.rank) || 0,
        user_id: String(row.user_id ?? ''),
        username: String(row.username ?? 'Anonymous'),
        weekly_points: Number(row.weekly_points) || 0,
      }));
  } catch (error) {
    console.error('getChannelWeeklyLeaderboard failed:', error);
    return [];
  }
}
