// GuruGraph — persistence adapter.
// Follows the Phase 1 local/offline architecture: localStorage when available,
// in-memory fallback when it is not (private mode, tests, SSR).

import type { GuruGraphStorage } from '../domain/types';

export function createMemoryStorage(seed: Record<string, string> = {}): GuruGraphStorage {
  const data = new Map<string, string>(Object.entries(seed));
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => {
      data.set(key, value);
    },
    remove: (key) => {
      data.delete(key);
    },
  };
}

export function createLocalStorageAdapter(): GuruGraphStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__gurugraph_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return {
      get: (key) => {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      set: (key, value) => {
        try {
          localStorage.setItem(key, value);
        } catch {
          // Storage full or blocked — intelligence stays in memory only.
        }
      },
      remove: (key) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Nothing to do.
        }
      },
    };
  } catch {
    return null;
  }
}

/** localStorage when usable, otherwise an in-memory store. */
export function defaultStorage(): GuruGraphStorage {
  return createLocalStorageAdapter() ?? createMemoryStorage();
}
