'use client';

// Fixture detail — restyled to use the same component language as
// PostCard/MatchCard: sections separated by spacing only (no borders, no
// card backgrounds), inline vote pills matching PostCard's pill shape,
// the pledge/bet section presenting bets as plain text rows rather than
// bordered sub-cards, prop markets rendered as compact pill rows, and
// the comments input styled like the inline comment field in MatchCard.

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

  const [voteSelection, setVoteSelection] = useState<
    'home_team' | 'draw' | 'away_team' | null
  >(null);
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
        userId && authToken
          ? getUserChannels(userId, authToken)
          : Promise.resolve([]),
      ]);
      const f =
        fixtures.find((fx) => fx.matchId === matchId || fx.id === matchId) ??
        null;
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
    const ok = await castVote({
      channelId,
      fixtureId: fixture.matchId || fixture.id,
      userId,
      selection: sel,
      authToken,
    });
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
      voteId: '',
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" />
      </div>
    );
  }

  if (!fixture) {
    return (
      <p className="py-16 text-center text-fan-body text-fan-textTertiary">
        Fixture not found.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-md px-fan-lg pt-fan-xxl pb-10">
      {/* Header — league label + matchup title + score, styled like a
          PostCard header extended to page level */}
      <p className="mb-fan-sm text-fan-tag font-bold uppercase tracking-[0.3px] text-fan-textTertiary">
        {fixture.league}
      </p>
      <h1 className="mb-fan-sm font-condensed text-fan-headline text-fan-textPrimary">
        {fixture.homeTeam} vs {fixture.awayTeam}
      </h1>
      {hasScores(fixture) && (
        <p className="mb-fan-xxl font-condensed text-fan-scoreCompact font-bold text-fan-textPrimary">
          {scoreDisplay(fixture)}
        </p>
      )}

      {/* Vote — pills in the same shape as PostCard's type tags, but
          selectable. No card background. */}
      <section className="mb-fan-xxl">
        <h2 className="mb-fan-md text-fan-tag font-bold uppercase tracking-[0.3px] text-fan-textTertiary">
          Vote
        </h2>
        {voted ? (
          <p className="text-fan-body text-fan-primary">
            ✓ Vote recorded — back it with a pledge below.
          </p>
        ) : (
          <div className="flex flex-wrap gap-fan-sm">
            {(
              [
                ['home_team', fixture.homeTeam],
                ['draw', 'Draw'],
                ['away_team', fixture.awayTeam],
              ] as const
            ).map(([sel, label]) => {
              const isActive = voteSelection === sel;
              return (
                <button
                  key={sel}
                  onClick={() => handleVote(sel)}
                  className={`max-w-full truncate rounded-fan-pill px-fan-md py-fan-xs text-fan-tag font-semibold transition ${isActive
                      ? 'bg-fan-primary text-fan-textInverse'
                      : 'bg-fan-surfaceSunken text-fan-textSecondary'
                    }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Pledge / Bet — no bordered card. Rows are plain text, matching
          how the Logs column shows sub-rows. */}
      {voteSelection && (
        <section className="mb-fan-xxl">
          <h2 className="mb-fan-md text-fan-tag font-bold uppercase tracking-[0.3px] text-fan-textTertiary">
            Back your vote
          </h2>

          <div className="mb-fan-base flex items-center gap-fan-md">
            <input
              type="number"
              min={1}
              value={pledgeAmount}
              onChange={(e) => setPledgeAmount(e.target.value)}
              className="w-full rounded-fan-pill border border-fan-border bg-fan-surfaceSunken px-fan-md py-fan-sm text-fan-body text-fan-textPrimary outline-none focus:border-fan-primary"
            />
            <button
              onClick={handlePlaceBet}
              disabled={placingBet}
              className="whitespace-nowrap rounded-fan-pill bg-fan-primary px-fan-lg py-fan-sm text-fan-tag font-semibold text-fan-textInverse disabled:opacity-60"
            >
              {placingBet ? 'Placing…' : 'Pledge'}
            </button>
          </div>

          {openBets.length > 0 && (
            <div className="mb-fan-base">
              <p className="mb-fan-xs text-fan-tag text-fan-textTertiary">
                Open bets
              </p>
              <ul className="space-y-1">
                {openBets.map((b) => (
                  <li
                    key={b.id}
                    className="flex justify-between text-fan-caption text-fan-textSecondary"
                  >
                    <span className="truncate">{b.starterName}</span>
                    <span className="shrink-0 font-semibold text-fan-textPrimary">
                      {b.starterAmount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {matchedBets.length > 0 && (
            <div>
              <p className="mb-fan-xs text-fan-tag text-fan-textTertiary">
                Matched bets
              </p>
              <ul className="space-y-1">
                {matchedBets.map((b) => (
                  <li
                    key={b.id}
                    className="flex justify-between text-fan-caption text-fan-textSecondary"
                  >
                    <span className="truncate">
                      {b.starterName} vs {b.finisherName}
                    </span>
                    <span className="shrink-0 font-semibold text-fan-textPrimary">
                      {b.starterAmount + (b.finisherAmount ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Prop markets — compact pill rows, no card backgrounds. */}
      {subFixtures.length > 0 && (
        <section className="mb-fan-xxl">
          <h2 className="mb-fan-md text-fan-tag font-bold uppercase tracking-[0.3px] text-fan-textTertiary">
            Prop Markets
          </h2>
          <div className="space-y-fan-base">
            {subFixtures.map((sf) => (
              <SubFixtureRow
                key={sf.id}
                sf={sf}
                userId={userId}
                username={username}
                matchId={fixture.matchId || fixture.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Comments — input styled like MatchCard's inline comment row. */}
      <section>
        <h2 className="mb-fan-md text-fan-tag font-bold uppercase tracking-[0.3px] text-fan-textTertiary">
          Comments
        </h2>
        <div className="flex items-center gap-fan-md rounded-fan-pill border border-fan-border bg-fan-surfaceSunken px-fan-md py-fan-xs">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Say something…"
            className="flex-1 bg-transparent text-fan-body text-fan-textPrimary outline-none placeholder:text-fan-textTertiary"
          />
          <button
            onClick={handlePostComment}
            disabled={postingComment}
            className="shrink-0 rounded-fan-pill bg-fan-primary px-fan-md py-fan-xs text-fan-tag font-semibold text-fan-textInverse disabled:opacity-60"
          >
            Post
          </button>
        </div>
        {commentStatus && (
          <p className="mt-fan-sm text-fan-caption text-fan-textTertiary">
            {commentStatus}
          </p>
        )}
      </section>
    </div>
  );
}

function SubFixtureRow({
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
    <div>
      <p className="mb-fan-sm text-fan-body text-fan-textPrimary">
        {sf.question}
      </p>
      {voted ? (
        <p className="text-fan-caption text-fan-primary">✓ Voted</p>
      ) : (
        <div className="flex flex-wrap gap-fan-sm">
          <button
            disabled={voting}
            onClick={() => vote('a')}
            className="rounded-fan-pill bg-fan-surfaceSunken px-fan-md py-fan-xs text-fan-tag font-semibold text-fan-textSecondary disabled:opacity-50"
          >
            {sf.optionA}
          </button>
          <button
            disabled={voting}
            onClick={() => vote('b')}
            className="rounded-fan-pill bg-fan-surfaceSunken px-fan-md py-fan-xs text-fan-tag font-semibold text-fan-textSecondary disabled:opacity-50"
          >
            {sf.optionB}
          </button>
        </div>
      )}
    </div>
  );
}