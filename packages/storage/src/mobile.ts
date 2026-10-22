import { MMKV } from 'react-native-mmkv';
import type { KVStorage } from './types';

// npm install react-native-mmkv
// (falls back to AsyncStorage below if you'd rather not add a native dep)
const mmkv = new MMKV({ id: 'app-cache' });

/** Synchronous MMKV access for startup-critical values such as auth state. */
export const mobileCache = {
  getItem(key: string): string | null {
    return mmkv.getString(key) ?? null;
  },
  setItem(key: string, value: string): void {
    mmkv.set(key, value);
  },
  removeItem(key: string): void {
    mmkv.delete(key);
  },
};

/** Async-compatible persistence contract used by the shared query cache. */
export const mobileStorage: KVStorage = mobileCache;

/**
 * Drop-in alternative if you don't want the MMKV native dependency yet.
 * Slower and fully async, but zero native linking required.
 *
 * import AsyncStorage from '@react-native-async-storage/async-storage';
 *
 * export const mobileStorageAsync: KVStorage = {
 *   getItem: (key) => AsyncStorage.getItem(key),
 *   setItem: (key, value) => AsyncStorage.setItem(key, value),
 *   removeItem: (key) => AsyncStorage.removeItem(key),
 * };
 */