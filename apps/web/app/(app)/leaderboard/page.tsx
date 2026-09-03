'use client';

// Ported functionality-wise from lib/modals/Funzy/leaderboard.dart's data
// layer: fetches GET /api/channels/:channelId/leaderboard, parses each row
// with the exact ComradeWithStats.fromChannelMember mapping, sorts by rank.
// The original file's ad-carousel presentation isn't ported — this renders
// the same real data as a plain ranked list.

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getUserChannels, getChannelLeaderboard, getUserComrades, Channel, ComradeWithStats, comradeWithStatsFromChannelMember } from '@funspot/core';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const { userId, authToken } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
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
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-gray-400">Join or create a channel to see its leaderboard.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-6">
      <h1 className="mb-4 text-lg font-bold text-white">🏆 Leaderboard</h1>

      {channels.length > 0 && (
        <select
          value={activeChannelId ?? ''}
          onChange={(e) => setActiveChannelId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-white/10 bg-funspot-surface px-3 py-2 text-sm text-white"
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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-funspot-green border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">No leaderboard data yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={row.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                row.id === userId
                  ? 'border-funspot-green/50 bg-funspot-green/10'
                  : 'border-white/10 bg-funspot-surface'
              }`}
            >
              <span className="w-8 text-center text-sm font-bold text-gray-400">
                {MEDAL[i] ?? `#${row.rank || i + 1}`}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{row.username}</p>
                <p className="text-[11px] text-gray-500">
                  {row.correctVotes}/{row.totalVotes} correct · {row.accuracyPercentage.toFixed(0)}% accuracy
                </p>
              </div>
              <span className="text-sm font-bold text-funspot-green">{row.totalPoints} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
