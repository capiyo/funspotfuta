/**
 * Platform-agnostic key/value storage contract.
 * packages/core depends ONLY on this interface — never on
 * localStorage, MMKV, or AsyncStorage directly.
 */
export interface KVStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}
