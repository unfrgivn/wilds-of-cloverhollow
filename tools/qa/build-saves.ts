import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  createState, autosaveNeeded, parseSave, serializeSave, stableHash, step,
  type Fixture, type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

type PackSpec = {
  id: string; label: string; note: string; fixture: string; run: string;
  interim: boolean;
};
type ManifestPack = Omit<PackSpec, "end"> & { tick: number; hash: string };
const pack = (spec: PackSpec): PackSpec => spec;

const specs: PackSpec[] = [
  pack({ id: "breakfast", label: "After breakfast", note: "A new game, just after Fae leaves home.",
    fixture: "new-game", run: "new-game/chapter-one.json", interim: false }),
  pack({ id: "fountain-frog", label: "After the fountain frog",
    note: "In the plaza, after the fountain frog's first calm-down; the school is next.",
    fixture: "new-game", run: "new-game/chapter-one.json", interim: false }),
  pack({ id: "tree-house", label: "At the tree house",
    note: "At the tree house, with chapter one complete; Bubblegum Bay is next.",
    fixture: "new-game", run: "new-game/chapter-one.json", interim: false }),
  pack({ id: "bubblegum-bay", label: "Arriving in Bubblegum Bay",
    note: "On the road into Bubblegum Bay, ready to explore the new lands.",
    fixture: "new-game", run: "new-game/east-road.json", interim: false }),
  ...["jordan", "lantern", "woods", "school", "gym", "music", "field",
    "clubhouse", "kitchen", "arcade", "lodge", "squirrel", "mist", "forest",
    "kid", "flute", "lasso"].map((run) => ({
    id: `shortcut-${run}`, label: `${run[0]?.toUpperCase() ?? ""}${run.slice(1)} shortcut`,
    note: `Starts from the pass-party shortcut, at the ${run} beat; continue from here.`,
    fixture: "pass-party", run: `pass-party/${run}.json`, interim: true,
  })),
];

const content = loadContent();
const outDir = "content/qa/saves";
mkdirSync(outDir, { recursive: true });
const manifest: ManifestPack[] = [];
const bytes = new Set<string>();
const origins = new Set<string>();
const replayCache = new Map<string, { states: State[]; final: State }>();
function beat(id: string, state: State): boolean {
  const variable = (name: string): boolean => content.world.storyVariable(state.ink, name) === true;
  if (id === "breakfast") return variable("ate_breakfast");
  if (id === "fountain-frog") return state.stickers.includes("fountain-frog");
  if (id === "tree-house") return variable("club_open");
  if (id === "bubblegum-bay") return state.area === "bay";
  const run = id.replace("shortcut-", "");
  if (run === "jordan") return variable("jordan_joined");
  if (run === "lantern") return variable("has_lantern");
  if (run === "woods") return state.area === "woods" && state.stickers.length >= 2;
  if (run === "school") return state.area === "east-hall";
  if (run === "gym") return variable("has_lasso");
  if (run === "music") return variable("has_flute");
  if (run === "field") return state.area === "field";
  if (run === "clubhouse" || run === "kitchen")
    return state.area === "clubhouse" &&
      state.stickers.length >= (run === "kitchen" ? 7 : 3);
  if (run === "arcade") return state.area === "arcade";
  if (run === "lodge") return state.area === "lodge";
  if (run === "squirrel") return state.stickers.includes("acorn-squirrel");
  if (run === "mist") return state.area === "mist";
  if (run === "forest") return state.area === "enchanted";
  if (run === "kid") return variable("milo_revealed");
  if (run === "flute") return state.area === "park" && variable("has_flute");
  if (run === "lasso") return state.area === "classroom" && variable("has_lasso");
  return false;
}
function stateAt(states: State[], index: number): State {
  const state = states[index];
  if (state === undefined) throw new Error(`Replay has no tick ${index}`);
  return state;
}

function replay(spec: PackSpec): { states: State[]; final: State } {
  const key = `${spec.fixture}/${spec.run}`;
  const cached = replayCache.get(key);
  if (cached !== undefined) return cached;
  const fixture: Fixture | undefined = content.fixtures[spec.fixture];
  if (fixture === undefined) throw new Error(`Unknown fixture ${spec.fixture}`);
  const scriptPath = `tests/sim/scripts/${spec.run}`;
  const script = parseScript(JSON.parse(readFileSync(scriptPath, "utf8")), scriptPath);
  let state = createState(content.world, fixture, 1);
  const states = [state];
  for (const segment of script) for (let i = 0; i < segment.ticks; i += 1) {
    state = step(content.world, state, segment.frame).state;
    states.push(state);
  }
  const result = { states, final: state };
  replayCache.set(key, result);
  return result;
}

for (const spec of specs) {
  const { states } = replay(spec);
  const requested = states.findIndex((candidate) => beat(spec.id, candidate));
  if (requested < 0) throw new Error(`Beat predicate never held for ${spec.id}`);
  let tick = requested;
  let foundAutosave = false;
  while (tick <= states.length - 1) {
    const previous = stateAt(states, tick - 1);
    const current = stateAt(states, tick);
    if (tick > 0 && autosaveNeeded(previous, current) && current.battle === null &&
      current.arcade === null && current.finale === null) {
      foundAutosave = true;
      break;
    }
    tick += 1;
  }
  if (!foundAutosave) throw new Error(`No valid autosave after beat for ${spec.id}`);
  const state = stateAt(states, tick);
  const fixture = content.fixtures[spec.fixture];
  if (fixture === undefined) throw new Error(`${spec.fixture} fixture missing`);
  if (parseSave(serializeSave(state), createState(content.world, fixture, 1)) === null)
    throw new Error(`Pack ${spec.id} is not a valid save at tick ${tick}`);
  const serialized = serializeSave(state);
  if (bytes.has(serialized) || origins.has(`${spec.run}:${tick}`))
    throw new Error(`Duplicate QA pack ${spec.id}`);
  bytes.add(serialized); origins.add(`${spec.run}:${tick}`);
  writeFileSync(`${outDir}/${spec.id}.json`, serialized);
  manifest.push({
    id: spec.id, label: spec.label, note: spec.note, fixture: spec.fixture,
    run: spec.run, tick, interim: spec.interim, hash: stableHash(state),
  });
}
writeFileSync("content/qa/saves.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${manifest.length} QA saves`);
for (const pack of manifest) console.log(`${pack.id} tick=${pack.tick} run=${pack.run}`);
