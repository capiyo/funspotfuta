import { getToken, onMessage } from 'firebase/messaging';
import { firebaseApp, getFirebaseMessaging, webFirebaseConfig } from '../firebase';

export type ForegroundNotice = { title: string; body: string; data?: Record<string, string> };

async function configureServiceWorker(registration: ServiceWorkerRegistration) {
  await navigator.serviceWorker.ready;
  const worker = registration.active ?? navigator.serviceWorker.controller;
  worker?.postMessage({ type: 'FUNSPOT_FIREBASE_CONFIG', config: webFirebaseConfig });
}

export async function requestWebPushToken(): Promise<string | null> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !firebaseApp) return null;
  if (Notification.permission === 'denied') return null;
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
  if (!vapidKey) throw new Error('VITE_FIREBASE_VAPID_KEY is not configured');
  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  await configureServiceWorker(registration);
  return getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
}

export async function listenForForegroundMessages(onNotice: (notice: ForegroundNotice) => void) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => undefined;
  return onMessage(messaging, (payload) => onNotice({
    title: payload.notification?.title ?? 'Funspot',
    body: payload.notification?.body ?? '',
    data: payload.data as Record<string, string> | undefined,
  }));
}