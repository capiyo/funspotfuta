// React Native Firebase is optional for first paint: a stale native binary,
// missing Firebase native module, or emulator without Google services must not
// prevent the app shell from mounting. Native packages are loaded lazily and
// every native call is guarded so notifications degrade gracefully.
import { Platform, PermissionsAndroid } from 'react-native';

type AuthModule = typeof import('@react-native-firebase/auth');
type MessagingModule = typeof import('@react-native-firebase/messaging');
type FirebaseAuthInstance = ReturnType<AuthModule['getAuth']>;
type FirebaseMessagingInstance = ReturnType<MessagingModule['getMessaging']>;

let cachedAuth: FirebaseAuthInstance | null = null;
let authAttempted = false;
let cachedMessagingModule: MessagingModule | null = null;
let messagingModuleAttempted = false;
let cachedMessaging: FirebaseMessagingInstance | null = null;
let messagingAttempted = false;

function getAuthModule(): AuthModule | null {
    try {
        return require('@react-native-firebase/auth') as AuthModule;
    } catch (error) {
        if (__DEV__) console.warn('[firebase] Auth native module unavailable', error);
        return null;
    }
}

function getMessagingModule(): MessagingModule | null {
    if (messagingModuleAttempted) return cachedMessagingModule;
    messagingModuleAttempted = true;
    try {
        cachedMessagingModule = require('@react-native-firebase/messaging') as MessagingModule;
    } catch (error) {
        if (__DEV__) console.warn('[firebase] Messaging package unavailable', error);
    }
    return cachedMessagingModule;
}

function safelyGetAuth(): FirebaseAuthInstance | null {
    if (authAttempted) return cachedAuth;
    authAttempted = true;
    try {
        const authModule = getAuthModule();
        if (authModule) cachedAuth = authModule.getAuth();
    } catch (error) {
        if (__DEV__) console.warn('[firebase] Auth initialization skipped', error);
    }
    return cachedAuth;
}

function safelyGetMessaging(): FirebaseMessagingInstance | null {
    if (messagingAttempted) return cachedMessaging;
    messagingAttempted = true;
    try {
        const messagingModule = getMessagingModule();
        if (messagingModule) cachedMessaging = messagingModule.getMessaging();
    } catch (error) {
        if (__DEV__) console.warn('[firebase] Messaging initialization skipped', error);
    }
    return cachedMessaging;
}

// Preserve these exports for callers that need native instances, but never
// let a missing native module throw during import evaluation.
export const firebaseAuth = safelyGetAuth();
export const firebaseMessaging = safelyGetMessaging();

// Values of messaging.AuthorizationStatus. The modular API exports the
// status enum only as a type in this version, so compare documented numeric values.
const AUTHORIZED = 1;
const PROVISIONAL = 2;

export async function hasNotificationPermission(): Promise<boolean> {
    const messaging = safelyGetMessaging();
    const module = getMessagingModule();
    if (!messaging || !module) return false;
    try {
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const granted = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );
            if (!granted) return false;
        }
        const authStatus = await module.hasPermission(messaging);
        return authStatus === AUTHORIZED || authStatus === PROVISIONAL;
    } catch {
        return false;
    }
}

export async function requestNotificationPermission(): Promise<boolean> {
    const messaging = safelyGetMessaging();
    const module = getMessagingModule();
    if (!messaging || !module) return false;
    try {
        if (await hasNotificationPermission()) return true;

        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;
        }

        const authStatus = await module.requestPermission(messaging);
        return authStatus === AUTHORIZED || authStatus === PROVISIONAL;
    } catch {
        return false;
    }
}

export async function requestFcmToken(): Promise<string | null> {
    const messaging = safelyGetMessaging();
    const module = getMessagingModule();
    if (!messaging || !module) return null;
    const granted = await requestNotificationPermission();
    if (!granted) return null;
    try {
        return await module.getToken(messaging);
    } catch (error) {
        if (__DEV__) console.warn('[firebase] FCM token request failed', error);
        return null;
    }
}

export function onForegroundMessage(
    callback: Parameters<MessagingModule['onMessage']>[1],
): () => void {
    const messaging = safelyGetMessaging();
    const module = getMessagingModule();
    if (!messaging || !module) return () => undefined;
    try {
        return module.onMessage(messaging, callback);
    } catch {
        return () => undefined;
    }
}

// Register in index.js (app entry, outside any component) — mirrors
// FirebaseMessaging.onBackgroundMessage in the Flutter original.
export function registerBackgroundMessageHandler(
    handler: Parameters<MessagingModule['setBackgroundMessageHandler']>[1],
): void {
    const messaging = safelyGetMessaging();
    const module = getMessagingModule();
    if (!messaging || !module) return;
    try {
        module.setBackgroundMessageHandler(messaging, handler);
    } catch (error) {
        if (__DEV__) console.warn('[firebase] Background handler registration skipped', error);
    }
}
