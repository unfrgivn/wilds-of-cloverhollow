import { readFileSync } from "node:fs";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { battleView, createState, step, type BattleView, type State } from "../../src/core";

export type ReplayTickQuery =
  | "owl-peek"
  | "flute-command"
  | "lasso-steady-command"
  | "kid-lasso-windup"
  | "lean-check";

function isReplayTickQuery(value: string): value is ReplayTickQuery {
  return (
    value === "owl-peek" ||
    value === "flute-command" ||
    value === "lasso-steady-command" ||
    value === "kid-lasso-windup" ||
    value === "lean-check"
  );
}

function matches(query: ReplayTickQuery, state: State, view: BattleView | null): boolean {
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
      return (
        battle.critterId === "hooded-kid" &&
        battle.phase === "command" &&
        view?.lassoAssist?.available === true &&
        view.lassoAssist.windUp === true &&
        !battle.lassoUsed &&
        battle.windUp !== null &&
        battle.windUp.popped.every((p) => !p)
      );
    case "lean-check":
      return battle.check?.kind === "lean";
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
    if (matches(rawQuery, state, view)) {
      console.log(JSON.stringify({ tick }));
      process.exit(0);
    }
  }
}

throw new Error(`No matching tick for "${rawQuery}" in ${scriptPath} (${fixtureId})`);
