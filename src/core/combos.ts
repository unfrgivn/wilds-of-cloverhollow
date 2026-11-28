import type { Battle, CheckSpec, CommandTargetScope, Grade, State, World } from "./types";
import { levelForXp, statsForCommand } from "./levels";
import { battleParty } from "./party";

export type DualComboId =
  | "combo:yarn-ball-lullaby"
  | "combo:bubblegum-lasso-spin"
  | "combo:rainbow-splash-juggle"
  | "combo:cloverhollow-harmony";

export type DualComboSpec = {
  id: DualComboId;
  label: string;
  partners: readonly string[];
  cost: number;
  emblem: string;
  targetScope: Extract<CommandTargetScope, "single" | "all">;
  check: CheckSpec;
  hint: string;
  popBubbles: number;
  energyGain: number;
  burstSoften: number;
  bonusCoinsOnGreat: number;
  calmMultiplier: number;
  lines: Record<Grade, string>;
};

export const DUAL_COMBOS: readonly DualComboSpec[] = [
  {
    id: "combo:yarn-ball-lullaby",
    label: "Yarn-Ball Lullaby",
    partners: ["fae", "maddie"],
    cost: 2,
    emblem: "combo-lullaby",
    targetScope: "single",
    check: {
      kind: "ring",
      ticks: 56,
      targetTick: 36,
      greatWindow: 5,
      goodWindow: 11,
    },
    hint: "Press confirm as the lullaby ring meets the star!",
    popBubbles: 1,
    energyGain: 1,
    burstSoften: 1,
    bonusCoinsOnGreat: 0,
    calmMultiplier: 1.15,
    lines: {
      great: "Fae hums while Maddie spins a cozy yarn cloud! +1 leaf and softer bursts!",
      good: "Fae and Maddie weave a warm yarn lullaby! +1 leaf and a gentler breeze!",
      miss: "Maddie tangles the yarn around her paws, still cozy enough for +1 leaf!",
    },
  },
  {
    id: "combo:bubblegum-lasso-spin",
    label: "Bubblegum Lasso Spin",
    partners: ["fae", "sue"],
    cost: 2,
    emblem: "combo-lasso",
    targetScope: "all",
    check: {
      kind: "spin-snag",
      spinsNeeded: 6,
      spinTicks: 120,
      snagTicks: 56,
      targetTick: 28,
      greatWindow: 5,
      goodWindow: 11,
    },
    hint: "Circle directions to spin the lasso, then press confirm to snag!",
    popBubbles: 1,
    energyGain: 0,
    burstSoften: 0,
    bonusCoinsOnGreat: 4,
    calmMultiplier: 1.0,
    lines: {
      great: "Fae and Sue whip up a bubblegum lasso whirl across the clearing! +4 coins!",
      good: "Fae's lasso and Sue's ribbon bobber swoop past every critter!",
      miss: "The bubblegum lasso loops into a silly pretzel, and everyone giggles!",
    },
  },
  {
    id: "combo:rainbow-splash-juggle",
    label: "Rainbow Splash-Juggle",
    partners: ["sue", "jordan"],
    cost: 2,
    emblem: "combo-juggle",
    targetScope: "all",
    check: {
      kind: "chain",
      travelTicks: 32,
      hitWindow: 8,
      arrivals: [36, 56, 76, 96, 116],
      look: "star",
    },
    hint: "Tap confirm on each rainbow star beat!",
    popBubbles: 2,
    energyGain: 0,
    burstSoften: 0,
    bonusCoinsOnGreat: 0,
    calmMultiplier: 1.2,
    lines: {
      great: "Sue's bubbles and Jordan's pinecones burst into a dazzling rainbow cascade!",
      good: "Sue and Jordan toss a shimmering volley of starlit splashes!",
      miss: "Pinecones splash into Sue's bubbles with a funny plop!",
    },
  },
  {
    id: "combo:cloverhollow-harmony",
    label: "Cloverhollow Harmony",
    partners: ["fae", "maddie", "sue", "jordan"],
    cost: 3,
    emblem: "combo-harmony",
    targetScope: "all",
    check: {
      kind: "chain",
      travelTicks: 34,
      hitWindow: 9,
      arrivals: [36, 58, 80, 102],
      look: "star",
    },
    hint: "Tap confirm together for the Cloverhollow Harmony!",
    popBubbles: 99,
    energyGain: 1,
    burstSoften: 0,
    bonusCoinsOnGreat: 0,
    calmMultiplier: 1.35,
    lines: {
      great: "Cloverhollow Harmony! Warm watercolor light washes over every critter! +1 leaf!",
      good: "Fae, Maddie, Sue, and Jordan shine in harmony across the field! +1 leaf!",
      miss: "Everyone piles into a joyful group hug! Warmth spreads and restores +1 leaf!",
    },
  },
];

export function isDualComboCommand(commandId: string | null | undefined): commandId is DualComboId {
  return commandId !== null && commandId !== undefined &&
    DUAL_COMBOS.some((combo) => combo.id === commandId);
}

export function dualComboById(commandId: string): DualComboSpec | null {
  return DUAL_COMBOS.find((combo) => combo.id === commandId) ?? null;
}

/**
 * Dual-friend combos available to `activeActorId`: sparkle meets combo cost,
 * every partner is in the active fighting roster, and the active actor is one
 * of the combo's partners.
 */
export function availableDualCombos(
  world: World,
  state: State,
  battle: Battle,
  activeActorId: string,
): DualComboSpec[] {
  const sparkle = battle.sparkle ?? 0;
  if (sparkle < 2) return [];
  const fighting = new Set<string>([
    "fae",
    ...battleParty(world, state.party).map((member) => member.id),
  ]);
  return DUAL_COMBOS.filter(
    (combo) =>
      sparkle >= combo.cost &&
      combo.partners.includes(activeActorId) &&
      combo.partners.every((partner) => fighting.has(partner)),
  );
}

/** Combined calm power for a Dual-Friend Synergy Combo based on partner levels. */
export function dualComboCalm(
  world: World,
  state: State,
  combo: DualComboSpec,
  grade: Grade,
): number {
  let combinedPower = 0;
  for (const partnerId of combo.partners) {
    if (partnerId === "fae") {
      combinedPower += statsForCommand(
        world.levels,
        "soothe",
        levelForXp(world.levels, state.xp),
      ).power;
      continue;
    }
    const member = state.party.find((item) => item.id === partnerId);
    const commandId = world.party[partnerId]?.command?.id ?? "soothe";
    combinedPower += statsForCommand(
      world.levels,
      commandId,
      levelForXp(world.levels, member?.xp ?? state.xp),
    ).power;
  }
  const scaled = Math.round(combinedPower * combo.calmMultiplier);
  if (grade === "great") return scaled + world.battle.feelingBonus;
  if (grade === "good") return Math.max(1, Math.round(scaled * 0.75));
  return Math.max(1, Math.round(scaled * 0.45));
}

/** Pops up to `count` unpopped bubbles from a wind-up state (pure). */
export function popWindUpBubbles(
  windUp: Battle["windUp"],
  count: number,
): Battle["windUp"] {
  if (windUp === null || count <= 0) return windUp;
  let remaining = count;
  const popped = windUp.popped.map((isPopped) => {
    if (!isPopped && remaining > 0) {
      remaining -= 1;
      return true;
    }
    return isPopped;
  });
  return { ...windUp, popped };
}
