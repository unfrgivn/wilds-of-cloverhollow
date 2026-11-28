import { isCozyWeatherMode, type CozyWeatherMode } from "../core/weather";
import { createPreferenceStore, type PreferenceAdapter } from "./preference-store";

export const WEATHER_PREF_KEY = "cloverhollow-weather";

export type WeatherPrefsListener = (mode: CozyWeatherMode) => void;

export type WeatherPrefsController = {
  get: () => CozyWeatherMode;
  set: (mode: CozyWeatherMode) => void;
  subscribe: (listener: WeatherPrefsListener) => () => void;
  ready: Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Parses a persisted weather preference value, defaulting safely to `"clear"`. */
export function parseCozyWeatherMode(raw: string | null): CozyWeatherMode {
  if (raw === null) return "clear";
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "clear";
  if (isCozyWeatherMode(trimmed)) return trimmed;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isCozyWeatherMode(parsed)) return parsed;
    if (isRecord(parsed) && isCozyWeatherMode(parsed.mode)) return parsed.mode;
  } catch {
    return "clear";
  }
  return "clear";
}

/** Serializes a weather preference mode for Capacitor Preferences persistence. */
export function serializeCozyWeatherMode(mode: CozyWeatherMode): string {
  return JSON.stringify({ mode: isCozyWeatherMode(mode) ? mode : "clear" });
}

function syncDocumentWeather(mode: CozyWeatherMode): void {
  if (typeof document === "undefined") return;
  if (document.documentElement.dataset.weather !== mode) {
    document.documentElement.dataset.weather = mode;
  }
}

/**
 * Creates a self-recovering cozy weather preference store backed by Capacitor
 * Preferences (defaulting to `"clear"` so all existing runs remain identical).
 */
export function createWeatherPrefsController(
  adapter?: PreferenceAdapter,
  options?: { syncDom?: boolean },
): WeatherPrefsController {
  const syncDom = options?.syncDom ?? true;
  let mode: CozyWeatherMode = "clear";
  const listeners = new Set<WeatherPrefsListener>();
  const store = createPreferenceStore(WEATHER_PREF_KEY, adapter);

  const notify = (): void => {
    if (syncDom) syncDocumentWeather(mode);
    for (const listener of listeners) listener(mode);
  };

  const persist = (): void => {
    void store.save(serializeCozyWeatherMode(mode));
  };

  const set = (next: CozyWeatherMode): void => {
    const sanitized: CozyWeatherMode = isCozyWeatherMode(next) ? next : "clear";
    mode = sanitized;
    store.markDirty();
    if (store.isLoaded()) persist();
    notify();
  };

  const subscribe = (listener: WeatherPrefsListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const ready = store.load((raw) => {
    if (store.isDirty()) {
      persist();
      if (syncDom) syncDocumentWeather(mode);
      return;
    }
    const loaded = parseCozyWeatherMode(raw);
    const changed = loaded !== mode;
    mode = loaded;
    if (syncDom) syncDocumentWeather(mode);
    if (changed) {
      for (const listener of listeners) listener(mode);
    }
  });

  if (syncDom) syncDocumentWeather(mode);

  return {
    get: () => mode,
    set,
    subscribe,
    ready,
  };
}

let sharedController: WeatherPrefsController | null = null;

function defaultController(): WeatherPrefsController {
  if (sharedController === null) {
    sharedController = createWeatherPrefsController();
  }
  return sharedController;
}

/** Returns the active cozy weather mode preference (default `"clear"`). */
export function getCozyWeatherMode(): CozyWeatherMode {
  return defaultController().get();
}

/** Updates and persists the active cozy weather mode preference. */
export function setCozyWeatherMode(mode: CozyWeatherMode): void {
  defaultController().set(mode);
}

/** Subscribes to live cozy weather mode changes; returns an unsubscribe callback. */
export function subscribeCozyWeather(listener: WeatherPrefsListener): () => void {
  return defaultController().subscribe(listener);
}
