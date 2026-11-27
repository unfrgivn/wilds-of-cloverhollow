import { createPreferenceStore } from "./preference-store";

export type MinigameKey = "skee" | "mole" | "comet" | "fish" | "cook";

export type MinigameRecords = {
  skee: number;
  mole: number;
  comet: number;
  fish: number;
  cook: number;
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
  return { skee: 0, mole: 0, comet: 0, fish: 0, cook: 0 };
}

/** Projects persisted personal bests into canonical Journal pill entries, omitting 0 scores. */
export function formatArcadeRecordPills(records: MinigameRecords): ArcadeRecordPill[] {
  const pills: ArcadeRecordPill[] = [];
  const skee = sanitizeScore(records.skee);
  const mole = sanitizeScore(records.mole);
  const comet = sanitizeScore(records.comet);
  const fish = sanitizeScore(records.fish);
  const cook = sanitizeScore(records.cook);
  if (skee > 0) pills.push({ id: "skee", label: "Skee-Ball", value: String(skee) });
  if (mole > 0) pills.push({ id: "mole", label: "Boop-a-Mole", value: `${mole} boops` });
  if (comet > 0) pills.push({ id: "comet", label: "Comet Cruise", value: `${comet} stars` });
  if (fish > 0) pills.push({ id: "fish", label: "Fishing Streak", value: `${fish}` });
  if (cook > 0) pills.push({ id: "cook", label: "Golden Dishes", value: String(cook) });
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
      cook: sanitizeScore(parsed.cook),
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
    cook: sanitizeScore(records.cook),
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
    cook: sanitizeScore(records.cook),
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
  const store = createPreferenceStore(preferenceKey);

  const persist = (): void => {
    void store.save(writeMinigameRecords(current));
  };

  const submit = (game: MinigameKey, score: number): MinigameRecordBadge => {
    const result = recordMinigameResult(current, game, score);
    if (result.isNewBest) {
      current = result.records;
      store.markDirty();
      if (store.isLoaded()) persist();
      onChange();
    }
    return { best: result.best, isNewBest: result.isNewBest };
  };

  const reset = (): void => {
    current = defaultMinigameRecords();
    store.markDirty();
    if (store.isLoaded()) persist();
    onChange();
  };

  void store.load((value) => {
    if (store.isDirty()) persist();
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
