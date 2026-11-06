import React from 'react';
import { renderToString } from 'react-dom/server';
import PublicHomeContent from './components/PublicHomeContent';

export function renderPublicHome(): string {
  return renderToString(<PublicHomeContent />);
}
