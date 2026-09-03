'use client';

import { useEffect, useState } from 'react';
import { Fixture, getAllFixtures, getUserChannels, Channel } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { MatchCard } from '@/components/MatchCard';
import Link from 'next/link';
import { Newspaper } from 'lucide-react';

export default function HomePage() {
  const { userId, authToken, username } = useAuth();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [f, c] = await Promise.all([
        getAllFixtures(),
        userId && authToken ? getUserChannels(userId, authToken) : Promise.resolve([]),
      ]);
      setFixtures(f);
      setChannels(c);
      setActiveChannelId(c[0]?.id);
      setLoading(false);
    })();
  }, [userId, authToken]);

  const filtered = fixtures.filter((f) => {
    if (filter === 'all') return true;
    if (filter === 'live') return f.isLive || f.status === 'live';
    if (filter === 'upcoming') return f.status === 'upcoming' || f.status === 'soon';
    if (filter === 'completed') return f.status === 'completed';
    return true;
  });

  return (
    <div className="mx-auto max-w-md px-4 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Welcome back</p>
          <h1 className="text-lg font-bold text-white">{username ?? 'Fan'} 👋</h1>
        </div>
        <Link
          href="/feed"
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300"
        >
          <Newspaper size={14} /> Feed
        </Link>
      </header>

      {channels.length > 0 && (
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveChannelId(c.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                activeChannelId === c.id
                  ? 'bg-funspot-green text-black'
                  : 'bg-white/5 text-gray-300 border border-white/10'
              }`}
            >
              {c.name}
            </button>
          ))}
          {activeChannelId && channels.find((c) => c.id === activeChannelId)?.created_by === userId && (
            <Link
              href={`/admin/${activeChannelId}`}
              className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-400"
            >
              ⚙ Admin
            </Link>
          )}
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {(['all', 'live', 'upcoming', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              filter === f ? 'bg-white text-black' : 'bg-white/5 text-gray-400'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-funspot-green border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">No fixtures right now — check back soon.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((fixture) => (
            <MatchCard key={fixture.id || fixture.matchId} fixture={fixture} channelId={activeChannelId} />
          ))}
        </div>
      )}
    </div>
  );
}
