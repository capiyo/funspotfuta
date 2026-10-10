import { useEffect, useState } from 'react';
import { MessageCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAllFixtures, getUserChannels } from '@funspot/core';
import type { Channel, Fixture } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { ChatModal } from './page';

export default function ChatRoutePage() {
  const { userId, authToken, isLoggedIn } = useAuth();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState('');
  const [activeFixture, setActiveFixture] = useState<Fixture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [fixtureRows, channelRows] = await Promise.all([
        getAllFixtures(),
        userId ? getUserChannels(userId, authToken ?? undefined) : Promise.resolve([]),
      ]);
      setFixtures(Array.isArray(fixtureRows) ? fixtureRows : []);
      setChannels(Array.isArray(channelRows) ? channelRows : []);
      setActiveChannelId((current) => current || channelRows[0]?.channelId || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load chats. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [userId, authToken]);

  if (!isLoggedIn) return null;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 pb-24">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-fan-primary">Community</p>
          <h1 className="mt-1 text-2xl font-bold text-fan-textPrimary">Match chats</h1>
          <p className="mt-1 text-sm text-fan-textSecondary">Choose a match to open its live channel conversation.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh chats" className="rounded-full border border-fan-border p-3 text-fan-textPrimary disabled:opacity-50">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {channels.length > 0 && (
        <label className="block space-y-2 text-sm text-fan-textSecondary">
          <span>Your channel</span>
          <select value={activeChannelId} onChange={(e) => setActiveChannelId(e.target.value)} className="w-full rounded-xl border border-fan-border bg-fan-surface px-3 py-3 text-fan-textPrimary">
            {channels.map((channel) => <option key={channel.channelId} value={channel.channelId}>{channel.name}</option>)}
          </select>
        </label>
      )}

      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border border-fan-border bg-fan-surface p-6 text-sm text-fan-textSecondary">Loading match chats…</div>
      ) : channels.length === 0 ? (
        <div className="rounded-2xl border border-fan-border bg-fan-surface p-6">
          <h2 className="font-semibold text-fan-textPrimary">Join a channel first</h2>
          <p className="mt-2 text-sm text-fan-textSecondary">Your match conversations are connected to your channels.</p>
          <Link to="/home" className="mt-4 inline-flex rounded-full bg-fan-primary px-4 py-2 text-sm font-semibold text-fan-background">Explore channels</Link>
        </div>
      ) : fixtures.length === 0 ? (
        <div className="rounded-2xl border border-fan-border bg-fan-surface p-6 text-sm text-fan-textSecondary">No matches are available right now. Refresh to try again.</div>
      ) : (
        <div className="space-y-3">
          {fixtures.map((fixture) => {
            const id = fixture.matchId || fixture.id;
            return (
              <article key={id} className="flex items-center justify-between gap-3 rounded-2xl border border-fan-border bg-fan-surface p-4">
                <div className="min-w-0">
                  <p className="truncate text-xs text-fan-textSecondary">{fixture.league || 'Match'}</p>
                  <h2 className="mt-1 truncate font-semibold text-fan-textPrimary">{fixture.homeTeam || 'Home'} <span className="text-fan-textTertiary">vs</span> {fixture.awayTeam || 'Away'}</h2>
                  {fixture.isLive && <span className="mt-2 inline-flex rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-400">Live</span>}
                </div>
                <button type="button" onClick={() => setActiveFixture(fixture)} disabled={!activeChannelId} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-fan-primary px-3 py-2 text-sm font-semibold text-fan-background disabled:opacity-40">
                  <MessageCircle size={16} /> Chat
                </button>
              </article>
            );
          })}
        </div>
      )}

      {activeFixture && activeChannelId && (
        <ChatModal fixture={activeFixture} channelId={activeChannelId} onClose={() => setActiveFixture(null)} />
      )}
    </section>
  );
}
