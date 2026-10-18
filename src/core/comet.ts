import { nextRandom } from "./random";
import type { ActionFrame, ArcadeOwned, CometContent, State, World } from "./types";

export type CometLane = 0 | 1 | 2;
export type CometObjectStatus = "coming" | "caught" | "bumped" | "passing" | "gone";
export type CometObject = {
  kind: "star" | "rock";
  lane: CometLane;
  index: number;
  spawn: number;
  status: CometObjectStatus;
  statusTicks: number;
};
export type CometPhase = "ready" | "playing" | "result";
export type CometGame = {
  game: "comet";
  phase: CometPhase;
  phaseTicks: number;
  lane: CometLane;
  // Where the rocket was across the lanes (0 to 2) as its last move began; it
  // slides from there to its lane over the content's moveTicks.
  from: number;
  moveTicks: number;
  objects: CometObject[];
  elapsed: number;
  caught: number;
  letGo: number;
  bumps: number;
  tickets: number;
  wobbleTicks: number;
  message: string;
  revealed: number;
};
export type CometView = {
  game: "comet";
  phase: CometPhase;
  // position: across the lanes, 0 to 2, as it slides; lean: which way while it
  // slides; wobble: how far through a bump's wobble is left, 1 to 0.
  rocket: { lane: CometLane; position: number; lean: -1 | 0 | 1; wobble: number };
  // progress: 0 at the screen's top, 1 at the rocket's row, more while it
  // passes; a catch's sparkle and a bump's puff stay on the row as flash runs
  // from 1 to 0.
  objects: { kind: "star" | "rock"; lane: CometLane; progress: number; flash: number }[];
  caught: number;
  total: number;
  left: number;
  hint: string | null;
  message: string;
  revealed: number;
};

const lanes: CometLane[] = [0, 1, 2];
function laneFrom(value: number, choices: CometLane[]): CometLane {
  return choices[Math.min(choices.length - 1, Math.floor(value * choices.length))] ?? 0;
}
function edgeMove(input: ActionFrame, previous: ActionFrame): -1 | 0 | 1 {
  if (input.move.x < 0 && !(previous.move.x < 0)) return -1;
  if (input.move.x > 0 && !(previous.move.x > 0)) return 1;
  return 0;
}

export function newComet(content: CometContent, state: State): [CometGame, State] {
  let current = state;
  const kinds: CometObject["kind"][] = Array.from(
    { length: content.stars + content.rocks }, () => "star");
  for (let rock = 0; rock < content.rocks; rock += 1) {
    const available = kinds.map((kind, index) => kind === "star" && index > 0 &&
      kinds[index - 1] !== "rock" && kinds[index + 1] !== "rock" ? index : -1)
      .filter((index) => index >= 0);
    const [roll, after] = nextRandom(current);
    current = after;
    const index = available[Math.min(available.length - 1, Math.floor(roll * available.length))];
    if (index !== undefined) kinds[index] = "rock";
  }
  const objects: CometObject[] = [];
  for (let index = 0; index < kinds.length; index += 1) {
    const [roll, after] = nextRandom(current);
    current = after;
    const previous = objects.at(-1)?.lane;
    const choices = lanes.filter((lane) => lane !== previous);
    objects.push({ kind: kinds[index] ?? "star", lane: laneFrom(roll, choices), index,
      spawn: index * content.gapTicks,
      status: "coming", statusTicks: 0 });
  }
  return [{ game: "comet", phase: "ready", phaseTicks: 0, lane: 1, from: 1,
    moveTicks: 0, objects, elapsed: 0, caught: 0, letGo: 0, bumps: 0, tickets: 0,
    wobbleTicks: 0, message: "", revealed: 0 }, current];
}

export function cometTravel(content: CometContent, index: number): number {
  const share = content.stars + content.rocks <= 1 ? 0
    : index / (content.stars + content.rocks - 1);
  return Math.round(content.travelFirst + (content.travelLast - content.travelFirst) * share);
}
export function cometRocketPosition(content: CometContent, game: CometGame): number {
  return game.lane + (game.from - game.lane) * (game.moveTicks / content.moveTicks);
}
export function cometObjectProgress(
  content: CometContent, object: CometObject, elapsed: number,
): number {
  return (elapsed - object.spawn) / cometTravel(content, object.index);
}

export function stepComet(
  world: World, state: State, game: CometGame, input: ActionFrame,
): ArcadeOwned {
  const content = world.arcade.comet;
  const kept = { prizes: state.prizes, tickets: state.tickets };
  const owned = (arcade: CometGame): ArcadeOwned => ({ arcade, ...kept });
  if (game.phase === "result") {
    const press = input.confirm && !state.previousInput.confirm;
    if (game.revealed < game.message.length) return owned({ ...game,
      revealed: press ? game.message.length : Math.min(game.message.length,
        game.revealed + world.tunables.interact.revealPerTick) });
    return { arcade: press ? null : game, ...kept };
  }
  if (game.phase === "ready") {
    return game.phaseTicks + 1 < content.readyTicks
      ? owned({ ...game, phaseTicks: game.phaseTicks + 1 })
      : owned({ ...game, phase: "playing", phaseTicks: 0, elapsed: 0 });
  }
  const move = game.wobbleTicks > 0 ? 0 : edgeMove(input, state.previousInput);
  const raw = Math.max(0, Math.min(2, game.lane + move));
  const lane: CometLane = raw === 0 ? 0 : raw === 1 ? 1 : 2;
  const moved = lane !== game.lane;
  const elapsed = game.elapsed + 1;
  let caught = game.caught;
  let letGo = game.letGo;
  let bumps = game.bumps;
  let tickets = game.tickets;
  let wobbleTicks = Math.max(0, game.wobbleTicks - 1);
  const objects = game.objects.map((object) => {
    const progress = cometObjectProgress(content, object, elapsed);
    if (object.status === "coming" && progress >= 1) {
      if (object.lane === lane && object.kind === "star") {
        caught += 1; tickets += content.ticketsPerStar;
        return { ...object, status: "caught" as const, statusTicks: 0 };
      }
      if (object.lane === lane && object.kind === "rock") {
        bumps += 1; wobbleTicks = content.wobbleTicks;
        return { ...object, status: "bumped" as const, statusTicks: 0 };
      }
      letGo += object.kind === "star" ? 1 : 0;
      return { ...object, status: "passing" as const, statusTicks: 0 };
    }
    if (object.status === "passing" && object.statusTicks + 1 >= content.passTicks)
      return { ...object, status: "gone" as const, statusTicks: object.statusTicks + 1 };
    if ((object.status === "caught" || object.status === "bumped") &&
        object.statusTicks + 1 >= content.flashTicks)
      return { ...object, status: "gone" as const, statusTicks: object.statusTicks + 1 };
    return object.status === "coming" ? object : { ...object, statusTicks: object.statusTicks + 1 };
  });
  const last = game.objects.length - 1;
  const done = elapsed >= last * content.gapTicks + cometTravel(content, last) + content.passTicks;
  const next: CometGame = { ...game, phaseTicks: game.phaseTicks + 1, lane,
    from: moved ? cometRocketPosition(content, game) : game.from,
    moveTicks: moved ? content.moveTicks : Math.max(0, game.moveTicks - 1),
    objects, elapsed, caught, letGo, bumps, tickets, wobbleTicks };
  if (!done) return owned(next);
  const message = content.lines.result.replace("{stars}", String(caught))
    .replace("{total}", String(content.stars)).replace("{tickets}", String(tickets));
  return { arcade: { ...next, phase: "result", phaseTicks: 0, message, revealed: 0 },
    prizes: state.prizes, tickets: state.tickets + tickets };
}

export function cometView(world: World, game: CometGame): CometView {
  const content = world.arcade.comet;
  const objects = game.objects.flatMap((object) => {
    if (object.status === "gone") return [];
    const flashing = object.status === "caught" || object.status === "bumped";
    const progress = flashing ? 1 : cometObjectProgress(content, object, game.elapsed);
    // Not set off yet: nothing on the screen.
    if (object.status === "coming" && progress <= 0) return [];
    const flash = flashing ? Math.max(0, 1 - object.statusTicks / content.flashTicks) : 0;
    return [{ kind: object.kind, lane: object.lane, progress, flash }];
  });
  const position = cometRocketPosition(content, game);
  const lean: -1 | 0 | 1 = game.moveTicks === 0 || position === game.lane ? 0
    : game.lane > position ? 1 : -1;
  return { game: "comet", phase: game.phase,
    rocket: { lane: game.lane, position, lean, wobble: game.wobbleTicks / content.wobbleTicks },
    objects, caught: game.caught, total: content.stars,
    left: Math.max(0, content.stars - game.caught - game.letGo),
    hint: game.phase === "ready" ? content.lines.ready
      : game.phase === "playing" ? content.lines.play : null,
    message: game.message, revealed: game.revealed };
}
