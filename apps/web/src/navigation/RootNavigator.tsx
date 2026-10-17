import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth/auth-context';
import { useLoginModal } from '@/modals/Login-modal-context';
import HomeScreen from '@/screens/home/HomeScreen';
import MessageScreen from '@/screens/MessageScreen';

/**
 * Browser route counterpart to mobile RootNavigator.
 * Mobile exposes Tabs (HomeScreen) and Chat (MessageScreen); the browser
 * preserves those screen identities while using URLs for deep linking.
 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isInitialized, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  const location = useLocation();

  useEffect(() => {
    if (isInitialized && !isLoggedIn) requireLogin();
  }, [isInitialized, isLoggedIn, requireLogin, location.pathname]);

  if (!isInitialized) {
    return <div className="loading-screen" role="status" aria-label="Loading">
      <span className="spinner" />
    </div>;
  }
  if (!isLoggedIn) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return children;
}

function LoginRoute() {
  const { isInitialized, isLoggedIn } = useAuth();
  const { requireLogin } = useLoginModal();
  useEffect(() => {
    if (isInitialized && !isLoggedIn) requireLogin();
  }, [isInitialized, isLoggedIn, requireLogin]);
  return <Navigate to="/" replace />;
}

export default function RootNavigator() {
  const { isInitialized } = useAuth();

  if (!isInitialized) {
    return <div className="loading-screen" role="status" aria-label="Loading">
      <span className="spinner" />
    </div>;
  }

  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/messages/:channelId?" element={
        <ProtectedRoute><MessageScreen /></ProtectedRoute>
      } />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
