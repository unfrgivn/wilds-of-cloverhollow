import { Preferences } from "@capacitor/preferences";

export type SaveMeta = {
  tick: number;
  hash: string;
};

export type SaveStorageAdapter = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

export type SaveStore = {
  load: () => Promise<string | null>;
  write: (serialized: string, meta: SaveMeta) => Promise<boolean>;
  clear: () => Promise<void>;
  last: () => SaveMeta | null;
  loaded: () => SaveMeta | null;
  setLoaded: (meta: SaveMeta | null) => void;
};

const defaultAdapter: SaveStorageAdapter = {
  get: async (key) => (await Preferences.get({ key })).value,
  set: (key, value) => Preferences.set({ key, value }),
  remove: (key) => Preferences.remove({ key }),
};

/**
 * Serializes save reads, writes, and clears behind a self-recovering FIFO queue.
 * A single rejected storage write (e.g. Safari Private Mode or quota errors)
 * returns `false` without poisoning subsequent saves.
 */
export function createSaveStore(
  key: string,
  adapter: SaveStorageAdapter = defaultAdapter,
): SaveStore {
  let queue: Promise<void> = Promise.resolve();
  let loadedMeta: SaveMeta | null = null;
  let lastMeta: SaveMeta | null = null;

  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  const load = async (): Promise<string | null> => {
    try {
      return await adapter.get(key);
    } catch {
      return null;
    }
  };

  const write = (serialized: string, meta: SaveMeta): Promise<boolean> =>
    enqueue(async () => {
      try {
        await adapter.set(key, serialized);
        lastMeta = meta;
        return true;
      } catch {
        return false;
      }
    });

  const clear = (): Promise<void> => {
    lastMeta = null;
    return enqueue(async () => {
      try {
        await adapter.remove(key);
      } catch {
        // Storage unavailable; keep in-memory state cleared cleanly.
      }
      lastMeta = null;
    });
  };

  return {
    load,
    write,
    clear,
    last: () => lastMeta,
    loaded: () => loadedMeta,
    setLoaded: (meta) => {
      loadedMeta = meta;
      lastMeta = meta;
    },
  };
}

export type SaveToastContext = {
  wrote: boolean;
  silent: boolean;
  documentHidden: boolean;
  paused: boolean;
  harnessStepping: boolean;
  qaActive: boolean;
  titleOpen: boolean;
  area: string;
  photoMode: boolean;
  inBattle: boolean;
  journalOpen: boolean;
  inFinale: boolean;
};

/** Returns true only when a live, non-silent autosave succeeded in an unobstructed overworld. */
export function shouldShowSaveToast(ctx: SaveToastContext): boolean {
  return (
    ctx.wrote &&
    !ctx.silent &&
    !ctx.documentHidden &&
    !ctx.paused &&
    !ctx.harnessStepping &&
    !ctx.qaActive &&
    !ctx.titleOpen &&
    ctx.area !== "harness" &&
    !ctx.photoMode &&
    !ctx.inBattle &&
    !ctx.journalOpen &&
    !ctx.inFinale
  );
}
