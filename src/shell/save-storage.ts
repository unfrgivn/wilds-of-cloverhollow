import { Preferences } from "@capacitor/preferences";
import { parseSave, serializeSave, stableHash, type State, type World } from "../core";
import { shouldFlushSaveOnHide } from "./lifecycle";

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

/** Maps each critter species to its baseline XP table entry for save migration. */
export function buildSpeciesXp(world: Pick<World, "critters" | "levels">): Record<string, number> {
  return Object.fromEntries(
    Object.values(world.critters).map((kind) => [
      kind.species,
      world.levels.critters[kind.id]?.xp ?? 0,
    ]),
  );
}

export type SaveSessionDeps = {
  store: SaveStore;
  world: Pick<World, "critters" | "levels">;
  fresh: State;
  getState: () => State;
  isDocumentHidden: () => boolean;
  isPaused: () => boolean;
  isHarnessStepping: () => boolean;
  isTitleOpen: () => boolean;
  isPhotoMode: () => boolean;
  isQaRestricted: () => boolean;
  isQaOverlayOpen: () => boolean;
  showSaveToast: () => void;
};

export type SaveSession = {
  speciesXp: Record<string, number>;
  parse: (raw: string) => State | null;
  saveState: (snapshot: State, options?: { silent?: boolean }) => Promise<void>;
  save: () => Promise<void>;
  flushOnHide: () => void;
  clear: () => void;
  markDirty: () => void;
  clearDirty: () => void;
  setSuppressed: (suppressed: boolean) => void;
};

/** Coordinates shell autosaves, toast visibility, dirty tracking, and pagehide flushing. */
export function createSaveSession(deps: SaveSessionDeps): SaveSession {
  const speciesXp = buildSpeciesXp(deps.world);
  let dirty = false;
  let suppressed = false;

  const parse = (raw: string): State | null =>
    parseSave(raw, deps.fresh, speciesXp, deps.world.levels.thresholds);

  const saveState = async (
    snapshot: State,
    options?: { silent?: boolean },
  ): Promise<void> => {
    if (suppressed || deps.isQaRestricted()) return;
    const serialized = serializeSave(snapshot);
    const hash = stableHash(snapshot);
    if (snapshot === deps.getState()) dirty = false;
    const silent = options?.silent ?? false;
    const liveAtStart =
      !silent &&
      !deps.isDocumentHidden() &&
      !deps.isPaused() &&
      !deps.isHarnessStepping() &&
      !deps.isTitleOpen();
    const wrote = await deps.store.write(serialized, { tick: snapshot.tick, hash });
    const current = deps.getState();
    if (
      liveAtStart &&
      shouldShowSaveToast({
        wrote,
        silent,
        documentHidden: deps.isDocumentHidden(),
        paused: deps.isPaused(),
        harnessStepping: deps.isHarnessStepping(),
        qaActive: deps.isQaRestricted(),
        titleOpen: deps.isTitleOpen(),
        area: snapshot.area,
        photoMode: deps.isPhotoMode(),
        inBattle: current.battle !== null,
        journalOpen: current.journalOpen,
        inFinale: current.finale !== null,
      })
    ) {
      deps.showSaveToast();
    }
  };

  const flushOnHide = (): void => {
    const current = deps.getState();
    if (
      shouldFlushSaveOnHide({
        qaActive: deps.isQaRestricted() || deps.isQaOverlayOpen(),
        titleOpen: deps.isTitleOpen(),
        area: current.area,
        inFinale: current.finale !== null,
        inBattle: current.battle !== null,
        inArcade: current.arcade !== null,
        autosaveNeeded:
          dirty &&
          !deps.isPaused() &&
          !deps.isHarnessStepping() &&
          !suppressed &&
          current.transition === null,
      })
    ) {
      void saveState(current, { silent: true });
    }
  };

  return {
    speciesXp,
    parse,
    saveState,
    save: () => saveState(deps.getState()),
    flushOnHide,
    clear: () => {
      void deps.store.clear();
      dirty = false;
    },
    markDirty: () => {
      dirty = true;
    },
    clearDirty: () => {
      dirty = false;
    },
    setSuppressed: (on) => {
      suppressed = on;
    },
  };
}
