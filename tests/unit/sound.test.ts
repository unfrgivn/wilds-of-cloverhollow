import { describe, expect, it } from "vitest";
import { createState, soundCues, step, type ActionFrame, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";

const content = loadContent();
const harness = content.fixtures.harness;
const plaza = content.fixtures.plaza;
if (harness === undefined || plaza === undefined) throw new Error("sound fixtures missing");
const none: ActionFrame = { move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false };
const right: ActionFrame = { ...none, move: { x: 1, y: 0 } };

describe("gameplay sound cues", () => {
  it("derives dialogue and journal cues from real step transitions", () => {
    const start = createState(content.world, content.fixtures["new-game"] ?? harness);
    const positioned: State = { ...start, player: { x: 610, y: 345 }, facing: "up" };
    const opened = step(content.world, positioned, { ...none, confirm: true }).state;
    expect(soundCues(positioned, opened)).toContain("dialogue-open");
    const typed = step(content.world, step(content.world, opened, none).state, none).state;
    expect(soundCues(opened, typed)).toContain("dialogue-blip");
    const journalStart = createState(content.world, content.fixtures["new-game"] ?? harness);
    const journal = step(content.world, journalStart, { ...none, menu: true }).state;
    expect(soundCues(journalStart, journal)).toEqual(["journal-open"]);
  });

  it("uses real movement steps for a throttled footstep and does not repeat while still", () => {
    let state = createState(content.world, harness);
    let cues: string[] = [];
    for (let index = 0; index < 16; index += 1) {
      const next = step(content.world, state, right).state;
      cues = [...cues, ...soundCues(state, next)];
      state = next;
    }
    expect(cues.filter((cue) => cue === "footstep")).toHaveLength(2);
    const stopped = step(content.world, state, none).state;
    expect(soundCues(state, stopped)).toEqual([]);
    const held = step(content.world, stopped, none).state;
    expect(soundCues(stopped, held)).toEqual([]);
  });

  it("starts a battle from a real step into a critter", () => {
    const initial = createState(content.world, plaza);
    const positioned: State = { ...initial, player: { x: 1080, y: 820 }, facing: "left" };
    const next = step(content.world, positioned, { ...none, move: { x: -1, y: 0 } }).state;
    expect(next.battle).not.toBeNull();
    expect(soundCues(positioned, next)).toEqual(["battle-start"]);
  });
});
