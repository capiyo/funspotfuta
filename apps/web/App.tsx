import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { ToastProvider, useToast } from '@/lib/toast/toast-context';
import { QueryProvider } from './QueryProvider';
import { onForegroundMessage } from '@/lib/firebase';
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
import { WebNavbar } from '@/components/WebNavbar';

const Loading = () => <div className="flex min-h-screen items-center justify-center bg-fan-background"><div className="h-10 w-10 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" /></div>;


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
    <div className="sticky top-0 z-40"><WebNavbar /></div>
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/home" element={<HomeScreen />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/feed" element={<Navigate to="/home?tab=feed" replace />} />
      <Route path="/trending" element={<TrendingScreen />} />
      <Route path="/fixture/:matchId" element={<FixtureDetailScreen />} />
      <Route path="/chat" element={<Navigate to="/home?tab=chats" replace />} />
      <Route path="/history" element={<Protected><HistoryScreen /></Protected>} />
      <Route path="/profile" element={<Protected><ProfileModal /></Protected>} />
      <Route path="/profile/:profileId" element={<Protected><ProfileModal /></Protected>} />
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
