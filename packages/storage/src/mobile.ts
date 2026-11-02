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

async function initializeEncryptedCache(): Promise<boolean> {
  try {
    let encryptionKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_ID);
    if (!encryptionKey) {
      // MMKV 2.12.x uses AES-128 and accepts a 16-byte key.
      const bytes = await Crypto.getRandomBytesAsync(16);
      encryptionKey = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      await SecureStore.setItemAsync(ENCRYPTION_KEY_ID, encryptionKey, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    }

    const { MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    // Remove the legacy unencrypted store once the secure key is available.
    try {
      new MMKV({ id: 'app-cache' }).clearAll();
    } catch {
      // A missing legacy store is expected on fresh installs.
    }
    mmkv = new MMKV({ id: 'app-cache-v2', encryptionKey });
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
