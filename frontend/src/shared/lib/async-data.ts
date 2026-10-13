import { useCallback, useEffect, useSyncExternalStore } from 'react';

// A small cache for data loaded from the API, shared by every component that uses
// the same key: repeated visits render cached data at once and refresh it quietly.

type Entry = { data?: unknown; error?: unknown; loading: boolean; stale: boolean };

const IDLE: Entry = { loading: false, stale: true };
const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const loaders = new Map<string, () => Promise<unknown>>();
const versions = new Map<string, number>();

function setEntry(key: string, entry: Entry) {
  entries.set(key, entry);
  listeners.get(key)?.forEach((listener) => listener());
}

function load(key: string, loader: () => Promise<unknown>) {
  loaders.set(key, loader);
  // Only the latest request for a key may write its result.
  const version = (versions.get(key) ?? 0) + 1;
  versions.set(key, version);
  const current = entries.get(key);
  setEntry(key, { data: current?.data, loading: true, stale: false });
  loader().then(
    (data) =>
      versions.get(key) === version && setEntry(key, { data, loading: false, stale: false }),
    (error: unknown) =>
      versions.get(key) === version &&
      setEntry(key, { data: current?.data, error, loading: false, stale: false }),
  );
}

export type AsyncData<T> = {
  data: T | undefined;
  error: unknown;
  /** True until the first result (or error) for the key arrives. */
  loading: boolean;
  reload: () => void;
};

/**
 * Loads data for `key` with `loader` and keeps it in the shared cache.
 * `loader` must be stable for a given key (wrap it in useCallback).
 * A `null` key means "nothing to load", e.g. a guest has no favorites.
 */
export function useAsyncData<T>(key: string | null, loader: () => Promise<T>): AsyncData<T> {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (key === null) return () => {};
      const set = listeners.get(key) ?? new Set();
      listeners.set(key, set);
      set.add(listener);
      return () => set.delete(listener);
    },
    [key],
  );
  const entry = useSyncExternalStore(subscribe, () =>
    key === null ? IDLE : (entries.get(key) ?? IDLE),
  );

  useEffect(() => {
    if (key !== null && (entries.get(key) ?? IDLE).stale) load(key, loader);
  }, [key, loader]);

  const reload = useCallback(() => {
    if (key !== null) load(key, loader);
  }, [key, loader]);

  return {
    data: entry.data as T | undefined,
    error: entry.error,
    loading: key !== null && entry.data === undefined && entry.error === undefined,
    reload,
  };
}

/** Replaces cached data, e.g. for an optimistic update. */
export function updateAsyncData<T>(key: string, update: (data: T | undefined) => T) {
  const current = entries.get(key) ?? IDLE;
  setEntry(key, { ...current, data: update(current.data as T | undefined) });
}

/** Reloads matching entries that are on screen; others reload when next used. */
export function invalidateAsyncData(match: (key: string) => boolean) {
  for (const [key, entry] of entries) {
    if (!match(key)) continue;
    const loader = loaders.get(key);
    if (loader && listeners.get(key)?.size) load(key, loader);
    else entries.set(key, { ...entry, stale: true });
  }
}

/** Forgets matching entries, e.g. a user's data after logout. */
export function clearAsyncData(match: (key: string) => boolean) {
  for (const key of [...entries.keys()]) {
    if (!match(key)) continue;
    versions.set(key, (versions.get(key) ?? 0) + 1);
    setEntry(key, IDLE);
    entries.delete(key);
  }
}
