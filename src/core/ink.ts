import { Story } from "inkjs";

export type InkCommand =
  | { type: "start"; knot: string; calmed?: Record<string, boolean> }
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

export function runInk(
  storyJson: StoryJson,
  inkJson: string,
  command: InkCommand,
): InkResult {
  const story = new Story(storyJson);
  story.state.LoadJson(inkJson);
  const facts = command.type === "start" ? (command.calmed ?? {}) : {};
  story.BindExternalFunction(
    "calmed",
    (id: unknown) => typeof id === "string" && facts[id] === true,
  );
  if (command.type === "start") story.ChoosePathString(command.knot);
  if (command.type === "choose") story.ChooseChoiceIndex(command.index);
  const continued = story.canContinue;
  const current = continued ? story.Continue() : "";
  const text = typeof current === "string" ? current : "";
  const resultLine =
    continued && (text.length > 0 || (story.currentTags ?? []).length > 0)
      ? line(story)
      : null;
  const json = story.state.ToJson();
  if (typeof json !== "string") throw new Error("Ink state was not serialized");
  return {
    ink: json,
    line: resultLine,
    choices: story.currentChoices.map((choice) => choice.text),
    ended: !story.canContinue && story.currentChoices.length === 0,
  };
}
