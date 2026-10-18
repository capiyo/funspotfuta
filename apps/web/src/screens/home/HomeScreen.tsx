// Browser-only home layout adaptation; mobile remains the source of truth for data and behavior.
// Order: AppHeader/navbar, then profile sidebar, then equally sized Chats and Feed columns.
// Desktop panes scroll independently; narrow screens use the same Chats/Feed pill tabs as mobile.
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useFanColors } from '@/theme/use-fan-colors';
import { registerToken } from '@funspot/core';
import { useAuth } from '@/lib/auth/auth-context';
import { useNavigate } from 'react-router-dom';
import ChatsScreen from '@/screens/ChatsScreen';
import FeedScreen from '@/screens/FeedScreen';
import { AppHeader } from '@/screens/home/appHeader';
import { FloatingPillTabBar } from '@/components/FloatingPillTabBar';
import ProfileSidebar from '@/components/ProfileSidebar';
import { requestWebPushToken } from '@/lib/api/notification-service';
import { HomeProvider, useHome } from '@/screens/home/home-context';

function HomeScreenContent() {
  const colors = useFanColors();
  const { userId, username, authToken, isLoggedIn, logout } = useAuth();
  const {
    channels, activeChannelId, setActiveChannelId,
    loadingChannels, reloadChannels, activeTab, setActiveTab, headerVisible,
  } = useHome();
  const [pushStatus, setPushStatus] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const root = document.querySelector('.home-screen');
    const header = root?.querySelector('.desktop-home-header');
    if (!root || !header) return;
    const updateShadow = () => {
      const scrollers = root.querySelectorAll<HTMLElement>('.home-column, .chats-fixture-list, .feed-screen');
      const scrolled = window.scrollY > 0 || Array.from(scrollers).some((node) => node.scrollTop > 0);
      header.classList.toggle('home-has-scrolled', scrolled);
    };
    const scrollers = root.querySelectorAll<HTMLElement>('.home-column, .chats-fixture-list, .feed-screen');
    scrollers.forEach((node) => node.addEventListener('scroll', updateShadow, { passive: true }));
    window.addEventListener('scroll', updateShadow, { passive: true });
    updateShadow();
    return () => {
      scrollers.forEach((node) => node.removeEventListener('scroll', updateShadow));
      window.removeEventListener('scroll', updateShadow);
      header.classList.remove('home-has-scrolled');
    };
  }, []);

  return (
    <div
      className="app-shell home-screen"
      style={{
        '--home-scrollbar-track': colors.background,
        '--home-scrollbar-thumb': colors.borderActive,
        '--home-text-primary': colors.textPrimary,
        '--home-text-secondary': colors.textSecondary,
        '--home-text-tertiary': colors.textTertiary,
        '--home-primary': colors.primary,
        '--home-primary-dim': colors.primaryDim,
        '--home-border': colors.border,
      } as CSSProperties}
    >
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

      <div className={`mobile-home-tabs ${headerVisible ? "home-header-visible" : "home-header-hidden"}`}>
        <FloatingPillTabBar active={activeTab} onChange={setActiveTab} />
      </div>

      <div className="workspace">
        <ProfileSidebar
          channels={channels}
          setActiveChannelId={setActiveChannelId}
          setActiveTab={setActiveTab}
          isLoggedIn={isLoggedIn}
        />

        <main className="home-columns no-scrollbar" aria-label="Home workspace">
          <section className={`home-column no-scrollbar chats-column ${activeTab === 'Chats' ? 'mobile-tab-active' : 'mobile-tab-hidden'}`} aria-label="Chats">
            <ChatsScreen />
          </section>
          <section className={`home-column no-scrollbar feed-column ${activeTab === 'Feed' ? 'mobile-tab-active' : 'mobile-tab-hidden'}`} aria-label="Feed">
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
