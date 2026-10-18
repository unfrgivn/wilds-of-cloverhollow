import { describe, expect, it } from "vitest";
import {
  blankInput,
  cookTime,
  cookView,
  createState,
  newCook,
  stepArcade,
  type ActionFrame,
  type CookDish,
  type CookGame,
  type State,
} from "../../src/core";
import { loadContent, parseArcade, parseCookCalibration } from "../../src/content/load";
import { readFileSync } from "node:fs";

// Contract for Milestone 52's cooking game (spec 8.2): a press starts the
// clubhouse microwave and holding keeps it going; letting go stops it. Still
// frozen, it waits for the next hold; otherwise it dings, and how long it
// cooked decides how it came out and how many snacks it makes.

const content = loadContent();
const world = content.world;
const cook = world.arcade.cook;
const fixture = content.fixtures.arcade;
if (fixture === undefined) throw new Error("the arcade fixture is missing");
const held: ActionFrame = { ...blankInput(), confirm: true };
const free = blankInput();

const opened = (dish: CookDish): State =>
  ({ ...createState(world, fixture), arcade: newCook(dish) });
// One tick of the open game, applied as the simulation applies it.
function tick(state: State, input: ActionFrame): State {
  return { ...state, ...stepArcade(world, state, input), previousInput: input };
}
function game(state: State): CookGame {
  const open = state.arcade;
  if (open === null || open.game !== "cook") throw new Error("the microwave isn't open");
  return open;
}
// Holds the button `ticks` ticks (the first a press), then lets go.
function hold(state: State, ticks: number): State {
  let next = state;
  for (let count = 0; count < ticks && next.arcade !== null; count += 1) {
    next = tick(next, held);
    if (game(next).phase !== "cooking") break;
  }
  return tick(next, free);
}
// Waits out the ding, then reads the result to the end and closes it.
function finish(state: State): { result: CookGame; snacks: number; closed: State } {
  let next = state;
  for (let count = 0; count < 200 && game(next).phase === "ding"; count += 1)
    next = tick(next, free);
  const result = game(next);
  const snacks = next.snacks;
  next = tick(tick(next, held), free);
  next = tick(tick(next, held), free);
  return { result, snacks, closed: next };
}

describe("the microwave", () => {
  it("waits for a press, then cooks while it's held", () => {
    const start = opened("nuggets");
    expect(game(tick(start, free)).phase).toBe("ready");
    const going = tick(start, held);
    expect([game(going).phase, game(going).cooked]).toEqual(["cooking", 1]);
    expect(game(tick(going, held)).cooked).toBe(2);
  });

  it("pays by how it came out, and says so", () => {
    const ticks = (seconds: number): number => seconds * cook.ticksPerSecond;
    const cases: [CookDish, number, string, number][] = [
      ["nuggets", ticks(60), "DING! Golden and perfect! Snacks +3.", 3],
      ["nuggets", ticks(40), "A little cold in the middle, but yummy! Snacks +2.", 2],
      ["nuggets", ticks(80), "A little crispy, but yummy! Snacks +2.", 2],
      ["nuggets", ticks(100), "DING! Extra crispy... Snacks +1.", 1],
      ["mac", ticks(90), "DING! Golden and perfect! Snacks +3.", 3],
      ["mac", ticks(60), "A little cold in the middle, but yummy! Snacks +2.", 2],
    ];
    for (const [dish, cooked, line, paid] of cases) {
      const start = opened(dish);
      const stopped = hold(start, cooked);
      expect(game(stopped).phase, `${dish} ${cooked}`).toBe("ding");
      const { result, snacks, closed } = finish(stopped);
      expect([result.phase, result.message, snacks - start.snacks], `${dish} ${cooked}`)
        .toEqual(["result", line, paid]);
      expect(closed.arcade).toBeNull();
      expect(closed.snacks).toBe(start.snacks + paid);
    }
  });

  it("is golden within ten seconds of the box's time, and only then", () => {
    const zone = (cooked: number): string | null =>
      cookView(world, { ...newCook("nuggets"), phase: "ding", cooked }).zone;
    // 50 s to 70 s is golden; half a second outside it isn't.
    expect([zone(99), zone(100), zone(140), zone(141)])
      .toEqual(["under", "golden", "golden", "over"]);
    expect([zone(191), zone(192)]).toEqual(["over", "burnt"]);
  });

  it("waits, still frozen, and cooks on from where it stopped", () => {
    const start = opened("mac");
    const frozen = hold(start, 40);
    expect([game(frozen).phase, game(frozen).cooked]).toEqual(["paused", 40]);
    expect(cookView(world, game(frozen)).hint)
      .toBe("Still frozen in the middle! Hold to cook it some more.");
    expect(frozen.snacks).toBe(start.snacks);
    // 40 ticks more is 80 in all: 40 seconds, still under the frozen 45.
    const still = hold(frozen, 40);
    expect([game(still).phase, game(still).cooked]).toEqual(["paused", 80]);
    // On to 180 ticks: 90 seconds, golden.
    const done = hold(still, 100);
    expect([game(done).phase, game(done).cooked]).toEqual(["ding", 180]);
    expect(finish(done).snacks).toBe(start.snacks + 3);
  });

  it("stops itself at twice the box's time, burnt", () => {
    let state = tick(opened("nuggets"), held);
    for (let count = 0; count < 400 && game(state).phase === "cooking"; count += 1)
      state = tick(state, held);
    expect([game(state).phase, game(state).cooked]).toEqual(["ding", 240]);
    expect(finish(state).result.message).toBe("DING! Extra crispy... Snacks +1.");
  });
});

describe("the close-up's view", () => {
  const at = (cooked: number, phase: CookGame["phase"] = "cooking"): ReturnType<
    typeof cookView> => cookView(world, { ...newCook("nuggets"), phase, cooked });

  it("tells the box's time before it starts", () => {
    const ready = cookView(world, newCook("nuggets"));
    expect([ready.label, ready.boxTime, ready.display, ready.hint]).toEqual([
      "Dino nuggets", "1:00", "0:00",
      "The box says 1:00. Hold to cook, and let go when it's golden!",
    ]);
    expect(cookView(world, newCook("mac")).boxTime).toBe("1:30");
    expect(cookTime(125)).toBe("2:05");
  });

  it("shows the food as it's cooked: frosty, steaming, darkening, smoking", () => {
    expect([at(0).frost, at(30).frost, at(60).frost]).toEqual([1, 0.5, 0]);
    expect([at(59).steam, at(60).steam]).toEqual([false, true]);
    expect([at(140).darkness, at(192).darkness, at(240).darkness]).toEqual([0, 1, 1]);
    expect(at(166).darkness).toBeCloseTo(0.5, 5);
    expect([at(191).smoke, at(192).smoke]).toEqual([false, true]);
    expect([at(75).display, at(120).display]).toEqual(["0:37", "1:00"]);
    expect([at(10).cooking, at(10, "paused").cooking]).toEqual([true, false]);
    expect([at(10).zone, at(120, "ding").zone]).toEqual([null, "golden"]);
  });
});

describe("the cooking content", () => {
  const arcadeText = readFileSync("content/arcade.json", "utf8");
  const prizes: unknown = JSON.parse(readFileSync("content/prizes.json", "utf8"));
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;
  // arcade.json with its cooking content changed.
  const withCook = (change: (data: Record<string, unknown>) => Record<string, unknown>):
    unknown => {
    const data: unknown = JSON.parse(arcadeText);
    if (!isRecord(data) || !isRecord(data.cook)) throw new Error("no cooking content");
    return { ...data, cook: change(data.cook) };
  };
  const nuggets = (fields: Partial<typeof cook.dishes.nuggets>) =>
    (data: Record<string, unknown>): Record<string, unknown> =>
      ({ ...data, dishes: { ...cook.dishes, nuggets: { ...cook.dishes.nuggets, ...fields } } });

  it("loads as written", () => {
    expect(parseArcade(JSON.parse(arcadeText), prizes).cook).toEqual(cook);
  });

  it("refuses a dish out of order, a snack-less way out, or a line without its number", () => {
    const refused = (change: (data: Record<string, unknown>) => Record<string, unknown>,
      label: RegExp): void => {
      expect(() => parseArcade(withCook(change), prizes)).toThrow(label);
    };
    refused(nuggets({ frozen: 55 }), /cook\.dishes\.nuggets/);
    refused(nuggets({ burnt: 70 }), /cook\.dishes\.nuggets/);
    refused(nuggets({ stop: 96 }), /cook\.dishes\.nuggets/);
    refused((data) => ({ ...data, snacks: { ...cook.snacks, burnt: 0 } }), /cook\.snacks\.burnt/);
    refused((data) => ({ ...data, lines: { ...cook.lines, golden: "DING!" } }),
      /cook\.lines\.golden/);
    refused((data) => ({ ...data, lines: { ...cook.lines, start: "Hold to cook!" } }),
      /cook\.lines/);
  });

  it("reads the microwave's close-up, and refuses a turntable outside its glass", () => {
    const file = "public/assets/arcade/microwave.json";
    const data: unknown = JSON.parse(readFileSync(file, "utf8"));
    const calibration = parseCookCalibration(data, file);
    expect(calibration.size).toEqual({ w: 1600, h: 1048 });
    if (!isRecord(data)) throw new Error("no calibration");
    const plate = { ...calibration.plate, cy: calibration.glass.y };
    expect(() => parseCookCalibration({ ...data, plate }, file)).toThrow(/plate/);
    const front = { ...calibration.front, y: calibration.button.cy };
    expect(() => parseCookCalibration({ ...data, front }, file)).toThrow(/front/);
  });
});
