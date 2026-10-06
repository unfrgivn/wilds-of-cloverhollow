#!/usr/bin/env bun
// Records "chapter one", the whole story so far played from a new game, as a
// sim script: the window and Fae's plan, breakfast with Mom, the Fizzy Frog,
// Meadow Park and the Zoomie Pup, the hall pass at school, the raccoon, and
// the tree house. It plays through the core like a careful player (arrow keys,
// a press on every aim's target tick) and prints the frames it used, so the
// script replays the run exactly. It fails loudly, naming the step, when the
// story or a map no longer fits the route. Rerun it after such changes:
//
//   bun tools/sim/chapter-one.ts > tests/sim/scripts/new-game/chapter-one.json
import {
  createState,
  step,
  targetInteractable,
  type ActionFrame,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
let state: State = createState(world, fixture);
const script: { frame: ActionFrame; ticks: number }[] = [];

function frame(x = 0, y = 0, confirm = false): ActionFrame {
  return { move: { x, y }, confirm, cancel: false, menu: false };
}

function same(left: ActionFrame, right: ActionFrame): boolean {
  return left.move.x === right.move.x && left.move.y === right.move.y &&
    left.confirm === right.confirm && left.cancel === right.cancel && left.menu === right.menu;
}

function tick(input: ActionFrame): void {
  const last = script[script.length - 1];
  if (last !== undefined && same(last.frame, input)) last.ticks += 1;
  else script.push({ frame: input, ticks: 1 });
  state = step(world, state, input).state;
}

// One released tick, then the press, so every press is a new edge.
function press(input = frame(0, 0, true)): void {
  tick(frame());
  tick(input);
}

function fail(why: string): never {
  const where = { area: state.area, player: state.player, facing: state.facing,
    dialogue: state.dialogue?.knot ?? null, battle: state.battle?.phase ?? null };
  throw new Error(`${why}: ${JSON.stringify(where)}`);
}

// Holds one arrow toward a coordinate; stops on arrival, when something
// blocks the way, or when a door, a conversation, or a battle starts.
function walk(axis: "x" | "y", target: number): void {
  const area = state.area;
  for (let count = 0; count < 600; count += 1) {
    if (state.area !== area || state.transition !== null || state.dialogue !== null ||
        state.battle !== null) return;
    const error = target - state.player[axis];
    if (Math.abs(error) <= 2) return;
    const before = state.player[axis];
    const sign = Math.sign(error);
    tick(frame(axis === "x" ? sign : 0, axis === "y" ? sign : 0));
    if (state.player[axis] === before) return;
  }
}

function arrive(area: string): void {
  for (let count = 0; count < 120 && state.transition !== null; count += 1) tick(frame());
  if (state.area !== area) fail(`expected to arrive in ${area}`);
}

// Talks to whatever Fae faces (which must be `who`), pressing through every
// line and picking `choices` in order.
function talk(who: string, ...choices: number[]): void {
  if (targetInteractable(world, state)?.id !== who) fail(`not facing ${who}`);
  press();
  const queue = [...choices];
  for (let count = 0; count < 200 && state.dialogue !== null; count += 1) {
    const dialogue = state.dialogue;
    if (dialogue.revealed < dialogue.text.length) press();
    else if (dialogue.choices.length > 0) {
      const choice = queue.shift();
      if (choice === undefined) fail(`an unplanned choice talking to ${who}`);
      for (let down = 0; down < choice; down += 1) press(frame(0, 1));
      press();
    } else press();
  }
  if (state.dialogue !== null) fail(`the conversation with ${who} never ended`);
  if (queue.length > 0) fail(`choices left over after ${who}`);
}

// Soothes every turn and presses on every aim's target tick (GREAT).
function battle(critter: string): void {
  if (state.battle?.critterId !== critter) fail(`expected a battle with ${critter}`);
  for (let count = 0; count < 600 && state.battle !== null; count += 1) {
    const current = state.battle;
    const aim = current.aim;
    if (current.phase === "aim" && aim !== null) {
      for (let wait = 0; wait < 200 && state.battle !== null &&
          state.battle.aimTick < aim.targetTick - 1; wait += 1) tick(frame());
      tick(frame(0, 0, true));
      tick(frame());
    } else if (current.phase === "command" && current.selected !== 0) {
      fail("Soothe isn't selected");
    } else press();
  }
  if (state.battle !== null) fail(`the battle with ${critter} never ended`);
  if (state.critters[critter] !== "calm") fail(`${critter} isn't calm`);
}

// The bedroom: the window, and "adventure first".
walk("x", 603);
walk("y", 323);
talk("window", 0);
walk("x", 500);
arrive("kitchen");
// Breakfast: a pancake.
walk("x", 615);
walk("y", 590);
talk("npc:mom", 0);
walk("x", 655);
walk("y", 510);
walk("x", 1040);
arrive("plaza");
// The Fizzy Frog.
walk("x", 600);
walk("y", 900);
walk("x", 1000);
battle("frog");
// Meadow Park and the Zoomie Pup.
walk("x", 1470);
walk("y", 1050);
arrive("park");
walk("x", 480);
walk("y", 600);
walk("x", 900);
battle("pup");
walk("x", 480);
walk("y", 850);
walk("x", 200);
walk("y", 1000);
arrive("plaza");
// School: Nurse Holly's hall pass.
walk("y", 860);
walk("x", 290);
walk("y", 1050);
arrive("school");
walk("x", 955);
walk("y", 590);
talk("npc:nurse", 1);
walk("x", 400);
arrive("plaza");
// The raccoon, and the password.
walk("x", 398);
walk("y", 914);
talk("npc:raccoon", 0);
walk("y", 860);
walk("x", 1470);
walk("y", 1050);
arrive("park");
// The tree house.
walk("x", 480);
walk("y", 600);
walk("x", 737);
walk("y", 500);
talk("tree-house");

console.error(`chapter one: ${state.tick} ticks, ${script.length} segments, ends in ` +
  `${state.area} at (${state.player.x}, ${state.player.y})`);
console.log(JSON.stringify(script, null, 2));
