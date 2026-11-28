import type { CheckSpec, Critter, State, World } from "../core";
import { adaptHintForInputMode } from "./battle-checks-helpers";
import type { HudInputMode } from "./hud-hints";

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
  intentNote?: string | null;
  phase2Note?: string | null;
  formationPager?: { index: number; total: number } | null;
};

/**
 * Steps the active target index in a multi-foe formation by `delta` (`-1` or `1`),
 * wrapping around and skipping already-soothed critters. Returns `null` when fewer
 * than two un-soothed foes remain.
 */
export function stepMultiFoeTargetIndex(
  foes: readonly { soothed: boolean }[] | undefined,
  currentIndex: number,
  delta: -1 | 1,
): number | null {
  if (foes === undefined || foes.length <= 1) return null;
  let activeCount = 0;
  for (const foe of foes) {
    if (!foe.soothed) activeCount += 1;
  }
  if (activeCount < 2) return null;
  const total = foes.length;
  const origin = ((Math.trunc(currentIndex) % total) + total) % total;
  for (let step = 1; step < total; step += 1) {
    const candidate = (((origin + delta * step) % total) + total) % total;
    if (foes[candidate]?.soothed === false && candidate !== origin) {
      return candidate;
    }
  }
  return null;
}

export type BattlePeekOptions = {
  inputMode?: HudInputMode;
  intentLabel?: string | null;
  intentDetail?: string | null;
  phase2Title?: string | null;
  phase2Rhythm?: string | null;
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
    case "which-one":
      return "3-Cup Shuffle";
    case "whack":
      return "Pop-Up Ticket Whack";
    case "spin-snag":
      return "Lasso Spin & Snag";
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
    case "which-one":
      return "Keep your eyes on the hiding cup as they shuffle, then pick it!";
    case "whack":
      return "Tap the matching direction as each ticket pops (confirm for middle).";
    case "spin-snag":
      return "Circle directions to spin the lasso, then confirm on the star!";
  }
}

/**
 * Pure tactical Field Guide snapshot for the active battle foe (spec 8.1).
 * Never spoils undiscovered favourite treats or feelings before calming/lantern.
 */
export function battlePeekData(
  world: Pick<World, "areas" | "battle" | "critters" | "lands" | "storyVariable" | "treats">,
  state: Pick<State, "area" | "battle" | "calms" | "ink" | "stickers">,
  options?: BattlePeekOptions,
): BattlePeekData | null {
  if (state.battle === null) return null;
  const foes = state.battle.foes;
  let activeCritterId = state.battle.critterId;
  let formationPager: { index: number; total: number } | null = null;
  if (foes !== undefined && foes.length > 0) {
    const chosenIndex = state.battle.targetIndex ?? 0;
    const chosen = foes[chosenIndex];
    const resolvedIndex =
      chosen !== undefined && !chosen.soothed
        ? chosenIndex
        : foes.findIndex((foe) => !foe.soothed);
    const targeted = resolvedIndex >= 0 ? foes[resolvedIndex] : chosen;
    if (targeted !== undefined) activeCritterId = targeted.critterId;
    if (foes.length > 1) {
      let activeCount = 0;
      let activePos = 0;
      for (let index = 0; index < foes.length; index += 1) {
        const foe = foes[index];
        if (foe === undefined || foe.soothed) continue;
        if (index === resolvedIndex) activePos = activeCount;
        activeCount += 1;
      }
      if (activeCount >= 2) {
        formationPager = { index: activePos + 1, total: activeCount };
      }
    }
  }
  const critter = world.critters[activeCritterId];
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

  const intentLabel = options?.intentLabel ?? null;
  const intentDetail = options?.intentDetail ?? null;
  const intentNote =
    intentLabel !== null && intentLabel !== ""
      ? intentDetail !== null && intentDetail !== ""
        ? `${intentLabel} — ${intentDetail}`
        : intentLabel
      : null;

  const phase2Title = options?.phase2Title ?? null;
  const phase2Rhythm = options?.phase2Rhythm ?? null;
  const phase2Note =
    phase2Title !== null && phase2Title !== ""
      ? phase2Rhythm !== null && phase2Rhythm !== ""
        ? `Phase 2 · ${phase2Title} (${phase2Rhythm})`
        : `Phase 2 · ${phase2Title}`
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
    tip: adaptHintForInputMode(peekTip(critter), options?.inputMode ?? "keyboard"),
    intentNote,
    phase2Note,
    formationPager,
  };
}
