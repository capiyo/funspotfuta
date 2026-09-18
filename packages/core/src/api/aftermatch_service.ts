// packages/core/src/api/aftermatch-service.ts
//
// Fetches the aftermatch review data for a fixture. Tries the real backend
// endpoint first; if it 404s or errors, computes everything from the
// Fixture object the caller already has in memory.

import type { Fixture } from '../types/fixture';
import type {
    AftermatchData,
    AftermatchVoter,
    AftermatchPledge,
    AftermatchBet,
    AftermatchSubFixture,
} from '../types/afternatch';

const API_BASE_URL =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
    'https://clash-api-m5mr.onrender.com/api';

export async function fetchAftermatch(
    fixture: Fixture,
    channelId: string,
    authToken: string | null,
): Promise<AftermatchData> {
    const matchId = fixture.matchId || fixture.id;

    try {
        const res = await fetch(
            `${API_BASE_URL}/games/${matchId}/aftermatch?channelId=${channelId}`,
            {
                headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
            },
        );
        if (res.ok) {
            const json = await res.json();
            return mapAftermatchResponse(json, fixture);
        }
    } catch {
        // fall through to the computed version
    }

    return computeFromFixture(fixture);
}

// ── Backend mapping ─────────────────────────────────────────────
// If your real endpoint returns a different shape, adjust here.
function mapAftermatchResponse(json: any, fixture: Fixture): AftermatchData {
    const data = json?.data ?? json;

    const winner: AftermatchData['winner'] =
        data?.winner ?? deriveWinner(fixture);

    return {
        matchId: fixture.matchId || fixture.id,
        homeScore: String(data?.homeScore ?? fixture.homeScore ?? 0),
        awayScore: String(data?.awayScore ?? fixture.awayScore ?? 0),
        winner,
        voters: mapVoters(data?.voters ?? [], winner),
        pledges: mapPledges(data?.pledges ?? [], winner),
        bets: mapBets(data?.bets ?? []),
        subFixtures: mapSubFixtures(data?.subFixtures ?? []),
        lastUpdated: Date.now(),
    };
}

// ── Computed-from-Fixture fallback ──────────────────────────────
function computeFromFixture(fixture: Fixture): AftermatchData {
    const winner = deriveWinner(fixture);

    return {
        matchId: fixture.matchId || fixture.id,
        homeScore: String(fixture.homeScore ?? 0),
        awayScore: String(fixture.awayScore ?? 0),
        winner,
        voters: mapVoters(fixture.voters ?? [], winner),
        pledges: mapPledges(fixture.pledgers ?? [], winner),
        bets: mapBets(fixture.bettors ?? []),
        subFixtures: mapSubFixtures(fixture.subFixtures ?? []),
        lastUpdated: Date.now(),
    };
}

// ── Helpers ─────────────────────────────────────────────────────
function deriveWinner(fixture: Fixture): AftermatchData['winner'] {
    if (fixture.homeScore == null || fixture.awayScore == null) return null;
    if (fixture.homeScore > fixture.awayScore) return 'home';
    if (fixture.awayScore > fixture.homeScore) return 'away';
    return 'draw';
}

function normaliseSelection(sel: string): 'home' | 'away' | 'draw' {
    if (sel === 'home_team' || sel === 'home') return 'home';
    if (sel === 'away_team' || sel === 'away') return 'away';
    return 'draw';
}

function mapVoters(
    raw: any[],
    winner: AftermatchData['winner'],
): AftermatchVoter[] {
    return raw.map((v) => {
        const selection = normaliseSelection(
            v?.selection ?? v?.userSelection ?? '',
        );
        return {
            userId: String(v?.userId ?? v?.user_id ?? ''),
            userName: String(v?.userName ?? v?.user_name ?? 'Anonymous'),
            selection,
            isComrade: Boolean(v?.isComrade ?? v?.is_comrade),
            result:
                winner == null
                    ? null
                    : selection === winner
                        ? 'won'
                        : 'lost',
        };
    });
}

function mapPledges(
    raw: any[],
    winner: AftermatchData['winner'],
): AftermatchPledge[] {
    return raw.map((p) => {
        const selection = normaliseSelection(
            p?.selection ?? p?.starterSelection ?? '',
        );
        return {
            userId: String(p?.userId ?? p?.user_id ?? p?.starterId ?? p?.starter_id ?? ''),
            userName: String(
                p?.userName ?? p?.user_name ?? p?.starterName ?? p?.starter_name ?? 'Anonymous',
            ),
            selection,
            amount: Number(p?.amount ?? p?.starterAmount ?? p?.starter_amount ?? 0),
            payout:
                p?.payout != null ? Number(p.payout) : null,
            status: (p?.status ?? 'open') as AftermatchPledge['status'],
            result:
                winner == null
                    ? null
                    : selection === winner
                        ? 'won'
                        : 'lost',
        };
    });
}

function mapBets(raw: any[]): AftermatchBet[] {
    return raw.map((b) => ({
        id: String(b?.id ?? b?._id ?? b?.betId ?? ''),
        starterId: String(b?.starterId ?? b?.starter_id ?? b?.userId ?? ''),
        starterName: String(b?.starterName ?? b?.starter_name ?? b?.userName ?? ''),
        starterSelection: String(
            b?.starterSelection ?? b?.starter_selection ?? b?.selection ?? '',
        ),
        starterAmount: Number(b?.starterAmount ?? b?.starter_amount ?? b?.amount ?? 0),
        finisherId: b?.finisherId ?? b?.finisher_id ?? b?.opponentId ?? null,
        finisherName:
            b?.finisherName ?? b?.finisher_name ?? b?.opponentName ?? null,
        finisherSelection:
            b?.finisherSelection ?? b?.finisher_selection ?? b?.opponentSelection ?? null,
        finisherAmount:
            b?.finisherAmount ?? b?.finisher_amount ?? b?.opponentAmount ?? null,
        totalPot: Number(
            b?.totalPot ?? b?.total_pot ?? b?.starterAmount ?? b?.amount ?? 0,
        ),
        status: (b?.status ?? 'open') as AftermatchBet['status'],
        result: b?.result ?? null,
        winnerPayout:
            b?.winnerPayout != null ? Number(b.winnerPayout) : b?.payout ?? null,
    }));
}

function mapSubFixtures(raw: any[]): AftermatchSubFixture[] {
    return raw.map((sf) => ({
        id: String(sf?.id ?? sf?._id ?? ''),
        marketType: String(sf?.marketType ?? sf?.market_type ?? ''),
        options: Array.isArray(sf?.options) ? sf.options.map(String) : [],
        line: sf?.line != null ? Number(sf.line) : null,
        result: sf?.result ?? null,
        pledges: Array.isArray(sf?.pledges)
            ? sf.pledges.map((p: any) => ({
                userId: String(p?.userId ?? p?.user_id ?? ''),
                userName: String(p?.userName ?? p?.user_name ?? 'Anonymous'),
                selection: String(p?.selection ?? ''),
                amount: Number(p?.amount ?? 0),
            }))
            : [],
    }));
}