import { writeFileSync } from "node:fs";
import { loadContent } from "../../src/content/load";
import { blankInput, createState, step, type ActionFrame, type State } from "../../src/core";

const content = loadContent();
const world = content.world;
const fixture = content.fixtures.pass;
if (fixture === undefined) throw new Error("pass fixture missing");
const output = "tests/sim/scripts/pass/trail.json";
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
function navigate(target: { x: number; y: number }): void {
  const moves = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => ({ x, y })))
    .filter((move) => move.x !== 0 || move.y !== 0);
  type Node = { state: State; path: { x: number; y: number }[] };
  const queue: Node[] = [{ state, path: [] }];
  const seen = new Set([`${Math.round(state.player.x / 8)},${Math.round(state.player.y / 8)}`]);
  for (let index = 0; index < queue.length && index < 60000; index += 1) {
    const node = queue[index];
    if (node === undefined) continue;
    if (
      Math.abs(node.state.player.x - target.x) < 12 &&
      Math.abs(node.state.player.y - target.y) < 12
    ) {
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
      seen.add(key); queue.push({ state: next, path: [...node.path, move] });
    }
  }
  throw new Error(
    `no path to ${JSON.stringify(target)} from ${JSON.stringify(state.player)} in ${state.area}`,
  );
}
function waitUntil(predicate: () => boolean, limit = 600): void {
  for (let count = 0; count < limit && !predicate(); count += 1) tick(frame());
  if (!predicate()) throw new Error("timed out waiting for state");
}
function clearDialogue(): void {
  waitUntil(() => state.dialogue === null, 500);
}
function calmBattle(): void {
  for (let round = 0; round < 24 && state.battle !== null; round += 1) {
    const phase = state.battle.phase;
    console.error("battle round", round, phase, state.battle.revealed, state.battle.aimTick);
    if (phase === "intro") {
      tick(frame(0, 0, true)); tick(frame()); tick(frame(0, 0, true));
    } else if (phase === "command") {
      waitUntil(() => (state.battle?.revealed ?? 0) >= (state.battle?.message.length ?? 1), 100);
      tick(frame(0, 0, true));
    } else if (phase === "aim") {
      for (let count = 0; count < 45; count += 1) tick(frame());
      tick(frame(0, 0, true));
    } else {
      waitUntil(() => (state.battle?.revealed ?? 0) >= (state.battle?.message.length ?? 1), 100);
      tick(frame()); tick(frame(0, 0, true));
    }
  }
  if (state.battle !== null) throw new Error(`battle did not end: ${state.battle.phase}`);
}
// Reach the trail, let the upper roamer initiate, and calm it with Soothe.
navigate({ x: 1460, y: 840 });
for (let count = 0; count < 40 && state.area === "pass"; count += 1) tick(frame(1, 0));
waitUntil(() => state.area === "trail", 100);
for (let count = 0; count < 95; count += 1) tick(frame(1, 0));
for (let count = 0; count < 20; count += 1) tick(frame(0, 1));
waitUntil(() => state.battle?.critterId === "bunny", 500);
calmBattle();
clearDialogue();
// The lower roamer is deliberately run from, then its cooldown expires.
 navigate({ x: 300, y: 700 });
 navigate({ x: 300, y: 850 });
 navigate({ x: 600, y: 850 });
for (let count = 0; count < 100; count += 1) tick(frame(-1, 0));
for (let count = 0; count < 50; count += 1) tick(frame(0, 1));
for (let count = 0; count < 80; count += 1) tick(frame(1, 0));
waitUntil(() => state.battle?.critterId === "squirrel", 500);
tick(frame(0, 0, true));
waitUntil(() => (state.battle?.revealed ?? 0) >= (state.battle?.message.length ?? 1), 100);
tick(frame());
for (let count = 0; count < 3; count += 1) { tick(frame(0, 1)); tick(frame()); }
tick(frame(0, 0, true));
waitUntil(() => state.battle?.phase === "run", 100);
waitUntil(() => (state.battle?.revealed ?? 0) >= (state.battle?.message.length ?? 1), 100);
tick(frame()); tick(frame(0, 0, true));
waitUntil(() => state.battle === null, 500);
clearDialogue();
for (let count = 0; count < world.tunables.roam.cooldownTicks + 10; count += 1) tick(frame());
navigate({ x: 1300, y: 960 });
for (let count = 0; count < 30 && state.area === "trail"; count += 1) tick(frame(0, 1));
waitUntil(() => state.area === "bay", 100);
// Keep walking down into the closed cliff path. It must play its knot, not leave.
for (let count = 0; count < 80 && state.dialogue === null; count += 1) tick(frame(0, 1));
if (state.dialogue?.knot !== "bay_cliff_path")
  throw new Error("closed cliff path was not recorded");
writeFileSync(output, `${JSON.stringify(script, null, 2)}\n`);
console.error(`trail: ${state.tick} ticks, ${script.length} segments, end=${state.area}`);
