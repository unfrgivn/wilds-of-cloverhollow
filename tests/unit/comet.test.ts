import { describe, expect, it } from "vitest";
import {
  blankInput, cometTravel, cometView, createState, newComet, nextRandom, openArcade, soundCues,
  step, type ActionFrame, type CometGame, type CometView, type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseArcade } from "../../src/content/load";
import arcadeJson from "../../content/arcade.json";
import prizesJson from "../../content/prizes.json";

const content = loadContent();
const fixture = content.fixtures.arcade;
if (fixture === undefined) throw new Error("missing arcade fixture");
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const world = content.world;
const comet = world.arcade.comet;
const right: ActionFrame = { ...blankInput(), move: { x: 1, y: 0 } };
const left: ActionFrame = { ...blankInput(), move: { x: -1, y: 0 } };
const idle = (ticks: number): ActionFrame[] =>
  Array.from({ length: Math.max(0, ticks) }, () => blankInput());
const run = (state: State, inputs: ActionFrame[]): State =>
  inputs.reduce((current, input) => step(world, current, input).state, state);
// The game as a `play: comet 2` line opens it: paid for, drawn, and ready.
const opened = (): State =>
  openArcade(world, { ...createState(world, fixture), coins: 2 }, "comet", 2);
const playing = (): State => run(opened(), idle(comet.readyTicks));
const game = (state: State): CometGame => {
  if (state.arcade?.game !== "comet") throw new Error("no comet game open");
  return state.arcade;
};
const view = (state: State): CometView => cometView(world, game(state));
// Steers the rocket to a lane, one fresh press at a time, and lets it settle.
const steerTo = (state: State, lane: 0 | 1 | 2): State => {
  let current = state;
  while (game(current).lane !== lane)
    current = run(current, [game(current).lane < lane ? right : left, blankInput()]);
  return run(current, idle(comet.moveTicks));
};

describe("Comet Cruise", () => {
  it("shrinks travel evenly from the first object to the last", () => {
    expect(cometTravel(content.world.arcade.comet, 0)).toBe(96);
    expect(cometTravel(content.world.arcade.comet, 23)).toBe(60);
    expect(cometTravel(content.world.arcade.comet, 12)).toBe(77);
    expect(cometTravel(content.world.arcade.comet, 13)).toBe(76);
  });

  it("draws the fixed field from the seeded random generator", () => {
    expect(content.world.arcade.comet).toMatchObject({
      stars: 16, rocks: 8, readyTicks: 60, gapTicks: 48, travelFirst: 96,
      travelLast: 60, passTicks: 24, flashTicks: 16, moveTicks: 6,
      wobbleTicks: 24,
    });
    const state = createState(content.world, fixture);
    const [first, after] = newComet(content.world.arcade.comet, state);
    const [second] = newComet(content.world.arcade.comet, state);
    expect(first.objects).toEqual(second.objects);
    expect(first.objects.filter((object) => object.kind === "star")).toHaveLength(16);
    expect(first.objects.filter((object) => object.kind === "rock")).toHaveLength(8);
    expect(after.rng).not.toEqual(state.rng);
    let expected = state;
    for (let draw = 0; draw < content.world.arcade.comet.rocks + first.objects.length; draw += 1)
      [, expected] = nextRandom(expected);
    expect(after.rng).toBe(expected.rng);
    expect(first.objects[0]?.kind).toBe("star");
    first.objects.slice(1).forEach((object, index) => {
      expect(object.kind === "rock" && first.objects[index]?.kind === "rock").toBe(false);
    });
  });

  it("puts each one in a lane other than the one before's", () => {
    const [game] = newComet(comet, createState(world, fixture));
    game.objects.slice(1).forEach((object, index) => {
      expect(object.lane).not.toBe(game.objects[index]?.lane);
    });
  });

  it("shows only what has set off: nothing while ready, then one every gapTicks", () => {
    expect(view(opened()).objects).toEqual([]);
    expect(view(playing()).objects).toEqual([]);
    const first = run(playing(), idle(1));
    expect(view(first).objects).toHaveLength(1);
    expect(view(first).objects[0]?.progress).toBeGreaterThan(0);
    expect(view(run(first, idle(comet.gapTicks - 1))).objects).toHaveLength(1);
    expect(view(run(first, idle(comet.gapTicks))).objects).toHaveLength(2);
  });

  it("waits readyTicks, then the run starts", () => {
    const before = run(opened(), idle(comet.readyTicks - 1));
    expect(game(before).phase).toBe("ready");
    expect(view(before).hint).toBe(comet.lines.ready);
    const started = run(before, idle(1));
    expect(game(started).phase).toBe("playing");
    expect(view(started).hint).toBe(comet.lines.play);
  });

  it("moves a lane a fresh press, never while held, and no further than the edge", () => {
    let state = playing();
    expect(game(state).lane).toBe(1);
    state = run(state, [right]);
    expect(game(state).lane).toBe(2);
    state = run(state, [right, right]);
    expect(game(state).lane).toBe(2);
    state = run(state, [blankInput(), left, left, blankInput(), left]);
    expect(game(state).lane).toBe(0);
    state = run(state, [blankInput(), left]);
    expect(game(state).lane).toBe(0);
  });

  it("does nothing with up, down, or confirm in a run", () => {
    const state = playing();
    const pressed = run(state, [{ ...blankInput(), move: { x: 0, y: -1 } }, blankInput(),
      { ...blankInput(), move: { x: 0, y: 1 } }, blankInput(), { ...blankInput(), confirm: true }]);
    expect(game(pressed).lane).toBe(1);
    expect(game(pressed).phase).toBe("playing");
  });

  it("slides the rocket over moveTicks, leaning into the turn, then stands it up", () => {
    let state = run(playing(), [right]);
    const positions = [view(state).rocket.position];
    expect(view(state).rocket.lean).toBe(1);
    for (let tick = 1; tick < comet.moveTicks; tick += 1) {
      state = run(state, idle(1));
      positions.push(view(state).rocket.position);
      expect(view(state).rocket.lean).toBe(1);
    }
    expect(positions[0]).toBe(1);
    positions.slice(1).forEach((position, index) =>
      expect(position).toBeGreaterThan(positions[index] ?? 0));
    state = run(state, idle(1));
    expect(view(state).rocket).toMatchObject({ lane: 2, position: 2, lean: 0 });
  });

  it("slides on from where the rocket is when a press comes mid-slide", () => {
    let state = run(playing(), [right, blankInput(), blankInput()]);
    const before = view(state).rocket.position;
    expect(before).toBeGreaterThan(1);
    expect(before).toBeLessThan(2);
    state = run(state, [left]);
    expect(view(state).rocket).toMatchObject({ lane: 1, position: before, lean: -1 });
    state = run(state, idle(comet.moveTicks));
    expect(view(state).rocket).toMatchObject({ lane: 1, position: 1, lean: 0 });
  });

  it("catches a star in the rocket's lane and pays; its sparkle stays on the row", () => {
    const first = game(opened()).objects[0];
    if (first?.kind !== "star") throw new Error("a run starts with a star");
    let state = steerTo(playing(), first.lane);
    state = run(state, idle(first.spawn + cometTravel(comet, 0) - game(state).elapsed - 1));
    expect(game(state).caught).toBe(0);
    state = run(state, idle(1));
    expect(game(state)).toMatchObject({ caught: 1, tickets: comet.ticketsPerStar });
    expect(view(state).objects.find((object) => object.flash > 0))
      .toMatchObject({ kind: "star", lane: first.lane, progress: 1, flash: 1 });
    state = run(state, idle(comet.flashTicks - 1));
    expect(view(state).objects.find((object) => object.flash > 0)?.progress).toBe(1);
    state = run(state, idle(1));
    expect(view(state).objects.some((object) => object.flash > 0)).toBe(false);
  });

  it("judges a press on the crossing tick after the move", () => {
    const first = game(opened()).objects[0];
    if (first === undefined) throw new Error("no objects");
    const beside: 0 | 1 | 2 = first.lane === 0 ? 1 : first.lane - 1 === 0 ? 0 : 1;
    let state = steerTo(playing(), beside);
    state = run(state, idle(first.spawn + cometTravel(comet, 0) - game(state).elapsed - 1));
    state = run(state, [first.lane > beside ? right : left]);
    expect(game(state).lane).toBe(first.lane);
    expect(game(state).caught).toBe(1);
  });

  it("bumps the rocket with a rock in its lane: it wobbles and can't steer", () => {
    const index = game(opened()).objects.findIndex((object) => object.kind === "rock");
    const rock = game(opened()).objects[index];
    if (rock === undefined) throw new Error("a run has rocks");
    let state = run(playing(), idle(rock.spawn - comet.gapTicks));
    state = steerTo(state, rock.lane);
    state = run(state, idle(rock.spawn + cometTravel(comet, index) - game(state).elapsed));
    expect(game(state).bumps).toBe(1);
    expect(view(state).rocket.wobble).toBe(1);
    expect(view(state).objects.find((object) => object.flash > 0))
      .toMatchObject({ kind: "rock", lane: rock.lane, progress: 1 });
    const lane = game(state).lane;
    state = run(state, [blankInput(), rock.lane === 0 ? right : left]);
    expect(game(state).lane).toBe(lane);
    state = run(state, idle(comet.wobbleTicks));
    expect(view(state).rocket.wobble).toBe(0);
    state = run(state, [rock.lane === 0 ? right : left]);
    expect(game(state).lane).not.toBe(lane);
  });

  it("lets anything else pass on for passTicks, then it's gone", () => {
    const first = game(opened()).objects[0];
    if (first === undefined) throw new Error("no objects");
    let state = steerTo(playing(), first.lane === 0 ? 2 : 0);
    state = run(state, idle(first.spawn + cometTravel(comet, 0) - game(state).elapsed));
    expect(game(state)).toMatchObject({ caught: 0, letGo: 1 });
    expect(game(state).objects[0]?.status).toBe("passing");
    state = run(state, idle(comet.passTicks - 1));
    expect(game(state).objects[0]?.status).toBe("passing");
    state = run(state, idle(1));
    expect(game(state).objects[0]?.status).toBe("gone");
  });

  it("ends passTicks after the last reaches the row, types the result, and pays once", () => {
    const start = playing();
    const last = game(start).objects.length - 1;
    const end = last * comet.gapTicks + cometTravel(comet, last) + comet.passTicks;
    let state = run(start, idle(end - 1));
    expect(game(state).phase).toBe("playing");
    const ticketsBefore = state.tickets;
    state = run(state, idle(1));
    const done = game(state);
    expect(done.phase).toBe("result");
    expect(done.message).toBe(comet.lines.result.replace("{stars}", String(done.caught))
      .replace("{total}", String(comet.stars)).replace("{tickets}", String(done.tickets)));
    expect(state.tickets).toBe(ticketsBefore + done.tickets);
    expect(view(state).hint).toBeNull();
    state = run(state, idle(1));
    expect(game(state).revealed).toBeLessThan(done.message.length);
    state = run(state, [{ ...blankInput(), confirm: true }]);
    expect(game(state).revealed).toBe(done.message.length);
    state = run(state, [blankInput(), { ...blankInput(), confirm: true }]);
    expect(state.arcade).toBeNull();
    expect(state.tickets).toBe(ticketsBefore + done.tickets);
  });

  it("cues a lane change, a catch, a bump, and the result, and nothing at the start", () => {
    const cuesOf = (before: State, input: ActionFrame): string[] => {
      const after = step(world, before, input).state;
      return soundCues(before, after, world).filter((cue) =>
        cue.startsWith("comet-") || cue === "tickets-won");
    };
    expect(cuesOf(run(opened(), idle(comet.readyTicks - 1)), blankInput())).toEqual([]);
    expect(cuesOf(playing(), right)).toEqual(["comet-move"]);
    const first = game(opened()).objects[0];
    if (first === undefined) throw new Error("no objects");
    const atStar = steerTo(playing(), first.lane);
    const beforeCatch = run(atStar,
      idle(first.spawn + cometTravel(comet, 0) - game(atStar).elapsed - 1));
    expect(cuesOf(beforeCatch, blankInput())).toEqual(["comet-star"]);
    const index = game(opened()).objects.findIndex((object) => object.kind === "rock");
    const rock = game(opened()).objects[index];
    if (rock === undefined) throw new Error("a run has rocks");
    let atRock = run(playing(), idle(rock.spawn - comet.gapTicks));
    atRock = steerTo(atRock, rock.lane);
    atRock = run(atRock, idle(rock.spawn + cometTravel(comet, index) - game(atRock).elapsed - 1));
    expect(cuesOf(atRock, blankInput())).toContain("comet-bump");
    const last = game(playing()).objects.length - 1;
    const end = last * comet.gapTicks + cometTravel(comet, last) + comet.passTicks;
    expect(cuesOf(run(playing(), idle(end - 1)), blankInput())).toEqual(["tickets-won"]);
  });

  it.each([
    ["stars", 0], ["rocks", 0], ["readyTicks", 0], ["gapTicks", 0],
    ["travelFirst", 0], ["travelLast", 0], ["passTicks", 0], ["flashTicks", 0],
    ["moveTicks", 0], ["wobbleTicks", 0], ["ticketsPerStar", 0],
  ])("rejects a non-positive %s", (name, value) => {
    const copy: Record<string, unknown> = JSON.parse(JSON.stringify(arcadeJson));
    const comet = copy.comet;
    if (!record(comet)) throw new Error("missing comet content");
    comet[name] = value;
    expect(() => parseArcade(copy, prizesJson)).toThrow(`comet.${name}`);
  });

  it("rejects invalid counts, travel, flash duration, and placeholders", () => {
    const invalid = (change: (comet: Record<string, unknown>) => void, field: string): void => {
      const copy: Record<string, unknown> = JSON.parse(JSON.stringify(arcadeJson));
      const comet = copy.comet;
      if (!record(comet)) throw new Error("missing comet content");
      change(comet);
      expect(() => parseArcade(copy, prizesJson)).toThrow(field);
    };
    invalid((comet) => { comet.rocks = 17; }, "comet.stars");
    invalid((comet) => { comet.travelLast = 97; }, "comet.travelLast");
    invalid((comet) => { comet.passTicks = 15; }, "comet.passTicks");
    invalid((comet) => {
      const lines = comet.lines;
      if (!record(lines)) throw new Error("missing comet lines");
      lines.result = "bad";
    }, "comet.lines");
  });
});
