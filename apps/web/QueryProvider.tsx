import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAppQueryClient } from '@funspot/core';
import { webStorage } from '@funspot/storage';

// Share one persisted client across the browser app, matching the mobile
// provider's cache restore behavior while using browser-compatible storage.
const { queryClient, persistOptions } = createAppQueryClient(webStorage);

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}
