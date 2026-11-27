import type { State, World } from "../core";

export type TimeOfDayPhase =
  | "morning"
  | "day"
  | "golden-hour"
  | "enchanted-twilight"
  | "golden-meadow"
  | "sunrise";

export type TimeOfDayGrade = {
  phase: TimeOfDayPhase;
  tint: number;
  alpha: number;
  sunTint: number;
  sunAlpha: number;
};

const OUTDOOR_GOLDEN_AREAS = new Set([
  "plaza",
  "park",
  "bay",
  "island",
  "pass",
  "summit",
  "trail",
  "woods",
  "hills",
  "sanctuary",
  "field",
]);

const MORNING_HOME_AREAS = new Set(["bedroom", "kitchen"]);

const NEUTRAL_DAY: TimeOfDayGrade = {
  phase: "day",
  tint: 0xffffff,
  alpha: 0,
  sunTint: 0xffffff,
  sunAlpha: 0,
};

const SUNRISE: TimeOfDayGrade = {
  phase: "sunrise",
  tint: 0xffd6a5,
  alpha: 0.085,
  sunTint: 0xffe49e,
  sunAlpha: 0.16,
};

const ENCHANTED_TWILIGHT: TimeOfDayGrade = {
  phase: "enchanted-twilight",
  tint: 0x9b7ed9,
  alpha: 0.08,
  sunTint: 0xd8b8ff,
  sunAlpha: 0.1,
};

const GOLDEN_MEADOW: TimeOfDayGrade = {
  phase: "golden-meadow",
  tint: 0xffe69c,
  alpha: 0.06,
  sunTint: 0xfff0b8,
  sunAlpha: 0.14,
};

const GOLDEN_HOUR: TimeOfDayGrade = {
  phase: "golden-hour",
  tint: 0xffcd85,
  alpha: 0.055,
  sunTint: 0xffe09c,
  sunAlpha: 0.13,
};

const MORNING: TimeOfDayGrade = {
  phase: "morning",
  tint: 0xfff1c9,
  alpha: 0.04,
  sunTint: 0xfff6d8,
  sunAlpha: 0.1,
};

/**
 * Pure story-driven lighting arc (spec 4): shifts overworld light subtly from
 * crisp morning in Fae's home, to golden hour outdoors after finding the
 * blacklight lantern, dreamy twilight in Misty Path / fizzy Enchanted Forest,
 * radiant golden meadow once calmed, and warm sunrise during the finale.
 */
export function storyTimeOfDay(world: World, state: State): TimeOfDayGrade {
  if (
    state.area === "harness" ||
    state.battle !== null ||
    state.arcade !== null ||
    state.lantern
  ) {
    return NEUTRAL_DAY;
  }
  if (state.finale !== null) return SUNRISE;
  if (state.area === "mist") return ENCHANTED_TWILIGHT;
  if (state.area === "enchanted") {
    return world.storyVariable(state.ink, "forest_fizzy") === false
      ? GOLDEN_MEADOW
      : ENCHANTED_TWILIGHT;
  }
  const hasLantern = world.storyVariable(state.ink, "has_lantern") === true;
  if (OUTDOOR_GOLDEN_AREAS.has(state.area) && hasLantern) return GOLDEN_HOUR;
  if (MORNING_HOME_AREAS.has(state.area) && state.stickers.length === 0 && !hasLantern) {
    return MORNING;
  }
  return NEUTRAL_DAY;
}
