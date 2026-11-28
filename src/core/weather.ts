export type CozyWeatherKind =
  | "clear"
  | "sunshower"
  | "breeze-petals"
  | "snow-flurry"
  | "twilight-fireflies";

export type CozyWeatherMode = "auto" | CozyWeatherKind;

export type WeatherBiome =
  | "indoor"
  | "town"
  | "woods"
  | "coast"
  | "alpine"
  | "enchanted";

export type CozyWeatherEffects = {
  fishFlavor: string;
  fishBiteBonus: number;
  gardenDewBonus: number;
  moodNote: string;
  skyTint: number;
  skyAlpha: number;
};

export type CozyWeatherInfo = {
  kind: CozyWeatherKind;
  label: string;
  accent: string;
  biome: WeatherBiome;
  hasRainbow: boolean;
  effects: CozyWeatherEffects;
};

/** Duration of one deterministic weather phase under `"auto"` mode (60 s at 60 Hz). */
export const WEATHER_CYCLE_TICKS = 3600;

export const COZY_WEATHER_MODES: readonly CozyWeatherMode[] = [
  "clear",
  "auto",
  "sunshower",
  "breeze-petals",
  "snow-flurry",
  "twilight-fireflies",
];

/** Ordered live sky cycle stepped in Photo Mode (`W`/`Shift+W`, `LB`/`RB`, and touch sky). */
export const PHOTO_WEATHER_CYCLE: readonly CozyWeatherKind[] = [
  "clear",
  "sunshower",
  "breeze-petals",
  "snow-flurry",
  "twilight-fireflies",
];

const TOWN_AREAS: ReadonlySet<string> = new Set([
  "plaza",
  "park",
  "field",
  "lane",
  "crossing",
  "hills",
  "sanctuary",
]);

const WOODS_AREAS: ReadonlySet<string> = new Set(["woods"]);

const COAST_AREAS: ReadonlySet<string> = new Set([
  "bay",
  "trail",
  "boardwalk",
  "island",
]);

const ALPINE_AREAS: ReadonlySet<string> = new Set(["pass", "summit"]);

const ENCHANTED_AREAS: ReadonlySet<string> = new Set(["mist", "enchanted"]);

type OutdoorWeatherBiome = Exclude<WeatherBiome, "indoor">;

const BIOME_SCHEDULES: Readonly<Record<OutdoorWeatherBiome, readonly CozyWeatherKind[]>> = {
  town: ["clear", "breeze-petals", "sunshower", "twilight-fireflies"],
  woods: ["clear", "twilight-fireflies", "sunshower", "breeze-petals"],
  coast: ["clear", "sunshower", "breeze-petals", "twilight-fireflies"],
  alpine: ["clear", "snow-flurry", "breeze-petals", "twilight-fireflies"],
  enchanted: ["clear", "twilight-fireflies", "breeze-petals"],
};

const WEATHER_LABELS: Readonly<Record<CozyWeatherKind, string>> = {
  clear: "Clear Skies",
  sunshower: "Rainbow Sunshower",
  "breeze-petals": "Blossom Breeze",
  "snow-flurry": "Snow Flurry",
  "twilight-fireflies": "Twilight Fireflies",
};

const WEATHER_ACCENTS: Readonly<Record<CozyWeatherKind, string>> = {
  clear: "#f3c95b",
  sunshower: "#7cc8f0",
  "breeze-petals": "#f4a8c4",
  "snow-flurry": "#9dd6f5",
  "twilight-fireflies": "#d9d25c",
};

const WEATHER_EFFECTS: Readonly<Record<CozyWeatherKind, CozyWeatherEffects>> = {
  clear: {
    fishFlavor: "Calm sunny ripples bring steady bites along Bubblegum Bay dock.",
    fishBiteBonus: 0,
    gardenDewBonus: 0,
    moodNote: "Warm sunlit skies keep Cloverhollow bright and breezy.",
    skyTint: 0xfff6dc,
    skyAlpha: 0,
  },
  sunshower: {
    fishFlavor: "Warm raindrop rings lure curious bay fish (+15% bite charm).",
    fishBiteBonus: 0.15,
    gardenDewBonus: 1,
    moodNote: "Sunlit pastel drizzle paints a 5-band rainbow over the valley.",
    skyTint: 0x9ad8f5,
    skyAlpha: 0.1,
  },
  "breeze-petals": {
    fishFlavor: "Floating petals dance across the water (+8% gentle bite charm).",
    fishBiteBonus: 0.08,
    gardenDewBonus: 0,
    moodNote: "Clover and sakura petals drift lazily on a honey-sweet breeze.",
    skyTint: 0xffc8dc,
    skyAlpha: 0.07,
  },
  "snow-flurry": {
    fishFlavor: "Crisp winter stillness makes every bobber dip easy to spot (+5% clarity).",
    fishBiteBonus: 0.05,
    gardenDewBonus: 0,
    moodNote: "Soft powdery snowflakes sparkle with crisp alpine clarity.",
    skyTint: 0xd8f0ff,
    skyAlpha: 0.09,
  },
  "twilight-fireflies": {
    fishFlavor: "Glowing lantern ripples draw shy starry fish (+12% dusk charm).",
    fishBiteBonus: 0.12,
    gardenDewBonus: 0,
    moodNote: "Warm golden-lime fireflies bob lazily like tiny story lanterns.",
    skyTint: 0xc8b6ff,
    skyAlpha: 0.12,
  },
};

/** Type guard for any supported cozy weather preference mode. */
export function isCozyWeatherMode(value: unknown): value is CozyWeatherMode {
  return (
    value === "auto" ||
    value === "clear" ||
    value === "sunshower" ||
    value === "breeze-petals" ||
    value === "snow-flurry" ||
    value === "twilight-fireflies"
  );
}

/** Maps any playable or special area ID to its cozy weather biome. */
export function weatherBiomeForArea(areaId: string): WeatherBiome {
  if (TOWN_AREAS.has(areaId)) return "town";
  if (WOODS_AREAS.has(areaId)) return "woods";
  if (COAST_AREAS.has(areaId)) return "coast";
  if (ALPINE_AREAS.has(areaId)) return "alpine";
  if (ENCHANTED_AREAS.has(areaId)) return "enchanted";
  return "indoor";
}

/** Returns the cozy player-facing label for a resolved weather kind. */
export function weatherLabel(kind: CozyWeatherKind): string {
  return WEATHER_LABELS[kind];
}

/** Returns the cozy player-facing label for a weather preference mode. */
export function weatherModeLabel(mode: CozyWeatherMode): string {
  return mode === "auto" ? "Auto Cycle" : WEATHER_LABELS[mode];
}

/**
 * Steps Photo Mode's live sky cycler forward (`+1`) or backward (`-1`).
 * Maps `"auto"` cleanly to `"sunshower"` for `+1` and `"twilight-fireflies"`
 * for `-1`, and wraps cleanly around `PHOTO_WEATHER_CYCLE` in both directions.
 */
export function stepPhotoWeatherMode(
  current: CozyWeatherMode,
  delta: -1 | 1,
): CozyWeatherKind {
  if (current === "auto") return delta > 0 ? "sunshower" : "twilight-fireflies";
  const index = PHOTO_WEATHER_CYCLE.indexOf(current);
  const base = index === -1 ? 0 : index;
  const nextIndex = (base + delta + PHOTO_WEATHER_CYCLE.length) % PHOTO_WEATHER_CYCLE.length;
  return PHOTO_WEATHER_CYCLE[nextIndex] ?? "clear";
}

/**
 * Advances Photo Mode's live sky cycler to the next cozy weather kind.
 * Maps `"auto"` directly to `"sunshower"` (first vivid sky) and wraps
 * `"twilight-fireflies"` back around to `"clear"`.
 */
export function nextPhotoWeatherMode(current: CozyWeatherMode): CozyWeatherKind {
  return stepPhotoWeatherMode(current, 1);
}

/** Returns the passive cozy flavor, bonuses, and pastel sky wash for a weather kind. */
export function weatherEffects(kind: CozyWeatherKind): CozyWeatherEffects {
  const base = WEATHER_EFFECTS[kind];
  return { ...base };
}

/**
 * Pure deterministic weather resolver for any area, tick, and preference mode.
 * Interiors and unknown/harness areas always stay sheltered and clear.
 */
export function weatherForArea(
  areaId: string,
  tick: number,
  mode: CozyWeatherMode = "clear",
): CozyWeatherInfo {
  const biome = weatherBiomeForArea(areaId);
  if (biome === "indoor") {
    return {
      kind: "clear",
      label: "Sheltered & Cozy",
      accent: "#e8c882",
      biome: "indoor",
      hasRainbow: false,
      effects: {
        ...WEATHER_EFFECTS.clear,
        moodNote: "Sheltered and cozy indoors while valley skies drift outside.",
      },
    };
  }
  const safeTick = Number.isFinite(tick) ? Math.max(0, tick) : 0;
  let kind: CozyWeatherKind;
  if (mode === "auto") {
    const schedule = BIOME_SCHEDULES[biome];
    const index = Math.floor(safeTick / WEATHER_CYCLE_TICKS) % schedule.length;
    kind = schedule[index] ?? "clear";
  } else {
    kind = mode;
  }
  return {
    kind,
    label: WEATHER_LABELS[kind],
    accent: WEATHER_ACCENTS[kind],
    biome,
    hasRainbow: kind === "sunshower",
    effects: { ...WEATHER_EFFECTS[kind] },
  };
}
