'use client';

// New page (no direct Dart equivalent file — the original app spreads this
// across VoteCastingModal, VotingBottomSheet, and inline home_page.dart
// widgets) that pulls together the ported services for a single fixture:
// channel vote, whole-match pledge/bet (bet-service.ts), per-market prop
// bets (sub-fixture-votes-service.ts), and comments (comrade-service.ts).

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getAllFixtures,
  getUserChannels,
  Fixture,
  hasScores,
  scoreDisplay,
  SubFixture,
  getOpenBets,
  getChannelBettors,
  createBetWithVoteId,
  Bet,
  getSubFixtures,
  submitSubFixtureVote,
  postComment,
  castVote,
} from '@funspot/core';
import { useToast } from '@/lib/toast/toast-context';

export default function FixtureDetailPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { userId, username, authToken } = useAuth();
  const toast = useToast();

  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [voteSelection, setVoteSelection] = useState<'home_team' | 'draw' | 'away_team' | null>(null);
  const [voted, setVoted] = useState(false);

  const [openBets, setOpenBets] = useState<Bet[]>([]);
  const [matchedBets, setMatchedBets] = useState<Bet[]>([]);
  const [pledgeAmount, setPledgeAmount] = useState('50');
  const [placingBet, setPlacingBet] = useState(false);

  const [subFixtures, setSubFixtures] = useState<SubFixture[]>([]);

  const [comment, setComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [commentStatus, setCommentStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [fixtures, channels] = await Promise.all([
        getAllFixtures(),
        userId && authToken ? getUserChannels(userId, authToken) : Promise.resolve([]),
      ]);
      const f = fixtures.find((fx) => fx.matchId === matchId || fx.id === matchId) ?? null;
      setFixture(f);
      const cid = channels[0]?.id ?? null;
      setChannelId(cid);

      if (f) {
        const subs = await getSubFixtures(f.matchId || f.id);
        setSubFixtures(subs);
        if (cid) {
          const [open, matched] = await Promise.all([
            getOpenBets(cid, f.matchId || f.id, authToken ?? undefined),
            getChannelBettors(cid, f.matchId || f.id, authToken ?? undefined),
          ]);
          setOpenBets(open);
          setMatchedBets(matched);
        }
      }
      setLoading(false);
    })();
  }, [matchId, userId, authToken]);

  async function handleVote(sel: 'home_team' | 'draw' | 'away_team') {
    if (!fixture || !channelId || !userId || !authToken) return;
    setVoteSelection(sel);
    const ok = await castVote({ channelId, fixtureId: fixture.matchId || fixture.id, userId, selection: sel, authToken });
    if (ok) setVoted(true);
  }

  async function handlePlaceBet() {
    if (!fixture || !channelId || !userId || !username || !voteSelection) return;
    const amount = Number(pledgeAmount);
    if (!amount || amount <= 0) return;
    setPlacingBet(true);
    const result = await createBetWithVoteId({
      fixtureId: fixture.matchId || fixture.id,
      starterId: userId,
      starterName: username,
      starterSelection: voteSelection,
      amount,
      channelId,
      voteId: '', // server associates with the vote just cast, per the original flow
      authToken: authToken ?? undefined,
    });
    setPlacingBet(false);
    if (result?.success !== false) {
      const [open, matched] = await Promise.all([
        getOpenBets(channelId, fixture.matchId || fixture.id, authToken ?? undefined),
        getChannelBettors(channelId, fixture.matchId || fixture.id, authToken ?? undefined),
      ]);
      setOpenBets(open);
      setMatchedBets(matched);
    }
  }

  async function handlePostComment() {
    if (!fixture || !userId || !username || !comment.trim()) return;
    setPostingComment(true);
    const result = await postComment({
      userId,
      username,
      fixtureId: fixture.matchId || fixture.id,
      comment,
      selection: voteSelection ?? '',
      authToken: authToken ?? undefined,
    });
    setPostingComment(false);
    setCommentStatus(result.message);
    if (result.success) {
      setComment('');
      toast.showSuccess(result.message);
    } else {
      toast.showError(result.message);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-funspot-green border-t-transparent" />
      </div>
    );
  }

  if (!fixture) {
    return <p className="py-16 text-center text-sm text-gray-500">Fixture not found.</p>;
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-10">
      <p className="mb-1 text-center text-xs text-gray-400">{fixture.league}</p>
      <h1 className="mb-4 text-center text-lg font-bold text-white">
        {fixture.homeTeam} vs {fixture.awayTeam}
      </h1>
      {hasScores(fixture) && (
        <p className="mb-4 text-center text-2xl font-bold text-white">{scoreDisplay(fixture)}</p>
      )}

      {/* Vote */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-300">Vote</h2>
        {voted ? (
          <p className="text-sm text-funspot-green">✓ Vote recorded — you can now back it with a pledge below.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['home_team', fixture.homeTeam],
                ['draw', 'Draw'],
                ['away_team', fixture.awayTeam],
              ] as const
            ).map(([sel, label]) => (
              <button
                key={sel}
                onClick={() => handleVote(sel)}
                className={`truncate rounded-xl border py-2 text-xs font-medium ${
                  voteSelection === sel
                    ? 'border-funspot-green bg-funspot-green/20 text-funspot-green'
                    : 'border-white/10 bg-white/5 text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Pledge / Bet */}
      {voteSelection && (
        <section className="mb-6 rounded-2xl border border-white/10 bg-funspot-surface p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-300">Back your vote with a pledge</h2>
          <div className="mb-3 flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={pledgeAmount}
              onChange={(e) => setPledgeAmount(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-funspot-green"
            />
            <button
              onClick={handlePlaceBet}
              disabled={placingBet}
              className="whitespace-nowrap rounded-xl bg-funspot-green px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
            >
              {placingBet ? 'Placing…' : 'Pledge'}
            </button>
          </div>

          {openBets.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-xs text-gray-400">Open bets waiting for a match</p>
              <div className="space-y-1">
                {openBets.map((b) => (
                  <div key={b.id} className="flex justify-between rounded-lg bg-black/20 px-2 py-1 text-xs text-gray-300">
                    <span>{b.starterName}</span>
                    <span>{b.starterAmount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchedBets.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-gray-400">Matched bets</p>
              <div className="space-y-1">
                {matchedBets.map((b) => (
                  <div key={b.id} className="flex justify-between rounded-lg bg-black/20 px-2 py-1 text-xs text-gray-300">
                    <span>{b.starterName} vs {b.finisherName}</span>
                    <span>{b.starterAmount + (b.finisherAmount ?? 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Sub-fixture prop markets */}
      {subFixtures.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-300">Prop Markets</h2>
          <div className="space-y-2">
            {subFixtures.map((sf) => (
              <SubFixtureCard key={sf.id} sf={sf} userId={userId} username={username} matchId={fixture.matchId || fixture.id} />
            ))}
          </div>
        </section>
      )}

      {/* Comments */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-300">Comments</h2>
        <div className="flex gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Say something…"
            className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-funspot-green"
          />
          <button
            onClick={handlePostComment}
            disabled={postingComment}
            className="rounded-full bg-funspot-green px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            Post
          </button>
        </div>
        {commentStatus && <p className="mt-2 text-xs text-gray-400">{commentStatus}</p>}
      </section>
    </div>
  );
}

function SubFixtureCard({
  sf,
  userId,
  username,
  matchId,
}: {
  sf: SubFixture;
  userId: string | null;
  username: string | null;
  matchId: string;
}) {
  const [voted, setVoted] = useState(false);
  const [voting, setVoting] = useState(false);

  async function vote(selection: 'a' | 'b') {
    if (!userId || !username) return;
    setVoting(true);
    try {
      await submitSubFixtureVote({
        voterId: userId,
        username,
        subFixtureId: sf.id,
        parentFixtureId: matchId,
        selection,
      });
      setVoted(true);
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-funspot-surface p-3">
      <p className="mb-2 text-xs font-medium text-white">{sf.question}</p>
      {voted ? (
        <p className="text-center text-xs text-funspot-green">✓ Voted</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={voting}
            onClick={() => vote('a')}
            className="rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs text-gray-200 disabled:opacity-50"
          >
            {sf.optionA}
          </button>
          <button
            disabled={voting}
            onClick={() => vote('b')}
            className="rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs text-gray-200 disabled:opacity-50"
          >
            {sf.optionB}
          </button>
        </div>
      )}
    </div>
  );
}
