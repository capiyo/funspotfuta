// Browser-only home layout adaptation; mobile remains the source of truth for data and behavior.
// Order: AppHeader/navbar, then profile sidebar, then equally sized Chats and Feed columns.
// Desktop panes scroll independently; narrow screens use the same Chats/Feed pill tabs as mobile.
import { useState } from 'react';
import { registerToken } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useNavigate } from 'react-router-dom';
import ChatsScreen from '@/screens/ChatsScreen';
import FeedScreen from '@/screens/FeedScreen';
import { AppHeader } from '@/screens/home/appHeader';
import { FloatingPillTabBar } from '@/components/FloatingPillTabBar';
import { requestWebPushToken } from '@/lib/api/notification-service';
import { HomeProvider, useHome } from '@/screens/home/home-context';

function HomeScreenContent() {
  const { userId, username, authToken, isLoggedIn, logout } = useAuth();
  const {
    channels, activeChannel, activeChannelId, setActiveChannelId,
    loadingChannels, reloadChannels, activeTab, setActiveTab,
  } = useHome();
  const [pushStatus, setPushStatus] = useState('');
  const navigate = useNavigate();

  return (
    <div className="app-shell home-screen">
      <AppHeader
        channels={channels}
        activeChannelId={activeChannelId ?? null}
        loadingChannels={loadingChannels}
        username={username}
        isLoggedIn={isLoggedIn}
        onSelectChannel={setActiveChannelId}
        onLogout={() => { void logout(); navigate('/'); }}
        onLogin={() => navigate('/login')}
        onRefresh={() => { void reloadChannels(); }}
        onEnableNotifications={async () => {
          try {
            if (!isLoggedIn || !userId || !authToken) {
              setPushStatus('Log in before enabling notifications.');
              return;
            }
            const token = await requestWebPushToken();
            if (!token) {
              setPushStatus('Push notifications are unsupported or permission was not granted.');
              return;
            }
            const registered = await registerToken({ userId, fcmToken: token, platform: 'web', authToken });
            setPushStatus(registered
              ? 'Browser notifications enabled.'
              : 'A browser token was created, but the server did not accept registration.');
          } catch (error) {
            setPushStatus(error instanceof Error ? error.message : 'Could not enable notifications.');
          }
        }}
      />
      {pushStatus && (
        <div className="push-status" role="status">
          {pushStatus}
          <button type="button" onClick={() => setPushStatus('')} aria-label="Dismiss notification setup message">×</button>
        </div>
      )}

      <div className="workspace">
        <aside className="profile-sidebar" aria-label="Profile and channels">
          <div className="profile-avatar" aria-hidden="true">{(username?.[0] ?? 'F').toUpperCase()}</div>
          <h2>{username ?? 'Your profile'}</h2>
          <p className="muted">{isLoggedIn ? 'Fan profile' : 'Join Funspot to personalize your profile.'}</p>
          <div className="sidebar-divider" />
          <p className="sidebar-label">YOUR CHANNELS</p>
          {channels.map((channel) => (
            <button
              type="button"
              key={channel.channelId}
              className={channel.channelId === activeChannelId ? 'sidebar-channel selected' : 'sidebar-channel'}
              onClick={() => setActiveChannelId(channel.channelId)}
            >{channel.name}</button>
          ))}
          {!isLoggedIn && <button type="button" className="button sidebar-join" onClick={() => navigate('/login')}>Sign in with phone</button>}
        </aside>

        <div className="mobile-home-tabs">
          <FloatingPillTabBar active={activeTab} onChange={setActiveTab} />
        </div>

        <main className="home-columns" aria-label="Home workspace">
          <section className={`home-column chats-column ${activeTab === 'Chats' ? 'mobile-tab-active' : 'mobile-tab-hidden'}`} aria-label="Chats">
            <ChatsScreen
              channels={channels}
              activeChannel={activeChannel ?? null}
              onSelectChannel={(channel) => setActiveChannelId(channel.channelId)}
              loading={loadingChannels}
            />
          </section>
          <section className={`home-column feed-column ${activeTab === 'Feed' ? 'mobile-tab-active' : 'mobile-tab-hidden'}`} aria-label="Feed">
            <FeedScreen />
          </section>
        </main>
      </div>
    </div>
  );
}

export default function HomeScreen() {
  return <HomeProvider><HomeScreenContent /></HomeProvider>;
}
