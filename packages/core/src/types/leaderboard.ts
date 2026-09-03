// Ported from funspot/lib/modals/Funzy/leaderboard.dart — the
// ComradeWithStats model and its fromChannelMember() factory, which is what
// GET /api/channels/:channelId/leaderboard's items get parsed into. The
// full leaderboard.dart file (2,783 lines) also drives an ad-carousel UI
// around this data — that carousel layer is not ported, just the real data
// model and rank sort used to render a leaderboard list.

export interface ComradeWithStats {
  id: string;
  username: string;
  nickname: string;
  clubFan: string;
  countryFan: string;
  isComrade: boolean;
  joinedDate: Date | null;
  totalPoints: number;
  accuracyPercentage: number;
  correctVotes: number;
  totalVotes: number;
  currentStreak: number;
  bestStreak: number;
  isOnline: boolean;
  rank: number;
  avatarUrl: string | null;
  messageCount: number;
}

export function comradeWithStatsFromChannelMember(json: any, comradesList: Set<string>): ComradeWithStats {
  const userId = (json.user_id ?? '').toString();
  return {
    id: userId,
    username: json.username?.toString() ?? 'Anonymous',
    nickname: json.username?.toString() ?? 'Anonymous',
    clubFan: '',
    countryFan: '',
    isComrade: comradesList.has(userId),
    joinedDate: null,
    totalPoints: json.season_points ?? 0,
    accuracyPercentage: Number(json.accuracy ?? 0),
    correctVotes: json.correct_votes ?? 0,
    totalVotes: json.total_votes ?? 0,
    currentStreak: 0,
    bestStreak: 0,
    isOnline: false,
    rank: json.rank ?? 0,
    avatarUrl: null,
    messageCount: json.message_count ?? 0,
  };
}
