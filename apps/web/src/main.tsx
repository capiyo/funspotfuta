import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { PERSIST_OPTIONS } from '@funspot/core';
import App from './App';
import PublicHomeContent from './components/PublicHomeContent';
import { indexedDbQueryPersister } from './lib/query-persistence';
import './styles.css';

const DAY = 24 * 60 * 60 * 1000;
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

const publicHome = document.getElementById('public-home');
if (publicHome?.hasChildNodes()) {
  hydrateRoot(
    publicHome,
    <React.StrictMode><PublicHomeContent /></React.StrictMode>,
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: indexedDbQueryPersister,
        maxAge: DAY,
        ...PERSIST_OPTIONS,
      }}
    >
      <BrowserRouter><App /></BrowserRouter>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
