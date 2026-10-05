import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/auth-context';

export default function RootPage() {
  const { isInitialized, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isInitialized) return;
    navigate(isLoggedIn ? '/home' : '/login', { replace: true });
  }, [isInitialized, isLoggedIn, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-fan-background">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" />
    </div>
  );
}