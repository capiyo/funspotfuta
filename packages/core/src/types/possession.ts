export type PossessionSide = 'home' | 'away';

export interface PossessionVote {
  id: string;
  userId: string;
  username: string;
  selection: PossessionSide;
  createdAt: string;
}

export interface PossessionPoke {
  id: string;
  userId: string;
  username: string;
  selection: PossessionSide;
  amount: number;
  status: 'open' | 'matched' | 'settled' | 'cancelled';
  createdAt: string;
  finisherId?: string | null;
  finisherName?: string | null;
  finisherSelection?: PossessionSide | null;
  finisherAmount?: number | null;
  totalPot?: number;
  settledAt?: string | null;
}

export interface PossessionMarket {
  fixtureId: string;
  channelId: string;
  status: 'open' | 'closed' | 'settling' | 'settled';
  homePossession?: number | null;
  awayPossession?: number | null;
  homeVotes: number;
  awayVotes: number;
  userSelection?: PossessionSide | null;
  votes: PossessionVote[];
  pokes: PossessionPoke[];
  settlement?: {
    winner: PossessionSide | 'draw' | null;
    settledAt: string;
    homePossession?: number | null;
    awayPossession?: number | null;
  } | null;
}

export interface PossessionActionResult {
  success: boolean;
  message?: string;
  market?: PossessionMarket;
  vote?: PossessionVote;
  poke?: PossessionPoke;
}
