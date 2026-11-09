import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import PublicDocument from './screens/PublicDocument';
import { NotFoundPage } from './screens/PublicHome';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Funspot root element is missing.');
}

const renderMode = root.dataset.renderMode;

if (renderMode === 'app') {
  void import('./bootstrap-app').then(({ hydrateApp }) => hydrateApp(root));
} else if (renderMode === 'public-document') {
  hydrateRoot(root, <React.StrictMode>
    <PublicDocument path={root.dataset.pagePath ?? ''} contactEmail={root.dataset.contactEmail ?? ''} />
  </React.StrictMode>);
} else if (renderMode === 'not-found') {
  hydrateRoot(root, <React.StrictMode><NotFoundPage /></React.StrictMode>);
} else if (import.meta.env.DEV) {
  void import('./bootstrap-app').then(({ mountApp }) => mountApp(root));
}
