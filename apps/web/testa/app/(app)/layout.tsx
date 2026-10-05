'use client';

// The real web app (home_page_web.dart) has no persistent bottom tab
// bar — that's a mobile-only pattern (home_page.dart's 3-item
// arena/feed/logs nav). On web, navigation happens via the navbar's
// channel chips and avatar menu (see WebNavbar), and /home itself
// renders the full navbar+sidebar+3-column shell. This layout now just
// handles the auth gate for every route under (app)/.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isInitialized, isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && !isLoggedIn) router.replace('/login');
  }, [isInitialized, isLoggedIn, router]);

  if (!isInitialized || !isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fan-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-fan-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
