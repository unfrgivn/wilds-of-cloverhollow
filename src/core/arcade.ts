import type { ActionFrame, ClawContent, HeapPlush, State, World } from "./types";

// The arcade's games (spec 8.2). Only the claw machine so far.
export const arcadeGames = ["claw"] as const;
export type ArcadeGameId = (typeof arcadeGames)[number];
export function isArcadeGameId(value: string): value is ArcadeGameId {
  return arcadeGames.some((game) => game === value);
}

// The claw, in two holds: slide it right, then push it back into the box.
//
//   ready ──press──▶ sliding ──let go / rail end──▶ aiming
//   aiming ──press──▶ pushing ──let go / back wall──▶ dropping
//   dropping ▶ grabbing ▶ lifting ▶ returning ──home, over the chute──▶ releasing
//   releasing ▶ result ──press (show it all), press──▶ closed
export type ClawPhase =
  | "ready" | "sliding" | "aiming" | "pushing" | "dropping" | "grabbing"
  | "lifting" | "returning" | "releasing" | "result";
// Decided as the claw closes: the topmost plush in reach came free, was held
// down by another resting on it, or there was nothing in reach.
export type ClawOutcome = "grabbed" | "stuck" | "empty";
export type ClawGame = {
  game: "claw";
  phase: ClawPhase;
  phaseTicks: number;
  x: number;
  z: number;
  // The topmost plush in reach when the claw closed, and what happened to it.
  target: string | null;
  outcome: ClawOutcome | null;
  message: string;
  revealed: number;
};
export type ArcadeGame = ClawGame;
type Owned = Pick<State, "arcade" | "prizes">;

export function openClaw(world: World, state: State, price: number): State {
  const claw = world.arcade.claw;
  return {
    ...state,
    coins: state.coins - price,
    arcade: {
      game: "claw", phase: "ready", phaseTicks: 0, x: claw.railLeft, z: claw.depthFront,
      target: null, outcome: null, message: "", revealed: 0,
    },
  };
}

function inHeap(state: State, plush: HeapPlush): boolean {
  return !state.prizes.includes(plush.prize);
}

function squaredDistance(plush: HeapPlush, x: number, z: number): number {
  return (x - plush.x) * (x - plush.x) + (z - plush.z) * (z - plush.z);
}

// The plush the claw comes down on at (x, z): of those still in the heap
// within reach on the floor, the highest in the pile, then the nearest, then
// the first in content order.
export function topPlush(
  claw: ClawContent,
  state: State,
  x: number,
  z: number,
): HeapPlush | null {
  let best: HeapPlush | null = null;
  for (const plush of claw.heap) {
    if (!inHeap(state, plush) || squaredDistance(plush, x, z) > claw.reach * claw.reach)
      continue;
    if (best === null || plush.level > best.level ||
      (plush.level === best.level &&
        squaredDistance(plush, x, z) < squaredDistance(best, x, z)))
      best = plush;
  }
  return best;
}

// A plush is held down while another plush still in the heap rests on it.
export function heldDown(claw: ClawContent, state: State, prize: string): boolean {
  return claw.heap.some((plush) => inHeap(state, plush) && plush.on.includes(prize));
}

function timedTicks(claw: ClawContent, phase: ClawPhase): number {
  if (phase === "dropping") return claw.dropTicks;
  if (phase === "grabbing") return claw.grabTicks;
  if (phase === "lifting") return claw.liftTicks;
  return claw.releaseTicks;
}

// One tick of the open game. It returns only what the game owns; the frozen
// world around it (Fae, the party, the tick) is the simulation's.
export function stepArcade(world: World, state: State, input: ActionFrame): Owned {
  const game = state.arcade;
  const prizes = state.prizes;
  if (game === null) return { arcade: null, prizes };
  const claw = world.arcade.claw;
  const press = input.confirm && !state.previousInput.confirm;
  const to = (phase: ClawPhase, changes: Partial<ClawGame> = {}): Owned =>
    ({ arcade: { ...game, ...changes, phase, phaseTicks: 0 }, prizes });
  const stay = (changes: Partial<ClawGame> = {}): Owned =>
    ({ arcade: { ...game, ...changes, phaseTicks: game.phaseTicks + 1 }, prizes });
  switch (game.phase) {
    case "ready":
      return press ? to("sliding") : stay();
    case "sliding": {
      if (!input.confirm) return to("aiming");
      const x = Math.min(claw.railRight, game.x + claw.speed);
      return x === claw.railRight ? to("aiming", { x }) : stay({ x });
    }
    case "aiming":
      return press ? to("pushing") : stay();
    case "pushing": {
      if (!input.confirm) return to("dropping");
      const z = Math.min(claw.depthBack, game.z + claw.speed);
      return z === claw.depthBack ? to("dropping", { z }) : stay({ z });
    }
    case "returning": {
      const x = Math.max(claw.railLeft, game.x - claw.speed);
      const z = Math.max(claw.depthFront, game.z - claw.speed);
      return x === claw.railLeft && z === claw.depthFront
        ? to("releasing", { x, z }) : stay({ x, z });
    }
    case "result": {
      if (game.revealed < game.message.length) {
        const revealed = press ? game.message.length
          : Math.min(game.message.length, game.revealed + world.tunables.interact.revealPerTick);
        return { arcade: { ...game, revealed }, prizes };
      }
      return press ? { arcade: null, prizes } : { arcade: game, prizes };
    }
    case "dropping":
    case "grabbing":
    case "lifting":
    case "releasing":
      break;
  }
  if (game.phaseTicks + 1 < timedTicks(claw, game.phase)) return stay();
  switch (game.phase) {
    case "dropping":
      return to("grabbing");
    case "grabbing": {
      const top = topPlush(claw, state, game.x, game.z);
      const outcome: ClawOutcome = top === null ? "empty"
        : heldDown(claw, state, top.prize) ? "stuck" : "grabbed";
      return to("lifting", { target: top?.prize ?? null, outcome });
    }
    case "lifting":
      return to("returning");
    case "releasing":
      return result(world, game, prizes);
  }
}

function result(world: World, game: ClawGame, prizes: string[]): Owned {
  const lines = world.arcade.claw.lines;
  const won = game.outcome === "grabbed" && game.target !== null ? game.target : null;
  const name = world.arcade.prizes.find((prize) => prize.id === won)?.name;
  const message = won !== null && name !== undefined ? lines.won.replace("{prize}", name)
    : game.outcome === "stuck" ? lines.stuck : lines.missed;
  return {
    arcade: { ...game, phase: "result", phaseTicks: 0, message, revealed: 0 },
    prizes: won === null || prizes.includes(won) ? prizes : [...prizes, won],
  };
}

// What the close-up draws (spec 8.2), in floor units: no pixels here.
export type ArcadeView = {
  game: "claw";
  phase: ClawPhase;
  box: { width: number; depth: number };
  rail: { left: number; right: number };
  depth: { front: number; back: number };
  // How far from a plush's spot on the floor the claw still catches it.
  reach: number;
  // `drop` runs from 0 (up under the rail) to 1 (resting at `stop`, the height
  // in plush levels of what it comes down on: 0 for bare floor).
  claw: { x: number; z: number; drop: number; stop: number; open: boolean };
  // The plushes still in the machine, in content order. The held one rides the
  // claw; `tug` marks one the claw is pulling at but can't free; `fall` runs
  // from 0 to 1 as the held one drops into the chute.
  plushes: {
    id: string;
    name: string;
    frame: string;
    x: number;
    z: number;
    level: number;
    held: boolean;
    tug: boolean;
    fall: number;
  }[];
  hint: string | null;
  message: string;
  revealed: number;
  prize: { id: string; name: string; frame: string; title: string } | null;
};

const openPhases: ClawPhase[] = ["ready", "sliding", "aiming", "pushing", "dropping", "releasing"];

export function arcadeView(world: World, state: State): ArcadeView | null {
  const game = state.arcade;
  if (game === null) return null;
  const claw = world.arcade.claw;
  const catalogue = world.arcade.prizes;
  const held = game.outcome === "grabbed" ? game.target : null;
  const tugging = game.outcome === "stuck" &&
    (game.phase === "lifting" || game.phase === "returning") ? game.target : null;
  const plushes = claw.heap.filter((plush) => inHeap(state, plush)).map((plush) => {
    const prize = catalogue.find((item) => item.id === plush.prize);
    const isHeld = plush.prize === held;
    return {
      id: plush.prize,
      name: prize?.name ?? plush.prize,
      frame: prize?.frame ?? plush.prize,
      x: isHeld ? game.x : plush.x,
      z: isHeld ? game.z : plush.z,
      level: plush.level,
      held: isHeld,
      tug: plush.prize === tugging,
      fall: isHeld && game.phase === "releasing" ? game.phaseTicks / claw.releaseTicks : 0,
    };
  });
  const top = topPlush(claw, state, game.x, game.z);
  const drop = game.phase === "dropping" ? game.phaseTicks / claw.dropTicks
    : game.phase === "grabbing" ? 1
      : game.phase === "lifting" ? 1 - game.phaseTicks / claw.liftTicks : 0;
  const won = game.phase === "result" ? held : null;
  const prize = catalogue.find((item) => item.id === won);
  return {
    game: "claw",
    phase: game.phase,
    box: { ...claw.box },
    rail: { left: claw.railLeft, right: claw.railRight },
    depth: { front: claw.depthFront, back: claw.depthBack },
    reach: claw.reach,
    claw: {
      x: game.x, z: game.z, drop,
      stop: top === null ? 0 : top.level + 1,
      open: openPhases.includes(game.phase),
    },
    plushes,
    hint: game.phase === "ready" ? claw.lines.slide
      : game.phase === "aiming" ? claw.lines.push : null,
    message: game.message,
    revealed: game.revealed,
    prize: prize === undefined ? null : { ...prize, title: claw.lines.prizeTitle },
  };
}
