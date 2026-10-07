// What every replay recorder (tools/sim/record-*.ts) does: play through the
// core like a careful player and keep the frames as a script. Recordings use
// only arrows and Z, so the real-key e2e can play them back through the
// keyboard (tests/e2e/helpers.ts, `playWithKeys`); choices and commands are
// picked by moving the selection, never by `choose`.
import {
  battleCommands,
  blankInput,
  step,
  targetInteractable,
  type ActionFrame,
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
  face: (direction: keyof typeof directions) => void;
  navigate: (target: Move, tolerance?: number) => void;
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
  // One down edge on the arrow, then up: the selection steps once.
  const nudge = (move: Move): void => {
    tick(frame(move));
    tick(frame());
  };
  const face = (direction: keyof typeof directions): void => nudge(directions[direction]);

  // Breadth-first over 8-way moves of 5 ticks each, through the real core, so
  // the route goes round furniture the way a player would and never touches a
  // chaos critter, opens a dialogue, or leaves the area.
  const navigate = (target: Move, tolerance = 10): void => {
    const moves = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => ({ x, y })))
      .filter((move) => move.x !== 0 || move.y !== 0);
    type Node = { state: State; path: Move[] };
    const key = (point: Move): string =>
      `${Math.round(point.x / 8)},${Math.round(point.y / 8)}`;
    const queue: Node[] = [{ state, path: [] }];
    const seen = new Set([key(state.player)]);
    for (let index = 0; index < queue.length && index < 80000; index += 1) {
      const node = queue[index];
      if (node === undefined) continue;
      if (Math.abs(node.state.player.x - target.x) < tolerance &&
        Math.abs(node.state.player.y - target.y) < tolerance) {
        for (const move of node.path) hold(move, 5);
        return;
      }
      for (const move of moves) {
        let next = node.state;
        for (let count = 0; count < 5; count += 1)
          next = step(world, next, frame(move)).state;
        if (next.area !== state.area || next.battle !== null || next.dialogue !== null ||
          next.transition !== null) continue;
        if (seen.has(key(next.player))) continue;
        seen.add(key(next.player));
        queue.push({ state: next, path: [...node.path, move] });
      }
    }
    throw new Error(`no path to ${JSON.stringify(target)} from ` +
      `${JSON.stringify(state.player)} in ${state.area}`);
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
    face,
    navigate,
    talk,
    battle,
  };
}
