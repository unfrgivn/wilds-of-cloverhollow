import { describe, expect, it } from "vitest";
import {
  arcadeView, blankInput, createState, newSkee, skeePoints, skeeZone, step,
  stepArcade, type ActionFrame, type SkeeGame, type State, type SkeeZone,
} from "../../src/core";
import { loadContent, parseArcade, storyTagErrors, storyTags } from "../../src/content/load";
import arcadeJson from "../../content/arcade.json";
import prizesJson from "../../content/prizes.json";
import { soundCues } from "../../src/core/sound";
import { createInkState, runInk, type InkFacts } from "../../src/core/ink";

const content = loadContent();
const world = content.world;
const skee = world.arcade.skee;
const fixture = content.fixtures.arcade;
if (fixture === undefined) throw new Error("arcade fixture is missing");
const base = (): State => createState(world, fixture);
const frame = (confirm = false): ActionFrame => ({ ...blankInput(), confirm });
const game = (phase: SkeeGame["phase"], changes: Partial<SkeeGame> = {}): SkeeGame => ({
  game: "skee", phase, phaseTicks: 0, aim: -skee.board.width / 2, sweep: 1, held: 0,
  throws: [], message: "", revealed: 0, ...changes,
});
const stateOf = (value: SkeeGame, tickets = 0): State => ({
  ...createState(world, fixture), arcade: value, tickets,
});
const tick = (state: State, input: ActionFrame): State => ({
  ...state, ...stepArcade(world, state, input), previousInput: input,
});
const realTick = (state: State, input: ActionFrame): State => step(world, state, input).state;
const facts = (tickets = 0): InkFacts => ({
  calmed: { "arcade-keeper": true }, coins: 2, snacks: 0, prizes: [], plushesLeft: 9,
  tickets,
});
const conversationState = (): State => {
  const started = runInk(world.story, createInkState(world.story, 1),
    { type: "start", knot: "skee_ball" }, facts());
  const line = started.line;
  if (line === null) throw new Error("skee knot did not start");
  return {
    ...base(), coins: 2, ink: started.ink,
    critters: { ...base().critters, "arcade-keeper": "calm" },
    dialogue: { knot: "skee_ball", speaker: line.speaker, text: line.text,
      revealed: 0, choices: started.choices, selected: 0, ended: started.ended },
  };
};
const choosePlay = (initial: State): State => {
  let state = initial;
  for (let count = 0; count < 300; count += 1) {
    const dialogue = state.dialogue;
    if (dialogue === null) return state;
    if (dialogue.revealed < dialogue.text.length) state = realTick(state, frame());
    else {
      state = realTick(state, frame(true));
      state = realTick(state, frame());
    }
  }
  throw new Error(`conversation did not finish: ${state.dialogue?.text ?? "none"}`);
};
const skeeState = (state: State): SkeeGame => {
  if (state.arcade?.game !== "skee") throw new Error("no skee game");
  return state.arcade;
};
const copy = (): Record<string, unknown> => {
  const value: unknown = JSON.parse(JSON.stringify(arcadeJson));
  if (!record(value)) throw new Error("arcade JSON is not an object");
  return value;
};
const object = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("value is not an object");
  if (!record(value)) throw new Error("value is not an object");
  return value;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const changed = (change: (arcade: Record<string, unknown>) => void): unknown => {
  const value = copy();
  change(value);
  return value;
};
const changeSkee = (change: (skeeValue: Record<string, unknown>) => void): unknown =>
  changed((value) => change(object(value.skee)));
const expectInvalid = (value: unknown, field: string): void => {
  expect(() => parseArcade(value, prizesJson)).toThrow(new RegExp(field));
};
const zoneAt = (x: number, y: number): SkeeZone => skeeZone(skee, x, y);
const scoreAt = (x: number, y: number): number => skeePoints(skee, x, y);
const reachable = (x: number): boolean =>
  Number.isInteger((x + skee.board.width / 2) / skee.sweepStep);
const holdForPoints = (points: number): number => {
  for (let held = 1; held < skee.powerTicks; held += 1)
    if (scoreAt(skee.centre.x, held * skee.powerStep) === points) return held;
  throw new Error(`no reachable hold scores ${points}`);
};

describe("skee-ball sweep and power", () => {
  it("starts left, steps, turns at both edges, and completes a full cycle", () => {
    let state = stateOf(newSkee(skee));
    expect(skeeState(state)).toMatchObject({ aim: -skee.board.width / 2, sweep: 1 });
    state = tick(state, frame());
    expect(skeeState(state).aim).toBe(-skee.board.width / 2 + skee.sweepStep);
    state = stateOf(game("aiming", {
      aim: skee.board.width / 2 - skee.sweepStep, sweep: 1,
    }));
    state = tick(state, frame());
    expect(skeeState(state)).toMatchObject({ aim: skee.board.width / 2, sweep: -1 });
    state = tick(state, frame());
    expect(skeeState(state).aim).toBe(skee.board.width / 2 - skee.sweepStep);
    state = stateOf(newSkee(skee));
    for (let index = 0; index < 2 * skee.board.width / skee.sweepStep; index += 1)
      state = tick(state, frame());
    expect(skeeState(state)).toMatchObject({ aim: -skee.board.width / 2, sweep: 1 });
  });

  it("locks only on a fresh press and does not move on that tick", () => {
    const held = stateOf(game("aiming", { aim: 12 }), 0);
    expect(skeeState(tick({ ...held, previousInput: frame(true) }, frame(true))).phase)
      .toBe("aiming");
    const next = tick(held, frame(true));
    expect(skeeState(next)).toMatchObject({ phase: "winding", aim: 12 });
  });

  it("requires a fresh press to wind, counts held ticks, and releases without adding", () => {
    let state = stateOf(game("winding"));
    state = tick({ ...state, previousInput: frame(true) }, frame(true));
    expect(skeeState(state).phase).toBe("winding");
    state = tick({ ...state, previousInput: frame(false) }, frame(true));
    expect(skeeState(state)).toMatchObject({ phase: "powering", held: 1 });
    state = tick(state, frame(true));
    expect(skeeState(state).held).toBe(2);
    state = tick(state, frame(false));
    expect(skeeState(state)).toMatchObject({ phase: "rolling", held: 2 });
    expect(skeeState(state).throws.at(-1)?.y).toBe(2 * skee.powerStep);
  });

  it("rolls immediately at the end of the meter and scores the floor off the top", () => {
    const state = stateOf(game("powering", { held: skee.powerTicks - 1 }));
    const next = tick(state, frame(true));
    expect(skeeState(next)).toMatchObject({ phase: "rolling", held: skee.powerTicks });
    expect(skeeState(next).throws.at(-1)).toMatchObject({
      y: skee.powerTicks * skee.powerStep, points: skee.floor,
    });
  });
});

describe("skee-ball scoring and views", () => {
  it("scores every ring edge, corner edge, floor, and off-board point", () => {
    for (const [index, ring] of skee.rings.entries()) {
      expect(skeePoints(skee, skee.centre.x, skee.centre.y + ring.radius))
        .toBe(ring.points);
      const next = skee.rings[index + 1];
      expect(skeePoints(skee, skee.centre.x, skee.centre.y + ring.radius + 1))
        .toBe(next?.points ?? skee.floor);
    }
    for (const x of [-skee.corners.x, skee.corners.x]) {
      expect(skeePoints(skee, x + skee.corners.radius, skee.corners.y))
        .toBe(skee.corners.points);
      expect(skeePoints(skee, x, skee.corners.y + skee.corners.radius)).toBe(skee.corners.points);
      expect(skeePoints(skee, x, skee.corners.y + skee.corners.radius + 1))
        .toBe(skee.floor);
    }
    expect(skeePoints(skee, 0, skee.board.height + 1)).toBe(skee.floor);
    expect(skeePoints(skee, 0, 0)).toBe(skee.floor);
  });

  it("exposes phase hints, meter, flight progress, balls, and landed score", () => {
    let state = stateOf(newSkee(skee));
    while (skeeState(state).aim !== skee.centre.x) state = realTick(state, frame());
    state = realTick(state, frame(true));
    const winding = arcadeView(world, state);
    expect(winding).toMatchObject({ phase: "winding", hint: skee.lines.power,
      power: { fill: 0, top: skee.board.height / (skee.powerTicks * skee.powerStep) },
      ball: null, ballsLeft: skee.balls, score: 0 });
    state = realTick(state, frame());
    state = realTick(state, frame(true));
    state = realTick(state, frame(true));
    const powering = arcadeView(world, state);
    expect(powering).toMatchObject({ hint: skee.lines.power,
      power: { fill: 2 / skee.powerTicks } });
    state = realTick(state, frame(false));
    for (let count = 0; count < 3; count += 1) state = realTick(state, frame());
    const rolling = arcadeView(world, state);
    expect(rolling).toMatchObject({ phase: "rolling", hint: null,
      ball: { stage: "rolling", progress: 3 / skee.rollTicks,
        zone: zoneAt(skee.centre.x, 2 * skee.powerStep) }, score: 0 });
    for (let count = 3; count < skee.rollTicks + skee.hopTicks; count += 1)
      state = realTick(state, frame());
    for (let count = 0; count < 2; count += 1) state = realTick(state, frame());
    const scored = arcadeView(world, state);
    expect(scored).toMatchObject({ ball: { stage: "landed", progress: 2 / skee.scoreTicks,
      zone: zoneAt(skee.centre.x, 2 * skee.powerStep) },
      score: scoreAt(skee.centre.x, 2 * skee.powerStep), ballsLeft: skee.balls - 1 });
  });
});

describe("skee-ball content validation", () => {
  it("accepts the real arcade content and rejects each invalid geometry or line", () => {
    expect(() => parseArcade(arcadeJson, prizesJson)).not.toThrow();
    expectInvalid(changeSkee((value) => { value.sweepStep = 7; }), "sweepStep");
    expectInvalid(changeSkee((value) => { value.powerTicks = 1; }), "powerTicks");
    expectInvalid(changeSkee((value) => {
      const rings = value.rings;
      if (!Array.isArray(rings)) throw new Error("rings missing");
      object(rings[1]).radius = object(rings[0]).radius;
    }), "rings");
    expectInvalid(changeSkee((value) => {
      if (!Array.isArray(value.rings)) throw new Error("rings missing");
      object(value.rings.at(-1)).radius = skee.board.width;
    }), "outer ring");
    expectInvalid(changeSkee((value) => {
      object(value.corners).x = skee.board.width;
    }), "corners");
    expectInvalid(changeSkee((value) => { object(value.corners).x = 140; }), "corners");
    expectInvalid(changeSkee((value) => { value.floor = 0; }), "floor");
    expectInvalid(changeSkee((value) => { object(value.lines).result = "{tickets}"; }), "lines");
    expectInvalid(changeSkee((value) => { object(value.lines).result = "{score}"; }), "lines");
  });

  it("validates trade tags against the counter prices and catalogue", () => {
    const tags = storyTags(world.story).filter((tag) => tag.startsWith("trade:"));
    const prices: Record<string, number> = {};
    for (const item of world.arcade.counter.prizes) prices[item.prize] = item.price;
    expect(storyTagErrors(tags, world.areas, prices)).toEqual([]);
    expect(storyTagErrors(["trade: pinwheel 21"], world.areas, prices))
      .not.toEqual([]);
    expect(storyTagErrors(["trade: pinwheel", "trade: pinwheel twenty"], world.areas,
      prices)).toHaveLength(2);
    expect(storyTagErrors(["trade: pinwheel 20"], world.areas, {})).not.toEqual([]);
  });
});

describe("skee-ball real-step integration", () => {
const throwBall = (initial: State, x: number, held: number): State => {
    let state = initial;
    while (skeeState(state).aim !== x) state = realTick(state, frame(false));
    state = realTick(state, frame(true));
    state = realTick(state, frame(false));
    state = realTick(state, frame(true));
    for (let count = 1; count < held; count += 1) state = realTick(state, frame(true));
    state = realTick(state, frame(false));
    for (let count = 0; count < skee.rollTicks + skee.hopTicks + skee.scoreTicks; count += 1)
      state = realTick(state, frame(false));
    return state;
};
  it("plays five real-step balls, pays the exact result, and closes on two presses", () => {
    let state = choosePlay(conversationState());
    expect(state.coins).toBe(0);
    const centre = skee.centre.x;
    const corner = skee.corners.x;
    const throws = [
      { x: centre, held: Math.round(skee.centre.y / skee.powerStep), points: 50,
        zone: { kind: "ring", index: 0 } },
      { x: corner, held: Math.round(skee.corners.y / skee.powerStep), points: 100,
        zone: { kind: "corner", side: 1 } },
      { x: centre, held: skee.powerTicks, points: skee.floor,
        zone: { kind: "floor" } },
      { x: centre, held: holdForPoints(40), points: 40,
        zone: { kind: "ring", index: 1 } },
      { x: centre, held: holdForPoints(20), points: 20,
        zone: { kind: "ring", index: 3 } },
    ];
    for (const expected of throws) {
      expect(reachable(expected.x)).toBe(true);
      state = throwBall(state, expected.x, expected.held);
      const landed = skeeState(state).throws.at(-1);
      expect(landed?.points).toBe(expected.points);
      expect(landed === undefined ? undefined : scoreAt(landed.x, landed.y))
        .toBe(expected.points);
      expect(landed === undefined ? undefined : zoneAt(landed.x, landed.y))
        .toEqual(expected.zone);
    }
    const total = throws.reduce((sum, item) => sum + item.points, 0);
    const tickets = Math.floor(total / skee.pointsPerTicket);
    const message = skee.lines.result.replace("{score}", String(total))
      .replace("{tickets}", String(tickets));
    expect(skeeState(state)).toMatchObject({ phase: "result", message });
    expect(state.tickets).toBe(tickets);
    state = realTick(state, frame(true));
    expect(skeeState(state).revealed).toBe(skeeState(state).message.length);
    state = realTick(state, frame(false));
    state = realTick(state, frame(true));
    expect(state.arcade).toBeNull();
    expect(state.tickets).toBe(22);
  });

  it("opens through the real skee-ball conversation and freezes movement and journal input", () => {
    const state = choosePlay(conversationState());
    const before = state.party.map((member) => member.stillTicks);
    const next = step(world, state, { ...frame(), move: { x: 1, y: 0 }, menu: true }).state;
    expect(next.coins).toBe(0);
    expect(next.journalOpen).toBe(false);
    expect(next.player).toEqual(state.player);
    expect(next.party.map((member) => member.stillTicks)).toEqual(
      before.map((ticks) => ticks + 1));
  });

  it("emits the exact cue sequence across a five-ball game", () => {
    let state = choosePlay(conversationState());
    const cues: string[] = [];
    const move = (input: ActionFrame): void => {
      const next = realTick(state, input);
      cues.push(...soundCues(state, next, world));
      state = next;
    };
    const planned = [
      { x: skee.centre.x, held: Math.round(skee.centre.y / skee.powerStep) },
      { x: skee.corners.x, held: Math.round(skee.corners.y / skee.powerStep) },
      { x: skee.centre.x, held: skee.powerTicks },
      { x: skee.centre.x, held: holdForPoints(40) },
      { x: skee.centre.x, held: holdForPoints(20) },
    ];
    for (const item of planned) {
      while (skeeState(state).aim !== item.x) move(frame());
      move(frame(true));
      move(frame());
      move(frame(true));
      for (let held = 1; held < item.held; held += 1) move(frame(true));
      move(frame());
      for (let count = 0; count < skee.rollTicks + skee.hopTicks + skee.scoreTicks;
        count += 1) move(frame());
    }
    expect(cues).toEqual([
      "skee-aim", "skee-roll", "skee-score", "skee-aim", "skee-roll", "skee-hundred",
      "skee-aim", "skee-roll", "skee-score", "skee-aim", "skee-roll", "skee-score",
      "skee-aim", "skee-roll", "skee-score", "tickets-won",
    ]);
  });
});
