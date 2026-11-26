import { Preferences } from "@capacitor/preferences";

export type GamePreferences = {
  gentleTiming: boolean;
  keyHints: boolean;
};

export type GameSettingsController = {
  gentleTiming: () => boolean;
  toggleGentleTiming: () => void;
  setGentleTiming: (on: boolean) => void;
  keyHints: () => boolean;
  toggleKeyHints: () => void;
  setKeyHints: (on: boolean) => void;
};

const preferenceKey = "cloverhollow-settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function defaultGamePreferences(): GamePreferences {
  return { gentleTiming: false, keyHints: false };
}

export function readGamePreferences(value: string | null): GamePreferences {
  if (value === null) return defaultGamePreferences();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return defaultGamePreferences();
    return {
      gentleTiming: parsed.gentleTiming === true,
      keyHints: parsed.keyHints === true,
    };
  } catch {
    return defaultGamePreferences();
  }
}

export function writeGamePreferences(preferences: GamePreferences): string {
  return JSON.stringify({
    gentleTiming: preferences.gentleTiming,
    keyHints: preferences.keyHints,
  });
}

export function createGameSettings(
  onChange: () => void = () => undefined,
): GameSettingsController {
  let gentleTiming = false;
  let keyHints = false;
  let preferenceLoaded = false;
  let locallyChanged = false;
  let preferenceWrite = Promise.resolve();

  const persist = (): void => {
    const value = writeGamePreferences({ gentleTiming, keyHints });
    preferenceWrite = preferenceWrite.then(() =>
      Preferences.set({ key: preferenceKey, value }),
    );
  };

  const setGentleTiming = (on: boolean): void => {
    gentleTiming = on;
    locallyChanged = true;
    if (preferenceLoaded) persist();
    onChange();
  };

  const setKeyHints = (on: boolean): void => {
    keyHints = on;
    locallyChanged = true;
    if (preferenceLoaded) persist();
    onChange();
  };

  void Preferences.get({ key: preferenceKey }).then(({ value }) => {
    preferenceLoaded = true;
    if (locallyChanged) persist();
    else {
      const preferences = readGamePreferences(value);
      gentleTiming = preferences.gentleTiming;
      keyHints = preferences.keyHints;
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
  };
}
