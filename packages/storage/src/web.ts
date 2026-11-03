import type { KVStorage } from './types';

/**
 * Next.js / web storage adapter.
 * Guards against SSR (no `window` on the server).
 */
export const webStorage: KVStorage = {
  getItem(key) {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  setItem(key, value) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  removeItem(key) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};
