import type { KVStorage } from './types';

// Keep the native package load inside the guarded block too. Some mismatched
// Android binaries throw while react-native-mmkv's JS module is evaluated,
// before new MMKV() is reached; a static value import would bypass the fallback.
type MMKVStore = import('react-native-mmkv').MMKV;

let mmkv: MMKVStore | null = null;
let mmkvStartupError: unknown = null;

try {
  const { MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
  mmkv = new MMKV({ id: 'app-cache' });
} catch (error) {
  mmkvStartupError = error;
  if (__DEV__) {
    console.warn('[storage] MMKV native store unavailable; using an in-memory startup fallback', error);
  }
}

const fallback = new Map<string, string>();

/** Synchronous cache for startup-critical values such as auth state. */
export const mobileCache = {
  getItem(key: string): string | null {
    if (fallback.has(key)) return fallback.get(key) ?? null;
    try {
      return mmkv?.getString(key) ?? null;
    } catch (error) {
      if (__DEV__) console.warn('[storage] MMKV read failed; using fallback', error);
      return null;
    }
  },
  setItem(key: string, value: string): void {
    fallback.set(key, value);
    try {
      mmkv?.set(key, value);
    } catch (error) {
      if (__DEV__) console.warn('[storage] MMKV write failed; retaining in-memory value', error);
    }
  },
  removeItem(key: string): void {
    fallback.delete(key);
    try {
      mmkv?.delete(key);
    } catch (error) {
      if (__DEV__) console.warn('[storage] MMKV delete failed', error);
    }
  },
};

/** Async-compatible persistence contract used by the shared query cache. */
export const mobileStorage: KVStorage = mobileCache;

/** Whether the synchronous native cache initialized successfully. */
export function isMobileCachePersistent(): boolean {
  return mmkv !== null && mmkvStartupError === null;
}
