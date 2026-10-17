import { nextRandom } from "./random";
import type { ActionFrame, ArcadeOwned, MoleContent, State, World } from "./types";

// Boop-a-Mole (spec 8.2): a round of moles, one at a time, from five holes in
// a plus. A fresh press of an arrow boops that hole, and Z the middle; a
// booped mole winces, giggles, and ducks. Booping an empty hole only squeaks,
// and a missed mole just ducks: nothing is ever lost.
//
//   ready ──readyTicks──▶ playing ──the last mole down──▶ result
//   result ──press (show it all), press──▶ closed
//
// A mole's life, in `playing`:
//
//   rising ──riseTicks──▶ up ──its window──▶ ducking ──duckTicks──▶ waiting
//     └──────boop──────────┴─▶ booped ──boopTicks──▶ giggling ──duckTicks──▶ waiting
//   waiting ──gapTicks──▶ the next mole rising
export const moleHoles = ["up", "left", "middle", "right", "down"] as const;
export type MoleHole = (typeof moleHoles)[number];
export type MolePhase = "ready" | "playing" | "result";
export type MoleStage = "rising" | "up" | "booped" | "giggling" | "ducking" | "waiting";
export type MoleGame = {
  game: "mole";
  phase: MolePhase;
  phaseTicks: number;
  // The holes the round's moles come from, in order, drawn when it opened.
  order: MoleHole[];
  // The mole in play (its index in `order`), its stage, and ticks in it.
  mole: number;
  stage: MoleStage;
  stageTicks: number;
  booped: number;
  // The hammer's last swing: at which hole, ticks since, and whether it booped.
  hammer: { hole: MoleHole; ticks: number; hit: boolean } | null;
  message: string;
  revealed: number;
};

// A new round: its holes drawn from the game's random generator, never the
// same hole twice in a row, one draw a mole. Returns the round and the state
// with the generator moved on.
export function newMole(mole: MoleContent, state: State): [MoleGame, State] {
  let current = state;
  const order: MoleHole[] = [];
  for (let index = 0; index < mole.moles; index += 1) {
    const [value, after] = nextRandom(current);
    current = after;
    const open = moleHoles.filter((hole) => hole !== order.at(-1));
    order.push(open[Math.min(open.length - 1, Math.floor(value * open.length))] ?? "middle");
  }
  return [{
    game: "mole", phase: "ready", phaseTicks: 0, order, mole: 0, stage: "rising",
    stageTicks: 0, booped: 0, hammer: null, message: "", revealed: 0,
  }, current];
}

// How long the `index`th mole of the round stays up: from `upFirst` for the
// first down to `upLast` for the last, in even steps, rounded.
export function moleWindow(mole: MoleContent, index: number): number {
  const share = mole.moles <= 1 ? 0 : index / (mole.moles - 1);
  return Math.round(mole.upFirst + (mole.upLast - mole.upFirst) * share);
}

// The hole this tick's input boops, if any: a fresh press (down now, not on
// the previous tick) of an arrow or of Z. More than one at once: the middle,
// then up, down, left, right.
export function moleHole(input: ActionFrame, previous: ActionFrame): MoleHole | null {
  if (input.confirm && !previous.confirm) return "middle";
  if (input.move.y < 0 && !(previous.move.y < 0)) return "up";
  if (input.move.y > 0 && !(previous.move.y > 0)) return "down";
  if (input.move.x < 0 && !(previous.move.x < 0)) return "left";
  if (input.move.x > 0 && !(previous.move.x > 0)) return "right";
  return null;
}

// One tick of a round. Like the other games, it returns only what the game
// owns; the simulation keeps the world around it frozen.
export function stepMole(
  world: World,
  state: State,
  game: MoleGame,
  input: ActionFrame,
): ArcadeOwned {
  const mole = world.arcade.mole;
  const kept = { prizes: state.prizes, tickets: state.tickets };
  const owned = (changed: MoleGame): ArcadeOwned => ({ arcade: changed, ...kept });
  if (game.phase === "result") {
    const press = input.confirm && !state.previousInput.confirm;
    if (game.revealed < game.message.length) {
      const revealed = press ? game.message.length
        : Math.min(game.message.length, game.revealed + world.tunables.interact.revealPerTick);
      return owned({ ...game, revealed });
    }
    return { arcade: press ? null : game, ...kept };
  }
  if (game.phase === "ready") {
    return game.phaseTicks + 1 < mole.readyTicks
      ? owned({ ...game, phaseTicks: game.phaseTicks + 1 })
      : owned({ ...game, phase: "playing", phaseTicks: 0, stage: "rising", stageTicks: 0 });
  }

  // The hammer: an old swing fades; a fresh press swings at its hole, and
  // boops the mole there if it's out (rising or up).
  const aged = game.hammer === null || game.hammer.ticks + 1 >= mole.hammerTicks ? null
    : { ...game.hammer, ticks: game.hammer.ticks + 1 };
  const swing = moleHole(input, state.previousInput);
  const out = game.stage === "rising" || game.stage === "up";
  const hit = swing !== null && out && game.order[game.mole] === swing;
  const played: MoleGame = {
    ...game,
    phaseTicks: game.phaseTicks + 1,
    hammer: swing === null ? aged : { hole: swing, ticks: 0, hit },
  };
  if (hit) return owned({ ...played, stage: "booped", stageTicks: 0, booped: game.booped + 1 });

  // The mole's life goes on.
  const to = (stage: MoleStage): MoleGame => ({ ...played, stage, stageTicks: 0 });
  const lasts: Record<MoleStage, number> = {
    rising: mole.riseTicks,
    up: moleWindow(mole, game.mole),
    booped: mole.boopTicks,
    giggling: mole.duckTicks,
    ducking: mole.duckTicks,
    waiting: mole.gapTicks,
  };
  if (game.stageTicks + 1 < lasts[game.stage])
    return owned({ ...played, stageTicks: game.stageTicks + 1 });
  switch (game.stage) {
    case "rising":
      return owned(to("up"));
    case "up":
      return owned(to("ducking"));
    case "booped":
      return owned(to("giggling"));
    case "giggling":
    case "ducking": {
      if (game.mole + 1 < game.order.length) return owned(to("waiting"));
      // The last mole is down: the round pays its tickets.
      const paid = game.booped * mole.ticketsPerBoop;
      const message = mole.lines.result.replace("{booped}", String(game.booped))
        .replace("{moles}", String(game.order.length)).replace("{tickets}", String(paid));
      return {
        arcade: { ...played, phase: "result", phaseTicks: 0, hammer: null, message, revealed: 0 },
        prizes: state.prizes,
        tickets: state.tickets + paid,
      };
    }
    case "waiting":
      return owned({ ...to("rising"), mole: game.mole + 1 });
  }
}

// What the Boop-a-Mole close-up draws (spec 8.2): each hole and the mole in
// it, if one's out (how far risen, 0 to 1, and its face), the hammer's swing,
// and the round's count.
export type MoleFace = "up" | "booped" | "giggle";
export type MoleView = {
  game: "mole";
  phase: MolePhase;
  holes: { hole: MoleHole; mole: { rise: number; face: MoleFace } | null }[];
  hammer: { hole: MoleHole; progress: number; hit: boolean } | null;
  booped: number;
  moles: number;
  // Moles still to come, the one out included.
  molesLeft: number;
  hint: string | null;
  message: string;
  revealed: number;
};

// The mole out of its hole now, if one is: how far risen, and its face. A
// booped mole winces for the first half of `boopTicks`, then giggles, and
// keeps giggling as it ducks; a missed one just ducks.
function moleOut(mole: MoleContent, game: MoleGame): { rise: number; face: MoleFace } | null {
  if (game.phase !== "playing") return null;
  const share = (ticks: number): number => game.stageTicks / ticks;
  switch (game.stage) {
    case "rising":
      return { rise: share(mole.riseTicks), face: "up" };
    case "up":
      return { rise: 1, face: "up" };
    case "booped":
      return { rise: 1, face: share(mole.boopTicks) < 0.5 ? "booped" : "giggle" };
    case "giggling":
      return { rise: 1 - share(mole.duckTicks), face: "giggle" };
    case "ducking":
      return { rise: 1 - share(mole.duckTicks), face: "up" };
    case "waiting":
      return null;
  }
}

export function moleView(world: World, game: MoleGame): MoleView {
  const mole = world.arcade.mole;
  const out = moleOut(mole, game);
  const at = game.order[game.mole];
  // A mole is still to come until it's down (or, before the round, all are).
  const down = game.phase === "result" || game.stage === "waiting" ? 1 : 0;
  return {
    game: "mole",
    phase: game.phase,
    holes: moleHoles.map((hole) => ({ hole, mole: hole === at ? out : null })),
    hammer: game.hammer === null ? null : {
      hole: game.hammer.hole, progress: game.hammer.ticks / mole.hammerTicks, hit: game.hammer.hit,
    },
    booped: game.booped,
    moles: game.order.length,
    molesLeft: game.phase === "ready" ? game.order.length
      : Math.max(0, game.order.length - game.mole - down),
    hint: game.phase === "ready" ? mole.lines.ready
      : game.phase === "playing" ? mole.lines.boop : null,
    message: game.message,
    revealed: game.revealed,
  };
}
