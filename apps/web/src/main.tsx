import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import PublicHome, { NotFoundPage } from './screens/PublicHome';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Funspot root element is missing.');
}

const renderMode = root.dataset.renderMode;

if (renderMode === 'public') {
  hydrateRoot(root, <React.StrictMode><PublicHome /></React.StrictMode>);
} else if (renderMode === 'not-found') {
  hydrateRoot(root, <React.StrictMode><NotFoundPage /></React.StrictMode>);
} else if (renderMode === 'app' || import.meta.env.DEV) {
  void import('./bootstrap-app').then(({ mountApp }) => mountApp(root));
}
