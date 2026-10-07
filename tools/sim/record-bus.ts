import { readFileSync, writeFileSync } from "node:fs";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import {
  blankInput, createState, step, targetInteractable,
  type ActionFrame, type State,
} from "../../src/core";

const content = loadContent();
const world = content.world;
const bayPath = "tests/sim/scripts/bay/bay.json";
const bayScript = parseScript(JSON.parse(readFileSync(bayPath, "utf8")), bayPath);
const fixture = content.fixtures.bay;
if (fixture === undefined) throw new Error("bay fixture missing");
let state = createState(world, fixture);
const script: { frame: ActionFrame; ticks: number }[] = [];
const frame = (x = 0, y = 0, confirm = false, choose?: number): ActionFrame => ({
  ...blankInput(), move: { x, y }, confirm, ...(choose === undefined ? {} : { choose }),
});
function tick(input: ActionFrame): void {
  const previous = script.at(-1);
  if (previous !== undefined && JSON.stringify(previous.frame) === JSON.stringify(input))
    previous.ticks += 1;
  else script.push({ frame: input, ticks: 1 });
  state = step(world, state, input).state;
}
function currentArea(): string { return state.area; }
function replay(segments: { frame: ActionFrame; ticks: number }[]): void {
  for (const segment of segments)
    for (let tickCount = 0; tickCount < segment.ticks; tickCount += 1)
      tick(segment.frame);
}
function walk(axis: "x" | "y", target: number): void {
  for (let count = 0; count < 800; count += 1) {
    if (state.dialogue !== null || state.battle !== null || state.transition !== null) {
      tick(frame());
      continue;
    }
    const delta = target - state.player[axis];
    if (Math.abs(delta) < 3) return;
    const before = state.player[axis];
    tick(frame(axis === "x" ? Math.sign(delta) : 0, axis === "y" ? Math.sign(delta) : 0));
    if (state.player[axis] === before) return;
  }
  throw new Error(`could not walk ${axis} to ${target} at ${JSON.stringify(state.player)}`);
}
function navigate(target: { x: number; y: number }): void {
  const directions = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => ({ x, y })))
    .filter((move) => move.x !== 0 || move.y !== 0);
  type Node = { state: State; path: { x: number; y: number }[] };
  const queue: Node[] = [{ state, path: [] }];
  const seen = new Set([`${Math.round(state.player.x / 8)},${Math.round(state.player.y / 8)}`]);
  for (let index = 0; index < queue.length && index < 50000; index += 1) {
    const node = queue[index];
    if (node === undefined) continue;
    if (Math.abs(node.state.player.x - target.x) < 10 &&
        Math.abs(node.state.player.y - target.y) < 10) {
      for (const move of node.path)
        for (let count = 0; count < 5; count += 1) tick(frame(move.x, move.y));
      return;
    }
    for (const move of directions) {
      let next = node.state;
      for (let count = 0; count < 5; count += 1)
        next = step(world, next, frame(move.x, move.y)).state;
      if (next.area !== state.area || next.dialogue !== null || next.battle !== null) continue;
      const key = `${Math.round(next.player.x / 8)},${Math.round(next.player.y / 8)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ state: next, path: [...node.path, move] });
    }
  }
  throw new Error(`no path to ${JSON.stringify(target)} from ${JSON.stringify(state.player)}`);
}
function press(): void { tick(frame()); tick(frame(0, 0, true)); }
function talk(choice = 0): void {
  press();
  for (let count = 0; count < 400 && state.dialogue !== null; count += 1) {
    const dialogue = state.dialogue;
    if (dialogue.revealed < dialogue.text.length) press();
    else if (dialogue.choices.length > 0) { tick(frame(0, 0, false, choice)); tick(frame()); }
    else press();
  }
  if (state.dialogue !== null)
    throw new Error(`conversation did not close at ${state.dialogue.knot}`);
}
replay(bayScript);
if (state.area !== "bay" || state.critters.bluebird !== "calm")
  throw new Error("bay replay did not calm the bluebird");
walk("x", 20); walk("y", 545); tick(frame());
for (let count = 0; count < 100; count += 1) {
  if (state.transition === null) break;
  tick(frame());
}
if (currentArea() !== "plaza")
  throw new Error(`did not leave bay: ${currentArea()}`);
navigate({ x: 878, y: 985 });
tick(frame(0, -1));
if (targetInteractable(world, state)?.id !== "npc:bus-stop")
  throw new Error(`not at plaza stop: ${JSON.stringify(state.player)}`);
talk(0);
for (let count = 0; count < 100; count += 1) {
  if (state.transition === null) break;
  tick(frame());
}
if (currentArea() !== "pass")
  throw new Error(`did not reach pass: ${currentArea()}`);
walk("x", 615); walk("y", 500); walk("x", 615); talk(0);
walk("x", 1017); walk("y", 985); talk(0);
for (let count = 0; count < 100; count += 1) {
  if (state.transition === null) break;
  tick(frame());
}
if (currentArea() !== "plaza" || state.player.x !== 878 || state.player.y !== 985)
  throw new Error(`did not return home: ${JSON.stringify(state)}`);
writeFileSync("tests/sim/scripts/bay/bus.json", `${JSON.stringify(script, null, 2)}\n`);
console.error(`bus: ${state.tick} ticks, ${script.length} segments`);
