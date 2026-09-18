'use client';

// New UI (the original spreads this across ComradeModal in
// leaderboard.dart and other Funzy/ modals) on top of the fully-ported
// comrades endpoints in comrade-service.ts: list your comrades, search for
// new ones, add/remove.

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getUserComrades,
  getComradeStats,
  addComrade,
  removeComrade,
  searchPotentialComrades,
  ComradeStats,
} from '@funspot/core';

export default function ComradesPage() {
  const { userId, username, authToken } = useAuth();
  const [comrades, setComrades] = useState<Record<string, any>[]>([]);
  const [stats, setStats] = useState<ComradeStats | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Record<string, any>[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    if (!userId) return;
    setLoading(true);
    const [list, s] = await Promise.all([
      getUserComrades(userId, authToken ?? undefined),
      getComradeStats(userId, authToken ?? undefined),
    ]);
    setComrades(list);
    setStats(s);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleSearch() {
    if (!userId || !query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const found = await searchPotentialComrades(query.trim(), userId, authToken ?? undefined);
    setResults(found);
    setSearching(false);
  }

  async function handleAdd(candidate: Record<string, any>) {
    if (!userId || !username || !authToken) return;
    setBusyId(candidate.id ?? candidate._id);
    await addComrade({
      userId,
      comradeId: candidate.id ?? candidate._id,
      username,
      comradeUsername: candidate.username ?? 'Unknown',
      comradeNickname: candidate.nickname ?? candidate.username ?? 'Unknown',
      comradeClub: candidate.club ?? '',
      comradeCountry: candidate.country ?? '',
      authToken,
    });
    setBusyId(null);
    setResults((prev) => prev.filter((r) => (r.id ?? r._id) !== (candidate.id ?? candidate._id)));
    refresh();
  }

  async function handleRemove(comradeId: string) {
    if (!userId || !authToken) return;
    setBusyId(comradeId);
    await removeComrade(userId, comradeId, authToken);
    setBusyId(null);
    refresh();
  }

  return (
    <div className="mx-auto max-w-md px-fan-lg pt-fan-xxl pb-10">
      <h1 className="mb-fan-sm font-condensed text-fan-headline text-fan-textPrimary">Comrades</h1>
      {stats && (
        <p className="mb-fan-lg text-fan-caption text-fan-textTertiary">
          {stats.count}/{stats.max_comrades} · {stats.remaining} remaining
        </p>
      )}

      <div className="mb-fan-xxl flex gap-fan-md">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by username…"
          className="flex-1 rounded-fan-pill border border-fan-border bg-fan-surfaceSunken px-fan-lg py-fan-md text-fan-body text-fan-textPrimary outline-none focus:border-fan-primary"
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="rounded-fan-pill bg-fan-primary px-fan-lg py-fan-md text-fan-body font-semibold text-fan-textInverse disabled:opacity-60"
        >
          {searching ? '…' : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="mb-fan-xxl">
          <p className="mb-fan-md text-fan-caption text-fan-textTertiary">Results</p>
          <div className="space-y-2">
            {results.map((r) => {
              const id = r.id ?? r._id;
              return (
                <div key={id} className="flex items-center justify-between rounded-fan-lg border border-fan-border bg-fan-surface px-fan-base py-fan-md">
                  <span className="text-fan-body text-fan-textPrimary">{r.username}</span>
                  <button
                    onClick={() => handleAdd(r)}
                    disabled={busyId === id}
                    className="rounded-fan-pill bg-fan-primary px-fan-base py-fan-sm text-fan-caption font-semibold text-fan-textInverse disabled:opacity-60"
                  >
                    Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mb-fan-md text-fan-caption text-fan-textTertiary">Your comrades</p>
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-fan-pill border-2 border-fan-primary border-t-transparent" />
        </div>
      ) : comrades.length === 0 ? (
        <p className="py-10 text-center text-fan-body text-fan-textTertiary">No comrades yet — search above to add some.</p>
      ) : (
        <div className="space-y-2">
          {comrades.map((c) => {
            const id = c.comrade_id ?? c.id;
            return (
              <div key={id} className="flex items-center justify-between rounded-fan-lg border border-fan-border bg-fan-surface px-fan-base py-fan-md">
                <div>
                  <p className="text-fan-body text-fan-textPrimary">{c.comrade_username ?? c.username}</p>
                  {c.comrade_nickname && <p className="text-[11px] text-fan-textTertiary">{c.comrade_nickname}</p>}
                </div>
                <button
                  onClick={() => handleRemove(id)}
                  disabled={busyId === id}
                  className="rounded-fan-pill border border-fan-away/30 bg-fan-awayDim px-fan-base py-fan-sm text-fan-caption font-semibold text-fan-away disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
