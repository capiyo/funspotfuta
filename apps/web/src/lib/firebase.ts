import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

// These public client settings match the working Flutter app's generated
// FirebaseOptions.web for project funzy-d56d7. Build-time variables can override
// them, but a missing Netlify variable must not silently disable authentication.
export const webFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCWMGz6AIRXgu7GVZiJWlkvO6tVZADf5tY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'funzy-d56d7.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'funzy-d56d7',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'funzy-d56d7.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '661929781606',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:661929781606:web:3f306a659ae64ac7f780a7',
};

export const missingFirebaseEnvVars: string[] = [];

export const firebaseApp = getApps().length ? getApp() : initializeApp(webFirebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);

export async function getFirebaseMessaging() {
  if (!('serviceWorker' in navigator) || !(await isSupported())) return null;
  return getMessaging(firebaseApp);
}
