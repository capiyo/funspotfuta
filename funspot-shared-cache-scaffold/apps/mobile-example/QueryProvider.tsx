import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { createAppQueryClient } from '@funspot/core';
import { mobileStorage } from '@funspot/storage';

/**
 * RN equivalent of your Flutter `didChangeAppLifecycleState` /
 * startAppCacheRefresh / stopAppCacheRefresh dance: when the app
 * comes back to the foreground, tell TanStack to treat it like a
 * focus event so staleTime-eligible queries refetch automatically.
 * No manual Timer.periodic needed.
 */
function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === 'active');
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createAppQueryClient(mobileStorage));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
