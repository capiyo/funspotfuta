import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAllFixtures, getUserChannels, type Fixture, type Channel } from '@funspot/core';
import { useAuth } from '../lib/auth/auth-context';
import { ChatModal } from '../app/(app)/chat/page';

export function ChatRoute() {
  const { userId, authToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeChannelId = searchParams.get('channelId') ?? '';
  const routeFixtureId = searchParams.get('fixtureId') ?? '';
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        const [fixtureRows, channelRows] = await Promise.all([
          getAllFixtures(),
          userId && authToken ? getUserChannels(userId, authToken) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setFixtures(fixtureRows ?? []);
        setChannels(channelRows ?? []);
      } catch {
        if (!cancelled) setLoadError('Could not load chat channels and fixtures. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, authToken]);

  const fixture = useMemo(() => fixtures.find((item) =>
    String(item.matchId ?? item.id) === routeFixtureId
  ), [fixtures, routeFixtureId]);
  const channelId = routeChannelId || channels[0]?.id || '';

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-fan-textSecondary" role="status">Loading chat…</div>;
  }

  if (loadError) {
    return <div className="mx-auto max-w-lg px-6 py-12 text-fan-textPrimary"><p role="alert">{loadError}</p><button className="mt-4 rounded-fan-md bg-fan-primary px-4 py-2" onClick={() => navigate('/home')}>Back home</button></div>;
  }

  if (!routeFixtureId || !fixture || !channelId) {
    return (
      <main className="mx-auto min-h-[60vh] w-full max-w-xl px-4 py-8 text-fan-textPrimary">
        <button className="mb-6 text-fan-primary" onClick={() => navigate('/home')}>← Back home</button>
        <h1 className="mb-2 font-condensed text-fan-headline">Open a channel chat</h1>
        <p className="mb-6 text-fan-textSecondary">Choose a fixture and channel to open the same live chat available from the Arena.</p>
        {fixtures.length === 0 || channels.length === 0 ? (
          <p className="rounded-fan-lg border border-fan-border p-4">{channels.length === 0 ? 'You need to join or create a channel before chatting.' : 'No fixtures are available right now.'}</p>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm">Fixture
              <select id="chat-fixture" className="mt-2 w-full rounded-fan-md border border-fan-border bg-fan-surface p-3" defaultValue={routeFixtureId} onChange={(event) => {
                const params = new URLSearchParams(searchParams);
                params.set('fixtureId', event.target.value);
                if (channelId) params.set('channelId', channelId);
                navigate(`/chat?${params.toString()}`, { replace: true });
              }}>
                <option value="">Select a fixture</option>
                {fixtures.map((item) => {
                  const id = String(item.matchId ?? item.id);
                  return <option key={id} value={id}>{item.homeTeam ?? item.homeTeamName ?? 'Home'} vs {item.awayTeam ?? item.awayTeamName ?? 'Away'}</option>;
                })}
              </select>
            </label>
            <label className="block text-sm">Channel
              <select className="mt-2 w-full rounded-fan-md border border-fan-border bg-fan-surface p-3" value={channelId} onChange={(event) => {
                const params = new URLSearchParams(searchParams);
                params.set('channelId', event.target.value);
                if (routeFixtureId) params.set('fixtureId', routeFixtureId);
                navigate(`/chat?${params.toString()}`, { replace: true });
              }}>
                {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
              </select>
            </label>
            <button disabled={!routeFixtureId || !fixture} className="rounded-fan-md bg-fan-primary px-4 py-2 text-fan-onPrimary disabled:opacity-50" onClick={() => navigate(`/chat?fixtureId=${encodeURIComponent(routeFixtureId)}&channelId=${encodeURIComponent(channelId)}`, { replace: true })}>Open chat</button>
          </div>
        )}
      </main>
    );
  }

  return <div className="min-h-screen bg-fan-background"><ChatModal fixture={fixture} channelId={channelId} onClose={() => navigate('/home')} /></div>;
}
