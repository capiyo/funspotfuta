// apps/mobile/lib/firebase.ts
import { Platform, PermissionsAndroid } from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import {
    getMessaging,
    requestPermission,
    getToken,
    onMessage,
    setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

// No initializeApp() call needed — @react-native-firebase auto-configures
// from google-services.json (Android) / GoogleService-Info.plist (iOS)
// at native build time. This file just exposes typed access to the modules.

export const firebaseAuth = getAuth();
export const firebaseMessaging = getMessaging();

// Values of messaging.AuthorizationStatus. The modular API only exports
// AuthorizationStatus as a type, so we compare against the numeric values.
const AUTHORIZED = 1;
const PROVISIONAL = 2;

export async function requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;
    }

    const authStatus = await requestPermission(firebaseMessaging);
    return authStatus === AUTHORIZED || authStatus === PROVISIONAL;
}

export async function requestFcmToken(): Promise<string | null> {
    const granted = await requestNotificationPermission();
    if (!granted) return null;
    try {
        return await getToken(firebaseMessaging);
    } catch (e) {
        console.error('FCM token request failed:', e);
        return null;
    }
}

export function onForegroundMessage(callback: (message: any) => void) {
    return onMessage(firebaseMessaging, callback);
}

// Register in index.js (app entry, outside any component) — mirrors
// FirebaseMessaging.onBackgroundMessage in the Flutter original.
export function registerBackgroundMessageHandler(handler: (message: any) => Promise<void>) {
    setBackgroundMessageHandler(firebaseMessaging, handler);
}