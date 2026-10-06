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

// `calmed` answers the story's external calmed(id) for every command, so a
// knot can ask on any line, not only its first.
export function runInk(
  storyJson: StoryJson,
  inkJson: string,
  command: InkCommand,
  calmed: Record<string, boolean> = {},
): InkResult {
  const story = new Story(storyJson);
  story.state.LoadJson(inkJson);
  story.BindExternalFunction(
    "calmed",
    (id: unknown) => typeof id === "string" && calmed[id] === true,
  );
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
