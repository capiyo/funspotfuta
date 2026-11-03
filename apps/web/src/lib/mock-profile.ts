export interface MockProfileChannel {
  id: string;
  name: string;
  role: string;
  points: number;
}

export interface MockLeaderboardMember {
  username: string;
  points: number;
  accuracy: number;
}

export const MOCK_PROFILE = {
  nickname: 'Guest Fan',
  username: 'guest',
  clubFan: 'Football Fan',
  countryFan: 'World',
  balance: 0,
  bets: 12,
  points: 84,
  accuracy: 67,
};

export const MOCK_PROFILE_CHANNELS: MockProfileChannel[] = [
  { id: 'mock-premier-league', name: 'Premier League', role: 'Member', points: 42 },
  { id: 'mock-champions-league', name: 'Champions League', role: 'Member', points: 27 },
  { id: 'mock-world-football', name: 'World Football', role: 'Member', points: 15 },
];

export const MOCK_PROFILE_LEADERBOARD: MockLeaderboardMember[] = [
  { username: 'GoalGetter', points: 128, accuracy: 78 },
  { username: 'BlueSupporter', points: 103, accuracy: 72 },
  { username: 'Guest Fan', points: 84, accuracy: 67 },
];
