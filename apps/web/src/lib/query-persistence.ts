import type { Persister, PersistedClient } from '@tanstack/query-persist-client-core';
import { deserializePersistedClient, serializePersistedClient } from '@funspot/core';

const DATABASE_NAME = 'funspot-query-cache';
const STORE_NAME = 'persisted-clients';
const CACHE_KEY = 'FUNSPOT_QUERY_CACHE';
const DATABASE_VERSION = 1;

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
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open cache database'));
  });
}

async function readClient(): Promise<PersistedClient | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(CACHE_KEY);
      request.onsuccess = () => {
        const value = request.result;
        if (typeof value !== 'string') {
          resolve(undefined);
          return;
        }
        try {
          resolve(deserializePersistedClient(value));
        } catch {
          resolve(undefined);
        }
      };
      request.onerror = () => reject(request.error ?? new Error('Unable to read persisted query cache'));
    });
  } finally {
    db.close();
  }
}

async function writeClient(client: PersistedClient): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const serialized = serializePersistedClient(client);
      transaction.objectStore(STORE_NAME).put(serialized, CACHE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to persist query cache'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Query cache persistence aborted'));
    });
  } finally {
    db.close();
  }
}

async function removeClient(): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(CACHE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to clear persisted query cache'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Query cache clearing aborted'));
    });
  } finally {
    db.close();
  }
}

/** IndexedDB-backed TanStack persister; no additional storage dependency. */
export const indexedDbQueryPersister: Persister = {
  persistClient: async (client) => {
    try {
      await writeClient(client);
    } catch (error) {
      // Storage can be disabled (private browsing, quota). Keep the app usable.
      if (import.meta.env.DEV) console.warn('[query-cache] IndexedDB persist failed', error);
    }
  },
  restoreClient: async () => {
    try {
      return await readClient();
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[query-cache] IndexedDB restore failed', error);
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      await removeClient();
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[query-cache] IndexedDB clear failed', error);
    }
  },
};
