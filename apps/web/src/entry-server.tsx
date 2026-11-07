import React from 'react';
import { renderToString } from 'react-dom/server';
import PublicHome, { NotFoundPage } from './screens/PublicHome';
import PublicDocument, { getPublicDocumentMetadata } from './screens/PublicDocument';

export function renderHome(): string {
  return renderToString(<PublicHome />);
}

export function renderNotFound(): string {
  return renderToString(<NotFoundPage />);
}

export function renderPublicDocument(path: string, contactEmail: string): string {
  return renderToString(<PublicDocument path={path} contactEmail={contactEmail} />);
}

export { getPublicDocumentMetadata };
