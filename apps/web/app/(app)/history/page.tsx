'use client';

// New UI on top of the fully-ported history-service.ts (HistoryGame +
// HistoryService, from fixture_models.dart). Lists real completed matches
// with the same source-detection (National vs League) and result-color
// logic as the original.

import { useEffect, useState } from 'react';
import {
  fetchHistoryGames,
  historyResultDisplay,
  historyResultColorHex,
  historyScoreDisplay,
  sourceIcon,
  sourceLabel,
  HistoryGame,
} from '@funspot/core';

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [league, setLeague] = useState('');

  async function loadPage(skip: number, replace: boolean) {
    const page = await fetchHistoryGames({ limit: PAGE_SIZE, skip, league: league || undefined });
    setHasMore(page.length === PAGE_SIZE);
    setGames((prev) => (replace ? page : [...prev, ...page]));
  }

  useEffect(() => {
    setLoading(true);
    loadPage(0, true).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league]);

  async function handleLoadMore() {
    setLoadingMore(true);
    await loadPage(games.length, false);
    setLoadingMore(false);
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-10">
      <h1 className="mb-4 text-lg font-bold text-white">Match History</h1>

      <input
        value={league}
        onChange={(e) => setLeague(e.target.value)}
        placeholder="Filter by league…"
        className="mb-4 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-funspot-green"
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-funspot-green border-t-transparent" />
        </div>
      ) : games.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">No history found.</p>
      ) : (
        <>
          <div className="space-y-2">
            {games.map((g) => (
              <div key={g.id} className="rounded-xl border border-white/10 bg-funspot-surface p-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
                  <span>
                    {sourceIcon(g)} {sourceLabel(g)} · {g.league}
                  </span>
                  <span>{g.date}</span>
                </div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex-1 truncate text-sm text-white">{g.homeTeam}</span>
                  <span className="px-2 text-sm font-bold" style={{ color: historyResultColorHex(g) }}>
                    {historyScoreDisplay(g)}
                  </span>
                  <span className="flex-1 truncate text-right text-sm text-white">{g.awayTeam}</span>
                </div>
                <p className="text-center text-[11px] text-gray-500">{historyResultDisplay(g)}</p>
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-gray-300 disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
