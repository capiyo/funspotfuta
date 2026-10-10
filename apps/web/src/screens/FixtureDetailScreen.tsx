// Fixture detail — production pass.
//
// Keeps the existing fan-* design language (pill shapes, condensed display
// type, no-hard-border surfaces) but raises the ceiling on hierarchy and
// polish: a compact sticky header for orientation while scrolling, skeleton
// loading instead of a bare spinner, explicit empty/error/"not signed in"
// states, inline validation on the pledge flow, a reachable bet CTA that
// only appears once the main pledge control scrolls out of view, and one
// deliberate reveal (the vote confirmation) rather than animation on every
// element. No new dependencies and no data the API doesn't already return.

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

type Selection = 'home_team' | 'draw' | 'away_team';

const QUICK_AMOUNTS = [50, 100, 200, 500];
const COMMENT_LIMIT = 240;

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatAmount(n: number) {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString();
}

function voteOptions(fixture: Fixture): [Selection, string][] {
  return [
    ['home_team', fixture.homeTeam],
    ['draw', 'Draw'],
    ['away_team', fixture.awayTeam],
  ];
}

export default function FixtureDetailPage() {
  const { matchId = '' } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { userId, username, authToken } = useAuth();
  const toast = useToast();

  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [voteSelection, setVoteSelection] = useState<Selection | null>(null);
  const [voted, setVoted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [votePending, setVotePending] = useState(false);

  const [openBets, setOpenBets] = useState<Bet[]>([]);
  const [matchedBets, setMatchedBets] = useState<Bet[]>([]);
  const [pledgeAmount, setPledgeAmount] = useState('50');
  const [placingBet, setPlacingBet] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);

  const [subFixtures, setSubFixtures] = useState<SubFixture[]>([]);

  const [comment, setComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [commentStatus, setCommentStatus] = useState<string | null>(null);

  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [pledgeInView, setPledgeInView] = useState(true);
  const pledgeSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [fixtures, channels] = await Promise.all([
          getAllFixtures(),
          userId && authToken
            ? getUserChannels(userId, authToken)
            : Promise.resolve([]),
        ]);
        if (!mounted) return;
        const found =
          fixtures.find((fx) => fx.matchId === matchId || fx.id === matchId) ??
          null;
        setFixture(found);
        const cid = channels[0]?.channelId ?? channels[0]?.id ?? null;
        setChannelId(cid);

        if (found) {
          const subs = await getSubFixtures(found.matchId || found.id);
          if (!mounted) return;
          setSubFixtures(subs);
          if (cid) {
            const [open, matched] = await Promise.all([
              getOpenBets(cid, found.matchId || found.id, authToken ?? undefined),
              getChannelBettors(cid, found.matchId || found.id, authToken ?? undefined),
            ]);
            if (!mounted) return;
            setOpenBets(open);
            setMatchedBets(matched);
          }
        }
      } catch (error) {
        console.error('Could not load fixture details:', error);
        if (mounted) setLoadError('Some fixture details could not be loaded. Please try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [matchId, userId, authToken]);

  // Compact header appears once the hero has scrolled past.
  useEffect(() => {
    function onScroll() {
      setShowStickyHeader(window.scrollY > 160);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Keep the pledge CTA reachable: show the sticky bar only once the main
  // pledge control has scrolled out of view.
  useEffect(() => {
    const el = pledgeSectionRef.current;
    if (!el) {
      setPledgeInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setPledgeInView(entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [voteSelection]);

  // One deliberate reveal for the vote confirmation, not a fade on everything.
  useEffect(() => {
    if (!voted) {
      setShowConfirm(false);
      return;
    }
    const t = setTimeout(() => setShowConfirm(true), 20);
    return () => clearTimeout(t);
  }, [voted]);

  async function handleVote(sel: Selection) {
    if (!fixture || !channelId || !userId || !authToken || votePending) return;
    setVoteSelection(sel);
    setVotePending(true);
    try {
      const ok = await castVote({
        channelId,
        fixtureId: fixture.matchId || fixture.id,
        userId,
        selection: sel,
        authToken,
      });
      if (ok) {
        setVoted(true);
      } else {
        toast.showError('Could not record your vote — try again.');
      }
    } catch (error) {
      console.error('Could not record fixture vote', error);
      toast.showError('Could not record your vote — try again.');
    } finally {
      setVotePending(false);
    }
  }

  async function handlePlaceBet() {
    if (!fixture || !channelId || !userId || !username || !voteSelection) return;
    const amount = Number(pledgeAmount);
    if (!amount || amount <= 0) {
      setBetError('Enter an amount greater than 0.');
      return;
    }
    setBetError(null);
    setPlacingBet(true);
    try {
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
      if (result?.success !== false) {
        toast.showSuccess('Bet placed.');
        const [open, matched] = await Promise.all([
          getOpenBets(channelId, fixture.matchId || fixture.id, authToken ?? undefined),
          getChannelBettors(channelId, fixture.matchId || fixture.id, authToken ?? undefined),
        ]);
        setOpenBets(open);
        setMatchedBets(matched);
      } else {
        toast.showError(result?.message ?? 'Could not place that bet.');
      }
    } catch (error) {
      console.error('Could not place fixture bet', error);
      toast.showError('Could not place that bet. Please try again.');
    } finally {
      setPlacingBet(false);
    }
  }

  async function handlePostComment() {
    if (!fixture || !userId || !username || !comment.trim()) return;
    setPostingComment(true);
    try {
      const result = await postComment({
        userId,
        username,
        fixtureId: fixture.matchId || fixture.id,
        comment: comment.trim(),
        selection: voteSelection ?? '',
        authToken: authToken ?? undefined,
      });
      setCommentStatus(result.message);
      if (result.success) {
        setComment('');
        toast.showSuccess(result.message);
      } else {
        toast.showError(result.message);
      }
    } catch (error) {
      console.error('Could not post fixture comment', error);
      setCommentStatus('Could not post your comment. Please try again.');
      toast.showError('Could not post your comment. Please try again.');
    } finally {
      setPostingComment(false);
    }
  }

  function onCommentKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !postingComment) {
      e.preventDefault();
      handlePostComment();
    }
  }

  // ---------- Loading ----------
  if (loading) {
    return (
      <div className="mx-auto max-w-md animate-pulse px-fan-lg pt-fan-xxl pb-10">
        <div className="mb-fan-sm h-3 w-24 rounded-fan-pill bg-fan-surfaceSunken" />
        <div className="mb-fan-lg h-8 w-3/4 rounded-fan-pill bg-fan-surfaceSunken" />
        <div className="mb-fan-xxl flex gap-fan-sm">
          <div className="h-9 w-24 rounded-fan-pill bg-fan-surfaceSunken" />
          <div className="h-9 w-16 rounded-fan-pill bg-fan-surfaceSunken" />
          <div className="h-9 w-24 rounded-fan-pill bg-fan-surfaceSunken" />
        </div>
        <div className="mb-fan-md h-4 w-32 rounded-fan-pill bg-fan-surfaceSunken" />
        <div className="h-20 w-full rounded-fan-pill bg-fan-surfaceSunken" />
      </div>
    );
  }

  // ---------- Not found ----------
  if (!fixture) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-fan-lg text-center">
        <p className="mb-fan-xs font-condensed text-fan-headline text-fan-textPrimary">
          Fixture not found
        </p>
        <p className="mb-fan-lg text-fan-body text-fan-textTertiary">
          {loadError ?? 'This match may have been removed, or the link is off. Head back and pick another one.'}
        </p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-fan-pill bg-fan-primary px-fan-lg py-fan-sm text-fan-tag font-semibold text-fan-textInverse"
        >
          Go back
        </button>
      </div>
    );
  }

  const statusLabel = hasScores(fixture) ? 'Final' : 'Upcoming';
  const totalPot =
    openBets.reduce((sum, b) => sum + (b.starterAmount ?? 0), 0) +
    matchedBets.reduce(
      (sum, b) => sum + (b.starterAmount ?? 0) + (b.finisherAmount ?? 0),
      0
    );

  return (
    <>
      {/* Sticky compact header — orientation while scrolling */}
      <div
        className={`fixed inset-x-0 top-0 z-40 border-b border-fan-border bg-fan-surfaceSunken/95 backdrop-blur transition-all duration-200 ${showStickyHeader
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0'
          }`}
      >
        <div className="mx-auto flex max-w-md items-center gap-fan-md px-fan-lg py-fan-sm">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="text-fan-body text-fan-textSecondary"
          >
            ←
          </button>
          <p className="flex-1 truncate font-condensed text-fan-body font-semibold text-fan-textPrimary">
            {fixture.homeTeam} vs {fixture.awayTeam}
          </p>
          {hasScores(fixture) && (
            <p className="shrink-0 font-condensed text-fan-body font-bold text-fan-textPrimary">
              {scoreDisplay(fixture)}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-md px-fan-lg pt-fan-xxl pb-28">
        {/* Hero */}
        <div className="mb-fan-md flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="text-fan-body text-fan-textSecondary"
          >
            ←
          </button>
          <span className="rounded-fan-pill bg-fan-surfaceSunken px-fan-sm py-[2px] text-fan-tag font-semibold text-fan-textTertiary">
            {statusLabel}
          </span>
        </div>

        <p className="mb-fan-sm text-fan-tag font-bold uppercase tracking-[0.3px] text-fan-textTertiary">
          {fixture.league}
        </p>

        <div className="mb-fan-xxl flex items-center gap-fan-md">
          <div className="flex flex-1 items-center gap-fan-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fan-surfaceSunken text-fan-tag font-bold text-fan-textPrimary">
              {initials(fixture.homeTeam)}
            </span>
            <span className="font-condensed text-fan-headline text-fan-textPrimary">
              {fixture.homeTeam}
            </span>
          </div>

          <span className="shrink-0 font-condensed text-fan-scoreCompact font-bold text-fan-textPrimary">
            {hasScores(fixture) ? scoreDisplay(fixture) : 'vs'}
          </span>

          <div className="flex flex-1 items-center justify-end gap-fan-sm text-right">
            <span className="font-condensed text-fan-headline text-fan-textPrimary">
              {fixture.awayTeam}
            </span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fan-surfaceSunken text-fan-tag font-bold text-fan-textPrimary">
              {initials(fixture.awayTeam)}
            </span>
          </div>
        </div>

        <div className="mb-fan-xxl h-px bg-fan-border" />

        {/* Vote */}
        <section className="mb-fan-xxl">
          <h2 className="mb-fan-md text-fan-tag font-bold uppercase tracking-[0.3px] text-fan-textTertiary">
            Vote
          </h2>

          {!userId ? (
            <p className="text-fan-body text-fan-textTertiary">
              Sign in to vote and back your pick.
            </p>
          ) : !channelId ? (
            <p className="text-fan-body text-fan-textTertiary">
              Join a channel to vote on this fixture.
            </p>
          ) : voted ? (
            <p
              className={`text-fan-body text-fan-primary transition-all duration-300 ${showConfirm ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
                }`}
            >
              ✓ Vote recorded — back it with a pledge below.
            </p>
          ) : (
            <div className="flex flex-wrap gap-fan-sm">
              {voteOptions(fixture).map(([sel, label]) => {
                const isActive = voteSelection === sel && votePending;
                return (
                  <button
                    key={sel}
                    onClick={() => handleVote(sel)}
                    disabled={votePending}
                    aria-pressed={voteSelection === sel}
                    className={`max-w-full truncate rounded-fan-pill px-fan-md py-fan-xs text-fan-tag font-semibold transition disabled:opacity-60 ${isActive
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

        {/* Pledge / Bet */}
        {voteSelection && (
          <section ref={pledgeSectionRef} className="mb-fan-xxl">
            <div className="mb-fan-md flex items-baseline justify-between">
              <h2 className="text-fan-tag font-bold uppercase tracking-[0.3px] text-fan-textTertiary">
                Back your vote
              </h2>
              {totalPot > 0 && (
                <span className="text-fan-caption text-fan-textTertiary">
                  {formatAmount(totalPot)} in the pool
                </span>
              )}
            </div>

            <div className="mb-fan-sm flex items-center gap-fan-md">
              <input
                type="number"
                min={1}
                value={pledgeAmount}
                onChange={(e) => {
                  setPledgeAmount(e.target.value);
                  if (betError) setBetError(null);
                }}
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

            <div className="mb-fan-base flex gap-fan-sm">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => {
                    setPledgeAmount(String(amt));
                    if (betError) setBetError(null);
                  }}
                  className={`rounded-fan-pill border px-fan-md py-[3px] text-fan-caption font-semibold transition ${pledgeAmount === String(amt)
                      ? 'border-fan-primary text-fan-primary'
                      : 'border-fan-border text-fan-textTertiary'
                    }`}
                >
                  {formatAmount(amt)}
                </button>
              ))}
            </div>

            {betError && (
              <p className="mb-fan-base text-fan-caption text-red-500">{betError}</p>
            )}

            {openBets.length > 0 && (
              <div className="mb-fan-base">
                <p className="mb-fan-xs text-fan-tag text-fan-textTertiary">
                  Open bets
                </p>
                <ul className="space-y-2">
                  {openBets.map((b) => (
                    <li key={b.id} className="flex items-center gap-fan-sm">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fan-surfaceSunken text-fan-caption font-semibold text-fan-textSecondary">
                        {initials(b.starterName)}
                      </span>
                      <span className="flex-1 truncate text-fan-caption text-fan-textSecondary">
                        {b.starterName}
                      </span>
                      <span className="shrink-0 font-semibold text-fan-caption text-fan-textPrimary">
                        {formatAmount(b.starterAmount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {matchedBets.length > 0 ? (
              <div>
                <p className="mb-fan-xs text-fan-tag text-fan-textTertiary">
                  Matched bets
                </p>
                <ul className="space-y-2">
                  {matchedBets.map((b) => (
                    <li key={b.id} className="flex items-center gap-fan-sm">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fan-surfaceSunken text-fan-caption font-semibold text-fan-textSecondary">
                        {initials(b.starterName)}
                      </span>
                      <span className="flex-1 truncate text-fan-caption text-fan-textSecondary">
                        {b.starterName} vs {b.finisherName}
                      </span>
                      <span className="shrink-0 font-semibold text-fan-caption text-fan-textPrimary">
                        {formatAmount(b.starterAmount + (b.finisherAmount ?? 0))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : openBets.length === 0 ? (
              <p className="text-fan-caption text-fan-textTertiary">
                No bets yet — be the first to back your pick.
              </p>
            ) : null}
          </section>
        )}

        {/* Prop markets */}
        {subFixtures.length > 0 && (
          <section className="mb-fan-xxl">
            <div className="mb-fan-md flex items-center gap-fan-sm">
              <h2 className="text-fan-tag font-bold uppercase tracking-[0.3px] text-fan-textTertiary">
                Prop Markets
              </h2>
              <span className="rounded-fan-pill bg-fan-surfaceSunken px-fan-sm py-[1px] text-fan-caption text-fan-textTertiary">
                {subFixtures.length}
              </span>
            </div>
            <div className="space-y-fan-lg">
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

        {/* Comments */}
        <section>
          <h2 className="mb-fan-md text-fan-tag font-bold uppercase tracking-[0.3px] text-fan-textTertiary">
            Comments
          </h2>
          <div className="flex items-center gap-fan-md rounded-fan-pill border border-fan-border bg-fan-surfaceSunken px-fan-md py-fan-xs">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, COMMENT_LIMIT))}
              onKeyDown={onCommentKeyDown}
              placeholder="Say something…"
              className="flex-1 bg-transparent text-fan-body text-fan-textPrimary outline-none placeholder:text-fan-textTertiary"
            />
            <button
              onClick={handlePostComment}
              disabled={postingComment || !comment.trim()}
              className="shrink-0 rounded-fan-pill bg-fan-primary px-fan-md py-fan-xs text-fan-tag font-semibold text-fan-textInverse disabled:opacity-60"
            >
              Post
            </button>
          </div>
          <div className="mt-fan-sm flex items-center justify-between">
            {commentStatus ? (
              <p className="text-fan-caption text-fan-textTertiary">{commentStatus}</p>
            ) : (
              <span />
            )}
            <p className="text-fan-caption text-fan-textTertiary">
              {comment.length}/{COMMENT_LIMIT}
            </p>
          </div>
        </section>
      </div>

      {/* Reachable pledge CTA — appears once the main pledge control scrolls
          out of view, so the primary action stays one tap away. */}
      {voteSelection && !pledgeInView && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-fan-border bg-fan-surfaceSunken px-fan-lg py-fan-sm">
          <div className="mx-auto flex max-w-md items-center justify-between gap-fan-md">
            <div>
              <p className="text-fan-caption text-fan-textTertiary">Pledging</p>
              <p className="font-condensed text-fan-body font-bold text-fan-textPrimary">
                {formatAmount(Number(pledgeAmount) || 0)}
              </p>
            </div>
            <button
              onClick={handlePlaceBet}
              disabled={placingBet || !Number(pledgeAmount)}
              className="rounded-fan-pill bg-fan-primary px-fan-lg py-fan-sm text-fan-tag font-semibold text-fan-textInverse disabled:opacity-60"
            >
              {placingBet ? 'Placing…' : 'Place bet'}
            </button>
          </div>
        </div>
      )}
    </>
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
  const [selection, setSelection] = useState<'a' | 'b' | null>(null);

  async function vote(sel: 'a' | 'b') {
    if (!userId || !username) return;
    setSelection(sel);
    setVoting(true);
    try {
      await submitSubFixtureVote({
        voterId: userId,
        username,
        subFixtureId: sf.id,
        parentFixtureId: matchId,
        selection: sel,
      });
      setVoted(true);
    } finally {
      setVoting(false);
    }
  }

  return (
    <div>
      <p className="mb-fan-sm text-fan-body text-fan-textPrimary">{sf.question}</p>
      {voted ? (
        <p className="text-fan-caption text-fan-primary">
          ✓ Voted {selection === 'a' ? sf.optionA : sf.optionB}
        </p>
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