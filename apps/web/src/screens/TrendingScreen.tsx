'use client';

// Wired to GET /api/votes/stats/sub-fixtures/trending — real trending
// prop-bet markets (first goal / first corner / first yellow / etc), with
// voting via submitSubFixtureVote. The original app's "War Zone" trending
// screen also shows live odds movement/animations; this is the functional
// core (data + voting), not a pixel port of that animation layer.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { userId, username, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [voting, setVoting] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getTrendingSubFixtures(20);
        setItems(data);
      } catch {
        setItems([]);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleVote(item: TrendingItem, selection: 'a' | 'b') {
    if (!isLoggedIn) {
      navigate(`/login?next=${encodeURIComponent('/trending')}`);
      return;
    }
    if (!userId || !username) return;
    const id = item.sub_fixture_id ?? item.id ?? '';
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
    } catch (e) {
      console.error(e);
      toast.showError('Could not record your vote. Please try again.');
    } finally {
      setVoting(null);
    }
  }

  return (
    <div className="mx-auto max-w-md px-fan-lg pt-fan-xxl">
      <h1 className="mb-fan-lg font-condensed text-fan-headline text-fan-textPrimary">🔥 Trending Markets</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-fan-pill border-2 border-fan-primary border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-fan-body text-fan-textTertiary">{loadError ? 'Could not load trending markets. Please try again later.' : 'No trending markets right now.'}</p>
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
                      disabled={voting === id}
                      onClick={() => handleVote(item, 'a')}
                      className="rounded-fan-lg border border-fan-border bg-fan-surfaceSunken py-fan-md text-fan-caption font-medium text-fan-textSecondary hover:border-fan-primary disabled:opacity-50"
                    >
                      {item.option_a ?? item.optionA ?? 'Option A'}
                    </button>
                    <button
                      disabled={voting === id}
                      onClick={() => handleVote(item, 'b')}
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
