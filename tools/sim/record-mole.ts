#!/usr/bin/env bun
// Records Boop-a-Mole (Milestone 46): from the arcade fixture, Mr. Pip is
// calmed, then a round of Boop-a-Mole played like a kid would: most moles
// booped while they're up (the arrows, and Z for the middle), one booped as
// it's still rising, two let go, and two squeaks at an empty hole. Then the
// cabinet is looked at again, and Fae says not now.
//
//   bun tools/sim/record-mole.ts > tests/sim/scripts/arcade/mole.json
import {
  blankInput, createState, moleWindow, type ActionFrame, type MoleGame, type MoleHole,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.arcade;
if (fixture === undefined) throw new Error("arcade fixture missing");
const play = createRecorder(world, createState(world, fixture));
const mole = world.arcade.mole;
// Ticks spent reading the result before pressing on.
const reading = 30;
const game = (): MoleGame => {
  const arcade = play.state().arcade;
  if (arcade?.game !== "mole") throw new Error("no Boop-a-Mole round is open");
  return arcade;
};
// The frame that boops a hole: its arrow, or Z for the middle.
const boop = (hole: MoleHole): ActionFrame => {
  const blank = blankInput();
  switch (hole) {
    case "middle":
      return { ...blank, confirm: true };
    case "up":
      return { ...blank, move: { x: 0, y: -1 } };
    case "down":
      return { ...blank, move: { x: 0, y: 1 } };
    case "left":
      return { ...blank, move: { x: -1, y: 0 } };
    case "right":
      return { ...blank, move: { x: 1, y: 0 } };
  }
};
// A tap of a hole's key: down a tick, then up.
const tap = (hole: MoleHole): void => {
  play.tick(boop(hole));
  play.idle(1);
};
const until = (done: () => boolean, label: string): void => {
  for (let count = 0; count < 600 && !done(); count += 1) play.idle(1);
  if (!done()) throw new Error(`never ${label}`);
};

play.meet("arcade-keeper");
play.battle(["juggle", "cast"]);
if (play.state().critters["arcade-keeper"] !== "calm") throw new Error("Mr. Pip isn't calm");

play.approach("boop-a-mole");
play.talk("boop-a-mole", [0]);
until(() => game().phase === "playing", "started playing");
const order = game().order;
// The moles let go, and the one booped while still rising.
const missed = new Set([4, 11]);
const early = 7;
for (let index = 0; index < order.length; index += 1) {
  const hole = order[index];
  if (hole === undefined) throw new Error("a short round");
  until(() => game().mole === index && game().stage === "rising", `mole ${index} rising`);
  if (index === 2) {
    // Two squeaks at the far side while the mole rises, a hole it isn't in.
    const empty: MoleHole = hole === "left" ? "right" : "left";
    tap(empty);
    tap(empty);
  }
  if (missed.has(index)) continue;
  if (index === early) {
    until(() => game().stageTicks >= Math.floor(mole.riseTicks / 2), "half risen");
  } else {
    until(() => game().stage === "up" && game().stageTicks >= 6, `mole ${index} up`);
    if (game().stageTicks + 2 >= moleWindow(mole, index)) throw new Error("too slow");
  }
  const before = game().booped;
  tap(hole);
  if (game().booped !== before + 1) throw new Error(`mole ${index} wasn't booped`);
}
const typed = (): boolean => game().phase === "result" && game().revealed >= game().message.length;
until(typed, "typed out the result");
const booped = order.length - missed.size;
const expected = mole.lines.result.replace("{booped}", String(booped))
  .replace("{moles}", String(order.length))
  .replace("{tickets}", String(booped * mole.ticketsPerBoop));
if (game().message !== expected) throw new Error(`"${game().message}", not "${expected}"`);
play.idle(reading);
play.press();
if (play.state().arcade !== null) throw new Error("the result didn't close");
play.approach("boop-a-mole");
play.talk("boop-a-mole", [1]);

const end = play.state();
if (end.tickets !== booped * mole.ticketsPerBoop) throw new Error(`tickets ${end.tickets}`);
if (end.arcade !== null || end.dialogue !== null) throw new Error("the run didn't end free");
console.error(`mole: ${end.tick} ticks, ${end.coins} coins, ${end.tickets} tickets, ` +
  `${booped} of ${order.length} booped, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
