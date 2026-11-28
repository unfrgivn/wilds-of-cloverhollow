import { PHOTO_WEATHER_CYCLE, type CozyWeatherKind } from "../core/weather";

export const POSTCARD_ALBUM_KEY = "cloverhollow-postcards";
export const PINNED_POSTCARD_KEY = "cloverhollow-pinned-postcard";
export const POSTCARD_ALBUM_LIMIT = 6;

export type SavedPostcard = {
  id: string; filename: string; caption: string; subcaption: string;
  weather?: CozyWeatherKind; dataUrl: string;
};
export type PostcardAlbumStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type PostcardAlbumListener = (entries: SavedPostcard[]) => void;
export type PostcardAlbumController = {
  list: () => SavedPostcard[]; save: (entry: SavedPostcard) => SavedPostcard[];
  remove: (id: string) => SavedPostcard[]; clear: () => void;
  pinnedId: () => string | null; setPinnedId: (id: string | null) => string | null;
  pinnedPostcard: () => SavedPostcard | null;
  subscribe: (listener: PostcardAlbumListener) => () => void;
};

const VALID_DATA_URL_RE = /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;
let postcardSequence = 0;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const nonEmpty = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
const isWeather = (v: unknown): v is CozyWeatherKind =>
  typeof v === "string" && PHOTO_WEATHER_CYCLE.some((kind) => kind === v);
const isQuotaError = (err: unknown): boolean =>
  (err instanceof DOMException || err instanceof Error)
    ? err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED"
    : isRecord(err) && (
      err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err.code === 22 || err.code === 1014
    );

function sanitizeEntry(value: unknown): SavedPostcard | null {
  if (!isRecord(value)) return null;
  const id = nonEmpty(value.id); const filename = nonEmpty(value.filename);
  const caption = nonEmpty(value.caption);
  if (id === null || filename === null || caption === null) return null;
  if (typeof value.subcaption !== "string") return null;
  if (typeof value.dataUrl !== "string" || !VALID_DATA_URL_RE.test(value.dataUrl)) return null;
  if (value.weather !== undefined && !isWeather(value.weather)) return null;
  return {
    id, filename, caption, subcaption: value.subcaption.trim(),
    ...(value.weather !== undefined ? { weather: value.weather } : {}), dataUrl: value.dataUrl,
  };
}

/** Generates a unique monotonic postcard album entry id for a snapped area or keepsake. */
export function createPostcardId(tag: string): string {
  postcardSequence += 1;
  const slug = tag.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug.length > 0 ? slug : "postcard"}-${Date.now()}-${postcardSequence}`;
}
/** Parses serialized postcard album JSON, rejecting malformed items and clamping to limit. */
export function parsePostcardAlbum(raw: string | null): SavedPostcard[] {
  if (raw === null || raw.trim().length === 0) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const entries: SavedPostcard[] = []; const seen = new Set<string>();
  for (const item of parsed) {
    const clean = sanitizeEntry(item);
    if (clean === null || seen.has(clean.id)) continue;
    seen.add(clean.id); entries.push(clean);
    if (entries.length >= POSTCARD_ALBUM_LIMIT) break;
  }
  return entries;
}
/** Prepends a new postcard entry (deduping by id) and trims to `POSTCARD_ALBUM_LIMIT`. */
export function addPostcardEntry(list: readonly SavedPostcard[], entry: SavedPostcard) {
  const clean = sanitizeEntry(entry);
  if (clean === null) return list.slice(0, POSTCARD_ALBUM_LIMIT);
  return [clean, ...list.filter((item) => item.id !== clean.id)].slice(0, POSTCARD_ALBUM_LIMIT);
}
/** Removes the postcard entry matching `id` without mutating the source array. */
export const removePostcardEntry = (list: readonly SavedPostcard[], id: string): SavedPostcard[] =>
  list.filter((entry) => entry.id !== id);
const defaultStorage = (): PostcardAlbumStorage | null => {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
};

/** Creates a quota-resilient localStorage controller for Fae's Postcard Scrapbook Album. */
export function createPostcardAlbumController(
  storage?: PostcardAlbumStorage | null,
): PostcardAlbumController {
  const store = storage === undefined ? defaultStorage() : storage;
  let lastRaw: string | null | undefined; let lastPinnedRaw: string | null | undefined;
  let entries: SavedPostcard[] = []; let pinned: string | null = null;
  const listeners = new Set<PostcardAlbumListener>();
  const syncFromStorage = (): SavedPostcard[] => {
    if (store === null) return [...entries];
    try {
      const raw = store.getItem(POSTCARD_ALBUM_KEY);
      if (raw !== lastRaw) { lastRaw = raw; entries = parsePostcardAlbum(raw); }
    } catch { /* fall back to in-memory album */ }
    return [...entries];
  };
  const persistPinned = (next: string | null): string | null => {
    pinned = next;
    if (store === null) return pinned;
    try {
      if (next === null) { store.removeItem(PINNED_POSTCARD_KEY); lastPinnedRaw = null; }
      else { store.setItem(PINNED_POSTCARD_KEY, next); lastPinnedRaw = next; }
    } catch { /* fall back to in-memory pin */ }
    return pinned;
  };
  const syncPinned = (current: readonly SavedPostcard[]): string | null => {
    if (store !== null) {
      try {
        const raw = store.getItem(PINNED_POSTCARD_KEY);
        if (raw !== lastPinnedRaw) { lastPinnedRaw = raw; pinned = nonEmpty(raw); }
      } catch { /* fall back to in-memory pin */ }
    }
    return pinned !== null && current.some((item) => item.id === pinned) ? pinned : null;
  };
  const clearDangling = (current: readonly SavedPostcard[]): void => {
    if (syncPinned(current) === null && pinned !== null) persistPinned(null);
  };
  const notify = (): void => { const snap = [...entries]; for (const fn of listeners) fn(snap); };
  const persist = (candidate: SavedPostcard[]): SavedPostcard[] => {
    if (store === null) { entries = candidate; return [...entries]; }
    if (candidate.length === 0) {
      try { store.removeItem(POSTCARD_ALBUM_KEY); lastRaw = null; } catch { /* ignore */ }
      entries = []; return [];
    }
    for (let attempt = [...candidate]; attempt.length > 0; attempt = attempt.slice(0, -1)) {
      const encoded = JSON.stringify(attempt);
      try {
        store.setItem(POSTCARD_ALBUM_KEY, encoded);
        lastRaw = encoded; entries = attempt; return [...entries];
      } catch (error: unknown) {
        if (!isQuotaError(error) || attempt.length <= 1) { entries = attempt; return [...entries]; }
      }
    }
    entries = []; return [];
  };
  return {
    list: syncFromStorage,
    save: (entry) => {
      const next = persist(addPostcardEntry(syncFromStorage(), entry));
      clearDangling(next); notify(); return next;
    },
    remove: (id) => {
      const next = persist(removePostcardEntry(syncFromStorage(), id));
      clearDangling(next); notify(); return next;
    },
    clear: () => { persist([]); persistPinned(null); notify(); },
    pinnedId: () => syncPinned(syncFromStorage()),
    setPinnedId: (id) => {
      const cur = syncFromStorage();
      if (id === null) { const out = persistPinned(null); notify(); return out; }
      const clean = nonEmpty(id);
      if (clean === null || !cur.some((i) => i.id === clean)) return syncPinned(cur);
      const out = persistPinned(clean); notify(); return out;
    },
    pinnedPostcard: () => {
      const cur = syncFromStorage(); const active = syncPinned(cur);
      return active === null ? null : (cur.find((item) => item.id === active) ?? null);
    },
    subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
}

let shared: PostcardAlbumController | null = null;
const ctrl = (): PostcardAlbumController => (shared ??= createPostcardAlbumController());
export const getPostcardAlbum = (): SavedPostcard[] => ctrl().list();
export const savePostcardToAlbum = (entry: SavedPostcard): SavedPostcard[] => ctrl().save(entry);
export const removePostcardFromAlbum = (id: string): SavedPostcard[] => ctrl().remove(id);
export const clearPostcardAlbum = (): void => { ctrl().clear(); };
export const getPinnedPostcardId = (): string | null => ctrl().pinnedId();
export const setPinnedPostcardId = (id: string | null): string | null => ctrl().setPinnedId(id);
export const getPinnedPostcard = (): SavedPostcard | null => ctrl().pinnedPostcard();
export const subscribePostcardAlbum = (fn: PostcardAlbumListener): (() => void) =>
  ctrl().subscribe(fn);