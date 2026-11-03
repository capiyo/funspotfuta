import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

const mode = process.argv[2] === 'development' ? 'development' : 'production';
const loadedEnv = loadEnv(mode, process.cwd(), 'VITE_');
const value = (key, fallback) => process.env[key] || loadedEnv[key] || fallback;

const config = {
  apiKey: value('VITE_FIREBASE_API_KEY', 'AIzaSyCWMGz6AIRXgu7GVZiJWlkvO6tVZADf5tY'),
  authDomain: value('VITE_FIREBASE_AUTH_DOMAIN', 'funzy-d56d7.firebaseapp.com'),
  projectId: value('VITE_FIREBASE_PROJECT_ID', 'funzy-d56d7'),
  storageBucket: value('VITE_FIREBASE_STORAGE_BUCKET', 'funzy-d56d7.firebasestorage.app'),
  messagingSenderId: value('VITE_FIREBASE_MESSAGING_SENDER_ID', '661929781606'),
  appId: value('VITE_FIREBASE_APP_ID', '1:661929781606:web:3f306a659ae64ac7f780a7'),
};

const output = resolve(process.cwd(), 'public/firebase-config.js');
writeFileSync(output, `self.FUNSPOT_FIREBASE_CONFIG = ${JSON.stringify(config)};\n`, 'utf8');
console.info(`[firebase] Generated ${mode} service-worker configuration`);
