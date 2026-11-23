import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import {
  createState, autosaveNeeded, parseSave, serializeSave, stableHash, step,
  type Fixture, type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// The only writer of content/qa (spec section 10). `--check`, run by
// `just check`, fails when a pack or the manifest differs from what this would
// write, or when a pack file has no spec below.
//
// A pack is one of two kinds:
//   story     a golden-path run from a new game (Milestone 68), cut at the
//             first autosave after its beat
//   setup     a QA fixture's first tick; interim, for a scene no recorded
//             run reaches yet
type PackKind = "story" | "setup";
type PackSpec = {
  id: string; label: string; note: string; fixture: string; run: string; kind: PackKind;
};
type ManifestPack = {
  id: string; label: string; note: string; fixture: string; run: string;
  tick: number; interim: boolean; hash: string;
};
type Cut = { spec: PackSpec; tick: number; state: State };

const specs: PackSpec[] = [
  { id: "breakfast", label: "After breakfast",
    note: "In the kitchen, just after Fae eats breakfast and leaves the table.",
    fixture: "new-game", run: "new-game/chapter-one.json", kind: "story" },
  { id: "fountain-frog", label: "After the fountain frog",
    note: "In the plaza, after the fountain frog is calm; the school is next.",
    fixture: "new-game", run: "new-game/chapter-one.json", kind: "story" },
  { id: "tree-house", label: "At the tree house",
    note: "At the tree house, with chapter one complete; Bubblegum Bay is next.",
    fixture: "new-game", run: "new-game/chapter-one.json", kind: "story" },
  { id: "bubblegum-bay", label: "Arriving in Bubblegum Bay",
    note: "On the road into Bubblegum Bay, ready to explore the new lands.",
    fixture: "new-game", run: "new-game/east-road.json", kind: "story" },
  { id: "bay-bluebird", label: "Sue joins at the bay",
    note: "On the bay's sand with Sue in the party and the bluebird calm; " +
      "the bus up the mountain is next.",
    fixture: "new-game", run: "new-game/golden-bay.json", kind: "story" },
  { id: "jordan", label: "Jordan at Pinecone Pass",
    note: "At the pass with the whole party: Jordan joined and the hamster " +
      "handed Fae the blacklight lantern.",
    fixture: "new-game", run: "new-game/golden-jordan.json", kind: "story" },
  { id: "lantern", label: "The blacklight lantern",
    note: "At the pass with the lantern found: its arrow points west, into the pines.",
    fixture: "new-game", run: "new-game/golden-lantern.json", kind: "story" },
  { id: "woods", label: "The Whispering Woods",
    note: "In the woods' clearing with the owl calm and the clubhouse claimed; the arcade is next.",
    fixture: "new-game", run: "new-game/golden-woods.json", kind: "story" },
  { id: "arcade", label: "Mr. Pip's arcade",
    note: "In the arcade with Mr. Pip calmed and his sticker won; school is next.",
    fixture: "new-game", run: "new-game/golden-arcade.json", kind: "story" },
  { id: "lodge", label: "Mrs. Flurry's lodge",
    note: "Inside the pass's lodge with the keeper calmed, the fire lit, and Biscuit home.",
    fixture: "new-game", run: "new-game/golden-lodge.json", kind: "story" },
  { id: "school", label: "Story time",
    note: "In the school's east hall after the kid in the purple hood was " +
      "glimpsed; the gym doors are locked until PE.",
    fixture: "new-game", run: "new-game/golden-school.json", kind: "story" },
  { id: "clubhouse", label: "The clubhouse fix-up",
    note: "In the clubhouse with the fridge humming and the garden planted, ready to ripen.",
    fixture: "new-game", run: "new-game/golden-clubhouse.json", kind: "story" },
  { id: "gym", label: "The gym and the lasso",
    note: "In the gym with Coach Ash's things back and his lasso lent; music class is next.",
    fixture: "new-game", run: "new-game/golden-gym.json", kind: "story" },
  { id: "music", label: "The music room",
    note: "In the music room with the class song played and Fae's first " +
      "flute earned; recess is next.",
    fixture: "new-game", run: "new-game/golden-music.json", kind: "story" },
  { id: "field", label: "Recess on the field",
    note: "On the playing field with the squirrel calmed, the stash found, " +
      "and the footbridge down.",
    fixture: "new-game", run: "new-game/golden-field.json", kind: "story" },
  { id: "squirrel", label: "The Acorn Squirrel",
    note: "In the woods with the Acorn Squirrel a friend, his golden acorn in the chest.",
    fixture: "new-game", run: "new-game/golden-squirrel.json", kind: "story" },
  { id: "flute", label: "The Pond Pup",
    note: "In Meadow Park with the Pond Pup a friend and the old tin fished from the pond.",
    fixture: "new-game", run: "new-game/golden-flute.json", kind: "story" },
  { id: "lasso", label: "The lasso errands",
    note: "In the classroom with the kite back to Rosie, the scarf returned, " +
      "and the treasure dug up.",
    fixture: "new-game", run: "new-game/golden-lasso.json", kind: "story" },
  { id: "mist", label: "The Misty Path",
    note: "At the parted seal with the mist's three stretches open; the Enchanted Forest is next.",
    fixture: "new-game", run: "new-game/golden-mist.json", kind: "story" },
  { id: "kitchen", label: "The clubhouse kitchen",
    note: "In the clubhouse with the nuggets cooked golden and the keepsake chest full.",
    fixture: "new-game", run: "new-game/golden-kitchen.json", kind: "story" },
  { id: "forest", label: "The Enchanted Forest",
    note: "In the forest with the fairies' story told and the hooded kid " +
      "waiting under the Ancient Tree.",
    fixture: "new-game", run: "new-game/golden-forest.json", kind: "story" },
  { id: "kid", label: "Milo, calmed",
    note: "Under the restored Ancient Tree with the kid revealed as Milo and " +
      "his story told; the ending is next.",
    fixture: "new-game", run: "new-game/golden-kid.json", kind: "story" },
  { id: "hills-lookout", label: "Fae in Clover Hills at the lookout",
    note: "At the hills lookout with the Acorn Squirrel in the party, ready to inspect its cache.",
    fixture: "hills-lookout-qa", run: "hills/hills-lookout.json", kind: "setup" },
];

const content = loadContent();
const outDir = "content/qa/saves";
const manifestPath = "content/qa/saves.json";
const replayCache = new Map<string, State[]>();
function beat(id: string, state: State): boolean {
  const variable = (name: string): boolean => content.world.storyVariable(state.ink, name) === true;
  if (id === "breakfast") return variable("ate_breakfast");
  if (id === "fountain-frog") return state.stickers.includes("fountain-frog");
  if (id === "tree-house") return variable("club_open");
  if (id === "bubblegum-bay") return state.area === "bay";
  if (id === "bay-bluebird")
    return variable("sue_joined") && state.stickers.includes("bay-bluebird");
  if (id === "jordan") return variable("jordan_joined");
  if (id === "lantern") return variable("has_lantern");
  if (id === "woods") return state.area === "woods" && state.stickers.length >= 2;
  if (id === "arcade") return state.area === "arcade";
  if (id === "lodge") return state.area === "lodge";
  if (id === "school") return state.area === "east-hall";
  if (id === "clubhouse") return state.area === "clubhouse" && state.stickers.length >= 3;
  if (id === "gym") return variable("has_lasso");
  if (id === "music") return variable("has_flute");
  if (id === "field") return state.area === "field";
  if (id === "squirrel") return state.stickers.includes("acorn-squirrel");
  if (id === "flute") return state.area === "park" && variable("has_flute");
  if (id === "lasso") return state.area === "classroom" && variable("has_lasso");
  if (id === "mist") return state.area === "mist";
  if (id === "kitchen") return state.area === "clubhouse" && state.stickers.length >= 7;
  if (id === "forest") return state.area === "enchanted";
  if (id === "kid") return variable("milo_revealed");
  return false;
}
function stateAt(states: State[], index: number): State {
  const state = states[index];
  if (state === undefined) throw new Error(`Replay has no tick ${index}`);
  return state;
}
function replay(spec: PackSpec): State[] {
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
  replayCache.set(key, states);
  return states;
}
function autosaveAfterBeat(id: string, states: State[]): number {
  const requested = states.findIndex((candidate) => beat(id, candidate));
  if (requested < 0) throw new Error(`Beat predicate never held for ${id}`);
  for (let tick = Math.max(requested, 1); tick < states.length; tick += 1) {
    const current = stateAt(states, tick);
    if (autosaveNeeded(stateAt(states, tick - 1), current) && current.battle === null &&
      current.arcade === null && current.finale === null) return tick;
  }
  throw new Error(`No valid autosave after beat for ${id}`);
}
function cut(spec: PackSpec): Cut {
  const states = replay(spec);
  const tick = spec.kind === "setup" ? 0 : autosaveAfterBeat(spec.id, states);
  const state = stateAt(states, tick);
  const fixture = content.fixtures[spec.fixture];
  if (fixture === undefined) throw new Error(`${spec.fixture} fixture missing`);
  if (parseSave(serializeSave(state), createState(content.world, fixture, 1)) === null)
    throw new Error(`Pack ${spec.id} is not a valid save at tick ${tick}`);
  return { spec, tick, state };
}

const cuts = specs.map(cut);
const bytes = new Set<string>();
const origins = new Set<string>();
for (const { spec, tick, state } of cuts) {
  const serialized = serializeSave(state);
  if (bytes.has(serialized) || origins.has(`${spec.run}:${tick}`))
    throw new Error(`Duplicate QA pack ${spec.id}`);
  bytes.add(serialized); origins.add(`${spec.run}:${tick}`);
}
const ofKind = (kind: PackKind): Cut[] => cuts.filter((item) => item.spec.kind === kind);
const entry = ({ spec, tick, state }: Cut): ManifestPack => ({
  id: spec.id, label: spec.label, note: spec.note, fixture: spec.fixture, run: spec.run,
  tick, interim: spec.kind !== "story", hash: stableHash(state),
});
const manifest: ManifestPack[] = [
  ...ofKind("story").map(entry),
  ...ofKind("setup").map(entry),
];

const files = new Map<string, string>(
  cuts.map(({ spec, state }) => [`${outDir}/${spec.id}.json`, serializeSave(state)]),
);
files.set(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const orphans = existsSync(outDir)
  ? readdirSync(outDir).map((name) => `${outDir}/${name}`).filter((path) => !files.has(path))
  : [];
if (process.argv.includes("--check")) {
  const stale = [...files]
    .filter(([path, text]) => !existsSync(path) || readFileSync(path, "utf8") !== text)
    .map(([path]) => path);
  if (stale.length > 0 || orphans.length > 0)
    throw new Error(
      [...stale.map((path) => `${path} is stale`),
        ...orphans.map((path) => `${path} has no spec in tools/qa/build-saves.ts`),
        "Add new packs to tools/qa/build-saves.ts, then run bun tools/qa/build-saves.ts"]
        .join("\n"),
    );
  console.log(`QA saves are current (${manifest.length} packs)`);
} else {
  mkdirSync(outDir, { recursive: true });
  for (const [path, text] of files) writeFileSync(path, text);
  for (const path of orphans) rmSync(path);
  console.log(`wrote ${manifest.length} QA saves`);
  for (const pack of manifest) console.log(`${pack.id} tick=${pack.tick} run=${pack.run}`);
}
