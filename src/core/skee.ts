import type { ActionFrame, ArcadeOwned, SkeeContent, State, World } from "./types";

// Skee-ball (spec 8.2): five balls, each in two presses. An arrow sweeps back
// and forth across the foot of the lane, and a press sets the aim; then a hold
// winds up, and letting go rolls the ball. Aim decides where across the target
// board it lands, the hold how far up.
//
//   aiming ──press──▶ winding ──press──▶ powering ──let go / held too long──▶ rolling
//   rolling ▶ hopping ▶ scored ──more balls──▶ aiming
//                             └─the last one──▶ result ──press (show it all), press──▶ closed
export type SkeePhase =
  | "aiming" | "winding" | "powering" | "rolling" | "hopping" | "scored" | "result";
// A ball rolled: where it lands on the board, and what it scores there.
export type SkeeThrow = { x: number; y: number; points: number };
export type SkeeGame = {
  game: "skee";
  phase: SkeePhase;
  phaseTicks: number;
  // The arrow's place across the board, and which way it's sweeping.
  aim: number;
  sweep: 1 | -1;
  // Ticks the press has been held, this ball.
  held: number;
  throws: SkeeThrow[];
  message: string;
  revealed: number;
};

// A new game: the first ball, the arrow at the lane's left edge.
export function newSkee(skee: SkeeContent): SkeeGame {
  return {
    game: "skee", phase: "aiming", phaseTicks: 0, aim: -skee.board.width / 2, sweep: 1,
    held: 0, throws: [], message: "", revealed: 0,
  };
}

const squared = (value: number): number => value * value;

// Where on the target a ball lands: a corner hole (left or right), a ring
// (its index, smallest first), or the floor's pocket.
export type SkeeZone =
  | { kind: "corner"; side: -1 | 1 }
  | { kind: "ring"; index: number }
  | { kind: "floor" };
type Target = Pick<SkeeContent, "board" | "centre" | "rings" | "corners">;

// Rolled so hard it flies off the top, a ball bounces back into the floor's
// pocket; otherwise a corner hole, else the smallest ring round the centre it's
// in, else the floor.
export function skeeZone(skee: Target, x: number, y: number): SkeeZone {
  if (y > skee.board.height) return { kind: "floor" };
  const { centre, corners } = skee;
  for (const side of [-1, 1] as const)
    if (squared(x - side * corners.x) + squared(y - corners.y) <= squared(corners.radius))
      return { kind: "corner", side };
  const distance = squared(x - centre.x) + squared(y - centre.y);
  const index = skee.rings.findIndex((ring) => distance <= squared(ring.radius));
  return index < 0 ? { kind: "floor" } : { kind: "ring", index };
}

// What a ball scores where it lands. Every ball scores at least the floor.
export function skeePoints(skee: SkeeContent, x: number, y: number): number {
  const zone = skeeZone(skee, x, y);
  if (zone.kind === "corner") return skee.corners.points;
  if (zone.kind === "ring") return skee.rings[zone.index]?.points ?? skee.floor;
  return skee.floor;
}

function total(throws: SkeeThrow[]): number {
  return throws.reduce((sum, ball) => sum + ball.points, 0);
}

// One tick of a skee-ball game. Like the claw, it returns only what the game
// owns; the simulation keeps the world around it frozen.
export function stepSkee(
  world: World,
  state: State,
  game: SkeeGame,
  input: ActionFrame,
): ArcadeOwned {
  const skee = world.arcade.skee;
  const press = input.confirm && !state.previousInput.confirm;
  const kept = { prizes: state.prizes, tickets: state.tickets };
  const to = (phase: SkeePhase, changes: Partial<SkeeGame> = {}): ArcadeOwned =>
    ({ arcade: { ...game, ...changes, phase, phaseTicks: 0 }, ...kept });
  const stay = (changes: Partial<SkeeGame> = {}): ArcadeOwned =>
    ({ arcade: { ...game, ...changes, phaseTicks: game.phaseTicks + 1 }, ...kept });
  const edge = skee.board.width / 2;
  // The ball goes as far up the board as the press was held.
  const roll = (held: number): ArcadeOwned => {
    const y = held * skee.powerStep;
    return to("rolling", {
      held,
      throws: [...game.throws, { x: game.aim, y, points: skeePoints(skee, game.aim, y) }],
    });
  };
  const timed = (ticks: number, next: () => ArcadeOwned): ArcadeOwned =>
    game.phaseTicks + 1 < ticks ? stay() : next();
  switch (game.phase) {
    case "aiming": {
      if (press) return to("winding");
      // Back and forth between the lane's edges, turning at each.
      const aim = Math.max(-edge, Math.min(edge, game.aim + game.sweep * skee.sweepStep));
      const sweep = aim === edge ? -1 : aim === -edge ? 1 : game.sweep;
      return stay({ aim, sweep });
    }
    case "winding":
      return press ? to("powering", { held: 1 }) : stay();
    case "powering": {
      if (!input.confirm) return roll(game.held);
      const held = game.held + 1;
      return held >= skee.powerTicks ? roll(held) : stay({ held });
    }
    case "rolling":
      return timed(skee.rollTicks, () => to("hopping"));
    case "hopping":
      return timed(skee.hopTicks, () => to("scored"));
    case "scored":
      return timed(skee.scoreTicks, () => {
        if (game.throws.length < skee.balls)
          return to("aiming", { aim: -edge, sweep: 1, held: 0 });
        // The last ball is in: the game pays its tickets.
        const score = total(game.throws);
        const paid = Math.floor(score / skee.pointsPerTicket);
        const message = skee.lines.result.replace("{score}", String(score))
          .replace("{tickets}", String(paid));
        return {
          arcade: { ...game, phase: "result", phaseTicks: 0, message, revealed: 0 },
          prizes: state.prizes,
          tickets: state.tickets + paid,
        };
      });
    case "result": {
      if (game.revealed < game.message.length) {
        const revealed = press ? game.message.length
          : Math.min(game.message.length, game.revealed + world.tunables.interact.revealPerTick);
        return { arcade: { ...game, revealed }, ...kept };
      }
      return { arcade: press ? null : game, ...kept };
    }
  }
}

// What the skee-ball close-up draws (spec 8.2), in board units.
export type SkeeView = {
  game: "skee";
  phase: SkeePhase;
  board: { width: number; height: number };
  centre: { x: number; y: number };
  rings: { points: number; radius: number }[];
  corners: { points: number; x: number; y: number; radius: number };
  floor: number;
  // The arrow across the foot of the lane: sweeping while aiming, then set.
  aim: number;
  // While winding up: how full the meter is (0 to 1), and where on it the
  // board's top falls (past it, the ball flies off).
  power: { fill: number; top: number } | null;
  // The ball in play: where it lands, how far along its way it is, and the
  // target it lands in and what that scores.
  ball: {
    x: number;
    y: number;
    stage: "rolling" | "hopping" | "landed";
    progress: number;
    zone: SkeeZone;
    points: number;
  } | null;
  // The game's balls, those still to roll, and the score of those landed.
  balls: number;
  ballsLeft: number;
  score: number;
  hint: string | null;
  message: string;
  revealed: number;
};

export function skeeView(world: World, game: SkeeGame): SkeeView {
  const skee = world.arcade.skee;
  const last = game.throws.at(-1);
  const stage = game.phase === "rolling" ? "rolling" : game.phase === "hopping" ? "hopping"
    : game.phase === "scored" ? "landed" : null;
  const ticks = game.phase === "rolling" ? skee.rollTicks
    : game.phase === "hopping" ? skee.hopTicks : skee.scoreTicks;
  const inFlight = game.phase === "rolling" || game.phase === "hopping" ? 1 : 0;
  const reach = skee.powerTicks * skee.powerStep;
  return {
    game: "skee",
    phase: game.phase,
    board: { ...skee.board },
    centre: { ...skee.centre },
    rings: skee.rings.map((ring) => ({ ...ring })),
    corners: { ...skee.corners },
    floor: skee.floor,
    aim: game.aim,
    power: game.phase === "winding" ? { fill: 0, top: skee.board.height / reach }
      : game.phase === "powering"
        ? { fill: game.held / skee.powerTicks, top: skee.board.height / reach } : null,
    ball: stage === null || last === undefined ? null : {
      ...last, stage, progress: game.phaseTicks / ticks, zone: skeeZone(skee, last.x, last.y),
    },
    balls: skee.balls,
    ballsLeft: skee.balls - game.throws.length,
    score: total(game.throws.slice(0, game.throws.length - inFlight)),
    hint: game.phase === "aiming" ? skee.lines.aim
      : game.phase === "winding" || game.phase === "powering" ? skee.lines.power : null,
    message: game.message,
    revealed: game.revealed,
  };
}
