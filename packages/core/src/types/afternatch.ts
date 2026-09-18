// packages/core/src/types/aftermatch.ts
//
// Types for the aftermatch review modal. The four "Aftermatch*" shapes
// mirror what the modal reads off AftermatchData: voters, pledges, bets,
// sub-fixtures. Anything the modal computes (won/lost, payout totals) is
// done client-side in the fetcher / modal, not stored on these objects.

export interface AftermatchVoter {
    userId: string;
    userName: string;
    selection: string;
    isComrade: boolean;
    /** Set by the modal after comparing selection to the match winner. */
    result: 'won' | 'lost' | null;
}

export interface AftermatchPledge {
    userId: string;
    userName: string;
    selection: string;
    amount: number;
    payout: number | null;
    status: 'open' | 'matched' | 'settled' | 'refunded';
    /** Set by the modal after comparing selection to the match winner. */
    result: 'won' | 'lost' | null;
}

export interface AftermatchBet {
    id: string;
    starterId: string;
    starterName: string;
    starterSelection: string;
    starterAmount: number;
    finisherId: string | null;
    finisherName: string | null;
    finisherSelection: string | null;
    finisherAmount: number | null;
    totalPot: number;
    status: 'open' | 'matched' | 'settled';
    result: 'starter_won' | 'finisher_won' | 'void' | null;
    winnerPayout: number | null;
}

export interface AftermatchSubFixturePledge {
    userId: string;
    userName: string;
    selection: string;
    amount: number;
}

export interface AftermatchSubFixture {
    id: string;
    marketType: string;
    options: string[];
    line: number | null;
    result: string | null;
    pledges: AftermatchSubFixturePledge[];
}

export interface AftermatchData {
    matchId: string;
    homeScore: string;
    awayScore: string;
    winner: 'home' | 'away' | 'draw' | null;
    voters: AftermatchVoter[];
    pledges: AftermatchPledge[];
    bets: AftermatchBet[];
    subFixtures: AftermatchSubFixture[];
    /** Date.now() timestamp of when this snapshot was produced. */
    lastUpdated: number;
}