import { describe, expect, it } from "vitest";
import {
  blankInput, createState, inkFacts, step, type ActionFrame, type InkFacts, type State,
} from "../../src/core";
import { createInkState, runInk } from "../../src/core/ink";
import { loadContent, parseArcade } from "../../src/content/load";
import arcadeJson from "../../content/arcade.json";
import prizesJson from "../../content/prizes.json";

const content = loadContent();
const world = content.world;
const fixture = content.fixtures.arcade;
if (fixture === undefined) throw new Error("arcade fixture is missing");
const counter = world.arcade.counter;
const frame = (confirm = false): ActionFrame => ({ ...blankInput(), confirm });
const facts = (tickets: number, prizes: string[] = [], calm = true): InkFacts => ({
  calmed: calm ? { "arcade-keeper": true } : {}, coins: 2, snacks: 0, prizes,
  plushesLeft: 0, tickets,
});
const storyCounter = (tickets: number, prizes: string[] = [], calm = true) =>
  runInk(world.story, createInkState(world.story, 1), { type: "start", knot: "ticket_counter" },
    facts(tickets, prizes, calm));
const counterState = (tickets: number, prizes: string[] = []): State => {
  const started = storyCounter(tickets, prizes);
  const line = started.line;
  if (line === null) throw new Error("counter knot did not start");
  return {
    ...createState(world, fixture), tickets, prizes,
    critters: { ...createState(world, fixture).critters, "arcade-keeper": "calm" },
    ink: started.ink,
    dialogue: { knot: "ticket_counter", speaker: line.speaker, text: line.text,
      revealed: 0, choices: started.choices, selected: 0, ended: started.ended },
  };
};
const toChoices = (initial: State): State => {
  let state = initial;
  for (let count = 0; count < 100; count += 1) {
    const dialogue = state.dialogue;
    if (dialogue === null) throw new Error("counter dialogue closed");
    if (dialogue.choices.length > 0 && dialogue.revealed >= dialogue.text.length)
      return state;
    if (dialogue.revealed < dialogue.text.length) state = step(world, state, frame(true)).state;
    else state = step(world, state, frame(true)).state;
    state = step(world, state, frame()).state;
  }
  throw new Error("counter choices did not appear");
};
const firstLine = (initial: State): State => {
  let state = initial;
  for (let count = 0; count < 100; count += 1) {
    const dialogue = state.dialogue;
    if (dialogue === null) throw new Error("counter dialogue closed");
    if (dialogue.revealed >= dialogue.text.length) return state;
    state = step(world, state, frame(true)).state;
    state = step(world, state, frame()).state;
  }
  throw new Error("counter line did not reveal");
};
const counterChoice = (item: { prize: string; price: number }): string => {
  const prize = world.arcade.prizes.find((entry) => entry.id === item.prize);
  if (prize === undefined) throw new Error(`catalogue prize missing: ${item.prize}`);
  return prize.name;
};
const object = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("value is not an object");
  if (!record(value)) throw new Error("value is not an object");
  return value;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const list = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new Error("value is not an array");
  return value;
};
const copy = (): Record<string, unknown> => {
  const value: unknown = JSON.parse(JSON.stringify(arcadeJson));
  return object(value);
};
const counterCopy = (): Record<string, unknown> => object(copy().counter);
const expectInvalid = (change: (value: Record<string, unknown>) => void, field: string): void => {
  const value = copy();
  change(object(value.counter));
  expect(() => parseArcade(value, prizesJson)).toThrow(new RegExp(field));
};

describe("ticket counter story", () => {
  it("shows the candy line with no choices before Mr. Pip is calm", () => {
    const result = storyCounter(100, [], false);
    expect(result.line?.text).toContain("Jars of candy");
    expect(result.choices).toEqual([]);
  });

  it("shows the zero-ticket line without choices when no prize is affordable", () => {
    const result = storyCounter(0);
    expect(result.line?.text).toContain("You have 0 tickets");
    expect(result.choices).toEqual([]);
  });

  it("offers exactly the prizes affordable at their authored prices", () => {
    for (const item of counter.prizes) {
      const unavailable = storyCounter(item.price - 1,
        counter.prizes.filter((other) => other.prize !== item.prize).map((other) => other.prize));
      expect(unavailable.choices.join(" ")).not.toContain(
        world.arcade.prizes.find((prize) => prize.id === item.prize)?.name ?? item.prize,
      );
      const available = storyCounter(item.price,
        counter.prizes.filter((other) => other.prize !== item.prize).map((other) => other.prize));
      expect(available.choices.length).toBeGreaterThan(0);
    }
  });

  it("answers tickets from inkFacts on a real state", () => {
    const state: State = { ...createState(world, fixture), tickets: 37 };
    expect(inkFacts(world, state).tickets).toBe(37);
  });

  it("buys every counter prize through real keyboard input and removes each on revisit", () => {
    for (const item of counter.prizes) {
      let state = toChoices(counterState(item.price));
      const dialogue = state.dialogue;
      if (dialogue === null) throw new Error("counter choices are missing");
      const choice = dialogue.choices.findIndex((entry) =>
        entry.includes(counterChoice(item)));
      if (choice < 0) throw new Error(`choice is missing for ${item.prize}`);
      for (let index = 0; index < choice; index += 1) {
        state = step(world, state, { ...blankInput(), move: { x: 0, y: 1 } }).state;
        state = step(world, state, frame()).state;
      }
      state = step(world, state, frame()).state;
      state = step(world, state, frame(true)).state;
      expect(state.tickets).toBe(0);
      expect(state.prizes).toEqual([item.prize]);
      const revisit = firstLine(counterState(0, [item.prize]));
      expect(revisit.dialogue?.choices).toEqual([]);
    }
  });

  it("shows the arcade champ line after all prizes are won", () => {
    const all = counter.prizes.map((item) => item.prize);
    const result = storyCounter(0, all);
    expect(result.line?.text).toContain("arcade champ");
    expect(result.choices).toEqual([]);
  });
});

describe("ticket counter content validation", () => {
  it("rejects unknown, plush, duplicate, and free counter prizes", () => {
    expectInvalid((value) => {
      const prizes = list(object(value).prizes);
      object(prizes[0]).prize = "not-a-prize";
    }, "counter.prizes");
    expectInvalid((value) => {
      const prizes = list(object(value).prizes);
      object(prizes[0]).prize = "cat-plush";
    }, "counter.prizes");
    expectInvalid((value) => {
      const prizes = list(object(value).prizes);
      prizes.push({ ...object(prizes[0]) });
    }, "duplicate");
    expectInvalid((value) => {
      const prizes = list(object(value).prizes);
      object(prizes[0]).price = 0;
    }, "price");
  });

  it("parses the real counter content", () => {
    expect(() => parseArcade(arcadeJson, prizesJson)).not.toThrow();
    expect(counterCopy().prizes).toBeDefined();
  });
});
