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
    note: "",
    fixture: "pass-party", run: `pass-party/${run}.json`, interim: true,
  })),
];

const content = loadContent();
const outDir = "content/qa/saves";
mkdirSync(outDir, { recursive: true });
const manifest: ManifestPack[] = [];
const statesById = new Map<string, State>();
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
function nextText(next: ManifestPack | undefined): string {
  if (next === undefined) return "the ending";
  return `the ${next.label.replace(/ shortcut$/, "").toLowerCase()}`;
}
function noteFor(spec: PackSpec, state: State, next: ManifestPack | undefined): string {
  if (!spec.interim) {
    if (spec.id === "breakfast")
      return "In the kitchen, just after Fae eats breakfast and leaves the table.";
    if (spec.id === "fountain-frog")
      return "In the plaza, after the fountain frog is calm; the school is next.";
    if (spec.id === "tree-house")
      return "At the tree house, with chapter one complete; Bubblegum Bay is next.";
    return "On the road into Bubblegum Bay, ready to explore the new lands.";
  }
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
  return `Starts from the pass-party shortcut in ${location}, ${party}; ` +
    `holds ${tools}, ${stickerCount}, and ${state.coins} coins. Next: ${nextText(next)}.`;
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
    const current = stateAt(states, tick);
    if (tick > 0 && autosaveNeeded(stateAt(states, tick - 1), current) && current.battle === null &&
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
  statesById.set(spec.id, state);
  manifest.push({
    id: spec.id, label: spec.label, note: "", fixture: spec.fixture,
    run: spec.run, tick, interim: spec.interim, hash: stableHash(state),
  });
}
const real = manifest.filter((pack) => !pack.interim);
const interim = manifest.filter((pack) => pack.interim)
  .sort((a, b) => compareProgression(
    statesById.get(a.id) ?? (() => { throw new Error(`State missing for ${a.id}`); })(),
    statesById.get(b.id) ?? (() => { throw new Error(`State missing for ${b.id}`); })(),
  ));
const ordered = [...real, ...interim];
for (let index = 1; index < interim.length; index += 1) {
  const previous = statesById.get(interim[index - 1]?.id ?? "");
  const current = statesById.get(interim[index]?.id ?? "");
  if (previous === undefined || current === undefined || compareProgression(previous, current) > 0)
    throw new Error("QA interim manifest is not monotonic by progression key");
}
for (let index = 0; index < ordered.length; index += 1) {
  const pack = ordered[index];
  if (pack === undefined) throw new Error(`QA manifest missing entry ${index}`);
  const state = statesById.get(pack.id);
  if (state === undefined) throw new Error(`State missing for ${pack.id}`);
  pack.note = noteFor(pack, state, pack.interim ? ordered[index + 1] : undefined);
}
manifest.splice(0, manifest.length, ...ordered);
writeFileSync("content/qa/saves.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${manifest.length} QA saves`);
for (const pack of manifest) console.log(`${pack.id} tick=${pack.tick} run=${pack.run}`);
