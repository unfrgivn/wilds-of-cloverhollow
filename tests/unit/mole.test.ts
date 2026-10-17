import { describe, expect, it } from "vitest";
import {
  arcadeView, blankInput, createState, moleHoles, moleHole, moleView, moleWindow, newMole,
  nextRandom, openArcade, step, stepArcade, type ActionFrame, type MoleGame,
  type MoleHole, type State,
} from "../../src/core";
import { createInkState, runInk, type InkFacts } from "../../src/core/ink";
import { loadContent, parseArcade, storyTagErrors } from "../../src/content/load";
import arcadeJson from "../../content/arcade.json";
import prizesJson from "../../content/prizes.json";
import { soundCues } from "../../src/core/sound";

const content = loadContent();
const world = content.world;
const mole = world.arcade.mole;
const fixture = content.fixtures.arcade;
if (fixture === undefined) throw new Error("arcade fixture is missing");

const frame = (changes: Partial<ActionFrame> = {}): ActionFrame => ({
  ...blankInput(), ...changes,
});
const press = (hole: MoleHole): ActionFrame => hole === "middle"
  ? frame({ confirm: true })
  : frame({ move: hole === "up" ? { x: 0, y: -1 } : hole === "down" ? { x: 0, y: 1 }
    : hole === "left" ? { x: -1, y: 0 } : { x: 1, y: 0 } });
const stateOf = (game: MoleGame, changes: Partial<State> = {}): State => ({
  ...createState(world, fixture), arcade: game, ...changes,
});
const game = (changes: Partial<MoleGame> = {}): MoleGame => ({
  game: "mole", phase: "playing", phaseTicks: 0, order: ["middle", "up", "right"],
  mole: 0, stage: "rising", stageTicks: 0, booped: 0, hammer: null,
  message: "", revealed: 0, ...changes,
});
const tick = (state: State, input = frame()): State => ({
  ...state, ...stepArcade(world, state, input), previousInput: input,
});
const advance = (state: State, count: number): State => {
  for (let index = 0; index < count; index += 1) state = tick(state);
  return state;
};
const moleGame = (state: State): MoleGame => {
  if (state.arcade?.game !== "mole") throw new Error("mole game is missing");
  return state.arcade;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const object = (value: unknown): Record<string, unknown> => {
  if (!record(value)) throw new Error("expected object");
  return value;
};
const arcadeCopy = (): Record<string, unknown> => {
  const value: unknown = JSON.parse(JSON.stringify(arcadeJson));
  return object(value);
};
const moleCopy = (): Record<string, unknown> => object(arcadeCopy().mole);
const invalidMole = (change: (value: Record<string, unknown>) => void, field: string): void => {
  const value = arcadeCopy();
  change(object(value.mole));
  expect(() => parseArcade(value, prizesJson)).toThrow(new RegExp(field));
};
const facts = (coins: number, calm: boolean): InkFacts => ({
  calmed: calm ? { "arcade-keeper": true } : {}, coins, snacks: 0, prizes: [],
  plushesLeft: 9, tickets: 0,
});
const story = (coins: number, calm: boolean) => runInk(world.story,
  createInkState(world.story, 1), { type: "start", knot: "boop_a_mole" }, facts(coins, calm));
const conversationState = (): State => {
  const started = story(2, true);
  const line = started.line;
  if (line === null) throw new Error("mole knot did not start");
  const base = createState(world, fixture);
  return { ...base, coins: 2, ink: started.ink,
    critters: { ...base.critters, "arcade-keeper": "calm" },
    dialogue: { knot: "boop_a_mole", speaker: line.speaker, text: line.text,
      revealed: 0, choices: started.choices, selected: 0, ended: started.ended } };
};
const choosePlay = (initial: State): State => {
  let state = initial;
  for (let count = 0; count < 300; count += 1) {
    const dialogue = state.dialogue;
    if (dialogue === null) return state;
    const input = dialogue.revealed < dialogue.text.length ? frame() : frame({ confirm: true });
    state = step(world, state, input).state;
    if (dialogue.revealed >= dialogue.text.length) state = step(world, state, frame()).state;
  }
  throw new Error("mole conversation did not finish");
};

describe("Boop-a-Mole draw and input", () => {
  it("draws each mole from the open holes and advances exactly one random value per mole", () => {
    const first = stateOf(game(), { rng: 12345 });
    const [round, drawn] = newMole(mole, first);
    let expected = first;
    const expectedOrder: MoleHole[] = [];
    for (let index = 0; index < mole.moles; index += 1) [, expected] = nextRandom(expected);
    expected = first;
    for (let index = 0; index < mole.moles; index += 1) {
      const [value, after] = nextRandom(expected);
      expected = after;
      const open = moleHoles.filter((hole) => hole !== expectedOrder.at(-1));
      expectedOrder.push(open[Math.floor(value * open.length)] ?? "middle");
    }
    expect(drawn.rng).toBe(expected.rng);
    expect(round.order).toHaveLength(mole.moles);
    expect(round.order).toEqual(expectedOrder);
    round.order.forEach((hole, index) => expect(hole).not.toBe(round.order[index - 1]));

    const [same, other] = [newMole(mole, stateOf(game(), { rng: 7 }))[0],
      newMole(mole, stateOf(game(), { rng: 8 }))[0]];
    expect(newMole(mole, stateOf(game(), { rng: 7 }))[0].order).toEqual(same.order);
    expect(same.order).not.toEqual(other.order);
    let source = stateOf(game(), { rng: 42, coins: 2 });
    source = openArcade(world, source, "mole", 2);
    expect(source.coins).toBe(0);
    expect(source.rng).toBe(newMole(mole, { ...stateOf(game()), rng: 42 })[1].rng);
  });

  it("waits through ready without swinging, then starts the first mole rising", () => {
    let state = stateOf(game({ phase: "ready" }));
    state = tick(state, press("middle"));
    expect(moleGame(state)).toMatchObject({ phase: "ready", hammer: null });
    state = advance(state, mole.readyTicks - 1);
    expect(moleGame(state)).toMatchObject({ phase: "playing", stage: "rising", stageTicks: 0 });
  });

  it("maps only fresh presses to holes, with middle taking priority", () => {
    const held = press("up");
    expect(moleHole(held, held)).toBeNull();
    expect(moleHole(press("up"), frame())).toBe("up");
    expect(moleHole(press("down"), frame())).toBe("down");
    expect(moleHole(press("left"), frame())).toBe("left");
    expect(moleHole(press("right"), frame())).toBe("right");
    expect(moleHole(press("middle"), frame())).toBe("middle");
    expect(moleHole(frame({ confirm: true, move: { x: 1, y: -1 } }), frame())).toBe("middle");
  });
});

describe("Boop-a-Mole timing and hits", () => {
  it("runs an unbooped mole through rising, up, ducking, waiting, and the next rising", () => {
    let state = stateOf(game());
    state = advance(state, mole.riseTicks);
    expect(moleGame(state).stage).toBe("up");
    state = advance(state, mole.upFirst);
    expect(moleGame(state).stage).toBe("ducking");
    state = advance(state, mole.duckTicks);
    expect(moleGame(state).stage).toBe("waiting");
    state = advance(state, mole.gapTicks);
    expect(moleGame(state)).toMatchObject({ mole: 1, stage: "rising", stageTicks: 0 });
  });

  it("uses the first, last, and rounded interpolated up windows", () => {
    const windows = [0, 1, 2].map((index) => {
      let state = stateOf(game({ order: ["up", "left", "down"], mole: index }));
      state = advance(state, mole.riseTicks + moleWindow(mole, index));
      return moleGame(state).stage;
    });
    expect(windows).toEqual(["ducking", "ducking", "ducking"]);
  });

  it("boops on the first rising tick and throughout up, then shows booped and giggling", () => {
    let state = stateOf(game());
    state = tick(state, press("middle"));
    expect(moleGame(state)).toMatchObject({ stage: "booped", booped: 1,
      hammer: { hole: "middle", ticks: 0, hit: true } });
    state = advance(state, mole.boopTicks);
    expect(moleGame(state).stage).toBe("giggling");
  });

  it("hits on the last up tick but squeaks on the first ducking tick", () => {
    let state = stateOf(game());
    state = advance(state, mole.riseTicks + mole.upFirst - 1);
    state = tick(state, press("middle"));
    expect(moleGame(state)).toMatchObject({ stage: "booped", booped: 1, hammer: { hit: true } });
    state = stateOf(game({ stage: "up", stageTicks: mole.upFirst - 1 }));
    state = tick(state, frame());
    expect(moleGame(state).stage).toBe("ducking");
    state = tick(state, press("middle"));
    expect(moleGame(state)).toMatchObject({ stage: "ducking", booped: 0, hammer: { hit: false } });
  });

  it("squeaks at empty or unavailable holes and ages the hammer until it disappears", () => {
    let state = stateOf(game());
    state = tick(state, press("up"));
    expect(moleGame(state)).toMatchObject({ booped: 0, hammer: { hit: false, ticks: 0 } });
    state = tick(state, press("middle"));
    expect(moleGame(state)).toMatchObject({ booped: 1, hammer: { hit: true, ticks: 0 } });
    state = tick(state);
    state = tick(state, press("middle"));
    expect(moleGame(state)).toMatchObject({ booped: 1, hammer: { hit: false, ticks: 0 } });
    for (let index = 0; index < mole.hammerTicks; index += 1) state = tick(state);
    expect(moleGame(state).hammer).toBeNull();
  });
});

describe("Boop-a-Mole view, result, and real round", () => {
  it("draws the current mole, phase faces, rise, hammer progress, counts, and hints", () => {
    let state = stateOf(game({ phase: "ready" }));
    expect(arcadeView(world, state)).toMatchObject({ phase: "ready", molesLeft: 3,
      hint: mole.lines.ready });
    state = { ...state, arcade: game({ stage: "rising", stageTicks: 2 }) };
    expect(moleView(world, moleGame(state))).toMatchObject({ hint: mole.lines.boop,
      holes: [{ hole: "up", mole: null }, { hole: "left", mole: null },
        { hole: "middle", mole: { rise: 2 / mole.riseTicks, face: "up" } },
        { hole: "right", mole: null }, { hole: "down", mole: null }], molesLeft: 3 });
    state = tick(state, press("middle"));
    expect(moleView(world, moleGame(state))).toMatchObject({ booped: 1,
      hammer: { hole: "middle", progress: 0, hit: true },
      holes: [{ hole: "up", mole: null }, { hole: "left", mole: null },
        { hole: "middle", mole: { rise: 1, face: "booped" } },
        { hole: "right", mole: null }, { hole: "down", mole: null }] });
    state = advance(state, Math.ceil(mole.boopTicks / 2));
    expect(moleView(world, moleGame(state)).holes[2]?.mole?.face).toBe("giggle");
    state = { ...state, arcade: game({ phase: "result", order: ["middle"], mole: 0,
      message: "done", revealed: 0 }) };
    expect(moleView(world, moleGame(state))).toMatchObject({ hint: null, holes: [
      { hole: "up", mole: null }, { hole: "left", mole: null }, { hole: "middle", mole: null },
      { hole: "right", mole: null }, { hole: "down", mole: null },
    ] });
    state = { ...state, arcade: game({ stage: "waiting", mole: 0 }) };
    expect(moleView(world, moleGame(state)).molesLeft).toBe(2);
  });

  it("pays once, reveals the result in two presses, and keeps tickets after closing", () => {
    let state = stateOf(game({ order: ["middle"], stage: "ducking", stageTicks: mole.duckTicks - 1,
      booped: 1 }), { tickets: 0 });
    state = tick(state);
    expect(moleGame(state)).toMatchObject({ phase: "result", message: mole.lines.result
      .replace("{booped}", "1").replace("{moles}", "1")
      .replace("{tickets}", String(mole.ticketsPerBoop)) });
    expect(state.tickets).toBe(mole.ticketsPerBoop);
    state = tick(state, frame({ confirm: true }));
    expect(moleGame(state).revealed).toBe(moleGame(state).message.length);
    state = tick(state);
    state = tick(state, frame({ confirm: true }));
    expect(state.arcade).toBeNull();
    expect(state.tickets).toBe(mole.ticketsPerBoop);
  });

  it("plays the real conversation and round with deterministic boops and squeaks", () => {
    let state = choosePlay(conversationState());
    expect(state.coins).toBe(0);
    const order = [...moleGame(state).order];
    const cues: string[] = [];
    const move = (input: ActionFrame): void => {
      const next = step(world, state, input).state;
      cues.push(...soundCues(state, next, world));
      state = next;
    };
    for (let index = 0; index < mole.readyTicks; index += 1) move(frame());
    for (const [index, hole] of order.entries()) {
      for (let tickCount = 0; tickCount < mole.riseTicks; tickCount += 1)
        move(index % 2 === 0 && tickCount === 2 ? press(hole) : frame());
      if (index === 1) {
        const empty = moleHoles.find((candidate) => candidate !== hole);
        if (empty === undefined) throw new Error("no empty mole hole");
        move(press(empty));
        move(frame());
        move(press(empty));
      }
      while (moleGame(state).phase === "playing" && moleGame(state).mole === index) move(frame());
    }
    expect(state.tickets).toBe(Math.ceil(order.length / 2) * mole.ticketsPerBoop);
    const expected = mole.lines.result.replace("{booped}", String(Math.ceil(order.length / 2)))
      .replace("{moles}", String(mole.moles)).replace("{tickets}",
        String(Math.ceil(order.length / 2) * mole.ticketsPerBoop));
    expect(moleGame(state).message).toBe(expected);
    expect(cues.filter((cue) => cue === "mole-pop")).toHaveLength(mole.moles);
    expect(cues.filter((cue) => cue === "mole-boop")).toHaveLength(Math.ceil(order.length / 2));
    expect(cues.filter((cue) => cue === "tickets-won")).toHaveLength(1);
    const expectedCues: string[] = [];
    for (let index = 0; index < order.length; index += 1) {
      expectedCues.push("mole-pop");
      if (index % 2 === 0) expectedCues.push("mole-boop");
      if (index === 1) expectedCues.push("mole-whiff", "mole-whiff");
    }
    expectedCues.push("tickets-won");
    expect(cues).toEqual(expectedCues);
  });

  it("freezes movement, journal input, and party still ticks during a round", () => {
    const state = openArcade(world, { ...createState(world, fixture), coins: 2 }, "mole", 2);
    const before = state.party.map((member) => member.stillTicks);
    const next = step(world, state, frame({ move: { x: 1, y: 0 }, menu: true })).state;
    expect(next.player).toEqual(state.player);
    expect(next.journalOpen).toBe(false);
    expect(next.party.map((member) => member.stillTicks)).toEqual(before.map((ticks) => ticks + 1));
  });
});

describe("Boop-a-Mole content and story validation", () => {
  it("rejects every invalid mole field and accepts the real content", () => {
    expect(() => parseArcade(arcadeJson, prizesJson)).not.toThrow();
    invalidMole((value) => { value.moles = 1; }, "mole.moles");
    invalidMole((value) => { value.upLast = mole.upFirst + 1; }, "mole.upLast");
    invalidMole((value) => { value.boopTicks = 1; }, "mole.boopTicks");
    for (const part of ["{booped}", "{moles}", "{tickets}"]) invalidMole((value) => {
      const lines = object(value.lines);
      lines.result = mole.lines.result.replace(part, "");
    }, "mole.lines");
    invalidMole((value) => { value.riseTicks = 1.5; }, "mole.riseTicks");
    invalidMole((value) => { value.ticketsPerBoop = 0; }, "mole.ticketsPerBoop");
    expect(moleCopy().moles).toBe(mole.moles);
  });

  it("authored story gates the game on calm and coins and validates its play tag", () => {
    const scribbles = story(2, false);
    expect(scribbles.line?.text).toContain("purple scribbles");
    expect(scribbles.choices).toEqual([]);
    const poor = story(1, true);
    const poorNext = runInk(world.story, poor.ink, { type: "next" }, facts(1, true));
    expect(poorNext.line?.text).toBe("I need 2 coins to play.");
    expect(poor.choices).toEqual([]);
    const ready = story(2, true);
    expect(ready.choices).toContain("Play for 2 coins");
    expect(ready.choices).toContain("Not now");
    expect(storyTagErrors(["play: mole 2"], world.areas)).toEqual([]);
  });
});
