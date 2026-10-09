import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { UserRound, MessageCircle, Newspaper, History } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { ToastProvider } from '@/lib/toast/toast-context';
import { QueryProvider } from './QueryProvider';
import { onForegroundMessage } from '@/lib/firebase';
import { registerToken } from '@funspot/core';
import { requestFcmToken } from '@/lib/firebase';
import HomeScreen from '@/src/screens/home/HomeScreen';
import FeedScreen from '@/src/screens/FeedScreen';
import TrendingScreen from '@/src/screens/TrendingScreen';
import FixtureDetailScreen from '@/src/screens/FixtureDetailScreen';
import HistoryScreen from '@/src/screens/HistoryScreen';
import LoginScreen from '@/src/screens/LoginScreen';
import ProfileModal from '@/src/modals/profile/ProfileModal';
import ComradesModal from '@/src/modals/ComradesModal';
import LeaderboardModal from '@/src/modals/LeaderboardModal';
import NotificationsModal from '@/src/modals/NotificationsModal';
import AdminModal from '@/src/modals/AdminModal';

const Loading = () => <div className="flex min-h-screen items-center justify-center bg-fan-background"><div className="h-10 w-10 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" /></div>;

function SiteNavbar() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const items = [
    { label: 'Profile', path: '/profile', Icon: UserRound, protected: true },
    { label: 'Chats', path: '/home?tab=chats', Icon: MessageCircle, protected: false },
    { label: 'Feed', path: '/home?tab=feed', Icon: Newspaper, protected: false },
    { label: 'Logs', path: '/home?tab=logs', Icon: History, protected: false },
  ];
  return (
    <nav aria-label="Main navigation" className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-fan-border/60 bg-fan-surfaceElevated px-4">
      {items.map(({ label, path, Icon, protected: needsLogin }) => {
        const active = label === 'Profile' ? location.pathname === '/profile' : location.pathname === '/home' && (new URLSearchParams(location.search).get('tab') ?? 'chats') === label.toLowerCase();
        return <button key={label} aria-label={label} title={label} onClick={() => navigate(needsLogin && !isLoggedIn ? `/login?next=${encodeURIComponent(path)}` : path)} className={`flex h-10 items-center gap-2 rounded-lg px-3 text-sm transition-colors ${active ? 'bg-fan-primaryDim text-fan-primary' : 'text-fan-textSecondary hover:bg-fan-surfaceSunken hover:text-fan-textPrimary'}`}>
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
        </button>;
      })}
      <div className="flex-1" />
      <button onClick={() => navigate('/home')} aria-label="Home" className="rounded-lg p-2 text-fan-textTertiary hover:text-fan-primary"><span className="sr-only">Home</span><span aria-hidden="true">⌂</span></button>
    </nav>
  );
}

function LoginRoute() {
  const nav = useNavigate();
  const location = useLocation();
  const { isInitialized, isLoggedIn } = useAuth();
  const next = new URLSearchParams(location.search).get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') && next !== '/login' ? next : '/home';
  if (!isInitialized) return <Loading />;
  if (isLoggedIn) return <Navigate to={safeNext} replace />;
  return <div className="min-h-[calc(100vh-3.5rem)] bg-fan-background"><HomeScreen /><LoginScreen isOpen onClose={() => nav('/home')} onLoginSuccess={() => nav(safeNext, { replace: true })} /></div>;
}

function Protected({ children }: { children: React.ReactNode }) {
  const { isInitialized, isLoggedIn } = useAuth();
  const location = useLocation();
  if (!isInitialized) return <Loading />;
  if (!isLoggedIn) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return <>
    <SiteNavbar />
    <Routes>
      <Route path="/" element={<Navigate to="/home?tab=chats" replace />} />
      <Route path="/home" element={<HomeScreen />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/feed" element={<Navigate to="/home?tab=feed" replace />} />
      <Route path="/trending" element={<TrendingScreen />} />
      <Route path="/fixture/:matchId" element={<FixtureDetailScreen />} />
      <Route path="/chat" element={<Navigate to="/home?tab=chats" replace />} />
      <Route path="/history" element={<Protected><HistoryScreen /></Protected>} />
      <Route path="/profile" element={<Protected><ProfileModal /></Protected>} />
      <Route path="/comrades" element={<Protected><ComradesModal /></Protected>} />
      <Route path="/leaderboard" element={<Protected><LeaderboardModal visible onClose={() => {}} /></Protected>} />
      <Route path="/notifications" element={<Protected><NotificationsModal /></Protected>} />
      <Route path="/admin/:channelId" element={<Protected><AdminModal /></Protected>} />
      <Route path="/arena" element={<Navigate to="/home?tab=chats" replace />} />
      <Route path="/logs" element={<Protected><Navigate to="/history" replace /></Protected>} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  </>;
}

function ForegroundNotifications() {
  const { isLoggedIn } = useAuth();
  const toast = useToast();
  useEffect(() => {
    if (!isLoggedIn) return;
    return onForegroundMessage((payload) => {
      const title = payload?.notification?.title ?? 'New notification';
      const body = payload?.notification?.body;
      toast.showInfo(body ? `${title}: ${body}` : title);
    });
  }, [isLoggedIn]);
  return null;
}

function App() {
  return <AuthProvider><ToastProvider><QueryProvider><BrowserRouter><ForegroundNotifications /><AppRoutes /></BrowserRouter></QueryProvider></ToastProvider></AuthProvider>;
}
export default App;
