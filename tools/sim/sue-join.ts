import { readFileSync } from "node:fs";
import { Compiler } from "inkjs/full";
import {
  blankInput,
  createState,
  createStoryReader,
  distanceToPolygon,
  pointInPolygon,
  step,
  targetInteractable,
  type Npc,
  type State,
  type World,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

const testKnot = [
  "=== sue_sim ===",
  "~ sue_joined = true",
  "Sue waves her ribbon bobber. # speaker: Sue",
  "-> DONE",
].join("\n");
const source = `${readFileSync("content/story/main.ink", "utf8")}\n${testKnot}\n`;
const compiler = new Compiler(source);
compiler.Compile();
if (compiler.errors.length > 0) throw new Error(compiler.errors.join("\n"));
const serialized = compiler.runtimeStory?.ToJson();
if (serialized === undefined || serialized === null) throw new Error("story did not compile");
const parsed: unknown = JSON.parse(serialized);
if (!record(parsed)) throw new Error("compiled story is not an object");

const content = loadContent();
const harness = content.world.areas.harness;
if (harness === undefined) throw new Error("harness missing");
const sue: Npc = {
  id: "sue",
  point: { x: 300, y: 420 },
  facing: "down",
  footprint: [[285, 410], [315, 410], [315, 430], [285, 430]],
  knot: "sue_sim",
  prompt: "Talk",
};
const world: World = {
  ...content.world,
  story: parsed,
  storyVariable: createStoryReader(parsed),
  areas: { ...content.world.areas, harness: { ...harness, npcs: [...harness.npcs, sue] } },
};
const fixture = content.fixtures.harness;
if (fixture === undefined) throw new Error("harness fixture missing");

function advance(state: State, input: ReturnType<typeof blankInput>): State {
  return step(world, state, input).state;
}

let state = createState(world, fixture);
for (let tick = 0; tick < 300 && targetInteractable(world, state)?.id !== "npc:sue"; tick += 1)
  state = advance(state, { ...blankInput(), move: { x: 0, y: -1 } });
if (targetInteractable(world, state)?.id !== "npc:sue")
  throw new Error("harness walk did not reach Sue");

state = advance(state, blankInput());
state = advance(state, { ...blankInput(), confirm: true });
if (state.dialogue === null) throw new Error("Sue talk did not open");
for (let tick = 0; tick < 600 && state.dialogue !== null; tick += 1)
  state = advance(state, { ...blankInput(), confirm: tick % 2 === 1 });
if (state.dialogue !== null || state.party.map((member) => member.id).join(",") !== "maddie,sue")
  throw new Error("Sue did not join after the talk");

for (let tick = 0; tick < 330; tick += 1) {
  state = advance(state, { ...blankInput(), move: { x: tick < 240 ? 1 : 0, y: 0 } });
  for (const member of state.party) {
    const area = world.areas[state.area];
    if (area === undefined || !pointInPolygon(member, area.walkable) ||
      distanceToPolygon(member, area.walkable) < world.tunables.follow.radius - 0.01)
      throw new Error(`${member.id} left the floor at tick ${state.tick}`);
  }
}
console.log(`sue-join: tick ${state.tick} ok, ${state.party.map((member) => member.id).join(",")}`);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
