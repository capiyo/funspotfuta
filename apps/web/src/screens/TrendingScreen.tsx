'use client';

// Wired to GET /api/votes/stats/sub-fixtures/trending — real trending
// prop-bet markets (first goal / first corner / first yellow / etc), with
// voting via submitSubFixtureVote. The original app's "War Zone" trending
// screen also shows live odds movement/animations; this is the functional
// core (data + voting), not a pixel port of that animation layer.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getTrendingSubFixtures, submitSubFixtureVote } from '@funspot/core';
import { useToast } from '@/lib/toast/toast-context';

interface TrendingItem {
  sub_fixture_id?: string;
  id?: string;
  question?: string;
  option_a?: string;
  option_b?: string;
  optionA?: string;
  optionB?: string;
  parent_fixture_id?: string;
  parentFixtureId?: string;
  total_votes?: number;
  [key: string]: any;
}

export default function TrendingPage() {
  const { userId, username } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [voting, setVoting] = useState<string | null>(null);

  const loadMarkets = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await getTrendingSubFixtures(20);
      setItems(data);
    } catch (error) {
      console.error('Could not load trending markets', error);
      setLoadError(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMarkets();
  }, [loadMarkets]);

  async function handleVote(item: TrendingItem, selection: 'a' | 'b') {
    if (!userId || !username) {
      toast.showInfo('Log in to vote on trending markets.');
      return;
    }
    const id = item.sub_fixture_id ?? item.id ?? '';
    if (!id || voting) return;
    setVoting(id);
    try {
      await submitSubFixtureVote({
        voterId: userId,
        username,
        subFixtureId: id,
        parentFixtureId: item.parent_fixture_id ?? item.parentFixtureId ?? '',
        selection,
      });
      setVotedIds((prev) => new Set(prev).add(id));
      setItems((prev) => prev.map((market) =>
        (market.sub_fixture_id ?? market.id ?? '') === id
          ? { ...market, total_votes: (market.total_votes ?? 0) + 1 }
          : market,
      ));
    } catch (error) {
      console.error('Could not submit trending vote', error);
      toast.showError('Could not record your vote. Please try again.');
    } finally {
      setVoting(null);
    }
  }

  return (
    <div className="mx-auto max-w-md px-fan-lg pt-fan-xxl">
      <h1 className="mb-fan-lg font-condensed text-fan-headline text-fan-textPrimary">🔥 Trending Markets</h1>

      {loading ? (
        <div className="flex justify-center py-16" role="status" aria-label="Loading trending markets">
          <div className="h-8 w-8 animate-spin rounded-fan-pill border-2 border-fan-primary border-t-transparent" />
        </div>
      ) : loadError ? (
        <div className="py-16 text-center text-fan-body text-fan-textTertiary" role="alert">
          <p>Could not load trending markets.</p>
          <button onClick={() => void loadMarkets()} className="mt-fan-md underline">Try again</button>
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-fan-body text-fan-textTertiary">No trending markets right now.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const id = item.sub_fixture_id ?? item.id ?? String(i);
            const voted = votedIds.has(id);
            return (
              <div key={id} className="rounded-fan-xl border border-fan-border bg-fan-surface p-fan-lg">
                <p className="mb-fan-sm text-fan-body font-semibold text-fan-textPrimary">
                  {item.question ?? 'Untitled market'}
                </p>
                <p className="mb-fan-base text-[11px] text-fan-textTertiary">
                  {item.total_votes ?? 0} votes
                </p>
                {voted ? (
                  <p className="text-center text-fan-caption font-medium text-fan-primary">✓ Vote recorded</p>
                ) : (
                  <div className="grid grid-cols-2 gap-fan-md">
                    <button
                      disabled={voting !== null}
                      onClick={() => void handleVote(item, 'a')}
                      className="rounded-fan-lg border border-fan-border bg-fan-surfaceSunken py-fan-md text-fan-caption font-medium text-fan-textSecondary hover:border-fan-primary disabled:opacity-50"
                    >
                      {item.option_a ?? item.optionA ?? 'Option A'}
                    </button>
                    <button
                      disabled={voting !== null}
                      onClick={() => void handleVote(item, 'b')}
                      className="rounded-fan-lg border border-fan-border bg-fan-surfaceSunken py-fan-md text-fan-caption font-medium text-fan-textSecondary hover:border-fan-primary disabled:opacity-50"
                    >
                      {item.option_b ?? item.optionB ?? 'Option B'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
