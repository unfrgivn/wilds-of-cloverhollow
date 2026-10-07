import { Story } from "inkjs";

export type InkCommand =
  | { type: "start"; knot: string }
  | { type: "next" }
  | { type: "choose"; index: number };

export type InkLine = {
  text: string;
  speaker: string | null;
  tags: string[];
};

export type InkResult = {
  ink: string;
  line: InkLine | null;
  choices: string[];
  ended: boolean;
};

type StoryJson = Record<string, unknown>;

export function createInkState(storyJson: StoryJson, seed: number): string {
  const story = new Story(storyJson);
  story.state.storySeed = seed;
  story.state.previousRandom = 0;
  const json = story.state.ToJson();
  if (typeof json !== "string") throw new Error("Ink state was not serialized");
  return json;
}

// A story variable's value in an Ink state: true or false for booleans, text
// for everything else, undefined for a name the story doesn't declare.
export function inkVariable(storyJson: StoryJson, inkJson: string, name: string): unknown {
  return createStoryReader(storyJson)(inkJson, name);
}

// The same reads without building a Story each time (about 0.2 ms each): one
// Story is built up front, and each read only loads the state into it and
// never continues it. For the per-tick checks, through world.storyVariable.
export function createStoryReader(
  storyJson: StoryJson,
): (inkJson: string, name: string) => unknown {
  const story = new Story(storyJson);
  return (inkJson, name) => {
    story.state.LoadJson(inkJson);
    const variable = story.state.variablesState.GetVariableWithName(name);
    if (variable === null) return undefined;
    const text = variable.toString();
    if (text === "true") return true;
    if (text === "false") return false;
    return text;
  };
}

function line(story: Story): InkLine | null {
  const text = story.currentText ?? "";
  const currentTags = story.currentTags ?? [];
  if (text.length === 0 && currentTags.length === 0) return null;
  let speaker: string | null = null;
  const tags: string[] = [];
  for (const tag of currentTags) {
    if (tag.startsWith("speaker:"))
      speaker = tag.slice("speaker:".length).trim();
    else tags.push(tag);
  }
  return { text: text.trim(), speaker, tags };
}

// What the story's externals answer (spec 7): `calmed(id)` and `coins()`.
// The core builds them from its state (`inkFacts`); the defaults are a new
// game's.
export type InkFacts = { calmed: Record<string, boolean>; coins: number };
const newGameFacts: InkFacts = { calmed: {}, coins: 0 };

// The externals are answered for every command, so a knot can ask on any
// line, not only its first.
export function runInk(
  storyJson: StoryJson,
  inkJson: string,
  command: InkCommand,
  facts: InkFacts = newGameFacts,
): InkResult {
  const story = new Story(storyJson);
  story.state.LoadJson(inkJson);
  story.BindExternalFunction(
    "calmed",
    (id: unknown) => typeof id === "string" && facts.calmed[id] === true,
  );
  story.BindExternalFunction("coins", () => facts.coins);
  if (command.type === "start") story.ChoosePathString(command.knot);
  if (command.type === "choose") story.ChooseChoiceIndex(command.index);
  const blank = (output: string | null): boolean =>
    (output ?? "").trim().length === 0 && (story.currentTags ?? []).length === 0;
  const continued = story.canContinue;
  let current = continued ? story.Continue() : "";
  // A conditional line whose condition is false outputs nothing: skip it.
  while (blank(current) && story.canContinue) current = story.Continue();
  const resultLine = continued && !blank(current) ? line(story) : null;
  // Look past blank lines after this one, so the choices (or the end) that
  // follow them come with this line instead of as an empty step. A real next
  // line is put back for the next command.
  while (resultLine !== null && story.canContinue) {
    const saved = story.state.ToJson();
    if (blank(story.Continue())) continue;
    story.state.LoadJson(saved);
    break;
  }
  const json = story.state.ToJson();
  if (typeof json !== "string") throw new Error("Ink state was not serialized");
  return {
    ink: json,
    line: resultLine,
    choices: story.currentChoices.map((choice) => choice.text),
    ended: !story.canContinue && story.currentChoices.length === 0,
  };
}
