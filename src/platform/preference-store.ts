import { Preferences } from "@capacitor/preferences";

export type PreferenceAdapter = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
};

export type PreferenceStore = {
  load: (onLoaded: (raw: string | null) => void) => Promise<void>;
  save: (serialized: string) => Promise<boolean>;
  isLoaded: () => boolean;
  markDirty: () => void;
  isDirty: () => boolean;
};

const defaultAdapter: PreferenceAdapter = {
  get: async (key) => (await Preferences.get({ key })).value,
  set: (key, value) => Preferences.set({ key, value }),
};

/**
 * Wraps a single Capacitor Preferences key behind a self-recovering FIFO write
 * queue and safe load handler. A rejected `get()` still marks the store loaded
 * with `null`, and a rejected `set()` (e.g. Safari Private Mode or quota error)
 * resolves to `false` without poisoning subsequent writes.
 */
export function createPreferenceStore(
  key: string,
  adapter: PreferenceAdapter = defaultAdapter,
): PreferenceStore {
  let queue: Promise<void> = Promise.resolve();
  let loaded = false;
  let dirty = false;

  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  const load = async (onLoaded: (raw: string | null) => void): Promise<void> => {
    let raw: string | null = null;
    try {
      raw = await adapter.get(key);
    } catch {
      raw = null;
    }
    loaded = true;
    onLoaded(raw);
  };

  const save = (serialized: string): Promise<boolean> =>
    enqueue(async () => {
      try {
        await adapter.set(key, serialized);
        return true;
      } catch {
        return false;
      }
    });

  return {
    load,
    save,
    isLoaded: () => loaded,
    markDirty: () => {
      dirty = true;
    },
    isDirty: () => dirty,
  };
}
