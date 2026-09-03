'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

// Mirrors the original app_shell.dart: gate on AuthService.isLoggedIn once
// initialized, otherwise show the login modal.
export default function RootPage() {
  const { isInitialized, isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;
    router.replace(isLoggedIn ? '/home' : '/login');
  }, [isInitialized, isLoggedIn, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-funspot-bg">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-funspot-green border-t-transparent" />
    </div>
  );
}
