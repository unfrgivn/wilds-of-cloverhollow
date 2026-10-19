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
// A pack is one of three kinds:
//   story     a run from a new game, cut at the first autosave after its beat
//   shortcut  a pass-party run, cut the same way; interim, ordered by story
//             progression, its note derived from the save
//   setup     a QA fixture's first tick; interim, for a scene no recorded
//             run reaches yet
type PackKind = "story" | "shortcut" | "setup";
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
  ...["jordan", "lantern", "woods", "school", "gym", "music", "field",
    "clubhouse", "kitchen", "arcade", "lodge", "squirrel", "mist", "forest",
    "kid", "flute", "lasso"].map((run): PackSpec => ({
    id: `shortcut-${run}`, label: `${run[0]?.toUpperCase() ?? ""}${run.slice(1)} shortcut`,
    note: "", fixture: "pass-party", run: `pass-party/${run}.json`, kind: "shortcut",
  })),
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

const areaNames: Record<string, string> = {
  plaza: "the plaza", kitchen: "the kitchen", bedroom: "the bedroom", park: "the park",
  pass: "Pinecone Pass",
  school: "the school", classroom: "the classroom", gym: "the gym", bay: "Bubblegum Bay",
  woods: "the Whispering Woods", "east-hall": "the east hall", clubhouse: "the clubhouse",
  arcade: "the arcade", lodge: "the lodge", squirrel: "the squirrel trail", mist: "the mist trail",
  music: "the music room",
  enchanted: "the Enchanted Forest", field: "the field",
};
function progressionKey(state: State): [number, number, number, number, number, number] {
  const variable = (name: string): number =>
    content.world.storyVariable(state.ink, name) === true ? 1 : 0;
  return [
    variable("has_lantern"), variable("has_lasso"), variable("has_flute"),
    state.stickers.length, state.coins, state.tick,
  ];
}
function compareProgression(a: State, b: State): number {
  const left = progressionKey(a);
  const right = progressionKey(b);
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    if (leftValue !== rightValue) return (leftValue ?? 0) - (rightValue ?? 0);
  }
  return 0;
}
function shortcutNote(state: State, next: Cut | undefined): string {
  const partyNames = state.party.map((member) =>
    content.world.party[member.id]?.name ?? member.id);
  const party = partyNames.length === 0
    ? "Fae alone"
    : `Fae with ${partyNames.map((name, index) => index === 0 ? name :
      index === partyNames.length - 1 ? `and ${name}` : name)
      .join(partyNames.length > 2 ? ", " : " ")}`;
  const tools = [
    content.world.storyVariable(state.ink, "has_lantern") === true ? "lantern" : "no lantern",
    content.world.storyVariable(state.ink, "has_lasso") === true ? "lasso" : "no lasso",
    content.world.storyVariable(state.ink, "has_flute") === true ? "flute" : "no flute",
  ].join(", ");
  const stickerCount = `${state.stickers.length} sticker${state.stickers.length === 1 ? "" : "s"}`;
  const location = areaNames[state.area] ?? state.area;
  const following = next === undefined
    ? "the ending"
    : `the ${next.spec.label.replace(/ shortcut$/, "").toLowerCase()}`;
  return `Starts from the pass-party shortcut in ${location}, ${party}; ` +
    `holds ${tools}, ${stickerCount}, and ${state.coins} coins. Next: ${following}.`;
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
const shortcuts = ofKind("shortcut").sort((a, b) => compareProgression(a.state, b.state));
const entry = ({ spec, tick, state }: Cut, note: string): ManifestPack => ({
  id: spec.id, label: spec.label, note, fixture: spec.fixture, run: spec.run,
  tick, interim: spec.kind !== "story", hash: stableHash(state),
});
const manifest: ManifestPack[] = [
  ...ofKind("story").map((item) => entry(item, item.spec.note)),
  ...shortcuts.map((item, index) => entry(item, shortcutNote(item.state, shortcuts[index + 1]))),
  ...ofKind("setup").map((item) => entry(item, item.spec.note)),
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
