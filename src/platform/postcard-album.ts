import { PHOTO_WEATHER_CYCLE, type CozyWeatherKind } from "../core/weather";

export const POSTCARD_ALBUM_KEY = "cloverhollow-postcards";
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
  subscribe: (listener: PostcardAlbumListener) => () => void;
};

const VALID_DATA_URL_RE = /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;
let postcardSequence = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCozyWeatherKind(value: unknown): value is CozyWeatherKind {
  return typeof value === "string" && PHOTO_WEATHER_CYCLE.some((kind) => kind === value);
}

function isQuotaError(error: unknown): boolean {
  if (error instanceof DOMException || error instanceof Error) {
    return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED";
  }
  return isRecord(error) && (
    error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 || error.code === 1014
  );
}

function sanitizeEntry(value: unknown): SavedPostcard | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || value.id.trim().length === 0) return null;
  if (typeof value.filename !== "string" || value.filename.trim().length === 0) return null;
  if (typeof value.caption !== "string" || value.caption.trim().length === 0) return null;
  if (typeof value.subcaption !== "string") return null;
  if (typeof value.dataUrl !== "string" || !VALID_DATA_URL_RE.test(value.dataUrl)) return null;
  if (value.weather !== undefined && !isCozyWeatherKind(value.weather)) return null;
  return {
    id: value.id.trim(), filename: value.filename.trim(),
    caption: value.caption.trim(), subcaption: value.subcaption.trim(),
    ...(value.weather !== undefined ? { weather: value.weather } : {}),
    dataUrl: value.dataUrl,
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
  const entries: SavedPostcard[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    const clean = sanitizeEntry(item);
    if (clean === null || seen.has(clean.id)) continue;
    seen.add(clean.id);
    entries.push(clean);
    if (entries.length >= POSTCARD_ALBUM_LIMIT) break;
  }
  return entries;
}

/** Prepends a new postcard entry (deduping by id) and trims to `POSTCARD_ALBUM_LIMIT`. */
export function addPostcardEntry(
  list: readonly SavedPostcard[],
  entry: SavedPostcard,
): SavedPostcard[] {
  const clean = sanitizeEntry(entry);
  if (clean === null) return list.slice(0, POSTCARD_ALBUM_LIMIT);
  const next: SavedPostcard[] = [clean];
  for (const item of list) {
    if (item.id === clean.id) continue;
    next.push(item);
    if (next.length >= POSTCARD_ALBUM_LIMIT) break;
  }
  return next;
}

/** Removes the postcard entry matching `id` without mutating the source array. */
export function removePostcardEntry(list: readonly SavedPostcard[], id: string): SavedPostcard[] {
  return list.filter((entry) => entry.id !== id);
}

function defaultStorage(): PostcardAlbumStorage | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
}

/** Creates a quota-resilient localStorage controller for Fae's Postcard Scrapbook Album. */
export function createPostcardAlbumController(
  storage?: PostcardAlbumStorage | null,
): PostcardAlbumController {
  const store = storage === undefined ? defaultStorage() : storage;
  let lastRaw: string | null | undefined;
  let entries: SavedPostcard[] = [];
  const listeners = new Set<PostcardAlbumListener>();

  const syncFromStorage = (): SavedPostcard[] => {
    if (store === null) return [...entries];
    try {
      const raw = store.getItem(POSTCARD_ALBUM_KEY);
      if (raw !== lastRaw) { lastRaw = raw; entries = parsePostcardAlbum(raw); }
    } catch { /* fall back to in-memory album */ }
    return [...entries];
  };
  const notify = (): void => {
    const snapshot = [...entries];
    for (const listener of listeners) listener(snapshot);
  };
  const persist = (candidate: SavedPostcard[]): SavedPostcard[] => {
    if (store === null) { entries = candidate; return [...entries]; }
    if (candidate.length === 0) {
      try { store.removeItem(POSTCARD_ALBUM_KEY); lastRaw = null; } catch { /* ignore */ }
      entries = [];
      return [];
    }
    let attempt = [...candidate];
    while (attempt.length > 0) {
      const encoded = JSON.stringify(attempt);
      try {
        store.setItem(POSTCARD_ALBUM_KEY, encoded);
        lastRaw = encoded; entries = attempt;
        return [...entries];
      } catch (error: unknown) {
        if (!isQuotaError(error) || attempt.length <= 1) { entries = attempt; return [...entries]; }
        attempt = attempt.slice(0, -1);
      }
    }
    entries = [];
    return [];
  };

  return {
    list: syncFromStorage,
    save: (entry) => {
      const next = persist(addPostcardEntry(syncFromStorage(), entry)); notify(); return next;
    },
    remove: (id) => {
      const next = persist(removePostcardEntry(syncFromStorage(), id)); notify(); return next;
    },
    clear: () => { persist([]); notify(); },
    subscribe: (listener) => {
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
  };
}

let sharedController: PostcardAlbumController | null = null;
const defaultController = (): PostcardAlbumController =>
  (sharedController ??= createPostcardAlbumController());

export const getPostcardAlbum = (): SavedPostcard[] => defaultController().list();
export const savePostcardToAlbum = (entry: SavedPostcard): SavedPostcard[] =>
  defaultController().save(entry);
export const removePostcardFromAlbum = (id: string): SavedPostcard[] =>
  defaultController().remove(id);
export const clearPostcardAlbum = (): void => { defaultController().clear(); };
export const subscribePostcardAlbum = (listener: PostcardAlbumListener): (() => void) =>
  defaultController().subscribe(listener);
