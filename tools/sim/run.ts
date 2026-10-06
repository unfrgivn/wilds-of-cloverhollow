import { readFileSync } from "node:fs";
import { createState, stableHash, step, type Fixture } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
const path = process.argv[2];
if (path === undefined)
  throw new Error("Usage: bun tools/sim/run.ts <script.json>");
const parsed = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
const content = loadContent();
const fixtureNameIndex = process.argv.indexOf("--fixture");
const fixtureName =
  fixtureNameIndex < 0
    ? "new-game"
    : (process.argv[fixtureNameIndex + 1] ?? "new-game");
const fixture: Fixture | undefined = content.fixtures[fixtureName];
if (fixture === undefined) throw new Error(`Unknown fixture "${fixtureName}"`);
const seedIndex = process.argv.indexOf("--seed");
const seed = seedIndex < 0 ? undefined : Number(process.argv[seedIndex + 1]);
let state = createState(content.world, fixture, seed);
let previousDialogueLine = "";
let previousBattleLine = "";
let previousTransitionLine = "";
for (const item of parsed) {
  for (let index = 0; index < item.ticks; index += 1) {
    state = step(content.world, state, item.frame).state;
    if (process.argv.includes("--trace") && state.dialogue !== null) {
      const line = `${state.dialogue.speaker ?? ""}|${state.dialogue.text}`;
      if (line !== previousDialogueLine) {
        console.log(
          `dialogue tick=${state.tick} speaker=${state.dialogue.speaker ?? ""} ` +
            `text=${state.dialogue.text}`,
        );
        previousDialogueLine = line;
      }
    }
    if (process.argv.includes("--trace") && state.battle !== null) {
      const line = `${state.battle.phase}|${state.battle.message}`;
      if (line !== previousBattleLine) {
        console.log(
          `battle tick=${state.tick} phase=${state.battle.phase} message=${state.battle.message}`,
        );
        previousBattleLine = line;
      }
    }
    if (process.argv.includes("--trace")) {
      const line =
        state.transition === null
          ? "none"
          : `${state.transition.phase}:${state.area}`;
      if (line !== previousTransitionLine) {
        if (state.transition !== null)
          console.log(`transition tick=${state.tick} phase=${line}`);
        previousTransitionLine = line;
      }
    }
  }
}
const result = {
  hash: stableHash(state),
  tick: state.tick,
  x: state.player.x,
  y: state.player.y,
  critters: state.critters,
  stickers: state.stickers,
  battle: state.battle?.phase ?? null,
  transition: state.transition?.phase ?? null,
};
const critterSummary = Object.entries(result.critters)
  .map(([id, mood]) => `${id}:${mood}`)
  .join(",");
console.log(
  process.argv.includes("--json")
    ? JSON.stringify(result)
    : `${result.hash} tick=${result.tick} player=(${result.x},${result.y}) ` +
      `critters=${critterSummary} ` +
      `stickers=${result.stickers.join(",")} ` +
      `battle=${result.battle ?? "none"} transition=${result.transition ?? "none"}`,
);
