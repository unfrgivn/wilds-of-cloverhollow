#!/usr/bin/env bun
import {
  createState,
  step,
  targetInteractable,
  type ActionFrame,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

const { world, fixtures } = loadContent();
const fixture = fixtures.bay;
if (fixture === undefined) throw new Error("bay fixture missing");
let state: State = createState(world, fixture);
const script: { frame: ActionFrame; ticks: number }[] = [];
const frame = (
  x = 0,
  y = 0,
  confirm = false,
  choose?: number,
): ActionFrame => ({
  move: { x, y }, confirm, cancel: false, menu: false,
  ...(choose === undefined ? {} : { choose }),
});
function tick(input: ActionFrame): void {
  const last = script.at(-1);
  if (last !== undefined && JSON.stringify(last.frame) === JSON.stringify(input))
    last.ticks += 1;
  else script.push({ frame: input, ticks: 1 });
  state = step(world, state, input).state;
}
function press(input = frame(0, 0, true)): void { tick(frame()); tick(input); }
function walk(axis: "x" | "y", target: number): void {
  for (let i = 0; i < 600; i += 1) {
    if (state.dialogue !== null || state.battle !== null || state.transition !== null)
      return;
    const delta = target - state.player[axis];
    if (Math.abs(delta) < 3) return;
    const before = state.player[axis];
    tick(frame(axis === "x" ? Math.sign(delta) : 0,
      axis === "y" ? Math.sign(delta) : 0));
    if (state.player[axis] === before) return;
  }
}
function talk(id: string, choice = 0): void {
  if (targetInteractable(world, state)?.id !== id) throw new Error(`not facing ${id}`);
  press();
  for (let i = 0; i < 200 && state.dialogue !== null; i += 1) {
    const dialogue = state.dialogue;
    if (dialogue.revealed < dialogue.text.length) press();
    else if (dialogue.choices.length > 0) press(frame(0, 0, false, choice));
    else press();
  }
}
function battle(): void {
  let castUsed = false;
  for (let i = 0; i < 700 && state.battle !== null; i += 1) {
    const current = state.battle;
    if (current.phase === "command") {
      const selected = castUsed ? 0 : 2;
      if (current.selected !== selected) tick(frame(0, 0, false, selected));
      else {
        press();
        castUsed = true;
      }
    } else if (current.phase === "aim" && current.aim !== null) {
      while (state.battle !== null &&
        state.battle.aimTick < current.aim.targetTick - 1) tick(frame());
      press();
    } else press();
  }
}

walk("x", 900);
walk("y", 300);
walk("x", 1400);
walk("y", 280);
talk("npc:sue");
walk("x", 900);
walk("y", 760);
walk("x", 1250);
battle();
if (state.party.map((member) => member.id).join(",") !== "maddie,sue" ||
    state.critters.bluebird !== "calm" || !state.stickers.includes("bay-bluebird"))
  throw new Error("bay replay did not finish with Sue and a calm bluebird");
console.error(`bay: ${state.tick} ticks, ${script.length} segments`);
console.log(JSON.stringify(script, null, 2));
