import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { PERSIST_OPTIONS } from '@funspot/core';
import App from './App';
import { indexedDbQueryPersister } from './lib/query-persistence';

const DAY = 24 * 60 * 60 * 1000;

export function mountApp(root: HTMLElement): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        staleTime: 5 * 60 * 1000,
        gcTime: DAY,
        networkMode: 'offlineFirst',
        placeholderData: (previousData: unknown) => previousData,
      },
      mutations: { networkMode: 'offlineFirst' },
    },
  });

  createRoot(root).render(
    <React.StrictMode>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: indexedDbQueryPersister,
          maxAge: DAY,
          ...PERSIST_OPTIONS,
        }}
      >
        <BrowserRouter basename={import.meta.env.DEV ? '/' : '/app'}>
          <App />
        </BrowserRouter>
      </PersistQueryClientProvider>
    </React.StrictMode>,
  );
}
