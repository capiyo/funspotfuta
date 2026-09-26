// apps/mobile/lib/firebase.ts
import { Platform } from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import {
    getMessaging,
    requestPermission,
    getToken,
    onMessage,
    setBackgroundMessageHandler,
    AuthorizationStatus,
} from '@react-native-firebase/messaging';

// No initializeApp() call needed — @react-native-firebase auto-configures
// from google-services.json (Android) / GoogleService-Info.plist (iOS)
// at native build time. This file just exposes typed access to the modules.

export const firebaseAuth = getAuth();
export const firebaseMessaging = getMessaging();

export async function requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
        const { PermissionsAndroid } = require('react-native');
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;
    }

    const authStatus = await requestPermission(firebaseMessaging);
    return (
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL
    );
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