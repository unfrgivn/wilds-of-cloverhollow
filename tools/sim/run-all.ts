import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createState,
  distanceToPolygon,
  pointInPolygon,
  step,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Scripts live in tests/sim/scripts/<fixture>/<name>.json; the folder names the
// fixture each script starts from.
const root = "tests/sim/scripts";
const content = loadContent();
const radius = content.world.tunables.playerRadius;
const epsilon = 0.01;

for (const folder of readdirSync(root, { withFileTypes: true })) {
  if (!folder.isDirectory()) throw new Error(`${root}/${folder.name}: expected a fixture folder`);
  const fixture = content.fixtures[folder.name];
  if (fixture === undefined) throw new Error(`${root}/${folder.name}: unknown fixture`);
  const scripts = readdirSync(join(root, folder.name)).filter((file) => file.endsWith(".json"));
  for (const file of scripts) {
    const name = `${folder.name}/${file}`;
    const script = parseScript(JSON.parse(readFileSync(join(root, name), "utf8")), name);
    let state = createState(content.world, fixture);
    for (const segment of script) {
      for (let index = 0; index < segment.ticks; index += 1) {
        state = step(content.world, state, segment.frame).state;
        const area = content.world.areas[state.area];
        if (area === undefined) throw new Error(`${name}: unknown area ${state.area}`);
        if (
          !pointInPolygon(state.player, area.walkable) ||
          distanceToPolygon(state.player, area.walkable) < radius - epsilon
        )
          throw new Error(`${name}: left the walkable floor at tick ${state.tick}`);
        for (const blocker of area.blockers)
          if (
            pointInPolygon(state.player, blocker) ||
            distanceToPolygon(state.player, blocker) < radius - epsilon
          )
            throw new Error(`${name}: entered a blocker at tick ${state.tick}`);
      }
    }
    console.log(`${name}: tick ${state.tick} ok`);
  }
}
