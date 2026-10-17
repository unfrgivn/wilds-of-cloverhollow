#!/usr/bin/env bun
// Records the claw machine (Milestone 44): from the arcade fixture, Mr. Pip is
// calmed, then four games of the claw cover every outcome: the buried
// raccoon (stuck), the pup on top (won), the bare floor in the back corner
// (empty, sliding and pushing to the ends), and the cat (won). Then the
// machine is looked at again, and Fae says not now.
//
//   bun tools/sim/record-claw.ts > tests/sim/scripts/arcade/claw.json
import { blankInput, createState, type ActionFrame, type HeapPlush } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.arcade;
if (fixture === undefined) throw new Error("arcade fixture missing");
const play = createRecorder(world, createState(world, fixture));
const claw = world.arcade.claw;
const held: ActionFrame = { ...blankInput(), confirm: true };
// Ticks spent reading a hint or a result before pressing on.
const reading = 30;
const plush = (prize: string): HeapPlush => {
  const found = claw.heap.find((item) => item.prize === prize);
  if (found === undefined) throw new Error(`the heap has no ${prize}`);
  return found;
};

play.meet("arcade-keeper");
play.battle(["juggle", "cast"]);
if (play.state().critters["arcade-keeper"] !== "calm") throw new Error("Mr. Pip isn't calm");

// One game, played like a reader: talk to the machine and play, read the
// hint, then the first hold; read the next hint, then the second. The press
// that starts each hold doesn't move the claw; each tick held after it moves
// it one speed; the tick it's let go doesn't. Then wait for the result to
// type out, read it, and close it.
const game = (target: { x: number; z: number }, expected: string): void => {
  play.approach("claw-machine");
  play.talk("claw-machine", [0]);
  if (play.state().arcade?.phase !== "ready") throw new Error("the claw machine didn't open");
  const slide = Math.ceil((target.x - claw.railLeft) / claw.speed);
  const push = Math.ceil((target.z - claw.depthFront) / claw.speed);
  play.idle(reading);
  for (let count = 0; count <= slide; count += 1) play.tick(held);
  play.idle(reading);
  for (let count = 0; count <= push; count += 1) play.tick(held);
  const typed = (): boolean => {
    const arcade = play.state().arcade;
    return arcade?.phase === "result" && arcade.revealed >= arcade.message.length;
  };
  for (let count = 0; count < 900 && !typed(); count += 1) play.idle(1);
  const result = play.state().arcade;
  if (result === null || !typed()) throw new Error("the claw never came back");
  if (result.message !== expected) throw new Error(`"${result.message}", not "${expected}"`);
  play.idle(reading);
  play.press();
  if (play.state().arcade !== null) throw new Error("the result didn't close");
};

const name = (prize: string): string =>
  world.arcade.prizes.find((item) => item.id === prize)?.name ?? prize;
const won = (prize: string): string => claw.lines.won.replace("{prize}", name(prize));
game(plush("raccoon-plush"), claw.lines.stuck);
game(plush("pup-plush"), won("pup-plush"));
game({ x: claw.railRight, z: claw.depthBack }, claw.lines.missed);
game(plush("cat-plush"), won("cat-plush"));
play.approach("claw-machine");
play.talk("claw-machine", [1]);

const end = play.state();
if (JSON.stringify(end.prizes) !== JSON.stringify(["pup-plush", "cat-plush"]))
  throw new Error(`the prizes are ${JSON.stringify(end.prizes)}`);
if (end.arcade !== null || end.dialogue !== null) throw new Error("the run didn't end free");
console.error(`claw: ${end.tick} ticks, ${end.coins} coins, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
