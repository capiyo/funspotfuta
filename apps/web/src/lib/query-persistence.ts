import type { Persister, PersistedClient } from '@tanstack/query-persist-client-core';
import { compactPersistedClient, deserializePersistedClient, serializePersistedClient } from '@funspot/core';

const DATABASE_NAME = 'funspot-query-cache';
const STORE_NAME = 'persisted-clients';
const KEY_STORE_NAME = 'encryption-keys';
const CACHE_KEY = 'FUNSPOT_QUERY_CACHE';
const DATABASE_VERSION = 2;

type EncryptedSnapshot = { iv: Uint8Array; ciphertext: ArrayBuffer };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this environment'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(KEY_STORE_NAME)) db.createObjectStore(KEY_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open cache database'));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

async function getOrCreateEncryptionKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const request = db.transaction(KEY_STORE_NAME, 'readonly').objectStore(KEY_STORE_NAME).get(CACHE_KEY);
    request.onsuccess = () => resolve(request.result as CryptoKey | undefined);
    request.onerror = () => reject(request.error ?? new Error('Unable to read cache encryption key'));
  });
  if (existing) return existing;

  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable; refusing plaintext cache persistence');
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(KEY_STORE_NAME, 'readwrite');
    transaction.objectStore(KEY_STORE_NAME).put(key, CACHE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save cache encryption key'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Cache key save aborted'));
  });
  return key;
}

async function readClient(): Promise<PersistedClient | undefined> {
  const db = await openDatabase();
  try {
    const [snapshot, key] = await Promise.all([
      requestValue(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(CACHE_KEY)) as Promise<EncryptedSnapshot | string | undefined>,
      requestValue(db.transaction(KEY_STORE_NAME, 'readonly').objectStore(KEY_STORE_NAME).get(CACHE_KEY)) as Promise<CryptoKey | undefined>,
    ]);
    // Old plaintext snapshots are deliberately not restored. The caller will
    // fetch clean data and the old schema is invalidated by the cache buster.
    if (!snapshot || typeof snapshot === 'string' || !key) return undefined;
    if (!globalThis.crypto?.subtle) return undefined;
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: snapshot.iv },
      key,
      snapshot.ciphertext,
    );
    return deserializePersistedClient(new TextDecoder().decode(plaintext));
  } finally {
    db.close();
  }
}

async function writeClient(client: PersistedClient): Promise<void> {
  const db = await openDatabase();
  try {
    if (!globalThis.crypto?.subtle) throw new Error('Web Crypto unavailable; plaintext cache writes are disabled');
    const key = await getOrCreateEncryptionKey(db);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(serializePersistedClient(compactPersistedClient(client)));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ iv, ciphertext } satisfies EncryptedSnapshot, CACHE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to persist encrypted query cache'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Encrypted query cache write aborted'));
    });
  } finally {
    db.close();
  }
}

async function removeClient(): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, KEY_STORE_NAME], 'readwrite');
      transaction.objectStore(STORE_NAME).delete(CACHE_KEY);
      // Delete the non-extractable key as well: old snapshots cannot be
      // decrypted after logout/account-boundary cache invalidation.
      transaction.objectStore(KEY_STORE_NAME).delete(CACHE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to clear encrypted query cache'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Encrypted cache clearing aborted'));
    });
  } finally {
    db.close();
  }
}

const WRITE_THROTTLE_MS = 500;
let pendingClient: PersistedClient | undefined;
let writeTimer: ReturnType<typeof setTimeout> | undefined;
let writeInProgress = false;
let pendingWaiters: Array<() => void> = [];

function scheduleWrite(client: PersistedClient): Promise<void> {
  pendingClient = client;
  const completion = new Promise<void>((resolve) => pendingWaiters.push(resolve));
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = undefined;
    void flushPendingWrite();
  }, WRITE_THROTTLE_MS);
  return completion;
}

async function flushPendingWrite(): Promise<void> {
  if (writeInProgress || !pendingClient) return;
  writeInProgress = true;
  const client = pendingClient;
  pendingClient = undefined;
  const waiters = pendingWaiters;
  pendingWaiters = [];
  try {
    await writeClient(client);
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[query-cache] encrypted IndexedDB persist failed', error);
  } finally {
    writeInProgress = false;
    waiters.forEach((resolve) => resolve());
    if (pendingClient && !writeTimer) {
      writeTimer = setTimeout(() => {
        writeTimer = undefined;
        void flushPendingWrite();
      }, WRITE_THROTTLE_MS);
    }
  }
}

/** AES-GCM encrypted IndexedDB persister using a non-extractable origin key. */
export const indexedDbQueryPersister: Persister = {
  persistClient: (client) => scheduleWrite(client),
  restoreClient: async () => {
    try {
      return await readClient();
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[query-cache] encrypted IndexedDB restore failed', error);
      return undefined;
    }
  },
  removeClient: async () => {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = undefined;
    pendingClient = undefined;
    pendingWaiters.splice(0).forEach((resolve) => resolve());
    // Wait for an in-flight write before deleting both ciphertext and key.
    while (writeInProgress) await new Promise((resolve) => setTimeout(resolve, 10));
    try {
      await removeClient();
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[query-cache] encrypted IndexedDB clear failed', error);
    }
  },
};
