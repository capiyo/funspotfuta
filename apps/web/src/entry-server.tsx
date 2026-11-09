import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { QueryClient, QueryClientProvider, dehydrate } from '@tanstack/react-query';
import { feedQueryOptions, getAllChannels, getAllFixtures, queryKeys } from '@funspot/core';
import App from './App';
import PublicDocument, { getPublicDocumentMetadata } from './screens/PublicDocument';
import { NotFoundPage } from './screens/PublicHome';

function encodeQueryState(value: unknown): unknown {
  if (value instanceof Date) return { __funspotSerializedDate: value.toISOString() };
  if (Array.isArray(value)) return value.map(encodeQueryState);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeQueryState(item)]));
  }
  return value;
}

export type ServerRenderedApp = { markup: string; queryState: string };

export async function renderApp(location = '/'): Promise<ServerRenderedApp> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const prefetch = Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: queryKeys.fixtures(),
      queryFn: ({ signal }) => getAllFixtures(signal),
      staleTime: 60_000,
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.channels(),
      queryFn: ({ signal }) => getAllChannels(undefined, signal),
      staleTime: 5 * 60_000,
    }),
    queryClient.prefetchQuery({
      queryKey: ['channels', 'browsable'],
      queryFn: ({ signal }) => getAllChannels(undefined, signal),
      staleTime: 5 * 60_000,
    }),
    queryClient.prefetchInfiniteQuery(feedQueryOptions(10)),
  ]);

  let deadline: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    prefetch,
    new Promise<void>((resolve) => {
      deadline = setTimeout(() => {
        void queryClient.cancelQueries().finally(resolve);
      }, 2200);
    }),
  ]);
  if (deadline) clearTimeout(deadline);

  const markup = renderToString(
    <QueryClientProvider client={queryClient}>
      <StaticRouter location={location}>
        <App initialAuthState={{ isInitialized: true }} />
      </StaticRouter>
    </QueryClientProvider>,
  );
  const queryState = JSON.stringify(encodeQueryState(dehydrate(queryClient)))
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
  return { markup, queryState };
}

export function renderNotFound(): string {
  return renderToString(<NotFoundPage />);
}

export function renderPublicDocument(path: string, contactEmail: string): string {
  return renderToString(<PublicDocument path={path} contactEmail={contactEmail} />);
}

export { getPublicDocumentMetadata };
