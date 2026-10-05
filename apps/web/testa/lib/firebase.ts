// apps/web/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: 'AIzaSyCWMGz6AIRXgu7GVZiJWlkvO6tVZADf5tY',
    authDomain: 'funzy-d56d7.firebaseapp.com',
    projectId: 'funzy-d56d7',
    storageBucket: 'funzy-d56d7.firebasestorage.app',
    messagingSenderId: '661929781606',
    appId: '1:661929781606:web:3f306a659ae64ac7f780a7',
    measurementId: 'G-J4JX2WVWH9',
};

const VAPID_KEY =
    'BIvcsdfnoQ07A2PAEiXvHfjLPOfyga-fiPB-JLJfdr7NbXxwWJMr6fNT-71RzUVP-WZcL76W_sN137Fs9wMhi90';

// Prevent re-initialization on hot reload / multiple imports
export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(firebaseApp);

// Messaging must only be touched in the browser — it depends on service
// worker + Notification APIs that don't exist during Next's server render
export function getMessagingIfSupported(): Messaging | null {
    if (typeof window === 'undefined') return null;
    try {
        return getMessaging(firebaseApp);
    } catch {
        return null; // browser doesn't support FCM (e.g. Safari <16.4, some in-app webviews)
    }
}

export async function requestFcmToken(): Promise<string | null> {
    const messaging = getMessagingIfSupported();
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration,
        });
        return token ?? null;
    } catch (e) {
        console.error('FCM token request failed:', e);
        return null;
    }
}

export function onForegroundMessage(callback: (payload: any) => void) {
    const messaging = getMessagingIfSupported();
    if (!messaging) return () => { };
    return onMessage(messaging, callback);
}