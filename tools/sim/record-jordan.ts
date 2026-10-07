#!/usr/bin/env bun
// Records Jordan's meeting at Pinecone Pass (Milestone 22) as a replay script:
// from the bus stop with Maddie and Sue, round the bus sign to Jordan (he
// joins), across to the fizzy hamster (Juggle first, then Soothe until it's
// calm), and a talk with the calm hamster, who gets Jordan to hand Fae his
// blacklight lantern.
//
//   bun tools/sim/record-jordan.ts > tests/sim/scripts/pass-party/jordan.json
import {
  battleCommands,
  createState,
  step,
  targetInteractable,
  type ActionFrame,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

const { world, fixtures } = loadContent();
const fixture = fixtures["pass-party"];
if (fixture === undefined) throw new Error("pass-party fixture missing");
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
function face(x: number, y: number): void { tick(frame(x, y)); tick(frame()); }
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
  let juggled = false;
  for (let i = 0; i < 900 && state.battle !== null; i += 1) {
    const current = state.battle;
    if (current.phase === "command") {
      const commands = battleCommands(world, state).map((command) => command.id);
      const wanted = commands.indexOf(juggled ? "soothe" : "juggle");
      if (wanted < 0) throw new Error(`no ${juggled ? "soothe" : "juggle"} in ${commands}`);
      if (current.selected !== wanted) tick(frame(0, 0, false, wanted));
      else {
        press();
        juggled = true;
      }
    } else if (current.phase === "aim" && current.aim !== null) {
      while (state.battle !== null &&
        state.battle.aimTick < current.aim.targetTick - 1) tick(frame());
      press();
    } else press();
  }
}

walk("x", 1066);
walk("y", 799);
walk("x", 1100);
walk("y", 745);
face(0, -1);
talk("npc:jordan");
walk("x", 850);
battle();
walk("x", 900);
face(-1, 0);
talk("critter:hamster");
if (state.party.map((member) => member.id).join(",") !== "maddie,sue,jordan" ||
    state.critters.hamster !== "calm" || !state.stickers.includes("hiker-hamster") ||
    world.storyVariable(state.ink, "has_lantern") !== true)
  throw new Error("the Jordan replay did not finish with Jordan, a calm hamster, and the lantern");
console.error(`jordan: ${state.tick} ticks, ${script.length} segments`);
console.log(JSON.stringify(script, null, 2));
