// packages/core/src/api/vote-actions.ts
//
// Voting, pledging and matching a pledge, in one place, following the Flutter
// app (fixture_page.dart: VoteService.castVote, _processPledge,
// _executeDialogMatch).
//
// Why this exists:
//   comrade-service.castVote posts to /channels/votes (the legacy channel vote
//   endpoint, marked deprecated in Flutter), sends no username, sends
//   home_team/away_team, and collapses the response to `res.ok`. Flutter votes
//   through POST /actions/vote/cast with fixture_id, user_id, username and
//   home | away | draw, and no channel at all.
//
// Every function here returns { success, message } and uses the server's own
// message (even on a 4xx), so the UI can say WHY something failed.
//
// bet-service.createBetWithVoteId / fillBet and comrade-service.castVote are
// left untouched; the modal just no longer uses them.

import { API_BASE } from './config';

type Token = string | null | undefined;
export type Pick = 'home' | 'away';

export interface ActionResult {
    success: boolean;
    message?: string;
    newBalance?: number;
    alreadyVoted?: boolean;
}

const TIMEOUT_MS = 30_000; // Render cold starts are slow

function headers(authToken?: Token): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    };
}

/** POST json; never throws. Returns the parsed body (or {}) plus http status. */
async function postJson(
    path: string,
    body: Record<string, unknown>,
    authToken?: Token,
): Promise<{ ok: boolean; status: number; data: any; networkError?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'POST',
            headers: headers(authToken),
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    } catch (e: any) {
        const msg =
            e?.name === 'AbortError'
                ? 'Request timed out. The server may be waking up, try again.'
                : `Network error: ${e?.message ?? e}`;
        return { ok: false, status: 0, data: {}, networkError: msg };
    } finally {
        clearTimeout(timer);
    }
}

function failMessage(r: { status: number; data: any; networkError?: string }, fallback: string): string {
    if (r.networkError) return r.networkError;
    if (r.status === 401 || r.status === 403) return 'Session expired, please sign in again';
    return r.data?.message ?? `${fallback} (server error ${r.status})`;
}

// ─────────────────────────────────────────────────────────────
//  VOTE
// ─────────────────────────────────────────────────────────────

export interface CastFixtureVoteParams {
    fixtureId: string;
    userId: string;
    username: string;
    selection: Pick | 'draw';
    authToken?: Token;
}

// POST /api/actions/vote/cast  (global, no channel_id)
export async function castFixtureVote(p: CastFixtureVoteParams): Promise<ActionResult> {
    if (!p.userId || !p.username) {
        return { success: false, message: 'Missing user details. Please sign in again.' };
    }
    const r = await postJson(
        '/actions/vote/cast',
        {
            fixture_id: p.fixtureId,
            user_id: p.userId,
            username: p.username,
            selection: p.selection,
        },
        p.authToken,
    );
    if (r.ok && r.data?.success !== false) {
        return { success: true, message: r.data?.message };
    }
    const message = failMessage(r, 'Vote failed');
    return {
        success: false,
        message,
        alreadyVoted: message.toLowerCase().includes('already voted'),
    };
}

// POST /api/vote/rollback  (Flutter VoteService.rollbackVote). Best effort.
export async function rollbackFixtureVote(
    fixtureId: string,
    userId: string,
    authToken?: Token,
): Promise<boolean> {
    const r = await postJson('/vote/rollback', { fixture_id: fixtureId, user_id: userId }, authToken);
    return r.ok;
}

// ─────────────────────────────────────────────────────────────
//  PLEDGE (vote first if needed, then create the bet; roll the vote back on failure)
// ─────────────────────────────────────────────────────────────

export interface CreatePledgeParams {
    fixtureId: string;
    userId: string;
    username: string;
    selection: Pick;
    amount: number;
    channelId: string;
    /** true when the user has already voted on this fixture */
    alreadyVoted: boolean;
    authToken?: Token;
}

export interface PledgeResult extends ActionResult {
    /** true when this call created a NEW vote (so the UI can add it to its cache) */
    votedNow?: boolean;
}

// POST /api/actions/bet/create  (starter_selection home | away, vote_id = user id)
export async function createPledge(p: CreatePledgeParams): Promise<PledgeResult> {
    if (!p.channelId) return { success: false, message: 'No channel selected' };

    let votedNow = false;
    if (!p.alreadyVoted) {
        const v = await castFixtureVote({
            fixtureId: p.fixtureId,
            userId: p.userId,
            username: p.username,
            selection: p.selection,
            authToken: p.authToken,
        });
        if (v.success) {
            votedNow = true;
        } else if (!v.alreadyVoted) {
            return { success: false, message: `Failed to vote: ${v.message ?? 'unknown error'}` };
        }
        // "already voted" is fine for a pledge: the vote is already recorded.
    }

    const r = await postJson(
        '/actions/bet/create',
        {
            fixture_id: p.fixtureId,
            starter_id: p.userId,
            starter_name: p.username,
            starter_selection: p.selection,
            amount: p.amount,
            channel_id: p.channelId,
            vote_id: p.userId, // Flutter: `final String voteId = widget.userId;`
        },
        p.authToken,
    );

    if (r.ok && r.data?.success === true) {
        return {
            success: true,
            message: r.data?.message,
            newBalance: r.data?.new_balance != null ? Number(r.data.new_balance) : undefined,
            votedNow,
        };
    }

    if (votedNow) {
        // We created the vote only to support this pledge; undo it.
        void rollbackFixtureVote(p.fixtureId, p.userId, p.authToken);
    }
    return { success: false, message: failMessage(r, 'Failed to create pledge') };
}

// ─────────────────────────────────────────────────────────────
//  MATCH (fill) A MAIN-FIXTURE PLEDGE
// ─────────────────────────────────────────────────────────────

export interface MatchMainPledgeParams {
    betId: string;
    finisherId: string;
    finisherName: string;
    finisherSelection: Pick;
    amount: number;
    authToken?: Token;
}

// POST /api/actions/bet/fill
// Flutter sends channel_id '' here ("to match the database").
export async function matchMainPledge(p: MatchMainPledgeParams): Promise<ActionResult> {
    const r = await postJson(
        '/actions/bet/fill',
        {
            bet_id: p.betId,
            finisher_id: p.finisherId,
            finisher_name: p.finisherName,
            finisher_selection: p.finisherSelection,
            amount: p.amount,
            channel_id: '',
        },
        p.authToken,
    );
    if (r.ok && r.data?.success === true) return { success: true, message: r.data?.message };
    return { success: false, message: failMessage(r, 'Failed to match bet') };
}