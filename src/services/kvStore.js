import { createStore, del, get, keys, set } from 'idb-keyval';

/*
 * The key-value store persistence.js writes to (D52). Four methods, two implementations:
 *
 *   createIdbStore()     the browser's IndexedDB through idb-keyval (unchanged from before)
 *   createMemoryStore()  a Map, for unit tests (replaces the fake-indexeddb test dependency)
 *
 * No silent in-memory fallback in the browser: if IndexedDB is blocked, saving fails and the top
 * bar says "Not saved", which is the truth.
 *
 * Same database and store as before (`ai-presentation-builder` / `kv`), so saved decks open
 * unchanged; no migration.
 *
 * @typedef {{ get: (key: string) => Promise<any>, set: (key: string, value: any) => Promise<void>,
 *   del: (key: string) => Promise<void>, keys: () => Promise<string[]> }} KvStore
 */

export const DB_NAME = 'ai-presentation-builder';
export const STORE_NAME = 'kv';

/** @returns {KvStore} */
export function createIdbStore(name = DB_NAME, storeName = STORE_NAME) {
  const store = createStore(name, storeName);
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
    keys: () => keys(store),
  };
}

/**
 * Values are copied with structuredClone on the way in and out, as IndexedDB does, so a test
 * can't pass by accidentally sharing an object with the store.
 * @returns {KvStore}
 */
export function createMemoryStore() {
  const map = new Map();
  return {
    get: async (key) => (map.has(key) ? structuredClone(map.get(key)) : undefined),
    set: async (key, value) => {
      map.set(key, structuredClone(value));
    },
    del: async (key) => {
      map.delete(key);
    },
    keys: async () => [...map.keys()],
  };
}
