'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { BottomNav } from '@/components/BottomNav';
import { ChannelCreationModal } from '@/components/ChannelCreationModal';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isInitialized, isLoggedIn } = useAuth();
  const router = useRouter();
  const [showCreateChannel, setShowCreateChannel] = useState(false);

  useEffect(() => {
    if (isInitialized && !isLoggedIn) router.replace('/login');
  }, [isInitialized, isLoggedIn, router]);

  if (!isInitialized || !isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-funspot-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-funspot-green border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-funspot-bg">
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>
      <div className="fixed bottom-0 left-0 right-0">
        <BottomNav onAddPressed={() => setShowCreateChannel(true)} />
      </div>
      {showCreateChannel && <ChannelCreationModal onClose={() => setShowCreateChannel(false)} />}
    </div>
  );
}
