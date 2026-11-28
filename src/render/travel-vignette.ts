import type { CompanionAudioEffect } from "../platform/audio-effects";

export type TravelVignetteId =
  | "bus-hills"
  | "bus-coast"
  | "bus-pass"
  | "boat-island"
  | "lift-summit";

export type TravelMode = "bus" | "boat" | "lift";

export type TravelVignetteSpec = {
  id: TravelVignetteId;
  mode: TravelMode;
  assetUrl: string;
  badgeLabel: string;
  caption: string;
  originLabel: string;
  destinationLabel: string;
  chime: CompanionAudioEffect;
  soundtrackHint: "hills" | "bay" | "pass" | "island" | "summit";
  accentColor: string;
  holdMs: number;
};

export const TRAVEL_VIGNETTE_IDS: readonly TravelVignetteId[] = [
  "bus-hills",
  "bus-coast",
  "bus-pass",
  "boat-island",
  "lift-summit",
];

export const TRAVEL_VIGNETTE_HOLD_MS = 1680;
export const TRAVEL_VIGNETTE_FADE_IN_MS = 200;
export const TRAVEL_VIGNETTE_FADE_OUT_MS = 220;

export function travelCardAssetUrl(id: TravelVignetteId): string {
  return `assets/travel/${id}.webp`;
}

type ModeDefaults = Pick<TravelVignetteSpec, "mode" | "badgeLabel" | "chime" | "accentColor">;

const MODE_DEFAULTS: Record<TravelMode, ModeDefaults> = {
  bus: {
    mode: "bus",
    badgeLabel: "Star-Line Bus",
    chime: "title-start",
    accentColor: "#e8c468",
  },
  boat: {
    mode: "boat",
    badgeLabel: "Bay Rowboat",
    chime: "card-open",
    accentColor: "#92cdd0",
  },
  lift: {
    mode: "lift",
    badgeLabel: "Alpine Ski Lift",
    chime: "tool-sparkle",
    accentColor: "#b8c7e8",
  },
};

type RouteEntry = Pick<
  TravelVignetteSpec,
  "id" | "mode" | "originLabel" | "destinationLabel" | "soundtrackHint"
>;

const ROUTE_TABLE: Record<string, RouteEntry> = {
  "bay->plaza": {
    id: "bus-hills",
    mode: "bus",
    originLabel: "Bubblegum Bay",
    destinationLabel: "Cloverhollow",
    soundtrackHint: "hills",
  },
  "pass->plaza": {
    id: "bus-hills",
    mode: "bus",
    originLabel: "Pinecone Pass",
    destinationLabel: "Cloverhollow",
    soundtrackHint: "hills",
  },
  "plaza->bay": {
    id: "bus-coast",
    mode: "bus",
    originLabel: "Cloverhollow",
    destinationLabel: "Bubblegum Bay",
    soundtrackHint: "bay",
  },
  "pass->bay": {
    id: "bus-coast",
    mode: "bus",
    originLabel: "Pinecone Pass",
    destinationLabel: "Bubblegum Bay",
    soundtrackHint: "bay",
  },
  "plaza->pass": {
    id: "bus-pass",
    mode: "bus",
    originLabel: "Cloverhollow",
    destinationLabel: "Pinecone Pass",
    soundtrackHint: "pass",
  },
  "bay->pass": {
    id: "bus-pass",
    mode: "bus",
    originLabel: "Bubblegum Bay",
    destinationLabel: "Pinecone Pass",
    soundtrackHint: "pass",
  },
  "bay->island": {
    id: "boat-island",
    mode: "boat",
    originLabel: "Bubblegum Bay",
    destinationLabel: "Starlight Island",
    soundtrackHint: "island",
  },
  "island->bay": {
    id: "boat-island",
    mode: "boat",
    originLabel: "Starlight Island",
    destinationLabel: "Bubblegum Bay",
    soundtrackHint: "bay",
  },
  "pass->summit": {
    id: "lift-summit",
    mode: "lift",
    originLabel: "Pinecone Pass",
    destinationLabel: "Alpine Summit Overlook",
    soundtrackHint: "summit",
  },
  "summit->pass": {
    id: "lift-summit",
    mode: "lift",
    originLabel: "Alpine Summit Overlook",
    destinationLabel: "Pinecone Pass",
    soundtrackHint: "pass",
  },
};

export function classifyTravelVignette(
  fromArea: string,
  toArea: string,
  tone?: "paper" | "dark",
): TravelVignetteSpec | null {
  if (tone === "dark" || fromArea === toArea) return null;
  if (fromArea === "harness" || toArea === "harness") return null;
  const entry = ROUTE_TABLE[`${fromArea}->${toArea}`];
  if (entry === undefined) return null;
  const defaults = MODE_DEFAULTS[entry.mode];
  return {
    id: entry.id,
    mode: defaults.mode,
    assetUrl: travelCardAssetUrl(entry.id),
    badgeLabel: defaults.badgeLabel,
    caption: `Next stop: ${entry.destinationLabel}!`,
    originLabel: entry.originLabel,
    destinationLabel: entry.destinationLabel,
    chime: defaults.chime,
    soundtrackHint: entry.soundtrackHint,
    accentColor: defaults.accentColor,
    holdMs: TRAVEL_VIGNETTE_HOLD_MS,
  };
}

export function shouldShowTravelVignette(ctx: {
  route: TravelVignetteSpec | null;
  paused: boolean;
  harnessStepping: boolean;
  reducedMotion: boolean;
}): boolean {
  return ctx.route !== null && !ctx.paused && !ctx.harnessStepping && !ctx.reducedMotion;
}

export function travelMarkerMotion(
  mode: TravelMode,
  progress: number,
): { progressPct: number; bobY: number; tiltDeg: number } {
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const smooth = clamped * clamped * (3 - 2 * clamped);
  const progressPct = (clamped * 0.25 + smooth * 0.75) * 100;
  if (mode === "bus") {
    const phase = clamped * Math.PI * 10;
    return {
      progressPct,
      bobY: -1.2 + Math.sin(phase) * 2.0,
      tiltDeg: Math.cos(phase * 0.5) * 2.2,
    };
  }
  if (mode === "boat") {
    const phase = clamped * Math.PI * 5;
    return {
      progressPct,
      bobY: Math.sin(phase) * 2.8,
      tiltDeg: Math.cos(phase) * 4.5,
    };
  }
  const phase = clamped * Math.PI * 4;
  return {
    progressPct,
    bobY: Math.sin(phase) * 2.0,
    tiltDeg: Math.sin(phase * 0.75) * 3.2,
  };
}
