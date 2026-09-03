'use client';

// Wired to GET /api/votes/stats/sub-fixtures/trending — real trending
// prop-bet markets (first goal / first corner / first yellow / etc), with
// voting via submitSubFixtureVote. The original app's "War Zone" trending
// screen also shows live odds movement/animations; this is the functional
// core (data + voting), not a pixel port of that animation layer.

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getTrendingSubFixtures, submitSubFixtureVote } from '@funspot/core';

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
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [voting, setVoting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await getTrendingSubFixtures(20);
      setItems(data);
      setLoading(false);
    })();
  }, []);

  async function handleVote(item: TrendingItem, selection: 'a' | 'b') {
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
    } finally {
      setVoting(null);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-6">
      <h1 className="mb-4 text-lg font-bold text-white">🔥 Trending Markets</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-funspot-green border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">No trending markets right now.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const id = item.sub_fixture_id ?? item.id ?? String(i);
            const voted = votedIds.has(id);
            return (
              <div key={id} className="rounded-2xl border border-white/10 bg-funspot-surface p-4">
                <p className="mb-1 text-sm font-semibold text-white">
                  {item.question ?? 'Untitled market'}
                </p>
                <p className="mb-3 text-[11px] text-gray-500">
                  {item.total_votes ?? 0} votes
                </p>
                {voted ? (
                  <p className="text-center text-xs font-medium text-funspot-green">✓ Vote recorded</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={voting === id}
                      onClick={() => handleVote(item, 'a')}
                      className="rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-medium text-gray-200 hover:border-funspot-green disabled:opacity-50"
                    >
                      {item.option_a ?? item.optionA ?? 'Option A'}
                    </button>
                    <button
                      disabled={voting === id}
                      onClick={() => handleVote(item, 'b')}
                      className="rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-medium text-gray-200 hover:border-funspot-green disabled:opacity-50"
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
