import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '@/modals/Login-modal-context';
import HomeScreen from '@/screens/home/HomeScreen';
import MessageScreen from '@/screens/MessageScreen';
import LoginModal from '@/modals/LoginModal';

/** Browser equivalent of the mobile RootNavigator. Only the mobile Tabs and
 * Chat destinations are registered here; the mobile screen names are kept. */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isInitialized, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  const location = useLocation();

  useEffect(() => {
    if (isInitialized && !isLoggedIn) requireLogin();
  }, [isInitialized, isLoggedIn, requireLogin, location.pathname]);

  if (!isInitialized) return <div className="loading-screen" role="status" aria-label="Loading"><span className="spinner" /></div>;
  if (!isLoggedIn) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return children;
}

export default function RootNavigator() {
  const { isInitialized, isLoggedIn } = useAuth();
  if (!isInitialized) return <div className="loading-screen" role="status" aria-label="Loading"><span className="spinner" /></div>;

  return <Routes>
    <Route path="/" element={<HomeScreen />} />
    <Route path="/messages/:channelId?" element={<ProtectedRoute><MessageScreen /></ProtectedRoute>} />
    <Route path="/login" element={isLoggedIn ? <Navigate to="/" replace /> : <LoginModal />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
