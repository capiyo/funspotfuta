import React from 'react';
import { renderToString } from 'react-dom/server';
import PublicHome, { NotFoundPage } from './screens/PublicHome';

export function renderHome(): string {
  return renderToString(<PublicHome />);
}

export function renderNotFound(): string {
  return renderToString(<NotFoundPage />);
}
