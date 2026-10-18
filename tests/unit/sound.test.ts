import { describe, expect, it } from "vitest";
import {
  createCheck,
  createState,
  soundCues,
  step,
  type ActionFrame,
  type State,
} from "../../src/core";
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
    expect(soundCues(positioned, opened, content.world)).toContain("dialogue-open");
    const typed = step(content.world, step(content.world, opened, none).state, none).state;
    expect(soundCues(opened, typed, content.world)).toContain("dialogue-blip");
    const journalStart = createState(content.world, content.fixtures["new-game"] ?? harness);
    const journal = step(content.world, journalStart, { ...none, menu: true }).state;
    expect(soundCues(journalStart, journal, content.world)).toEqual(["journal-open"]);
  });

  it("uses real movement steps for a throttled footstep and does not repeat while still", () => {
    let state = createState(content.world, harness);
    let cues: string[] = [];
    for (let index = 0; index < 16; index += 1) {
      const next = step(content.world, state, right).state;
      cues = [...cues, ...soundCues(state, next, content.world)];
      state = next;
    }
    expect(cues).toEqual(["footstep-grass", "footstep-grass"]);
    const stopped = step(content.world, state, none).state;
    expect(soundCues(state, stopped, content.world)).toEqual([]);
    const held = step(content.world, stopped, none).state;
    expect(soundCues(stopped, held, content.world)).toEqual([]);
  });

  it("starts a battle from a real step into a critter", () => {
    const initial = createState(content.world, plaza);
    const positioned: State = { ...initial, player: { x: 1080, y: 820 }, facing: "left" };
    const next = step(content.world, positioned, { ...none, move: { x: -1, y: 0 } }).state;
    expect(next.battle).not.toBeNull();
    expect(soundCues(positioned, next, content.world)).toEqual(["battle-start"]);
  });

  it("emits one battle-beat per real chain hit and battle-hit on resolution", () => {
    const fixture = content.fixtures.plaza;
    if (fixture === undefined) throw new Error("plaza fixture missing");
    const initial = createState(content.world, fixture);
    const critter = content.world.critters["fountain-frog"];
    if (critter === undefined) throw new Error("fountain frog missing");
    const checkSpec = critter.burst.check;
    if (checkSpec.kind !== "chain") throw new Error("fountain burst is not a chain");
    const check = createCheck(checkSpec, "fae");
    let state: State = {
      ...initial,
      battle: {
        critterId: critter.id, den: null, entry: initial.player, phase: "check",
        message: "", revealed: 0, selected: 0, command: null, energy: 5, calm: 0,
        rest: {}, check, lastGrade: null, feelings: [], answered: false, lanternPeek: false,
        turn: 1, windUp: null,
        rewardSticker: null, phaseTicks: 0,
      },
    };
    let beats = 0;
    let hits = 0;
    for (const arrival of checkSpec.arrivals) {
      while (state.battle?.check?.tick !== arrival - 1)
        state = step(content.world, state, none).state;
      const next = step(content.world, state, { ...none, confirm: true }).state;
      const cues = soundCues(state, next, content.world);
      beats += cues.filter((cue) => cue === "battle-beat").length;
      hits += cues.filter((cue) => cue === "battle-hit").length;
      state = next;
    }
    expect(beats).toBe(checkSpec.arrivals.length);
    expect(hits).toBe(1);
  });

  it("emits one battle-beat per Trace hit through real battle steps", () => {
    const fixture = content.fixtures.plaza;
    if (fixture === undefined) throw new Error("plaza fixture missing");
    const initial = createState(content.world, fixture);
    const critter = content.world.critters["fountain-frog"];
    if (critter === undefined) throw new Error("fountain frog missing");
    const trace = {
      kind: "trace" as const, dryTicks: 20, brushSpeed: 100, reachRadius: 5,
      paths: [{ id: "sound", points: [
        { x: 100, y: 100 }, { x: 200, y: 100 }, { x: 300, y: 100 }, { x: 400, y: 100 },
      ] }],
    };
    let state: State = {
      ...initial,
      battle: {
        critterId: critter.id, den: null, entry: initial.player, phase: "check",
        message: "", revealed: 0, selected: 0, command: null, energy: 5, calm: 0,
        rest: {}, check: createCheck(trace, "fae"), lastGrade: null, feelings: [],
        answered: false, lanternPeek: false, turn: 1, windUp: null,
        rewardSticker: null, phaseTicks: 0,
      },
    };
    let beats = 0;
    for (const pointer of [undefined, { x: 200, y: 100 }, { x: 300, y: 100 }, { x: 400, y: 100 }]) {
      const next = step(
        content.world, state, pointer === undefined ? none : { ...none, pointer },
      ).state;
      beats += soundCues(state, next, content.world)
        .filter((cue) => cue === "battle-beat").length;
      state = next;
    }
    expect(beats).toBe(4);
  });

  it("emits no battle-beat for a real chain miss but still emits battle-hit", () => {
    const fixture = content.fixtures.plaza;
    if (fixture === undefined) throw new Error("plaza fixture missing");
    const initial = createState(content.world, fixture);
    const critter = content.world.critters["fountain-frog"];
    if (critter === undefined) throw new Error("fountain frog missing");
    const checkSpec = critter.burst.check;
    if (checkSpec.kind !== "chain") throw new Error("fountain burst is not a chain");
    let state: State = {
      ...initial,
      battle: {
        critterId: critter.id, den: null, entry: initial.player, phase: "check",
        message: "", revealed: 0, selected: 0, command: null, energy: 5, calm: 0,
        rest: {}, check: createCheck(checkSpec, "fae"), lastGrade: null,
        feelings: [], answered: false, lanternPeek: false,
        turn: 1, windUp: null,
        rewardSticker: null, phaseTicks: 0,
      },
    };
    while (state.battle?.phase === "check") {
      const next = step(content.world, state, none).state;
      expect(soundCues(state, next, content.world)).not.toContain("battle-beat");
      state = next;
    }
    expect(state.battle?.phase).toBe("burstResult");
    expect(soundCues({ ...state, battle: { ...state.battle!, phase: "check" } }, state,
      content.world)).toContain("battle-hit");
  });

  it("emits one battle-beat per caught toy and none for a missed toy", () => {
    const fixture = content.fixtures.plaza;
    const pup = content.world.critters.pup;
    if (fixture === undefined || pup === undefined || pup.burst.check.kind !== "catch")
      throw new Error("catch fixtures missing");
    const initial = createState(content.world, fixture);
    const check = createCheck(pup.burst.check, "fae", false, [0, 1, 2, 0]);
    let state: State = {
      ...initial,
      battle: {
        critterId: pup.id, den: null, entry: initial.player, phase: "check",
        message: "", revealed: 0, selected: 0, command: null, energy: 5, calm: 0,
        rest: {}, check, lastGrade: null, feelings: [], answered: false, lanternPeek: false,
        turn: 1, windUp: null,
        rewardSticker: null, phaseTicks: 0,
      },
    };
    let beats = 0;
    for (const [index, arrival] of pup.burst.check.arrivals.entries()) {
      const lane = index === 0 ? 1 : (check.kind === "catch" ? check.lanes[index] : undefined);
      if (lane === undefined) throw new Error("catch lane missing");
      while (state.battle?.check?.tick !== arrival - 1)
        state = step(content.world, state, { ...none, move: { x: 0, y: lane - 1 } }).state;
      const next = step(content.world, state, { ...none, move: { x: 0, y: lane - 1 } }).state;
      beats += soundCues(state, next, content.world)
        .filter((cue) => cue === "battle-beat").length;
      state = next;
    }
    expect(beats).toBe(pup.burst.check.arrivals.length - 1);
  });

  it("emits one battle-beat per held puff and none for a lost one", () => {
    const fixture = content.fixtures.plaza;
    const bluebird = content.world.critters.bluebird;
    if (fixture === undefined || bluebird === undefined || bluebird.burst.check.kind !== "lean")
      throw new Error("lean fixtures missing");
    const initial = createState(content.world, fixture);
    let state: State = {
      ...initial,
      battle: {
        critterId: bluebird.id, den: null, entry: initial.player, phase: "check",
        message: "", revealed: 0, selected: 0, command: null, energy: 5, calm: 0,
        rest: {}, check: createCheck(bluebird.burst.check, "fae", false, [2, 3]),
        lastGrade: null, feelings: [], answered: false, lanternPeek: false,
        turn: 1, windUp: null,
        rewardSticker: null, phaseTicks: 0,
      },
    };
    // The first puff blows Fae over; through the second she leans back
    // toward straight.
    let beats = 0;
    while (state.battle?.phase === "check") {
      const check = state.battle.check;
      const leaning = check?.kind === "lean" && check.results[0] !== "pending";
      const balance = check?.kind === "lean" ? check.balance : 0;
      const x = !leaning ? 0 : balance <= -5 ? 1 : balance >= 5 ? -1 : 0;
      const next = step(content.world, state, { ...none, move: { x, y: 0 } }).state;
      beats += soundCues(state, next, content.world)
        .filter((cue) => cue === "battle-beat").length;
      state = next;
    }
    expect(state.battle?.check).toMatchObject({ results: ["miss", "hit"] });
    expect(beats).toBe(1);
  });
});
