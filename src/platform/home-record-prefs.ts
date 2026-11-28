import { isJukeboxTrack, type JukeboxTrack } from "../core/music";
import { createPreferenceStore, type PreferenceAdapter } from "./preference-store";

export const HOME_RECORD_PREF_KEY = "cloverhollow-home-record";

export type HomeRecordListener = (track: JukeboxTrack | null, fromUser: boolean) => void;

export type HomeRecordController = {
  get: () => JukeboxTrack | null;
  set: (track: JukeboxTrack | null) => void;
  subscribe: (listener: HomeRecordListener) => () => void;
  ready: Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Parses a persisted Home Record preference, safely falling back to `null` on invalid input. */
export function parseHomeRecord(raw: string | null): JukeboxTrack | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed === "null") return null;
  if (isJukeboxTrack(trimmed)) return trimmed;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isJukeboxTrack(parsed)) return parsed;
    if (isRecord(parsed) && isJukeboxTrack(parsed.track)) return parsed.track;
  } catch {
    return null;
  }
  return null;
}

/** Serializes the pinned Bedroom & Clubhouse Home Record for Capacitor Preferences storage. */
export function serializeHomeRecord(track: JukeboxTrack | null): string {
  return JSON.stringify({ track: track !== null && isJukeboxTrack(track) ? track : null });
}

/** Creates a resilient Capacitor Preferences store for the Bedroom & Clubhouse Home Record. */
export function createHomeRecordController(adapter?: PreferenceAdapter): HomeRecordController {
  let track: JukeboxTrack | null = null;
  const listeners = new Set<HomeRecordListener>();
  const store = createPreferenceStore(HOME_RECORD_PREF_KEY, adapter);

  const persist = (): void => {
    void store.save(serializeHomeRecord(track));
  };

  const set = (next: JukeboxTrack | null): void => {
    track = next !== null && isJukeboxTrack(next) ? next : null;
    store.markDirty();
    if (store.isLoaded()) persist();
    for (const listener of listeners) listener(track, true);
  };

  const subscribe = (listener: HomeRecordListener): (() => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };

  const ready = store.load((raw) => {
    if (store.isDirty()) { persist(); return; }
    const loaded = parseHomeRecord(raw);
    const changed = loaded !== track;
    track = loaded;
    if (changed) for (const listener of listeners) listener(track, false);
  });

  return { get: () => track, set, subscribe, ready };
}

let sharedController: HomeRecordController | null = null;
const defaultController = (): HomeRecordController =>
  (sharedController ??= createHomeRecordController());

/** Returns the pinned Bedroom & Clubhouse Home Record track (default `null`). */
export const getHomeRecordTrack = (): JukeboxTrack | null => defaultController().get();

/** Pins or unpins (`null`) the Bedroom & Clubhouse Home Record track and persists it. */
export const setHomeRecordTrack = (track: JukeboxTrack | null): void => {
  defaultController().set(track);
};

/** Subscribes to live Home Record changes; returns an unsubscribe callback. */
export const subscribeHomeRecord = (listener: HomeRecordListener): (() => void) =>
  defaultController().subscribe(listener);
