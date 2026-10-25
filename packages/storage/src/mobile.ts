import { MMKV } from 'react-native-mmkv';
import type { KVStorage } from './types';

// MMKV is the preferred synchronous cache, but a stale or partially installed
// native binary must not take the whole app down before React can render.
// In that case use a process-local fallback; AuthProvider can still restore
// legacy sessions from AsyncStorage and the app remains usable until a native
// build with MMKV correctly linked is installed.
type MMKVStore = InstanceType<typeof MMKV>;

let mmkv: MMKVStore | null = null;
let mmkvStartupError: unknown = null;

try {
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
    try {
      return mmkv?.getString(key) ?? fallback.get(key) ?? null;
    } catch (error) {
      if (__DEV__) console.warn('[storage] MMKV read failed; using fallback', error);
      return fallback.get(key) ?? null;
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
