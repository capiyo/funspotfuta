import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth/auth-context';
import LoginModal from '../app/login/page';
import HomePage from '../app/(app)/home/page';
import TrendingPage from '../app/(app)/trending/page';
import FeedPage from '../app/(app)/feed/page';
import ComradesPage from '../app/(app)/comrades/page';
import FixtureDetailPage from '../app/(app)/fixture/[matchId]/page';
import HistoryPage from '../app/(app)/history/page';
import LeaderboardPage from '../app/(app)/leaderboard/page';
import NotificationsPage from '../app/(app)/notifications/page';
import ProfilePage from '../app/(app)/profile/page';
import AdminDashboardPage from '../app/(app)/admin/[channelId]/page';

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center bg-fan-background"><div aria-label="Loading Funspot" role="status" className="h-10 w-10 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" /></div>;
}

function RootRedirect() {
  const { isInitialized, isLoggedIn } = useAuth();
  if (!isInitialized) return <LoadingScreen />;
  return <Navigate to={isLoggedIn ? '/home' : '/login'} replace />;
}

function LoginRoute() {
  const { isInitialized, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  if (!isInitialized) return <LoadingScreen />;
  if (isLoggedIn) return <Navigate to="/home" replace />;
  return <LoginModal isOpen onClose={() => navigate('/')} onLoginSuccess={() => navigate('/home', { replace: true })} />;
}

function Protected({ children }: { children: React.ReactNode }) {
  const { isInitialized, isLoggedIn } = useAuth();
  if (!isInitialized) return <LoadingScreen />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return <Routes>
    <Route path="/" element={<RootRedirect />} />
    <Route path="/login" element={<LoginRoute />} />
    <Route path="/home" element={<Protected><HomePage /></Protected>} />
    <Route path="/trending" element={<Protected><TrendingPage /></Protected>} />
    <Route path="/feed" element={<Protected><FeedPage /></Protected>} />
    <Route path="/comrades" element={<Protected><ComradesPage /></Protected>} />
    <Route path="/fixture/:matchId" element={<Protected><FixtureDetailPage /></Protected>} />
    <Route path="/history" element={<Protected><HistoryPage /></Protected>} />
    <Route path="/leaderboard" element={<Protected><LeaderboardPage /></Protected>} />
    <Route path="/notifications" element={<Protected><NotificationsPage /></Protected>} />
    <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
    <Route path="/admin/:channelId" element={<Protected><AdminDashboardPage /></Protected>} />
    <Route path="*" element={<RootRedirect />} />
  </Routes>;
}
