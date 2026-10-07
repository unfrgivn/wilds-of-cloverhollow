#!/usr/bin/env bun
// Records the Cliffside Trail's lower end (Milestone 21) as a replay script, for
// the real-key e2e as well as the headless sims: from the beach (the `trail`
// fixture), up onto the footbridge, across to the lookout and its bench, back
// down the beach, and through the bottom edge into Bubblegum Bay, holding down
// all the way. The back-link rule keeps the bay's cliff path from sending her
// straight back while she holds; after letting go she steps up and walks into
// it, where it's closed (no bus ride yet).
//
//   bun tools/sim/record-lookout.ts > tests/sim/scripts/trail/lookout.json
import {
  blankInput,
  createState,
  step,
  targetInteractable,
  type ActionFrame,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

const { world, fixtures } = loadContent();
const fixture = fixtures.trail;
if (fixture === undefined) throw new Error("trail fixture missing");
let state: State = createState(world, fixture);
const script: { frame: ActionFrame; ticks: number }[] = [];
const frame = (x = 0, y = 0, confirm = false): ActionFrame =>
  ({ ...blankInput(), move: { x, y }, confirm });
function tick(input: ActionFrame): void {
  const last = script.at(-1);
  if (last !== undefined && JSON.stringify(last.frame) === JSON.stringify(input))
    last.ticks += 1;
  else script.push({ frame: input, ticks: 1 });
  state = step(world, state, input).state;
}

// Breadth-first over 8-way moves of 5 ticks each, so the route goes round
// rocks and along the stream's banks the way a player would.
function navigate(target: { x: number; y: number }): void {
  const moves = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => ({ x, y })))
    .filter((move) => move.x !== 0 || move.y !== 0);
  type Node = { state: State; path: { x: number; y: number }[] };
  const queue: Node[] = [{ state, path: [] }];
  const seen = new Set([`${Math.round(state.player.x / 8)},${Math.round(state.player.y / 8)}`]);
  for (let index = 0; index < queue.length && index < 80000; index += 1) {
    const node = queue[index];
    if (node === undefined) continue;
    if (Math.abs(node.state.player.x - target.x) < 10 &&
      Math.abs(node.state.player.y - target.y) < 10) {
      for (const move of node.path)
        for (let count = 0; count < 5; count += 1) tick(frame(move.x, move.y));
      return;
    }
    for (const move of moves) {
      let next = node.state;
      for (let count = 0; count < 5; count += 1)
        next = step(world, next, frame(move.x, move.y)).state;
      if (next.area !== state.area || next.battle !== null || next.dialogue !== null) continue;
      const key = `${Math.round(next.player.x / 8)},${Math.round(next.player.y / 8)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ state: next, path: [...node.path, move] });
    }
  }
  throw new Error(`no path to ${JSON.stringify(target)} from ${JSON.stringify(state.player)}`);
}

// Talks to what Fae faces, a confirm edge per line, to the end.
function look(id: string): void {
  if (targetInteractable(world, state)?.id !== id) throw new Error(`not facing ${id}`);
  tick(frame(0, 0, true));
  tick(frame());
  for (let count = 0; count < 200 && state.dialogue !== null; count += 1) {
    tick(frame(0, 0, true));
    tick(frame());
  }
  if (state.dialogue !== null) throw new Error(`${id} never finished`);
}

navigate({ x: 1265, y: 560 });
for (let count = 0; count < 30; count += 1) tick(frame());
navigate({ x: 1530, y: 565 });
tick(frame(0, -1));
tick(frame());
look("lookout-bench");
navigate({ x: 1330, y: 1000 });
// Down off the beach and into the bay, holding down through the fade and on.
for (let count = 0; count < 300 && !(state.area === "bay" && state.transition === null);
  count += 1) tick(frame(0, 1));
for (let count = 0; count < 60; count += 1) tick(frame(0, 1));
if (state.area !== "bay" || state.transition !== null || state.dialogue !== null)
  throw new Error("holding down in the bay sent Fae somewhere");
// Let go, step back up out of the doorway, and walk into the closed cliff path.
tick(frame());
for (let count = 0; count < 20; count += 1) tick(frame(0, -1));
const knot = (): string | undefined => state.dialogue?.knot;
for (let count = 0; count < 80 && knot() === undefined; count += 1) tick(frame(0, 1));
if (knot() !== "bay_cliff_path") throw new Error("the cliff path didn't speak");
console.error(`lookout: ${state.tick} ticks, ${script.length} segments`);
console.log(JSON.stringify(script, null, 2));
