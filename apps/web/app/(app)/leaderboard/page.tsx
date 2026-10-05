'use client';

// Ported functionality-wise from lib/modals/Funzy/leaderboard.dart's data
// layer: fetches GET /api/channels/:channelId/leaderboard, parses each row
// with the exact ComradeWithStats.fromChannelMember mapping, sorts by rank.
// The original file's ad-carousel presentation isn't ported — this renders
// the same real data as a plain ranked list.

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getUserChannels, getChannelLeaderboard, getUserComrades, ComradeWithStats, type ComradeChannel, comradeWithStatsFromChannelMember } from '@funspot/core';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const { userId, authToken } = useAuth();
  const [channels, setChannels] = useState<ComradeChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [rows, setRows] = useState<ComradeWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !authToken) return;
    getUserChannels(userId, authToken).then((c) => {
      setChannels(c);
      setActiveChannelId((prev) => prev ?? c[0]?.id ?? null);
    });
  }, [userId, authToken]);

  useEffect(() => {
    if (!activeChannelId || !authToken || !userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [board, comrades] = await Promise.all([
        getChannelLeaderboard(activeChannelId, authToken),
        getUserComrades(userId, authToken),
      ]);
      if (cancelled) return;
      const comradesList = new Set(comrades.map((c) => c.comrade_id));
      const list: any[] = board?.leaderboard ?? [];
      const parsed = list
        .map((item) => comradeWithStatsFromChannelMember(item, comradesList))
        .sort((a, b) => a.rank - b.rank);
      setRows(parsed);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeChannelId, authToken, userId]);

  if (channels.length === 0 && !loading) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-fan-xxl text-center">
        <p className="text-fan-body text-fan-textTertiary">Join or create a channel to see its leaderboard.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-fan-lg pt-fan-xxl">
      <h1 className="mb-fan-lg font-condensed text-fan-headline text-fan-textPrimary">🏆 Leaderboard</h1>

      {channels.length > 0 && (
        <select
          value={activeChannelId ?? ''}
          onChange={(e) => setActiveChannelId(e.target.value)}
          className="mb-fan-lg w-full rounded-fan-md border border-fan-border bg-fan-surface px-fan-base py-fan-md text-fan-body text-fan-textPrimary"
        >
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-fan-pill border-2 border-fan-primary border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-fan-body text-fan-textTertiary">No leaderboard data yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={row.id}
              className={`flex items-center gap-fan-base rounded-fan-lg border px-fan-base py-fan-md ${
                row.id === userId
                  ? 'border-fan-primary/50 bg-fan-primary/10'
                  : 'border-fan-border bg-fan-surface'
              }`}
            >
              <span className="w-8 text-center text-fan-body font-bold text-fan-textTertiary">
                {MEDAL[i] ?? `#${row.rank || i + 1}`}
              </span>
              <div className="flex-1">
                <p className="text-fan-body font-medium text-fan-textPrimary">{row.username}</p>
                <p className="text-[11px] text-fan-textTertiary">
                  {row.correctVotes}/{row.totalVotes} correct · {row.accuracyPercentage.toFixed(0)}% accuracy
                </p>
              </div>
              <span className="text-fan-body font-bold text-fan-primary">{row.totalPoints} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
