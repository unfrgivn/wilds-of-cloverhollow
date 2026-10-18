import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  createState, autosaveNeeded, parseSave, serializeSave, step,
  type Fixture, type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

type PackSpec = {
  id: string; label: string; note: string; fixture: string; run: string;
  interim: boolean; end?: number;
};
type ManifestPack = Omit<PackSpec, "end"> & { tick: number };
const pack = (spec: PackSpec): PackSpec => spec;

const specs: PackSpec[] = [
  pack({ id: "breakfast", label: "After breakfast", note: "A new game, just after Fae leaves home.",
    fixture: "new-game", run: "new-game/chapter-one.json", interim: false, end: 4000 }),
  pack({ id: "fountain-frog", label: "After the fountain frog",
    note: "The first calm-down is complete.",
    fixture: "new-game", run: "new-game/chapter-one.json", interim: false, end: 9000 }),
  pack({ id: "tree-house", label: "At the tree house",
    note: "New game, at the end of chapter one.",
    fixture: "new-game", run: "new-game/chapter-one.json", interim: false }),
  pack({ id: "bubblegum-bay", label: "Arriving in Bubblegum Bay",
    note: "New game, stepping onto the bay road.",
    fixture: "new-game", run: "new-game/east-road.json", interim: false }),
  ...["jordan", "lantern", "woods", "school", "gym", "music", "field",
    "clubhouse", "kitchen", "arcade", "lodge", "squirrel", "mist", "forest",
    "kid", "flute", "lasso"].map((run) => ({
    id: `shortcut-${run}`, label: `${run[0]?.toUpperCase() ?? ""}${run.slice(1)} shortcut`,
    note: "Starts from the shortcut that skips chapter one and Sue's joining.",
    fixture: "pass-party", run: `pass-party/${run}.json`, interim: true,
  })),
];

const content = loadContent();
const outDir = "content/qa/saves";
mkdirSync(outDir, { recursive: true });
const manifest: ManifestPack[] = [];
const replayCache = new Map<string, { states: State[]; final: State }>();
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
  const requested = spec.end ?? states.length - 1;
  let tick = Math.min(requested, states.length - 1);
  while (tick > 0) {
    const previous = stateAt(states, tick - 1);
    const current = stateAt(states, tick);
    if (autosaveNeeded(previous, current) && current.battle === null &&
      current.arcade === null && current.finale === null) break;
    tick -= 1;
  }
  const state = stateAt(states, tick);
  const fixture = content.fixtures["new-game"];
  if (fixture === undefined) throw new Error("new-game fixture missing");
  if (parseSave(serializeSave(state), createState(content.world, fixture, 1)) === null)
    throw new Error(`Pack ${spec.id} is not a valid save at tick ${tick}`);
  writeFileSync(`${outDir}/${spec.id}.json`, serializeSave(state));
  manifest.push({
    id: spec.id, label: spec.label, note: spec.note, fixture: spec.fixture,
    run: spec.run, tick, interim: spec.interim,
  });
}
writeFileSync("content/qa/saves.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${manifest.length} QA saves`);
for (const pack of manifest) console.log(`${pack.id} tick=${pack.tick} run=${pack.run}`);
