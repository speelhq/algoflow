// Every read and write of localStorage. Storage may be absent, full, or hold
// anything: a read returns undefined unless `parse` accepts the value, and a
// write that fails reports false instead of throwing out of a store's `set`.
import type { PersistStorage } from "zustand/middleware";

function store(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** The JSON under `key`, accepted by `parse`; undefined when absent, unreadable, or rejected. */
export function readStored<T>(
  key: string,
  parse: (stored: unknown) => T | undefined,
): T | undefined {
  try {
    const raw = store()?.getItem(key);
    return raw === null || raw === undefined ? undefined : parse(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/** Writes `value` as JSON; false when storage is absent or refuses it. */
export function writeStored(key: string, value: unknown): boolean {
  try {
    const target = store();
    if (!target) return false;
    target.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {
    // Nothing to remove from storage that cannot be reached.
  }
}

/** Every key in storage. */
export function storedKeys(): string[] {
  const target = store();
  if (!target) return [];
  const keys: string[] = [];
  for (let i = 0; i < target.length; i += 1) {
    const key = target.key(i);
    if (key !== null) keys.push(key);
  }
  return keys;
}

/**
 * A storage for zustand's `persist`: the key holds `encode(state)`, and `decode`
 * validates what is read back (undefined rejects it).
 */
export function persistStorage<S>(
  decode: (stored: unknown) => S | undefined,
  encode: (state: S) => unknown,
): PersistStorage<S> {
  return {
    getItem(name) {
      const state = readStored(name, decode);
      return state === undefined ? null : { state };
    },
    setItem(name, value) {
      writeStored(name, encode(value.state));
    },
    removeItem: removeStored,
  };
}
