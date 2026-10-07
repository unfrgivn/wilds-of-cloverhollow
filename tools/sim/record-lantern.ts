#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import {
  createState,
  step,
  targetInteractable,
  type ActionFrame,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
const source = JSON.parse(readFileSync("tests/sim/scripts/pass-party/jordan.json", "utf8"));
const script: { frame: ActionFrame; ticks: number }[] = parseScript(source);
let state: State = createState(world, fixture);
for (const segment of script)
  for (let tick = 0; tick < segment.ticks; tick += 1)
    state = step(world, state, segment.frame).state;

function add(frame: ActionFrame): void {
  const last = script.at(-1);
  if (last !== undefined && JSON.stringify(last.frame) === JSON.stringify(frame)) last.ticks += 1;
  else script.push({ frame, ticks: 1 });
  state = step(world, state, frame).state;
}
const idle = (): ActionFrame => ({
  move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false,
});
function press(frame: ActionFrame = { ...idle(), confirm: true }): void { add(idle()); add(frame); }
function move(x: number, y: number): void { add({ ...idle(), move: { x, y } }); }
function face(direction: State["facing"]): void {
  const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
  const [x, y] = vectors;
  if (x === undefined || y === undefined) throw new Error("invalid facing");
  move(x, y);
  add(idle());
}
// Breadth-first over 8-way moves of 5 ticks each, round the pass's signs,
// benches, and people the way a player would walk.
function navigate(target: { x: number; y: number }): void {
  const moves = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => ({ x, y })))
    .filter((step) => step.x !== 0 || step.y !== 0);
  type Node = { state: State; path: { x: number; y: number }[] };
  const queue: Node[] = [{ state, path: [] }];
  const seen = new Set([`${Math.round(state.player.x / 8)},${Math.round(state.player.y / 8)}`]);
  for (let index = 0; index < queue.length && index < 80000; index += 1) {
    const node = queue[index];
    if (node === undefined) continue;
    if (Math.abs(node.state.player.x - target.x) < 8 &&
      Math.abs(node.state.player.y - target.y) < 8) {
      for (const way of node.path) for (let count = 0; count < 5; count += 1) move(way.x, way.y);
      return;
    }
    for (const way of moves) {
      let next = node.state;
      for (let count = 0; count < 5; count += 1)
        next = step(world, next, { ...idle(), move: way }).state;
      if (next.battle !== null || next.dialogue !== null) continue;
      const key = `${Math.round(next.player.x / 8)},${Math.round(next.player.y / 8)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ state: next, path: [...node.path, way] });
    }
  }
  throw new Error(`no path to ${JSON.stringify(target)} from ${JSON.stringify(state.player)}`);
}

function glowAt(id: string): { x: number; y: number } {
  const glow = world.areas.pass?.glows.find((item) => item.id === id);
  if (glow === undefined) throw new Error(`missing ${id}`);
  return glow.point;
}

// Walks to a spot 40 units from a glow, faces it, and reads it to the end.
function readGlow(id: string, facing: State["facing"]): void {
  const point = glowAt(id);
  const offset = { up: [0, 40], down: [0, -40], left: [40, 0], right: [-40, 0] }[facing];
  navigate({ x: point.x + (offset[0] ?? 0), y: point.y + (offset[1] ?? 0) });
  face(facing);
  if (targetInteractable(world, state)?.id !== `glow:${id}`)
    throw new Error(`not facing ${id} at ${state.player.x},${state.player.y}`);
  press();
  for (let i = 0; i < 500 && state.dialogue !== null; i += 1) press();
}

while (state.dialogue !== null) press();
// Lantern on: the doodle on the ski lift's tower, then the paw prints across
// the clearing to the marker on the edge of the west pines. Lantern off.
add({ ...idle(), lantern: true });
add(idle());
readGlow("lift-note", "up");
for (const print of ["paw-print-1", "paw-print-2", "paw-print-3"]) navigate(glowAt(print));
readGlow("old-trail-marker", "left");
add({ ...idle(), lantern: true });
if (world.storyVariable(state.ink, "found_old_trail") !== true || state.lantern)
  throw new Error("lantern recording did not finish");
writeFileSync("tests/sim/scripts/pass-party/lantern.json", `${JSON.stringify(script, null, 2)}\n`);
console.error(`lantern: ${state.tick} ticks, ${script.length} segments`);
