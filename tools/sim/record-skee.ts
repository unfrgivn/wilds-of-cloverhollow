#!/usr/bin/env bun
// Records skee-ball and the ticket counter (Milestone 45): from the arcade
// fixture, Mr. Pip is calmed, then a game of skee-ball with a ball for each
// kind of score: the 50 in the middle, the 100 in a corner hole, one rolled so
// hard it flies off the top (the floor's 10), a 40, and a 20. That's 220, or 22
// tickets, and Mr. Pip trades 20 of them for the rainbow pinwheel.
//
//   bun tools/sim/record-skee.ts > tests/sim/scripts/arcade/skee.json
import {
  blankInput, createState, skeePoints, type ActionFrame, type SkeeGame,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.arcade;
if (fixture === undefined) throw new Error("arcade fixture missing");
const play = createRecorder(world, createState(world, fixture));
const skee = world.arcade.skee;
const held: ActionFrame = { ...blankInput(), confirm: true };
// Ticks spent reading a hint or a result before pressing on.
const reading = 30;
const game = (): SkeeGame => {
  const arcade = play.state().arcade;
  if (arcade?.game !== "skee") throw new Error("no skee-ball game is open");
  return arcade;
};
const ring = (index: number): { points: number; radius: number } => {
  const found = skee.rings[index];
  if (found === undefined) throw new Error(`skee-ball has no ring ${index}`);
  return found;
};

play.meet("arcade-keeper");
play.battle(["juggle", "cast"]);
if (play.state().critters["arcade-keeper"] !== "calm") throw new Error("Mr. Pip isn't calm");

// One ball, played like a reader: watch the arrow sweep to the aim and press,
// then hold for `hold` ticks and let go (held to the meter's end, it rolls on
// its own). Then watch it roll, hop, and land.
const ball = (aim: number, hold: number): void => {
  for (let count = 0; count < 400 && game().aim !== aim; count += 1) play.idle(1);
  if (game().phase !== "aiming" || game().aim !== aim) throw new Error(`the arrow missed ${aim}`);
  play.press();
  if (game().phase !== "winding") throw new Error("the aim didn't set");
  play.idle(reading);
  play.tick(held);
  for (let count = 1; count < hold && game().phase === "powering"; count += 1) play.tick(held);
  if (game().phase === "powering") play.idle(1);
  const thrown = game().throws.at(-1);
  if (game().phase !== "rolling" || thrown === undefined || thrown.y !== hold * skee.powerStep)
    throw new Error(`the ball wasn't rolled after ${hold} ticks`);
  for (let count = 0; count < 200 && game().phase !== "scored"; count += 1) play.idle(1);
  if (thrown.points !== skeePoints(skee, aim, hold * skee.powerStep))
    throw new Error("the ball scored what the rules don't");
  for (let count = 0; count < 200 && game().phase === "scored"; count += 1) play.idle(1);
};

play.approach("skee-ball", "left");
play.talk("skee-ball", [0]);
if (game().phase !== "aiming") throw new Error("skee-ball didn't open");
const centre = skee.centre;
const middle = (inner: number, outer: number): number =>
  Math.round((centre.y - (inner + outer) / 2) / skee.powerStep);
ball(centre.x, Math.round(centre.y / skee.powerStep));
ball(skee.corners.x, Math.round(skee.corners.y / skee.powerStep));
ball(centre.x - 10 * skee.sweepStep, skee.powerTicks);
ball(centre.x, middle(ring(0).radius, ring(1).radius));
ball(centre.x, middle(ring(2).radius, ring(3).radius));
const points = game().throws.map((thrown) => thrown.points);
const expected = [ring(0).points, skee.corners.points, skee.floor, ring(1).points,
  ring(3).points];
if (JSON.stringify(points) !== JSON.stringify(expected))
  throw new Error(`the balls scored ${JSON.stringify(points)}`);
const typed = (): boolean => game().phase === "result" && game().revealed >= game().message.length;
for (let count = 0; count < 600 && !typed(); count += 1) play.idle(1);
if (!typed()) throw new Error("the result never typed out");
play.idle(reading);
play.press();
if (play.state().arcade !== null) throw new Error("the result didn't close");

play.approach("ticket-counter");
play.talk("ticket-counter", [0]);

const end = play.state();
if (JSON.stringify(end.prizes) !== JSON.stringify(["pinwheel"]) || end.tickets !== 2)
  throw new Error(`prizes ${JSON.stringify(end.prizes)}, tickets ${end.tickets}`);
if (end.arcade !== null || end.dialogue !== null) throw new Error("the run didn't end free");
console.error(`skee: ${end.tick} ticks, ${end.coins} coins, ${end.tickets} tickets, ` +
  `${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
