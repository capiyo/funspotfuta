import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

export const webFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Vite injects VITE_* values during the Netlify build. .env.example is documentation
// only; it is not loaded as configuration and must never be imported by the app.
const requiredFirebaseEnv = {
  VITE_FIREBASE_API_KEY: webFirebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: webFirebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID: webFirebaseConfig.projectId,
  VITE_FIREBASE_APP_ID: webFirebaseConfig.appId,
} as const;

export const missingFirebaseEnvVars = Object.entries(requiredFirebaseEnv)
  .filter(([, value]) => !value?.trim())
  .map(([name]) => name);

const configured = missingFirebaseEnvVars.length === 0;

if (!configured) {
  console.error(
    '[Firebase] Missing build-time environment variables:',
    missingFirebaseEnvVars.join(', '),
    'Check Netlify variable scopes for this deploy context, then trigger a new deploy.',
  );
}

export const firebaseApp = getApps().length ? getApp() : configured ? initializeApp(webFirebaseConfig) : null;
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null;

export async function getFirebaseMessaging() {
  if (!firebaseApp || !('serviceWorker' in navigator) || !(await isSupported())) return null;
  return getMessaging(firebaseApp);
}
