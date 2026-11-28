// What every replay recorder (tools/sim/record-*.ts) does: play through the
// core like a careful player and keep the frames as a script. Recordings use
// only arrows, Z, and L, so the real-key e2e can play them back through the
// keyboard (tests/e2e/helpers.ts, `playWithKeys`); choices and commands are
// picked by moving the selection, never by `choose`.
import {
  battleCommands,
  blankInput,
  distanceToPolygon,
  npcLiveFootprint,
  npcLivePoint,
  pointInPolygon,
  presentCritters,
  sceneryArea,
  step,
  targetInteractable,
  type ActionFrame,
  type CheckState,
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
  flute: (choices?: number[]) => void;
  face: (direction: keyof typeof directions) => void;
  navigate: (target: Move, tolerance?: number) => void;
  approach: (id: string, from?: Direction) => void;
  meet: (kind: string) => void;
  clear: () => void;
  leave: (move: Move, area: string) => void;
  through: (area: string) => void;
  knock: (move: Move, knot: string) => void;
  talk: (id: string, choices?: number[]) => void;
   battle: (plan: string[], pause?: (state: State) => boolean, talkChoices?: number[]) => void;
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
   * Best-first (A* when a target hint is known, else BFS) over 8-way moves of
   * up to 5 ticks through the real core (critters wander and chase as they
   * would), so a route goes round furniture and critters the way a player
   * would. Ends on the first tick where `done` is true; no route passes
   * through a door, a talk, or a battle.
   */
  const route = (done: (next: State) => boolean, goal: string, hint?: Move): void => {
    if (done(state)) return;
    const moves = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => ({ x, y })))
      .filter((move) => move.x !== 0 || move.y !== 0);
    type Leg = { move: Move; ticks: number };
    type Node = { state: State; path: Leg[]; ticks: number; score: number };
    const key = (point: Move): string =>
      `${Math.round(point.x / 8)},${Math.round(point.y / 8)}`;
    const busy = (next: State): boolean => next.area !== state.area ||
      next.battle !== null || next.dialogue !== null || next.transition !== null;
    const score = (point: Move, ticks: number): number =>
      hint === undefined ? ticks : ticks + Math.hypot(point.x - hint.x, point.y - hint.y) / 4;
    const heap: Node[] = [{ state, path: [], ticks: 0, score: score(state.player, 0) }];
    const push = (node: Node): void => {
      heap.push(node);
      let child = heap.length - 1;
      while (child > 0) {
        const parent = (child - 1) >> 1;
        const p = heap[parent];
        const c = heap[child];
        if (p === undefined || c === undefined || p.score <= c.score) break;
        heap[parent] = c;
        heap[child] = p;
        child = parent;
      }
    };
    const pop = (): Node | undefined => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length === 0 || last === undefined) return top;
      heap[0] = last;
      let parent = 0;
      for (;;) {
        const left = parent * 2 + 1;
        const right = left + 1;
        let smallest = parent;
        if (left < heap.length && (heap[left]?.score ?? Infinity) < (heap[smallest]?.score ?? 0))
          smallest = left;
        if (right < heap.length && (heap[right]?.score ?? Infinity) < (heap[smallest]?.score ?? 0))
          smallest = right;
        if (smallest === parent) break;
        const a = heap[parent];
        const b = heap[smallest];
        if (a === undefined || b === undefined) break;
        heap[parent] = b;
        heap[smallest] = a;
        parent = smallest;
      }
      return top;
    };
    const seen = new Set([key(state.player)]);
    for (let expanded = 0; heap.length > 0 && expanded < 80000; expanded += 1) {
      const node = pop();
      if (node === undefined) break;
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
        const total = node.ticks + ticks;
        push({
          state: next,
          path: [...node.path, { move, ticks }],
          ticks: total,
          score: score(next.player, total),
        });
      }
    }
    throw new Error(`no way to ${goal} from ${JSON.stringify(state.player)} in ${state.area}`);
  };

  // Walks to `target`, meeting no critter on the way.
  const navigate = (target: Move, tolerance = 10): void => {
    const area = state.area;
    route((next) => next.area === area && next.battle === null && next.dialogue === null &&
      next.transition === null && Math.abs(next.player.x - target.x) < tolerance &&
      Math.abs(next.player.y - target.y) < tolerance, `reach ${JSON.stringify(target)}`, target);
  };

  // Where a talk target stands: `npc:<id>`, `critter:<key>`, `glow:<id>`, or
  // an interactable's id.
  const targetPoint = (id: string): Point => {
    const area = world.areas[state.area];
    const [kind, name] = id.includes(":") ? id.split(":", 2) : ["", id];
    const npc = kind === "npc" ? area?.npcs.find((item) => item.id === name) : undefined;
    const point = kind === "npc"
      ? (npc === undefined ? undefined : npcLivePoint(state, npc))
      : kind === "critter"
        ? presentCritters(world, state).find((critter) => `critter:${critter.key}` === id)?.point
        : kind === "glow"
          ? area?.glows.find((glow) => glow.id === name)?.point
          : area?.interactables.find((item) => item.id === name)?.point;
    if (point === undefined) throw new Error(`nothing called ${id} in ${state.area}`);
    return point;
  };
  const standable = (point: Point): boolean => {
    const room = world.areas[state.area];
    if (room === undefined) return false;
    const area = sceneryArea(world, state.ink, room);
    const radius = world.tunables.playerRadius;
    const solid = [
      ...area.blockers,
      ...area.npcs.map((npc) => npcLiveFootprint(npc, npcLivePoint(state, npc))),
    ];
    return pointInPolygon(point, area.walkable) &&
      distanceToPolygon(point, area.walkable) >= radius &&
      solid.every((polygon) =>
        !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius);
  };

  // Walks to about 45 units from the talk target `id` (below it if Fae can
  // stand there, else beside it, else above; or first on the side `from`,
  // where a watcher sees them both) and turns to face it.
  const approach = (id: string, from?: Direction): void => {
    const area = world.areas[state.area];
    const [kind, name] = id.includes(":") ? id.split(":", 2) : ["", id];
    const strollingNpc = kind === "npc"
      ? area?.npcs.find((item) => item.id === name && item.stroll !== undefined)
      : undefined;
    if (strollingNpc !== undefined) {
      const areaId = state.area;
      route(
        (next) => {
          if (
            next.area !== areaId ||
            next.battle !== null ||
            next.dialogue !== null ||
            next.transition !== null
          ) {
            return false;
          }
          const live = npcLivePoint(next, strollingNpc);
          return Math.hypot(next.player.x - live.x, next.player.y - live.y) <= 52;
        },
        `approach strolling ${id}`,
      );
      const live = npcLivePoint(state, strollingNpc);
      const dx = live.x - state.player.x;
      const dy = live.y - state.player.y;
      const dir: Direction =
        Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      face(dir);
      if (targetInteractable(world, state)?.id === id) return;
    }
    const sides: Record<Direction, [number, number, Direction]> = {
      down: [0, 45, "up"], left: [-45, 0, "right"], right: [45, 0, "left"], up: [0, -45, "down"],
    };
    const order: Direction[] = ["down", "left", "right", "up"];
    const spots = (from === undefined ? order : [from, ...order.filter((side) => side !== from)])
      .map((side) => sides[side]);
    for (const [dx, dy, facing] of spots) {
      const point = targetPoint(id);
      const spot = { x: point.x + dx, y: point.y + dy };
      if (!standable(spot)) continue;
      navigate(spot, 6);
      face(facing);
      if (targetInteractable(world, state)?.id === id) return;
      const live = targetPoint(id);
      const ldx = live.x - state.player.x;
      const ldy = live.y - state.player.y;
      const liveDir: Direction =
        Math.abs(ldx) >= Math.abs(ldy) ? (ldx > 0 ? "right" : "left") : ldy > 0 ? "down" : "up";
      face(liveDir);
      if (targetInteractable(world, state)?.id === id) return;
    }
    if (id.startsWith("critter:wild:")) {
      const key = id.slice("critter:".length);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const live = presentCritters(world, state).find((item) => item.key === key)?.point;
        if (live === undefined) break;
        navigate(live, 45);
        const now = presentCritters(world, state).find((item) => item.key === key)?.point ?? live;
        const ldx = now.x - state.player.x;
        const ldy = now.y - state.player.y;
        const liveDir: Direction =
          Math.abs(ldx) >= Math.abs(ldy) ? (ldx > 0 ? "right" : "left") : ldy > 0 ? "down" : "up";
        face(liveDir);
        if (targetInteractable(world, state)?.id === id) return;
      }
    }
    throw new Error(`couldn't get in front of ${id}`);
  };

  // Walks into a battle with a chaos critter of `kind`, meeting no other.
  const meet = (kind: string): void => {
    const target = presentCritters(world, state)
      .filter((critter) => critter.kind.id === kind && critter.mood === "chaos")
      .sort(
        (a, b) =>
          Math.hypot(a.point.x - state.player.x, a.point.y - state.player.y) -
          Math.hypot(b.point.x - state.player.x, b.point.y - state.player.y),
      )[0]?.point;
    route((next) => next.battle?.critterId === kind, `meet a ${kind}`, target);
  };

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

  // Through the door of the area Fae is in that leads to `area`: toward the
  // middle of its trigger, arrows only (from its spawn side, so get there first).
  const through = (area: string): void => {
    const here = world.areas[state.area];
    const door = here?.triggers.find((trigger) => trigger.target.area === area);
    if (here === undefined || door === undefined)
      throw new Error(`no door from ${state.area} to ${area}`);
    const middle: Point = {
      x: door.polygon.reduce((sum, [x]) => sum + x, 0) / door.polygon.length,
      y: door.polygon.reduce((sum, [, y]) => sum + y, 0) / door.polygon.length,
    };
    const gap = { x: middle.x - state.player.x, y: middle.y - state.player.y };
    const sign = (value: number): number => Math.abs(value) < 12 ? 0 : Math.sign(value);
    leave({ x: sign(gap.x), y: sign(gap.y) }, area);
  };

  // Reads the open dialogue, every line; `choices` are the options to take,
  // in order, each picked by stepping the selection down to it after half a
  // second's read (long enough for a watcher to see them).
  const read = (id: string, choices: number[]): void => {
    const wanted = choices.slice();
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

  // F down for a tick, then up: the flute plays its knot (Milestone 47), read
  // through with `choices`.
  const flute = (choices: number[] = []): void => {
    tick({ ...frame(), flute: true });
    if (state.dialogue?.knot !== "flute") throw new Error("the flute didn't play");
    read("flute", choices);
  };

  // Talks to what Fae faces.
  const talk = (id: string, choices: number[] = []): void => {
    const target = targetInteractable(world, state)?.id;
    if (target !== id) throw new Error(`facing ${target ?? "nothing"}, not ${id}`);
    press();
    read(id, choices);
  };

  // Holds `move` into a door that's shut until its `knot` plays, and reads it.
  const knock = (move: Move, knot: string): void => {
    for (let count = 0; count < 300 && state.dialogue === null; count += 1) {
      if (state.battle !== null || state.transition !== null)
        throw new Error(`went somewhere on the way to ${knot}`);
      tick(frame(move));
    }
    if (state.dialogue?.knot !== knot) throw new Error(`${knot} never played`);
    read(knot, []);
  };

  // Plays a battle to its end: the commands in `plan` first, then Soothe for
  // the rest, except that in a wind-up it pops a bubble when a ready command
  // can; every check GREAT (`playCheck`). `pause` holds still for half a
  // second whenever it's true of the command menu, so a watcher (the e2e)
  // can look.
  const battle = (plan: string[], pause?: (state: State) => boolean,
    talkChoices: number[] = []): void => {
    const commands = plan.slice();
    for (let count = 0; count < 2000 && state.battle !== null; count += 1) {
      const current = state.battle;
      if (current.phase === "talk") {
        if (current.revealed < current.message.length || current.talk?.choices.length === 0) {
          press();
          continue;
        }
        const choice = talkChoices.shift() ?? 0;
        while (state.battle?.phase === "talk" && state.battle.talk?.selected !== choice)
          nudge(directions.down);
        press();
      } else if (current.phase === "command" && current.revealed >= current.message.length) {
        const available = battleCommands(world, state);
        const popper = current.windUp === null ? undefined : available
          .find((item) => item.feeling !== null && !item.disabled)?.id;
        const ownedByParty = (id: string): boolean =>
          id === "soothe" || id === "recover" || id === "snack" || id === "run" || id === "talk" ||
          state.party.some((member) => world.party[member.id]?.command?.id === id);
        while (commands.length > 0 && !ownedByParty(commands[0] ?? "")) commands.shift();
        const planned = commands[0];
        const plannedHere = planned !== undefined &&
          available.some((item) => item.id === planned && !item.disabled);
        const defaultCmd = available.find((item) =>
          item.id !== "run" && item.id !== "snack" && !item.disabled)?.id ??
          available.find((item) => !item.disabled)?.id;
        const wanted = plannedHere
          ? planned
          : current.talkMode
            ? "talk"
            : popper ?? defaultCmd ?? "soothe";
        const index = available.findIndex((item) => item.id === wanted && !item.disabled);
        if (index < 0)
          throw new Error(
            `no ${wanted} command in this battle (calm ${current.calm}, talk ${current.talkMode})`);
        if (state.battle.selected !== index) {
          nudge(directions.down);
          continue;
        }
        if (pause?.(state) === true) idle(30);
        if (plannedHere) commands.shift();
        press();
      } else if (current.phase === "check" && current.check !== null) {
        playCheck(current.check);
      } else press();
    }
    if (state.battle !== null) throw new Error("the battle never finished");
  };

  // Plays one check like a careful player, every grade GREAT: a ring pressed
  // on its target tick; a charge held exactly to its target, then let go; a
  // chain pressed on each beat's arrival; a catch held in each toy's lane
  // (up high, nothing for the middle, down low) as it lands; a lean leaned
  // back toward straight whenever Fae is 5 or more off.
  const playCheck = (check: CheckState): void => {
    const live = (): CheckState | null => state.battle?.check ?? null;
    const waitFor = (target: number): void => {
      while ((live()?.tick ?? target) < target) tick(frame());
    };
    if (check.kind === "ring") {
      waitFor(check.spec.targetTick - 1);
      press();
    } else if (check.kind === "charge") {
      // The press that chose the command was let go on the tick after it.
      for (let count = 0; count < check.spec.targetTick; count += 1)
        tick(frame(undefined, true));
      tick(frame());
    } else if (check.kind === "catch") {
      for (let current = live(); current?.kind === "catch"; current = live()) {
        const next = current.results.indexOf("pending");
        if (next < 0) break;
        const lane = current.lanes[next] ?? 1;
        tick(frame(lane === 0 ? directions.up : lane === 2 ? directions.down : undefined));
      }
    } else if (check.kind === "lean") {
      for (let current = live(); current?.kind === "lean"; current = live()) {
        if (!current.results.includes("pending")) break;
        const { balance } = current;
        tick(frame(balance <= -5 ? directions.right : balance >= 5 ? directions.left : undefined));
      }
    } else if (check.kind === "trace") {
      for (let current = live(); current?.kind === "trace"; current = live()) {
        if (!current.results.includes("pending")) break;
        const target = current.path.points[current.checkpoint];
        if (target === undefined) break;
        const dx = target.x - current.brush.x;
        const dy = target.y - current.brush.y;
        const near = Math.sqrt(dx * dx + dy * dy) <= current.spec.reachRadius;
        const move = near ? { x: 0, y: 0 } : {
          x: Math.sign(dx), y: Math.sign(dy),
        };
        tick(frame(move));
      }
    } else if (check.kind === "peekaboo") {
      for (let current = live(); current?.kind === "peekaboo"; current = live()) {
        if (current.result !== null) break;
        const nextTick = current.tick + 1;
        const mustFreeze = current.spec.peeks.some(
          (peek) => nextTick >= peek.start - 2 && nextTick < peek.end,
        );
        tick(frame(undefined, !mustFreeze));
      }
    } else if (check.kind === "echo") {
      const demoEnd = check.spec.notes * (check.spec.demoTicks + check.spec.gapTicks);
      waitFor(demoEnd);
      const noteDirs = [directions.up, directions.right, directions.down, directions.left];
      for (const note of check.sequence) {
        const current = live();
        if (state.battle?.phase !== "check" || current?.kind !== "echo") break;
        tick(frame(noteDirs[note]));
        if (state.battle?.phase === "check") tick(frame());
      }
    } else {
      for (const arrival of check.spec.arrivals) {
        waitFor(arrival - 1);
        press();
      }
    }
  };

  return {
    state: () => state,
    script,
    tick,
    idle,
    hold,
    press,
    lantern,
    flute,
    face,
    navigate,
    approach,
    meet,
    clear,
    leave,
    through,
    knock,
    talk,
    battle,
  };
}
