import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import PublicDocument, { getPublicDocumentMetadata } from './screens/PublicDocument';
import { NotFoundPage } from './screens/PublicHome';

export function renderApp(location = '/'): string {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <StaticRouter location={location}>
        <App initialAuthState={{ isInitialized: true }} />
      </StaticRouter>
    </QueryClientProvider>,
  );
}

export function renderNotFound(): string {
  return renderToString(<NotFoundPage />);
}

export function renderPublicDocument(path: string, contactEmail: string): string {
  return renderToString(<PublicDocument path={path} contactEmail={contactEmail} />);
}

export { getPublicDocumentMetadata };
