import { useSyncExternalStore } from 'react';

// Tiny observable store, persisted to localStorage (web build only).

export type Store<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
};

export type PersistedStore<T> = Store<T> & {
  /** The localStorage key currently backing the store. */
  key: () => string;
  /** Switches to another key and loads its state. */
  load: (key: string) => void;
};

export function createPersistedStore<T>(
  initialKey: string,
  initial: T,
  /** Applied to state read from storage. */
  onLoad: (state: T) => T = (s) => s,
): PersistedStore<T> {
  let key = initialKey;
  let state = onLoad(readJson(key, initial));
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  return {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      // Written synchronously, so it's on disk before any request that depends on it.
      writeJson(key, state);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    key: () => key,
    load(nextKey) {
      key = nextKey;
      state = onLoad(readJson(key, initial));
      notify();
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode etc.): state still works in memory.
  }
}
