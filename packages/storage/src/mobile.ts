import { MMKV } from 'react-native-mmkv';
import type { KVStorage } from './types';

// npm install react-native-mmkv
// (falls back to AsyncStorage below if you'd rather not add a native dep)
const mmkv = new MMKV({ id: 'app-cache' });

export const mobileStorage: KVStorage = {
  getItem(key) {
    return mmkv.getString(key) ?? null;
  },
  setItem(key, value) {
    mmkv.set(key, value);
  },
  removeItem(key) {
    mmkv.delete(key);
  },
};

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