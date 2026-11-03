import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCWMGz6AIRXgu7GVZiJWlkvO6tVZADf5tY',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'funzy-d56d7.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'funzy-d56d7',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'funzy-d56d7.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '661929781606',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:661929781606:web:3f306a659ae64ac7f780a7',
};

const output = resolve(process.cwd(), 'public/firebase-config.js');
writeFileSync(output, `self.FUNSPOT_FIREBASE_CONFIG = ${JSON.stringify(config)};\n`, 'utf8');
console.info('[firebase] Generated service-worker configuration');
