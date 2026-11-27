import type { CheckSpec, Critter, State, World } from "../core";

export type CheckKind = CheckSpec["kind"];

export type BattlePeekData = {
  critterId: string;
  name: string;
  level: number;
  landName: string;
  familiarity: "old-friend" | "befriended" | "first-meeting";
  familiarityLabel: string;
  calmedCount: number;
  checkLabel: string;
  favouriteTreats: readonly string[];
  knownFeelings: readonly string[] | null;
  tip: string;
};

/** Exhaustive human-readable mechanic label for every battle check kind. */
export function checkMechanicLabel(kind: CheckKind): string {
  switch (kind) {
    case "ring":
      return "Timing Ring";
    case "charge":
      return "Hold & Release";
    case "chain":
      return "Rhythm Chain";
    case "catch":
      return "Toy Catch";
    case "lean":
      return "Wind-Gust Lean";
    case "trace":
      return "Shape Trace";
    case "peekaboo":
      return "Peekaboo Freeze";
    case "echo":
      return "Musical Echo Chimes";
  }
}

function peekTip(critter: Critter): string {
  if (critter.talk !== null) {
    return "Calm partway to unlock Talk, then listen closely to their words.";
  }
  const kind = critter.burst.check.kind;
  if (kind === "peekaboo") {
    return "Hold confirm while it looks away; freeze still when it watches!";
  }
  if (kind === "echo") {
    return "Listen to the glowing chime order, then echo each note back.";
  }
  if (critter.windUp !== null) {
    return "Pop every wind-up bubble with matching moves or Coach Ash's lasso.";
  }
  switch (kind) {
    case "trace":
      return "Trace every glowing dot cleanly before the chaos paint dries.";
    case "lean":
      return "Lean into each gust to keep the star centered on the green bar.";
    case "catch":
      return "Slide up or down between lanes to catch every tossed toy.";
    case "chain":
      return "Tap confirm right as each bouncing beat lands in the ring.";
    case "charge":
      return "Hold confirm to charge, then release inside the green band.";
    case "ring":
      return "Press confirm right as the shrinking ring meets the dashed circle.";
  }
}

/**
 * Pure tactical Field Guide snapshot for the active battle foe (spec 8.1).
 * Never spoils undiscovered favourite treats or feelings before calming/lantern.
 */
export function battlePeekData(
  world: Pick<World, "areas" | "battle" | "critters" | "lands" | "storyVariable" | "treats">,
  state: Pick<State, "area" | "battle" | "calms" | "ink" | "stickers">,
): BattlePeekData | null {
  if (state.battle === null) return null;
  const critter = world.critters[state.battle.critterId];
  if (critter === undefined) return null;

  const area = world.areas[state.area];
  const land = area?.land !== undefined
    ? world.lands.find((entry) => entry.id === area.land)
    : undefined;
  const landName = land?.name ?? area?.name ?? "Cloverhollow";

  const speciesCalms = state.calms[critter.species] ?? 0;
  const calmedCount = speciesCalms > 0
    ? speciesCalms
    : (state.stickers.includes(critter.sticker.id) ? 1 : 0);

  let familiarity: BattlePeekData["familiarity"];
  let familiarityLabel: string;
  if (calmedCount >= world.battle.oldFriends.calms) {
    familiarity = "old-friend";
    familiarityLabel = "Old Friend ★";
  } else if (calmedCount >= 1) {
    familiarity = "befriended";
    familiarityLabel = "Befriended ✓";
  } else {
    familiarity = "first-meeting";
    familiarityLabel = "New Friend";
  }

  const favouriteTreats = calmedCount >= 1
    ? world.treats
        .filter((treat) => treat.favourites.includes(critter.species))
        .map((treat) => treat.name)
    : [];

  const hasLantern = world.storyVariable(state.ink, "has_lantern") === true;
  const knownFeelings = calmedCount >= 1 || hasLantern
    ? critter.feelings.map((id) => world.battle.feelings[id].label)
    : null;

  return {
    critterId: critter.id,
    name: critter.name,
    level: critter.level,
    landName,
    familiarity,
    familiarityLabel,
    calmedCount,
    checkLabel: checkMechanicLabel(critter.burst.check.kind),
    favouriteTreats,
    knownFeelings,
    tip: peekTip(critter),
  };
}
