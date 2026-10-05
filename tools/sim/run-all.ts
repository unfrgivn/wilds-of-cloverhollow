import { readdirSync, readFileSync } from "node:fs";
import {
  createState,
  distanceToPolygon,
  pointInPolygon,
  step,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
const content = loadContent();
const fixture = content.fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture is missing");
const epsilon = 0.01;
for (const name of readdirSync("tests/sim/scripts")) {
  const parsed = parseScript(
    JSON.parse(readFileSync(`tests/sim/scripts/${name}`, "utf8")),
    name,
  );
  let state = createState(content.world, fixture);
  const area = content.world.areas[state.area];
  if (area === undefined) throw new Error(`${name}: missing area`);
  for (const item of parsed)
    for (let index = 0; index < item.ticks; index += 1) {
      state = step(content.world, state, item.frame).state;
      if (
        !pointInPolygon(state.player, area.walkable) ||
        distanceToPolygon(state.player, area.walkable) <
          content.world.tunables.playerRadius - epsilon
      )
        throw new Error(`${name}: walkable invariant at ${state.tick}`);
      for (const blocker of area.blockers)
        if (
          pointInPolygon(state.player, blocker) ||
          distanceToPolygon(state.player, blocker) <
            content.world.tunables.playerRadius - epsilon
        )
          throw new Error(`${name}: blocker invariant at ${state.tick}`);
    }
  console.log(`${name}: tick ${state.tick} ok`);
}
