import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../lib/auth/auth-context';
import LoginPage from '../app/login/page';
import HomePage from '../app/(app)/home/page';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-fan-background">
      <div
        aria-label="Loading Funspot"
        role="status"
        className="h-10 w-10 animate-spin rounded-full border-2 border-fan-primary border-t-transparent"
      />
    </div>
  );
}

function RootRedirect() {
  const { isInitialized, isLoggedIn } = useAuth();
  if (!isInitialized) return <LoadingScreen />;
  return <Navigate to={isLoggedIn ? '/home' : '/login'} replace />;
}

function LoginRoute() {
  const { isInitialized, isLoggedIn } = useAuth();
  if (!isInitialized) return <LoadingScreen />;
  if (isLoggedIn) return <Navigate to="/home" replace />;
  return <LoginPage />;
}

function ProtectedHomeRoute() {
  const { isInitialized, isLoggedIn } = useAuth();
  if (!isInitialized) return <LoadingScreen />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <HomePage />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/home" element={<ProtectedHomeRoute />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
