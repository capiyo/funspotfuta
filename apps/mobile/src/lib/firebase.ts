// React Native Firebase is optional for first paint: a stale native binary,
// missing Firebase native module, or emulator without Google services must not
// prevent the app shell from mounting. All native calls are guarded and the
// notification UI degrades to "not available" until a correctly configured
// native build is installed.
import { Platform, PermissionsAndroid } from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import {
    getMessaging,
    requestPermission,
    hasPermission,
    getToken,
    onMessage,
    setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

type FirebaseAuthInstance = ReturnType<typeof getAuth>;
type FirebaseMessagingInstance = ReturnType<typeof getMessaging>;

function safelyGetAuth(): FirebaseAuthInstance | null {
    try {
        return getAuth();
    } catch (error) {
        if (__DEV__) console.warn('[firebase] Auth native module unavailable', error);
        return null;
    }
}

function safelyGetMessaging(): FirebaseMessagingInstance | null {
    try {
        return getMessaging();
    } catch (error) {
        if (__DEV__) console.warn('[firebase] Messaging native module unavailable', error);
        return null;
    }
}

// Preserve these exports for callers that need the native instances, but never
// let a missing native module throw during import evaluation.
export const firebaseAuth = safelyGetAuth();
export const firebaseMessaging = safelyGetMessaging();

// Values of messaging.AuthorizationStatus. The modular API only exports
// AuthorizationStatus as a type, so we compare against the numeric values.
const AUTHORIZED = 1;
const PROVISIONAL = 2;

export async function hasNotificationPermission(): Promise<boolean> {
    if (!firebaseMessaging) return false;
    try {
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const granted = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );
            if (!granted) return false;
        }
        const authStatus = await hasPermission(firebaseMessaging);
        return authStatus === AUTHORIZED || authStatus === PROVISIONAL;
    } catch {
        return false;
    }
}

export async function requestNotificationPermission(): Promise<boolean> {
    if (!firebaseMessaging) return false;
    try {
        if (await hasNotificationPermission()) return true;

        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;
        }

        const authStatus = await requestPermission(firebaseMessaging);
        return authStatus === AUTHORIZED || authStatus === PROVISIONAL;
    } catch {
        return false;
    }
}

export async function requestFcmToken(): Promise<string | null> {
    if (!firebaseMessaging) return null;
    const granted = await requestNotificationPermission();
    if (!granted) return null;
    try {
        return await getToken(firebaseMessaging);
    } catch (error) {
        if (__DEV__) console.warn('[firebase] FCM token request failed', error);
        return null;
    }
}

export function onForegroundMessage(callback: Parameters<typeof onMessage>[1]): () => void {
    if (!firebaseMessaging) return () => undefined;
    try {
        return onMessage(firebaseMessaging, callback);
    } catch {
        return () => undefined;
    }
}

// Register in index.js (app entry, outside any component) — mirrors
// FirebaseMessaging.onBackgroundMessage in the Flutter original.
export function registerBackgroundMessageHandler(
    handler: Parameters<typeof setBackgroundMessageHandler>[1],
): void {
    if (!firebaseMessaging) return;
    try {
        setBackgroundMessageHandler(firebaseMessaging, handler);
    } catch (error) {
        if (__DEV__) console.warn('[firebase] Background handler registration skipped', error);
    }
}
