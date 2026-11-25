import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { KVStorage } from './types';

declare const __DEV__: boolean;
const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;
type MMKVStore = import('react-native-mmkv').MMKV;

let mmkv: MMKVStore | null = null;
let mmkvStartupError: unknown = null;
const fallback = new Map<string, string>();
const ENCRYPTION_KEY_ID = 'funspot.app-cache.encryption-key';
const SECURE_SESSION_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
} as const;

async function initializeEncryptedCache(): Promise<boolean> {
  try {
    let encryptionKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_ID);
    // Recover from an interrupted/older development build that stored a key
    // outside MMKV 2.12.x's strict 16-byte AES-128 limit.
    if (encryptionKey && !/^[\x21-\x7E]{16}$/.test(encryptionKey)) {
      await SecureStore.deleteItemAsync(ENCRYPTION_KEY_ID);
      encryptionKey = null;
    }
    if (!encryptionKey) {
      // MMKV 2.12.x uses AES-128 and accepts at most 16 UTF-8 bytes.
      // Use 16 printable ASCII characters so the native key is exactly
      // 16 bytes and has over 100 bits of random entropy.
      const bytes = await Crypto.getRandomBytesAsync(16);
      const alphabet = Array.from({ length: 94 }, (_, index) => String.fromCharCode(33 + index)).join('');
      encryptionKey = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
      await SecureStore.setItemAsync(ENCRYPTION_KEY_ID, encryptionKey, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    }

    const { MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    // Open the encrypted store first. Once the one-time migration marker is
    // present, normal launches avoid reopening and clearing the legacy plaintext
    // MMKV database (an unnecessary synchronous disk operation on every boot).
    mmkv = new MMKV({ id: 'app-cache-v2', encryptionKey });
    const migrationMarker = 'storage.migration.encrypted-cache-v2';
    if (mmkv.getBoolean(migrationMarker) !== true) {
      try {
        const legacy = new MMKV({ id: 'app-cache' });
        const legacyQuerySnapshot = legacy.getString('FUNSPOT_QUERY_CACHE');
        const [secureToken, secureUser] = await Promise.all([
          SecureStore.getItemAsync('auth.usertoken'),
          SecureStore.getItemAsync('auth.user'),
        ]);
        const legacyToken = legacy.getString('auth:usertoken');
        const legacyUser = legacy.getString('auth:user');
        if ((!secureToken || !secureUser) && legacyToken && legacyUser) {
          let migratedUser = legacyUser;
          const legacyPhone = legacy.getString('auth:phone');
          try {
            const parsed: unknown = JSON.parse(legacyUser);
            if (parsed && typeof parsed === 'object' && legacyPhone) {
              migratedUser = JSON.stringify({ ...(parsed as Record<string, unknown>), phone: legacyPhone });
            }
          } catch {
            // Preserve the original serialized user; AuthProvider validates it.
          }
          await SecureStore.setItemAsync('auth.usertoken', legacyToken, SECURE_SESSION_OPTIONS);
          await SecureStore.setItemAsync('auth.user', migratedUser, SECURE_SESSION_OPTIONS);
          const legacyRefresh = legacy.getString('auth:refreshToken');
          if (legacyRefresh) await SecureStore.setItemAsync('auth.refreshToken', legacyRefresh, SECURE_SESSION_OPTIONS);
        }
        if (legacyQuerySnapshot) mmkv.set('FUNSPOT_QUERY_CACHE', legacyQuerySnapshot);
        // Mark migration only after the encrypted destination is seeded.
        // If any step fails, keep the legacy store and retry next launch.
        legacy.clearAll();
        mmkv.set(migrationMarker, true);
      } catch {
        throw new Error('Unable to migrate legacy native session securely');
      }
    }
    for (const [key, value] of fallback) mmkv.set(key, value);
    fallback.clear();
    return true;
  } catch (error) {
    mmkvStartupError = error;
    if (isDevelopment) {
      console.warn('[storage] encrypted MMKV unavailable; using memory-only cache', error);
    }
    return false;
  }
}

/**
 * Resolves before QueryProvider mounts its persistence provider. The cache
 * never falls back to an unencrypted on-disk store if secure key setup fails.
 */
export const mobileStorageReady: Promise<boolean> = initializeEncryptedCache();

/** Synchronous encrypted cache for TanStack Query after mobileStorageReady. */
export const mobileCache = {
  getItem(key: string): string | null {
    if (fallback.has(key)) return fallback.get(key) ?? null;
    try {
      return mmkv?.getString(key) ?? null;
    } catch (error) {
      if (isDevelopment) console.warn('[storage] encrypted MMKV read failed', error);
      return null;
    }
  },
  setItem(key: string, value: string): void {
    if (!mmkv) {
      fallback.set(key, value);
      return;
    }
    try {
      mmkv.set(key, value);
    } catch (error) {
      // Preserve current-session behavior in memory if native persistence
      // becomes unavailable; never switch to an unencrypted disk fallback.
      fallback.set(key, value);
      if (isDevelopment) console.warn('[storage] encrypted MMKV write failed', error);
    }
  },
  removeItem(key: string): void {
    fallback.delete(key);
    try {
      mmkv?.delete(key);
    } catch (error) {
      if (isDevelopment) console.warn('[storage] encrypted MMKV delete failed', error);
    }
  },
};

export const mobileStorage: KVStorage = mobileCache;

export function isMobileCachePersistent(): boolean {
  return mmkv !== null && mmkvStartupError === null;
}
