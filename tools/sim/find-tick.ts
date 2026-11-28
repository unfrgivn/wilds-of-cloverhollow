import { readFileSync } from "node:fs";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import {
  battleView,
  createState,
  step,
  targetInteractable,
  type BattleView,
  type State,
  type World,
} from "../../src/core";

export type ReplayTickQuery =
  | "owl-peek"
  | "flute-command"
  | "lasso-steady-command"
  | "kid-lasso-windup"
  | "lasso-windup-command"
  | "lean-check"
  | "lean-normal-check"
  | "catch-all-lanes-check"
  | "taco-ready"
  | "fish-dock-ready";

function isReplayTickQuery(value: string): value is ReplayTickQuery {
  return (
    value === "owl-peek" ||
    value === "flute-command" ||
    value === "lasso-steady-command" ||
    value === "kid-lasso-windup" ||
    value === "lasso-windup-command" ||
    value === "lean-check" ||
    value === "lean-normal-check" ||
    value === "catch-all-lanes-check" ||
    value === "taco-ready" ||
    value === "fish-dock-ready"
  );
}

function matches(
  world: World,
  query: ReplayTickQuery,
  state: State,
  view: BattleView | null,
): boolean {
  if (query === "taco-ready") {
    return (
      state.arcade?.game === "taco" &&
      state.arcade.phase === "ready" &&
      !state.previousInput.confirm
    );
  }
  if (query === "fish-dock-ready") {
    return (
      state.area === "bay" &&
      state.dialogue === null &&
      state.arcade === null &&
      state.battle === null &&
      state.transition === null &&
      world.storyVariable(state.ink, "sue_joined") === true &&
      state.stickers.includes("bay-bluebird") &&
      targetInteractable(world, state)?.id === "dock-end" &&
      !state.previousInput.confirm
    );
  }
  const battle = state.battle;
  if (battle === null) return false;
  switch (query) {
    case "owl-peek":
      return (
        battle.critterId === "owl" &&
        battle.phase === "command" &&
        !battle.lanternPeek &&
        battle.revealed >= battle.message.length
      );
    case "flute-command":
      return (
        battle.phase === "command" &&
        view?.activeActor.id === "fae" &&
        view.fluteAssist?.available === true &&
        !battle.fluteUsed &&
        battle.revealed >= battle.message.length
      );
    case "lasso-steady-command":
      return (
        battle.phase === "command" &&
        view?.activeActor.id === "fae" &&
        view.lassoAssist?.available === true &&
        view.lassoAssist.windUp === false &&
        !battle.lassoUsed &&
        battle.revealed >= battle.message.length
      );
    case "kid-lasso-windup":
    case "lasso-windup-command":
      return (
        battle.critterId === "hooded-kid" &&
        battle.phase === "command" &&
        view?.lassoAssist?.available === true &&
        view.lassoAssist.windUp === true &&
        battle.windUp !== null &&
        battle.windUp.popped.every((popped) => !popped) &&
        !battle.lassoUsed &&
        battle.revealed >= battle.message.length
      );
    case "lean-check":
      return battle.check?.kind === "lean";
    case "lean-normal-check":
      return battle.check?.kind === "lean" && battle.check.tick === 0 && !battle.check.big;
    case "catch-all-lanes-check":
      return (
        battle.check?.kind === "catch" &&
        battle.check.tick === 0 &&
        battle.check.spec.arrivals.length >= 4 &&
        new Set(battle.check.lanes).size === 3
      );
  }
}

const [scriptPath, fixtureId, rawQuery] = process.argv.slice(2);
if (scriptPath === undefined || fixtureId === undefined || rawQuery === undefined) {
  throw new Error("Usage: bun tools/sim/find-tick.ts <scriptPath> <fixtureId> <query>");
}
if (!isReplayTickQuery(rawQuery)) {
  throw new Error(`Unknown replay tick query: ${rawQuery}`);
}

const content = loadContent();
const fixture = content.fixtures[fixtureId];
if (fixture === undefined) throw new Error(`Missing fixture: ${fixtureId}`);

const segments = parseScript(JSON.parse(readFileSync(scriptPath, "utf8")), scriptPath);
let state = createState(content.world, fixture, 1);
let tick = 0;

for (const segment of segments) {
  for (let i = 0; i < segment.ticks; i += 1) {
    state = step(content.world, state, segment.frame).state;
    tick += 1;
    const view = state.battle === null ? null : battleView(content.world, state);
    if (matches(content.world, rawQuery, state, view)) {
      console.log(JSON.stringify({ tick }));
      process.exit(0);
    }
  }
}

throw new Error(`No matching tick for "${rawQuery}" in ${scriptPath} (${fixtureId})`);
