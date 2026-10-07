// What every replay recorder (tools/sim/record-*.ts) does: play through the
// core like a careful player and keep the frames as a script. Recordings use
// only arrows, Z, and L, so the real-key e2e can play them back through the
// keyboard (tests/e2e/helpers.ts, `playWithKeys`); choices and commands are
// picked by moving the selection, never by `choose`.
import {
  battleCommands,
  blankInput,
  distanceToPolygon,
  pointInPolygon,
  presentCritters,
  step,
  targetInteractable,
  type ActionFrame,
  type Direction,
  type Point,
  type State,
  type World,
} from "../../src/core";

export type Segment = { frame: ActionFrame; ticks: number };
type Move = { x: number; y: number };

const frame = (move: Move = { x: 0, y: 0 }, confirm = false): ActionFrame =>
  ({ ...blankInput(), move, confirm });
const directions: Record<"up" | "down" | "left" | "right", Move> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function createRecorder(world: World, initial: State): {
  state: () => State;
  script: Segment[];
  tick: (input: ActionFrame) => void;
  idle: (ticks: number) => void;
  hold: (move: Move, ticks: number) => void;
  press: () => void;
  lantern: () => void;
  face: (direction: keyof typeof directions) => void;
  navigate: (target: Move, tolerance?: number) => void;
  approach: (id: string) => void;
  meet: (kind: string) => void;
  clear: () => void;
  leave: (move: Move, area: string) => void;
  talk: (id: string, choices?: number[]) => void;
  battle: (plan: string[], pause?: (state: State) => boolean) => void;
} {
  let state = initial;
  const script: Segment[] = [];
  const tick = (input: ActionFrame): void => {
    const last = script.at(-1);
    if (last !== undefined && JSON.stringify(last.frame) === JSON.stringify(input))
      last.ticks += 1;
    else script.push({ frame: input, ticks: 1 });
    state = step(world, state, input).state;
  };
  const idle = (ticks: number): void => {
    for (let count = 0; count < ticks; count += 1) tick(frame());
  };
  const hold = (move: Move, ticks: number): void => {
    for (let count = 0; count < ticks; count += 1) tick(frame(move));
  };
  // A confirm edge: Z down for a tick, then up.
  const press = (): void => {
    tick(frame(undefined, true));
    tick(frame());
  };
  // L down for a tick, then up: the lantern switches.
  const lantern = (): void => {
    tick({ ...frame(), lantern: true });
    tick(frame());
  };
  // One down edge on the arrow, then up: the selection steps once.
  const nudge = (move: Move): void => {
    tick(frame(move));
    tick(frame());
  };
  const face = (direction: keyof typeof directions): void => nudge(directions[direction]);

  /*
   * Breadth-first over 8-way moves of up to 5 ticks, through the real core
   * (critters wander and chase as they would), so a route goes round furniture
   * and critters the way a player would. It ends on the first tick where
   * `done` is true; no route passes through a door, a talk, or a battle.
   */
  const route = (done: (next: State) => boolean, goal: string): void => {
    if (done(state)) return;
    const moves = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => ({ x, y })))
      .filter((move) => move.x !== 0 || move.y !== 0);
    type Leg = { move: Move; ticks: number };
    type Node = { state: State; path: Leg[] };
    const key = (point: Move): string =>
      `${Math.round(point.x / 8)},${Math.round(point.y / 8)}`;
    const busy = (next: State): boolean => next.area !== state.area ||
      next.battle !== null || next.dialogue !== null || next.transition !== null;
    const queue: Node[] = [{ state, path: [] }];
    const seen = new Set([key(state.player)]);
    for (let index = 0; index < queue.length && index < 80000; index += 1) {
      const node = queue[index];
      if (node === undefined) continue;
      for (const move of moves) {
        let next = node.state;
        let ticks = 0;
        let arrived = false;
        while (ticks < 5) {
          next = step(world, next, frame(move)).state;
          ticks += 1;
          arrived = done(next);
          if (arrived || busy(next)) break;
        }
        if (arrived) {
          for (const leg of [...node.path, { move, ticks }]) hold(leg.move, leg.ticks);
          return;
        }
        if (busy(next) || seen.has(key(next.player))) continue;
        seen.add(key(next.player));
        queue.push({ state: next, path: [...node.path, { move, ticks }] });
      }
    }
    throw new Error(`no way to ${goal} from ${JSON.stringify(state.player)} in ${state.area}`);
  };

  // Walks to `target`, meeting no critter on the way.
  const navigate = (target: Move, tolerance = 10): void => {
    const area = state.area;
    route((next) => next.area === area && next.battle === null && next.dialogue === null &&
      next.transition === null && Math.abs(next.player.x - target.x) < tolerance &&
      Math.abs(next.player.y - target.y) < tolerance, `reach ${JSON.stringify(target)}`);
  };

  // Where a talk target stands: `npc:<id>`, `critter:<key>`, `glow:<id>`, or
  // an interactable's id.
  const targetPoint = (id: string): Point => {
    const area = world.areas[state.area];
    const [kind, name] = id.includes(":") ? id.split(":", 2) : ["", id];
    const point = kind === "npc"
      ? area?.npcs.find((npc) => npc.id === name)?.point
      : kind === "critter"
        ? presentCritters(world, state).find((critter) => `critter:${critter.key}` === id)?.point
        : kind === "glow"
          ? area?.glows.find((glow) => glow.id === name)?.point
          : area?.interactables.find((item) => item.id === name)?.point;
    if (point === undefined) throw new Error(`nothing called ${id} in ${state.area}`);
    return point;
  };
  const standable = (point: Point): boolean => {
    const area = world.areas[state.area];
    if (area === undefined) return false;
    const radius = world.tunables.playerRadius;
    const solid = [...area.blockers, ...area.npcs.map((npc) => npc.footprint)];
    return pointInPolygon(point, area.walkable) &&
      distanceToPolygon(point, area.walkable) >= radius &&
      solid.every((polygon) =>
        !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius);
  };

  // Walks to about 45 units from the talk target `id` (below it if Fae can
  // stand there, else beside it, else above) and turns to face it.
  const approach = (id: string): void => {
    const point = targetPoint(id);
    const spots: [number, number, Direction][] =
      [[0, 45, "up"], [-45, 0, "right"], [45, 0, "left"], [0, -45, "down"]];
    for (const [dx, dy, facing] of spots) {
      const spot = { x: point.x + dx, y: point.y + dy };
      if (!standable(spot)) continue;
      navigate(spot, 6);
      face(facing);
      if (targetInteractable(world, state)?.id === id) return;
    }
    throw new Error(`couldn't get in front of ${id}`);
  };

  // Walks into a battle with a chaos critter of `kind`, meeting no other.
  const meet = (kind: string): void =>
    route((next) => next.battle?.critterId === kind, `meet a ${kind}`);

  // Calms every chaos critter out in the area, nearest first, so a long walk
  // after it can't be cut off (a critter that comes after Fae from ahead).
  const clear = (): void => {
    for (let count = 0; count < 8; count += 1) {
      const gap = (point: Point): number =>
        Math.hypot(point.x - state.player.x, point.y - state.player.y);
      const foe = presentCritters(world, state)
        .filter((critter) => critter.wild !== null && critter.mood === "chaos")
        .sort((a, b) => gap(a.point) - gap(b.point))[0];
      if (foe === undefined) return;
      meet(foe.kind.id);
      battle([]);
    }
    throw new Error(`critters kept coming in ${state.area}`);
  };

  // Holds `move` through a door into `area`, then waits out the fade.
  const leave = (move: Move, area: string): void => {
    for (let count = 0; count < 300 && state.area !== area; count += 1) {
      if (state.battle !== null || state.dialogue !== null)
        throw new Error(`stopped on the way to ${area}`);
      tick(frame(move));
    }
    for (let count = 0; count < 60 && state.transition !== null; count += 1) tick(frame(move));
    if (state.area !== area || state.transition !== null)
      throw new Error(`never got to ${area} (in ${state.area})`);
  };

  // Talks to what Fae faces, reading every line; `choices` are the options
  // to take, in order, each picked by stepping the selection down to it after
  // half a second's read (long enough for a watcher to see them).
  const talk = (id: string, choices: number[] = []): void => {
    const target = targetInteractable(world, state)?.id;
    if (target !== id) throw new Error(`facing ${target ?? "nothing"}, not ${id}`);
    const wanted = choices.slice();
    press();
    for (let count = 0; count < 400 && state.dialogue !== null; count += 1) {
      const dialogue = state.dialogue;
      if (dialogue.revealed < dialogue.text.length || dialogue.choices.length === 0) {
        press();
        continue;
      }
      const choice = wanted.shift();
      if (choice === undefined || choice >= dialogue.choices.length)
        throw new Error(`${id}: no choice for ${JSON.stringify(dialogue.choices)}`);
      idle(30);
      while (state.dialogue !== null && state.dialogue.selected !== choice)
        nudge(directions.down);
      press();
    }
    if (state.dialogue !== null) throw new Error(`${id} never finished`);
    if (wanted.length > 0) throw new Error(`${id}: choices left over: ${wanted.join(",")}`);
  };

  // Plays a battle to its end: the commands in `plan` first, then Soothe for
  // the rest, every press on its target tick. `pause` holds still for half a
  // second whenever it's true of the command menu, so a watcher (the e2e)
  // can look.
  const battle = (plan: string[], pause?: (state: State) => boolean): void => {
    const commands = plan.slice();
    for (let count = 0; count < 2000 && state.battle !== null; count += 1) {
      const current = state.battle;
      if (current.phase === "command" && current.revealed >= current.message.length) {
        const wanted = commands[0] ?? "soothe";
        const index = battleCommands(world, state).findIndex((item) => item.id === wanted);
        if (index < 0) throw new Error(`no ${wanted} command in this battle`);
        if (state.battle.selected !== index) {
          nudge(directions.down);
          continue;
        }
        if (pause?.(state) === true) idle(30);
        commands.shift();
        press();
      } else if (current.phase === "aim" && current.aim !== null) {
        while (state.battle !== null && state.battle.aimTick < current.aim.targetTick - 1)
          tick(frame());
        press();
      } else press();
    }
    if (state.battle !== null) throw new Error("the battle never finished");
  };

  return {
    state: () => state,
    script,
    tick,
    idle,
    hold,
    press,
    lantern,
    face,
    navigate,
    approach,
    meet,
    clear,
    leave,
    talk,
    battle,
  };
}
