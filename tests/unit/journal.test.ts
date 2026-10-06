import { describe, expect, it } from "vitest";
import {
  createState,
  journalNotes,
  autosaveNeeded,
  step,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createInkState, runInk } from "../../src/core/ink";

describe("journal", () => {
  const content = loadContent();
  const fixture = content.fixtures["new-game"];
  if (fixture === undefined) throw new Error("fixture missing");
  it("opens and closes on menu edges and freezes movement", () => {
    let state = createState(content.world, fixture);
    state = step(content.world, state, {
      move: { x: 0, y: 0 },
      confirm: false,
      cancel: false,
      menu: true,
    }).state;
    expect(state.journalOpen).toBe(true);
    const frozen = step(content.world, state, {
      move: { x: 1, y: 0 },
      confirm: false,
      cancel: false,
      menu: false,
    }).state;
    expect(frozen.player).toEqual(state.player);
    const closed = step(content.world, frozen, {
      move: { x: 0, y: 0 },
      confirm: false,
      cancel: true,
      menu: false,
    }).state;
    expect(closed.journalOpen).toBe(false);
  });
  it("detects each autosave trigger and ignores an ordinary tick", () => {
    const state = createState(content.world, fixture);
    expect(
      autosaveNeeded(state, {
        ...state,
        player: { x: state.player.x + 1, y: state.player.y },
      }),
    ).toBe(false);
    expect(
      autosaveNeeded(state, {
        ...state,
        dialogue: {
          knot: "x",
          speaker: null,
          text: "",
          revealed: 0,
          choices: [],
          selected: 0,
          ended: true,
        },
      }),
    ).toBe(false);
    expect(
      autosaveNeeded(
        {
          ...state,
          dialogue: {
            knot: "x",
            speaker: null,
            text: "",
            revealed: 0,
            choices: [],
            selected: 0,
            ended: true,
          },
        },
        state,
      ),
    ).toBe(true);
    expect(autosaveNeeded({ ...state, journalOpen: true }, state)).toBe(true);
    expect(
      autosaveNeeded(
        {
          ...state,
          battle: {
            critterId: "frog",
            entry: state.player,
            phase: "command",
            message: "",
            revealed: 0,
            selected: 0,
            command: null,
            energy: 5,
            calm: 0,
            snacks: 2,
            rest: 0,
            aim: null,
            lastGrade: null,
            rewardSticker: null,
            aimTick: 0,
            phaseTicks: 0,
          },
        },
        state,
      ),
    ).toBe(true);
  });
  it("lists every note that applies, newest first, without repeats", () => {
    const story = content.world.story;
    let ink = createInkState(story, 1);
    ink = runInk(story, ink, { type: "start", knot: "window" }).ink;
    ink = runInk(story, ink, { type: "next" }).ink;
    ink = runInk(story, ink, { type: "choose", index: 1 }).ink;
    let board = runInk(story, ink, { type: "start", knot: "notice_board" });
    for (let count = 0; count < 10 && !board.ended; count += 1)
      board = runInk(story, board.ink, { type: "next" });
    const state = { ...createState(content.world, fixture), ink: board.ink,
      critters: { frog: "calm" as const } };
    expect(journalNotes(content.world, state)).toEqual([
      "The Fountain Frog is calm. Something purple fizzed into his fountain.",
      "A raccoon in a purple hood was seen in town.",
      "Check the fizzing fountain after school.",
    ]);
    expect(state.ink, "reading the journal never changes the story").toBe(board.ink);
  });

  it("produces the empty note list for a fresh state", () => {
    expect(
      journalNotes(content.world, createState(content.world, fixture)),
    ).toEqual([]);
  });
});
