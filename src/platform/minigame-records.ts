import { Preferences } from "@capacitor/preferences";

export type MinigameKey = "skee" | "mole" | "comet" | "fish";

export type MinigameRecords = {
  skee: number;
  mole: number;
  comet: number;
  fish: number;
};

export type MinigameRecordBadge = {
  best: number;
  isNewBest: boolean;
};

export type ArcadeRecordPill = {
  id: MinigameKey;
  label: string;
  value: string;
};

export type MinigameRecordsController = {
  records: () => MinigameRecords;
  bestOf: (game: MinigameKey) => number;
  submit: (game: MinigameKey, score: number) => MinigameRecordBadge;
  reset: () => void;
};

const preferenceKey = "cloverhollow-records";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

export function defaultMinigameRecords(): MinigameRecords {
  return { skee: 0, mole: 0, comet: 0, fish: 0 };
}

/** Projects persisted personal bests into canonical Journal pill entries, omitting 0 scores. */
export function formatArcadeRecordPills(records: MinigameRecords): ArcadeRecordPill[] {
  const pills: ArcadeRecordPill[] = [];
  const skee = sanitizeScore(records.skee);
  const mole = sanitizeScore(records.mole);
  const comet = sanitizeScore(records.comet);
  const fish = sanitizeScore(records.fish);
  if (skee > 0) pills.push({ id: "skee", label: "Skee-Ball", value: String(skee) });
  if (mole > 0) pills.push({ id: "mole", label: "Boop-a-Mole", value: `${mole} boops` });
  if (comet > 0) pills.push({ id: "comet", label: "Comet Cruise", value: `${comet} stars` });
  if (fish > 0) pills.push({ id: "fish", label: "Fishing Streak", value: `${fish}` });
  return pills;
}

export function readMinigameRecords(value: string | null): MinigameRecords {
  if (value === null) return defaultMinigameRecords();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return defaultMinigameRecords();
    return {
      skee: sanitizeScore(parsed.skee),
      mole: sanitizeScore(parsed.mole),
      comet: sanitizeScore(parsed.comet),
      fish: sanitizeScore(parsed.fish),
    };
  } catch {
    return defaultMinigameRecords();
  }
}

export function writeMinigameRecords(records: MinigameRecords): string {
  return JSON.stringify({
    skee: sanitizeScore(records.skee),
    mole: sanitizeScore(records.mole),
    comet: sanitizeScore(records.comet),
    fish: sanitizeScore(records.fish),
  });
}

export function recordMinigameResult(
  records: MinigameRecords,
  game: MinigameKey,
  score: number,
): { records: MinigameRecords; best: number; isNewBest: boolean } {
  const clean: MinigameRecords = {
    skee: sanitizeScore(records.skee),
    mole: sanitizeScore(records.mole),
    comet: sanitizeScore(records.comet),
    fish: sanitizeScore(records.fish),
  };
  const nextScore = sanitizeScore(score);
  const previous = clean[game];
  const isNewBest = nextScore > 0 && nextScore > previous;
  const best = Math.max(previous, nextScore);
  const nextRecords: MinigameRecords = isNewBest ? { ...clean, [game]: best } : clean;
  return { records: nextRecords, best, isNewBest };
}

export function createMinigameRecords(
  onChange: () => void = () => undefined,
): MinigameRecordsController {
  let current: MinigameRecords = defaultMinigameRecords();
  let preferenceLoaded = false;
  let locallyChanged = false;
  let preferenceWrite = Promise.resolve();

  const persist = (): void => {
    const value = writeMinigameRecords(current);
    preferenceWrite = preferenceWrite.then(() =>
      Preferences.set({ key: preferenceKey, value }),
    );
  };

  const submit = (game: MinigameKey, score: number): MinigameRecordBadge => {
    const result = recordMinigameResult(current, game, score);
    if (result.isNewBest) {
      current = result.records;
      locallyChanged = true;
      if (preferenceLoaded) persist();
      onChange();
    }
    return { best: result.best, isNewBest: result.isNewBest };
  };

  const reset = (): void => {
    current = defaultMinigameRecords();
    locallyChanged = true;
    if (preferenceLoaded) persist();
    onChange();
  };

  void Preferences.get({ key: preferenceKey }).then(({ value }) => {
    preferenceLoaded = true;
    if (locallyChanged) persist();
    else {
      current = readMinigameRecords(value);
      onChange();
    }
  });

  return {
    records: () => ({ ...current }),
    bestOf: (game) => current[game],
    submit,
    reset,
  };
}
