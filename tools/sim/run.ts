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
for (const item of parsed)
  for (let index = 0; index < item.ticks; index += 1)
    state = step(content.world, state, item.frame).state;
const result = {
  hash: stableHash(state),
  tick: state.tick,
  x: state.player.x,
  y: state.player.y,
};
console.log(
  process.argv.includes("--json")
    ? JSON.stringify(result)
    : `${result.hash} tick=${result.tick} player=(${result.x},${result.y})`,
);
