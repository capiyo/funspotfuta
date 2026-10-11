import { useEffect, useState } from 'react';
import { getUserChannels, type Channel } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useNavigate } from 'react-router-dom';
import ChatsScreen from '@/screens/ChatsScreen';
import FeedScreen from '@/screens/FeedScreen';

export default function HomeScreen() {
  const { userId, username, authToken, isLoggedIn, logout } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setLoadingChannels(true);
    const load = isLoggedIn && userId && authToken ? getUserChannels(userId, authToken) : Promise.resolve([] as Channel[]);
    load.then((result) => {
      if (!alive) return;
      setChannels(result);
      setActiveChannelId((current) => current ?? result[0]?.channelId ?? null);
    }).catch(() => { if (alive) setChannels([]); }).finally(() => { if (alive) setLoadingChannels(false); });
    return () => { alive = false; };
  }, [userId, authToken, isLoggedIn, refreshKey]);

  const activeChannel = channels.find((channel) => channel.channelId === activeChannelId) ?? null;
  return <div className="app-shell">
    <header className="navbar">
      <a href="/" className="brand" aria-label="Funspot home">Funspot😂</a>
      <div className="navbar-channels" aria-label="Channels">
        {channels.map((channel) => <button key={channel.channelId} className={channel.channelId === activeChannelId ? 'channel-chip active' : 'channel-chip'} onClick={() => setActiveChannelId(channel.channelId)}>{channel.name}</button>)}
        {loadingChannels && <span className="muted">Loading channels…</span>}
        {!loadingChannels && channels.length === 0 && <span className="muted">No channels available</span>}
      </div>
      <div className="navbar-actions">
        {isLoggedIn ? <><span className="username">{username}</span><button className="button button-quiet" onClick={() => { logout(); navigate('/login'); }}>Log out</button></> : <button className="button" onClick={() => navigate('/login')}>Join</button>}
        <button className="button button-quiet" onClick={() => setRefreshKey((n) => n + 1)} aria-label="Refresh channels">↻</button>
      </div>
    </header>
    <div className="workspace">
      <aside className="profile-sidebar">
        <div className="profile-avatar" aria-hidden="true">{(username?.[0] ?? 'F').toUpperCase()}</div>
        <h2>{username ?? 'Your profile'}</h2>
        <p className="muted">{isLoggedIn ? 'Fan profile' : 'Join Funspot to personalize your profile.'}</p>
        <div className="sidebar-divider" />
        <p className="sidebar-label">YOUR CHANNELS</p>
        {channels.map((channel) => <button key={channel.channelId} className={channel.channelId === activeChannelId ? 'sidebar-channel selected' : 'sidebar-channel'} onClick={() => setActiveChannelId(channel.channelId)}>{channel.name}</button>)}
        {!isLoggedIn && <button className="button sidebar-join" onClick={() => navigate('/login')}>Sign in with phone</button>}
      </aside>
      <main className="home-columns">
        <section className="home-column chats-column" aria-label="Chats">
          <ChatsScreen channels={channels} activeChannel={activeChannel} onSelectChannel={(channel) => setActiveChannelId(channel.channelId)} loading={loadingChannels} />
        </section>
        <section className="home-column feed-column" aria-label="Feed">
          <FeedScreen />
        </section>
      </main>
    </div>
  </div>;
}
