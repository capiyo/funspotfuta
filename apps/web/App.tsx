import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { ToastProvider } from '@/lib/toast/toast-context';
import { QueryProvider } from '@/app/provider';
import RootPage from '@/app/page';
import LoginModal from '@/app/login/page';
import AppLayout from '@/app/(app)/layout';
import HomePage from '@/app/(app)/home/page';
import ChatPage from '@/app/(app)/chat/ChatRoutePage';
import FeedPage from '@/app/(app)/feed/page';
import TrendingPage from '@/app/(app)/trending/page';
import FixtureDetailPage from '@/app/(app)/fixture/[matchId]/page';
import HistoryPage from '@/app/(app)/history/page';
import ProfilePage from '@/app/(app)/profile/page';
import ComradesPage from '@/app/(app)/comrades/page';
import LeaderboardPage from '@/app/(app)/leaderboard/page';
import NotificationsPage from '@/app/(app)/notifications/page';
import AdminDashboardPage from '@/app/(app)/admin/[channelId]/page';

function LoginRoute() {
  const navigate = useNavigate();
  return (
    <LoginModal
      isOpen
      onClose={() => navigate('/', { replace: true })}
      onLoginSuccess={() => navigate('/home', { replace: true })}
    />
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isInitialized, isLoggedIn } = useAuth();
  if (!isInitialized) {
    return <div className="flex min-h-screen items-center justify-center bg-fan-background"><div className="h-10 w-10 animate-spin rounded-fan-pill border-2 border-fan-primary border-t-transparent" /></div>;
  }
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <QueryProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootPage />} />
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/home" element={<PrivateRoute><AppLayout><HomePage /></AppLayout></PrivateRoute>} />
              <Route path="/feed" element={<PrivateRoute><AppLayout><FeedPage /></AppLayout></PrivateRoute>} />
              <Route path="/chat" element={<PrivateRoute><AppLayout><ChatPage /></AppLayout></PrivateRoute>} />
              <Route path="/trending" element={<PrivateRoute><AppLayout><TrendingPage /></AppLayout></PrivateRoute>} />
              <Route path="/fixture/:matchId" element={<PrivateRoute><AppLayout><FixtureDetailPage /></AppLayout></PrivateRoute>} />
              <Route path="/history" element={<PrivateRoute><AppLayout><HistoryPage /></AppLayout></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute><AppLayout><ProfilePage /></AppLayout></PrivateRoute>} />
              <Route path="/comrades" element={<PrivateRoute><AppLayout><ComradesPage /></AppLayout></PrivateRoute>} />
              <Route path="/leaderboard" element={<PrivateRoute><AppLayout><LeaderboardPage /></AppLayout></PrivateRoute>} />
              <Route path="/notifications" element={<PrivateRoute><AppLayout><NotificationsPage /></AppLayout></PrivateRoute>} />
              <Route path="/admin/:channelId" element={<PrivateRoute><AppLayout><AdminDashboardPage /></AppLayout></PrivateRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </QueryProvider>
      </ToastProvider>
    </AuthProvider>
  );
}