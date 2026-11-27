import type { TextSpeed } from "../core/sim";
import { createPreferenceStore } from "./preference-store";

export type GamePreferences = {
  gentleTiming: boolean;
  keyHints: boolean;
  textSpeed: TextSpeed;
  reducedMotion: boolean;
};

export type GameSettingsController = {
  gentleTiming: () => boolean;
  toggleGentleTiming: () => void;
  setGentleTiming: (on: boolean) => void;
  keyHints: () => boolean;
  toggleKeyHints: () => void;
  setKeyHints: (on: boolean) => void;
  textSpeed: () => TextSpeed;
  cycleTextSpeed: () => void;
  setTextSpeed: (speed: TextSpeed) => void;
  reducedMotion: () => boolean;
  toggleReducedMotion: () => void;
  setReducedMotion: (on: boolean) => void;
};

const preferenceKey = "cloverhollow-settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseTextSpeed(value: unknown): TextSpeed {
  return value === "cozy" || value === "brisk" || value === "instant" ? value : "cozy";
}

function nextTextSpeed(current: TextSpeed): TextSpeed {
  if (current === "cozy") return "brisk";
  if (current === "brisk") return "instant";
  return "cozy";
}

function defaultGamePreferences(): GamePreferences {
  return { gentleTiming: false, keyHints: false, textSpeed: "cozy", reducedMotion: false };
}

export function readGamePreferences(value: string | null): GamePreferences {
  if (value === null) return defaultGamePreferences();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return defaultGamePreferences();
    return {
      gentleTiming: parsed.gentleTiming === true,
      keyHints: parsed.keyHints === true,
      textSpeed: parseTextSpeed(parsed.textSpeed),
      reducedMotion: parsed.reducedMotion === true,
    };
  } catch {
    return defaultGamePreferences();
  }
}

export function writeGamePreferences(preferences: GamePreferences): string {
  return JSON.stringify({
    gentleTiming: preferences.gentleTiming,
    keyHints: preferences.keyHints,
    textSpeed: parseTextSpeed(preferences.textSpeed),
    reducedMotion: preferences.reducedMotion,
  });
}

export function createGameSettings(
  onChange: () => void = () => undefined,
): GameSettingsController {
  let gentleTiming = false;
  let keyHints = false;
  let textSpeed: TextSpeed = "cozy";
  let reducedMotion = false;
  const store = createPreferenceStore(preferenceKey);

  const persist = (): void => {
    void store.save(
      writeGamePreferences({ gentleTiming, keyHints, textSpeed, reducedMotion }),
    );
  };

  const setGentleTiming = (on: boolean): void => {
    gentleTiming = on;
    store.markDirty();
    if (store.isLoaded()) persist();
    onChange();
  };

  const setKeyHints = (on: boolean): void => {
    keyHints = on;
    store.markDirty();
    if (store.isLoaded()) persist();
    onChange();
  };

  const setTextSpeed = (speed: TextSpeed): void => {
    textSpeed = parseTextSpeed(speed);
    store.markDirty();
    if (store.isLoaded()) persist();
    onChange();
  };

  const setReducedMotion = (on: boolean): void => {
    reducedMotion = on;
    store.markDirty();
    if (store.isLoaded()) persist();
    onChange();
  };

  void store.load((value) => {
    if (store.isDirty()) persist();
    else {
      const preferences = readGamePreferences(value);
      gentleTiming = preferences.gentleTiming;
      keyHints = preferences.keyHints;
      textSpeed = preferences.textSpeed;
      reducedMotion = preferences.reducedMotion;
      onChange();
    }
  });

  return {
    gentleTiming: () => gentleTiming,
    toggleGentleTiming: () => setGentleTiming(!gentleTiming),
    setGentleTiming,
    keyHints: () => keyHints,
    toggleKeyHints: () => setKeyHints(!keyHints),
    setKeyHints,
    textSpeed: () => textSpeed,
    cycleTextSpeed: () => setTextSpeed(nextTextSpeed(textSpeed)),
    setTextSpeed,
    reducedMotion: () => reducedMotion,
    toggleReducedMotion: () => setReducedMotion(!reducedMotion),
    setReducedMotion,
  };
}
