import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  firstTouch,
  nextNotice,
  step,
  wildMarks,
  type ActionFrame,
  type Fixture,
  type State,
  type Wild,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

// Milestone 51: a recurring critter takes a moment to notice Fae in its
// sight; whoever gets the jump shows in the battle's opening; and once Fae
// has calmed three of a species, its critters calm on touch.
const content = loadContent();
const world = content.world;
const roam = world.tunables.roam;
function fixture(name: string): Fixture {
  const value = content.fixtures[name];
  if (value === undefined) throw new Error(`${name} fixture missing`);
  return value;
}
const pup = world.critters.pup;
if (pup === undefined) throw new Error("pup missing");
const right: ActionFrame = { ...blankInput(), move: { x: 1, y: 0 } };

// The park's pup den always has one out. Fae stands 130 to its left: in its
// sight, out of its reach. It rests where it is (a long pause) until it
// notices her, so nothing turns on where it would have wandered.
function meeting(options: {
  notice?: number;
  calms?: State["calms"];
  party?: string[];
  stickers?: string[];
} = {}): State {
  const park = fixture("park");
  const base = createState(world, options.party ? { ...park, party: options.party } : park);
  const out = base.wild.find((critter) => critter.den === 0);
  if (out === undefined) throw new Error("no pup out");
  return {
    ...base,
    player: { x: out.x - 130, y: out.y },
    facing: "right",
    wild: [{ ...out, target: { x: out.x, y: out.y }, pauseTicks: 1000,
      notice: options.notice ?? 0 }],
    calms: options.calms ?? {},
    stickers: options.stickers ?? [],
  };
}

function until(state: State, frame: ActionFrame, done: (next: State) => boolean): State {
  let current = state;
  for (let count = 0; count < 600 && !done(current); count += 1)
    current = step(world, current, frame).state;
  if (!done(current)) throw new Error("never got there");
  return current;
}

// Lets the battle's message type out, then presses on to the next phase.
function confirm(state: State): State {
  const phase = state.battle?.phase;
  const typed = until(state, blankInput(),
    (next) => next.battle !== null && next.battle.revealed >= next.battle.message.length);
  const pressed = step(world, typed, { ...blankInput(), confirm: true }).state;
  if (pressed.battle?.phase === phase && pressed.battle !== null) return confirm(pressed);
  return pressed;
}

function wild(notice: number, mood: Wild["mood"] = "chaos"): Wild {
  return { kind: "pup", den: 0, mood, x: 0, y: 0, target: { x: 0, y: 0 }, pauseTicks: 0,
    cooldownTicks: 0, facing: "down", moving: false, notice };
}

describe("noticing", () => {
  it("counts up in sight to the end of its alert, and starts over out of sight", () => {
    const top = roam.noticeTicks + roam.alertTicks;
    expect(nextNotice(wild(0), true, roam)).toBe(1);
    expect(nextNotice(wild(top - 1), true, roam)).toBe(top);
    expect(nextNotice(wild(top), true, roam)).toBe(top);
    expect(nextNotice(wild(12), false, roam)).toBe(0);
  });

  it("marks a chaos critter ? until it notices Fae, then ! for its alert", () => {
    const at = (notice: number, mood: Wild["mood"] = "chaos"): string[] =>
      wildMarks(world, { ...meeting(), wild: [wild(notice, mood)] }).map((item) => item.mark);
    expect(at(0)).toEqual([]);
    expect(at(1)).toEqual(["?"]);
    expect(at(roam.noticeTicks - 1)).toEqual(["?"]);
    expect(at(roam.noticeTicks)).toEqual(["!"]);
    expect(at(roam.noticeTicks + roam.alertTicks - 1)).toEqual(["!"]);
    expect(at(roam.noticeTicks + roam.alertTicks)).toEqual([]);
    expect(at(5, "calm")).toEqual([]);
  });

  it("goes its own way until Fae has been in its sight noticeTicks, then chases", () => {
    let state = meeting();
    for (let tick = 1; tick < roam.noticeTicks; tick += 1) {
      state = step(world, state, blankInput()).state;
      expect(state.wild[0]?.notice).toBe(tick);
      expect(state.wild[0]?.target).not.toEqual(state.player);
    }
    state = step(world, state, blankInput()).state;
    expect(state.battle).toBeNull();
    expect(state.wild[0]?.notice).toBe(roam.noticeTicks);
    expect(state.wild[0]?.target).toEqual(state.player);
  });
});

describe("first touch", () => {
  it("says who got the jump from the notice and Fae's step", () => {
    const aware = { ...wild(roam.noticeTicks), x: 100, y: 0 };
    const from = { x: 0, y: 0 };
    expect(firstTouch({ ...aware, notice: roam.noticeTicks - 1 }, roam, from, from))
      .toBe("surprised");
    expect(firstTouch(aware, roam, from, { x: 4, y: 0 })).toBe("even");
    expect(firstTouch(aware, roam, from, from)).toBe("caught");
    expect(firstTouch(aware, roam, from, { x: -4, y: 0 })).toBe("caught");
    expect(firstTouch(aware, roam, from, { x: 0, y: 4 })).toBe("caught");
  });

  it("opens a quarter calm when Fae gets to the pup before it notices her", () => {
    const state = until(meeting(), right, (next) => next.battle !== null);
    expect(state.battle).toMatchObject({
      critterId: "pup",
      phase: "intro",
      turn: 1,
      calm: world.battle.firstTouch.surprise,
      message: world.battle.firstTouch.lines.surprised.replace("{name}", pup.name),
    });
    expect(state.battle?.message).toBe(
      "The Zoomie Pup didn't see Fae coming! It's a little calmer already.");
  });

  it("opens plainly when Fae walks at a pup that has noticed her", () => {
    const state = until(meeting({ notice: roam.noticeTicks }), right,
      (next) => next.battle !== null);
    expect(state.battle).toMatchObject({ turn: 1, calm: 0, message: pup.lines.intro });
  });

  it("bursts first when the pup catches Fae standing, then turn 1 opens", () => {
    let state = until(meeting({ party: ["maddie", "sue"] }), blankInput(),
      (next) => next.battle !== null);
    expect(state.battle).toMatchObject({
      phase: "intro",
      turn: 0,
      calm: 0,
      message: "The Zoomie Pup pounces before Fae is ready!",
    });
    // The intro draws the battle's three feelings, and the pup bursts.
    state = confirm(state);
    const drawn = state.battle?.feelings;
    expect(drawn).toHaveLength(3);
    expect(state.battle).toMatchObject({ phase: "burst", message: pup.lines.burst, turn: 0 });
    state = confirm(state);
    expect(state.battle?.check?.side).toBe("fae");
    state = until(state, blankInput(), (next) => next.battle?.phase === "burstResult");
    // Turn 1 shows the first feeling drawn: nothing moved up, nothing more drawn.
    state = confirm(state);
    expect(state.battle).toMatchObject({ phase: "command", turn: 1, feelings: drawn });
  });

  it("never comes into a set piece's opening", () => {
    const frog = world.critters["fountain-frog"];
    if (frog === undefined) throw new Error("fountain frog missing");
    // The plaza's spawn to the fountain frog, as the feelings e2e walks it.
    let state = createState(world, fixture("plaza"));
    for (const [move, ticks] of [[{ x: 0, y: 1 }, 25], [{ x: -1, y: 0 }, 15],
      [{ x: 0, y: 1 }, 50]] as const)
      for (let tick = 0; tick < ticks; tick += 1)
        state = step(world, state, { ...blankInput(), move }).state;
    state = until(state, { ...blankInput(), move: { x: -1, y: 0 } },
      (next) => next.battle !== null);
    expect(state.battle).toMatchObject({ critterId: "fountain-frog", turn: 1, calm: 0,
      message: frog.lines.intro });
  });
});

describe("old friends", () => {
  it("calms a species Fae has calmed three of on touch, pays, and counts it", () => {
    let state = until(meeting({ calms: { pup: 3 }, stickers: [pup.sticker.id] }), right,
      (next) => next.battle !== null);
    expect(state.battle).toMatchObject({
      phase: "soothed",
      calm: pup.calmMax,
      message: "The Zoomie Pup remembers Fae and calms right down!",
    });
    const coins = state.coins;
    state = confirm(state);
    expect(state.battle).toMatchObject({ phase: "reward", rewardSticker: null });
    state = confirm(state);
    expect(state.battle).toBeNull();
    expect(state.coins).toBe(coins + pup.coins);
    expect(state.calms).toEqual({ pup: 4 });
    expect(state.wild[0]?.mood).toBe("calm");
  });

  it("battles as ever with two calmed", () => {
    const state = until(meeting({ calms: { pup: 2 } }), right, (next) => next.battle !== null);
    expect(state.battle?.phase).toBe("intro");
  });

  it("counts every calm by species, set pieces too", () => {
    const base = createState(world, fixture("plaza"));
    const reward: State = {
      ...base,
      calms: { frog: 1 },
      battle: {
        critterId: "fountain-frog", den: null, entry: base.player, phase: "reward",
        message: "+5 coins!", revealed: 9, selected: 0, command: null, energy: 5,
        calm: 100, rest: {}, check: null, lastGrade: null, feelings: [], answered: false,
        lanternPeek: false, turn: 3, windUp: null, rewardSticker: null, phaseTicks: 0,
      },
    };
    expect(confirm(reward).calms).toEqual({ frog: 2 });
  });
});
