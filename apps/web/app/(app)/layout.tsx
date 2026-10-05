import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/auth-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isInitialized, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isInitialized && !isLoggedIn) navigate('/login', { replace: true });
  }, [isInitialized, isLoggedIn, navigate]);

  if (!isInitialized || !isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fan-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}