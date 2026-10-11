// Browser-only home layout adaptation; mobile remains the source of truth for data and behavior.
// Order: AppHeader/navbar, then profile sidebar, then equally sized Chats and Feed columns.
// Desktop panes scroll independently; narrow screens use the same Chats/Feed pill tabs as mobile.
import { useEffect, useState } from 'react';
import { getAllChannels, getUserChannels, registerToken, type Channel } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useNavigate } from 'react-router-dom';
import ChatsScreen from '@/screens/ChatsScreen';
import FeedScreen from '@/screens/FeedScreen';
import { AppHeader } from '@/screens/home/appHeader';
import { FloatingPillTabBar, type TabName } from '@/components/FloatingPillTabBar';
import { requestWebPushToken } from '@/lib/api/notification-service';

export default function HomeScreen() {
  const { userId, username, authToken, isLoggedIn, logout } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pushStatus, setPushStatus] = useState('');
  const [activeTab, setActiveTab] = useState<TabName>('Chats');
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setLoadingChannels(true);
    const load = isLoggedIn && userId && authToken ? getUserChannels(userId, authToken) : getAllChannels(authToken ?? undefined);
    load.then((result) => {
      if (!alive) return;
      setChannels(result);
      setActiveChannelId((current) => current ?? result[0]?.channelId ?? null);
    }).catch(() => { if (alive) setChannels([]); }).finally(() => { if (alive) setLoadingChannels(false); });
    return () => { alive = false; };
  }, [userId, authToken, isLoggedIn, refreshKey]);

  const activeChannel = channels.find((channel) => channel.channelId === activeChannelId) ?? null;
  return <div className="app-shell home-screen">
    <AppHeader channels={channels} activeChannelId={activeChannelId} loadingChannels={loadingChannels}
      username={username} isLoggedIn={isLoggedIn} onSelectChannel={setActiveChannelId}
      onLogout={() => { logout(); navigate('/login'); }} onLogin={() => navigate('/login')}
      onRefresh={() => setRefreshKey((n) => n + 1)}
      onEnableNotifications={async () => {
        try {
          if (!isLoggedIn || !userId || !authToken) { setPushStatus('Log in before enabling notifications.'); return; }
          const token = await requestWebPushToken();
          if (!token) { setPushStatus('Push notifications are unsupported or permission was not granted.'); return; }
          const registered = await registerToken({ userId, fcmToken: token, platform: 'web', authToken });
          setPushStatus(registered ? 'Browser notifications enabled.' : 'A browser token was created, but the server did not accept registration.');
        } catch (error) { setPushStatus(error instanceof Error ? error.message : 'Could not enable notifications.'); }
      }} />
    {pushStatus && <div className="push-status" role="status">{pushStatus}<button onClick={() => setPushStatus('')} aria-label="Dismiss notification setup message">×</button></div>}
    <div className="workspace">
      <aside className="profile-sidebar" aria-label="Profile and channels">
        <div className="profile-avatar" aria-hidden="true">{(username?.[0] ?? 'F').toUpperCase()}</div>
        <h2>{username ?? 'Your profile'}</h2>
        <p className="muted">{isLoggedIn ? 'Fan profile' : 'Join Funspot to personalize your profile.'}</p>
        <div className="sidebar-divider" /><p className="sidebar-label">YOUR CHANNELS</p>
        {channels.map((channel) => <button key={channel.channelId}
          className={channel.channelId === activeChannelId ? 'sidebar-channel selected' : 'sidebar-channel'}
          onClick={() => setActiveChannelId(channel.channelId)}>{channel.name}</button>)}
        {!isLoggedIn && <button className="button sidebar-join" onClick={() => navigate('/login')}>Sign in with phone</button>}
      </aside>
      <div className="mobile-home-tabs"><FloatingPillTabBar active={activeTab} onChange={setActiveTab} /></div>
      <main className="home-columns" aria-label="Home workspace">
        <section className={`home-column chats-column ${activeTab === 'Chats' ? 'mobile-tab-active' : 'mobile-tab-hidden'}`} aria-label="Chats" aria-hidden={activeTab !== 'Chats' && window.matchMedia('(max-width: 650px)').matches}>
          <ChatsScreen channels={channels} activeChannel={activeChannel}
            onSelectChannel={(channel) => setActiveChannelId(channel.channelId)} loading={loadingChannels} />
        </section>
        <section className={`home-column feed-column ${activeTab === 'Feed' ? 'mobile-tab-active' : 'mobile-tab-hidden'}`} aria-label="Feed" aria-hidden={activeTab !== 'Feed' && window.matchMedia('(max-width: 650px)').matches}>
          <FeedScreen />
        </section>
      </main>
    </div>
  </div>;
}
