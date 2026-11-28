import { activeBlessingEffects, fishBiteTicksWithBlessing } from "./blessings";
import { nextRandom } from "./random";
import type {
  ActionFrame, ArcadeStep, FishCatchSpec, FishContent, FishRarity, State, World,
} from "./types";

// Bubblegum Bay fishing (spec 8.2): cast out from Sue's dock, watch the bobber
// ripple through one or two nibbles until the big splash, then keep the bobber
// band over the darting catch to reel it in.
//
//   aim ──confirm──▶ casting ──castTicks──▶ waiting ──nibbles──▶ bite
//   bite ──confirm──▶ reeling ──progress=1──▶ result (caught!) ──press, press──▶ closed
//   aim/waiting ──cancel──▶ closed; waiting+confirm / bite timeout / reel=0 ──▶ result (miss)
export type FishPhase = "aim" | "casting" | "waiting" | "bite" | "reeling" | "result";

export type FishGame = {
  game: "fish";
  phase: FishPhase;
  phaseTicks: number;
  power: number;
  castX: number;
  castY: number;
  nibblesLeft: number;
  nextEventTick: number;
  nibblePulse: number;
  fishId: string;
  fishSeed: number;
  reelProgress: number;
  hookPos: number;
  hookVel: number;
  fishPos: number;
  caught: string | null;
  isNew: boolean;
  message: string;
  revealed: number;
};

export type FishCatalogSlot = {
  id: string;
  name: string;
  frame: string;
  rarity: FishRarity;
  caught: boolean;
  count: number;
};

export type FishView = {
  game: "fish";
  phase: FishPhase;
  phaseTicks: number;
  power: number;
  castProgress: number;
  castX: number;
  castY: number;
  nibblePulse: number;
  reelProgress: number;
  hookPos: number;
  zoneHalf: number;
  fishPos: number;
  inZone: boolean;
  holding: boolean;
  caught: {
    id: string;
    name: string;
    frame: string;
    rarity: FishRarity;
    coins: number;
    snacks: number;
    isNew: boolean;
  } | null;
  catalog: FishCatalogSlot[];
  caughtSpecies: number;
  totalSpecies: number;
  hint: string;
  canCancel: boolean;
  message: string;
  revealed: number;
};

const PULSE_TICKS = 28;
const GENTLE_BITE_BONUS = 20;
const GENTLE_ZONE_BONUS = 0.08;

export function newFish(fish: FishContent): FishGame {
  return {
    game: "fish",
    phase: "aim",
    phaseTicks: 0,
    power: 0,
    castX: 0.5,
    castY: 0.78,
    nibblesLeft: 0,
    nextEventTick: 0,
    nibblePulse: 0,
    fishId: fish.catches[0]?.id ?? "minnow",
    fishSeed: 0,
    reelProgress: fish.reelStart,
    hookPos: 0.5,
    hookVel: 0,
    fishPos: 0.5,
    caught: null,
    isNew: false,
    message: "",
    revealed: 0,
  };
}

// Weighted deterministic pick among catches unlocked at `power`.
export function pickFishCatch(
  catches: FishCatchSpec[],
  power: number,
  roll: number,
): FishCatchSpec {
  const pool = catches.filter((item) => item.minPower <= power);
  const eligible = pool.length > 0 ? pool : catches;
  const first = eligible[0];
  if (first === undefined) throw new Error("Fishing catch table is empty");
  const totalWeight = eligible.reduce((sum, item) => sum + item.weight, 0);
  let target = Math.max(0, Math.min(0.999999999, roll)) * totalWeight;
  for (const item of eligible) {
    target -= item.weight;
    if (target < 0) return item;
  }
  return eligible[eligible.length - 1] ?? first;
}

// Pure C1-smooth sine-like wave in [-1, 1] with period 1, using only basic
// IEEE-754 arithmetic so V8 and JavaScriptCore stay bit-identical.
function smoothWave(turns: number): number {
  const frac = turns - Math.floor(turns);
  if (frac < 0.5) {
    const x = frac * 4 - 1;
    return 1 - x * x;
  }
  const x = (frac - 0.5) * 4 - 1;
  return -(1 - x * x);
}

// Smooth 0 -> 1 -> 0 aim sweep over `period` ticks.
export function fishAimPower(ticks: number, period: number): number {
  const step = ((ticks % period) + period) % period;
  const ratio = step / period;
  const tri = ratio <= 0.5 ? ratio * 2 : (1 - ratio) * 2;
  return tri * tri * (3 - 2 * tri);
}

// Smooth deterministic fish swim position in 0.14..0.86 during reeling.
export function fishWavePosition(fightSpeed: number, seed: number, ticks: number): number {
  const phaseOne = (seed % 360) / 360;
  const phaseTwo = ((seed * 7) % 360) / 360;
  const turns = ticks * fightSpeed;
  const wave = 0.5 + 0.24 * smoothWave(turns * 0.34 + phaseOne) +
    0.12 * smoothWave(turns * 0.59 + phaseTwo);
  return Math.max(0.14, Math.min(0.86, wave));
}

export function fishCatalogSummary(
  world: World,
  state: State,
): { caught: number; total: number; trophy: boolean } {
  const catches = world.arcade.fish.catches;
  const caught = catches.filter((item) => (state.caughtFish?.[item.id] ?? 0) > 0).length;
  const trophy = (state.caughtFish?.starfish ?? 0) > 0;
  return { caught, total: catches.length, trophy };
}

function catchById(fish: FishContent, id: string): FishCatchSpec {
  const found = fish.catches.find((item) => item.id === id) ?? fish.catches[0];
  if (found === undefined) throw new Error(`Unknown fish catch: ${id}`);
  return found;
}

function rollGap(fish: FishContent, roll: number): number {
  const span = fish.nibbleGapMax - fish.nibbleGapMin + 1;
  return fish.nibbleGapMin + Math.floor(roll * span);
}

export function stepFish(
  world: World,
  state: State,
  game: FishGame,
  input: ActionFrame,
  gentleTiming = false,
): ArcadeStep {
  const fish = world.arcade.fish;
  const press = input.confirm && !state.previousInput.confirm;
  const pressCancel = input.cancel && !state.previousInput.cancel;
  const kept = { prizes: state.prizes, tickets: state.tickets, snacks: state.snacks };

  switch (game.phase) {
    case "aim": {
      if (pressCancel) return { arcade: null, ...kept };
      if (press) {
        const [rCastX, s1] = nextRandom(state);
        const [rNibbles, s2] = nextRandom(s1);
        const [rGap, s3] = nextRandom(s2);
        const [rFish, s4] = nextRandom(s3);
        const [rSeed, s5] = nextRandom(s4);
        const picked = pickFishCatch(fish.catches, game.power, rFish);
        return {
          arcade: {
            ...game,
            phase: "casting",
            phaseTicks: 0,
            castX: 0.24 + rCastX * 0.52,
            castY: 0.78 - game.power * 0.64,
            nibblesLeft: rNibbles < 0.5 ? 1 : 2,
            nextEventTick: rollGap(fish, rGap),
            nibblePulse: 0,
            fishId: picked.id,
            fishSeed: Math.floor(rSeed * 1000),
            caught: null,
            isNew: false,
            message: "",
            revealed: 0,
          },
          ...kept,
          rng: s5.rng,
        };
      }
      const phaseTicks = game.phaseTicks + 1;
      const power = fishAimPower(phaseTicks, fish.aimPeriod);
      return { arcade: { ...game, phaseTicks, power }, ...kept };
    }
    case "casting": {
      const phaseTicks = game.phaseTicks + 1;
      if (phaseTicks >= fish.castTicks) {
        return {
          arcade: { ...game, phase: "waiting", phaseTicks: 0, nibblePulse: 1 },
          ...kept,
        };
      }
      return { arcade: { ...game, phaseTicks }, ...kept };
    }
    case "waiting": {
      if (pressCancel) return { arcade: null, ...kept };
      if (press) {
        return {
          arcade: {
            ...game,
            phase: "result",
            phaseTicks: 0,
            caught: null,
            isNew: false,
            message: fish.lines.early,
            revealed: 0,
          },
          ...kept,
        };
      }
      const phaseTicks = game.phaseTicks + 1;
      const nibblePulse = game.nibblePulse > 0
        ? (game.nibblePulse >= PULSE_TICKS ? 0 : game.nibblePulse + 1)
        : 0;
      if (phaseTicks >= game.nextEventTick) {
        if (game.nibblesLeft > 0) {
          const [rGap, s1] = nextRandom(state);
          return {
            arcade: {
              ...game,
              phaseTicks,
              nibblesLeft: game.nibblesLeft - 1,
              nextEventTick: phaseTicks + rollGap(fish, rGap),
              nibblePulse: 1,
            },
            ...kept,
            rng: s1.rng,
          };
        }
        return {
          arcade: { ...game, phase: "bite", phaseTicks: 0, nibblePulse: 1 },
          ...kept,
        };
      }
      return { arcade: { ...game, phaseTicks, nibblePulse }, ...kept };
    }
    case "bite": {
      const biteWindow = fishBiteTicksWithBlessing(
        fish.biteTicks,
        GENTLE_BITE_BONUS,
        gentleTiming,
        activeBlessingEffects(world, state).fishBiteGrace,
      );
      if (press) {
        const spec = catchById(fish, game.fishId);
        return {
          arcade: {
            ...game,
            phase: "reeling",
            phaseTicks: 0,
            reelProgress: fish.reelStart,
            hookPos: 0.5,
            hookVel: 0,
            fishPos: fishWavePosition(spec.fightSpeed, game.fishSeed, 0),
          },
          ...kept,
        };
      }
      const phaseTicks = game.phaseTicks + 1;
      if (phaseTicks >= biteWindow) {
        return {
          arcade: {
            ...game,
            phase: "result",
            phaseTicks: 0,
            caught: null,
            isNew: false,
            message: fish.lines.missed,
            revealed: 0,
          },
          ...kept,
        };
      }
      const nibblePulse = game.nibblePulse >= PULSE_TICKS ? 1 : game.nibblePulse + 1;
      return { arcade: { ...game, phaseTicks, nibblePulse }, ...kept };
    }
    case "reeling": {
      const spec = catchById(fish, game.fishId);
      const nextTicks = game.phaseTicks + 1;
      const rawVel = game.hookVel + (input.confirm ? fish.hookAccel : -fish.hookGravity);
      let hookVel = Math.max(-fish.hookMaxSpeed, Math.min(fish.hookMaxSpeed, rawVel));
      let hookPos = game.hookPos + hookVel;
      if (hookPos <= 0) {
        hookPos = 0;
        hookVel = hookVel < -0.004 ? -hookVel * 0.35 : 0;
      } else if (hookPos >= 1) {
        hookPos = 1;
        hookVel = hookVel > 0.004 ? -hookVel * 0.35 : 0;
      }
      const fishPos = fishWavePosition(spec.fightSpeed, game.fishSeed, nextTicks);
      const zoneHalf = gentleTiming ? fish.zoneHalf + GENTLE_ZONE_BONUS : fish.zoneHalf;
      const drain = gentleTiming ? fish.reelDrain * 0.5 : fish.reelDrain;
      const inside = Math.abs(hookPos - fishPos) <= zoneHalf;
      const reelProgress = inside
        ? Math.min(1, game.reelProgress + fish.reelGain)
        : Math.max(0, game.reelProgress - drain);
      if (reelProgress >= 1) {
        const previousCount = state.caughtFish?.[spec.id] ?? 0;
        const caughtFish = { ...(state.caughtFish ?? {}), [spec.id]: previousCount + 1 };
        return {
          arcade: {
            ...game,
            phase: "result",
            phaseTicks: 0,
            reelProgress: 1,
            hookPos,
            hookVel,
            fishPos,
            caught: spec.id,
            isNew: previousCount === 0,
            message: spec.line,
            revealed: 0,
          },
          ...kept,
          coins: state.coins + spec.coins,
          snacks: state.snacks + spec.snacks,
          caughtFish,
        };
      }
      if (reelProgress <= 0 || nextTicks >= fish.reelMaxTicks) {
        return {
          arcade: {
            ...game,
            phase: "result",
            phaseTicks: 0,
            reelProgress,
            hookPos,
            hookVel,
            fishPos,
            caught: null,
            isNew: false,
            message: fish.lines.missed,
            revealed: 0,
          },
          ...kept,
        };
      }
      return {
        arcade: {
          ...game,
          phaseTicks: nextTicks,
          reelProgress,
          hookPos,
          hookVel,
          fishPos,
        },
        ...kept,
      };
    }
    case "result": {
      const dismiss = press || pressCancel;
      if (game.revealed < game.message.length) {
        const revealed = dismiss
          ? game.message.length
          : Math.min(game.message.length, game.revealed + world.tunables.interact.revealPerTick);
        return { arcade: { ...game, revealed }, ...kept };
      }
      return { arcade: dismiss ? null : game, ...kept };
    }
  }
}

export function fishView(
  world: World,
  state: State,
  game: FishGame,
  gentleTiming = false,
): FishView {
  const fish = world.arcade.fish;
  const zoneHalf = gentleTiming ? fish.zoneHalf + GENTLE_ZONE_BONUS : fish.zoneHalf;
  const catalog: FishCatalogSlot[] = fish.catches.map((item) => {
    const count = state.caughtFish?.[item.id] ?? 0;
    return {
      id: item.id,
      name: item.name,
      frame: item.frame,
      rarity: item.rarity,
      caught: count > 0,
      count,
    };
  });
  const caughtSpec = game.caught === null ? null : catchById(fish, game.caught);
  const hint = game.phase === "aim"
    ? fish.lines.aim
    : game.phase === "casting" || game.phase === "waiting"
      ? fish.lines.wait
      : game.phase === "bite"
        ? fish.lines.bite
        : game.phase === "reeling"
          ? fish.lines.reel
          : "";
  return {
    game: "fish",
    phase: game.phase,
    phaseTicks: game.phaseTicks,
    power: game.power,
    castProgress: game.phase === "aim"
      ? 0
      : game.phase === "casting"
        ? Math.min(1, game.phaseTicks / Math.max(1, fish.castTicks))
        : 1,
    castX: game.castX,
    castY: game.castY,
    nibblePulse: game.nibblePulse,
    reelProgress: game.reelProgress,
    hookPos: game.hookPos,
    zoneHalf,
    fishPos: game.fishPos,
    inZone: game.phase === "reeling" && Math.abs(game.hookPos - game.fishPos) <= zoneHalf,
    holding: state.previousInput.confirm,
    caught: caughtSpec === null
      ? null
      : {
          id: caughtSpec.id,
          name: caughtSpec.name,
          frame: caughtSpec.frame,
          rarity: caughtSpec.rarity,
          coins: caughtSpec.coins,
          snacks: caughtSpec.snacks,
          isNew: game.isNew,
        },
    catalog,
    caughtSpecies: catalog.filter((slot) => slot.caught).length,
    totalSpecies: catalog.length,
    hint,
    canCancel: game.phase === "aim" || game.phase === "waiting",
    message: game.message,
    revealed: game.revealed,
  };
}
