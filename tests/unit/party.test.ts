import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  battleCommands,
  blankInput,
  createState,
  distanceToPolygon,
  parseSave,
  pointInPolygon,
  serializeSave,
  step,
  type ActionFrame,
  type Critter,
  type Fixture,
  type PartyContent,
  type Point,
  type State,
  type World,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import followerEnds from "./fixtures/follower-ends.json";

// Contract for Milestone 17 (followers who fight). Maddie becomes the first
// member of a party that chains behind Fae; every member brings one battle
// command. The party version must walk exactly where Maddie walked before.

const content = loadContent();
const world = content.world;
const tune = world.tunables.follow;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

function replay(
  world: World,
  fixture: Fixture,
  path: string,
  each?: (state: State) => void,
): State {
  let state = createState(world, fixture);
  for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
    for (let tick = 0; tick < segment.ticks; tick += 1) {
      state = step(world, state, segment.frame).state;
      each?.(state);
    }
  return state;
}

function fixtureFor(name: string): Fixture {
  const fixture = content.fixtures[name];
  if (fixture === undefined) throw new Error(`fixture ${name} missing`);
  return fixture;
}

function validFollowerPoint(state: State, point: Point): boolean {
  const area = world.areas[state.area];
  if (area === undefined) throw new Error(`unknown area ${state.area}`);
  const clear = tune.radius - 0.01;
  if (!pointInPolygon(point, area.walkable)) return false;
  if (distanceToPolygon(point, area.walkable) < clear) return false;
  return area.blockers.every(
    (blocker) => !pointInPolygon(point, blocker) && distanceToPolygon(point, blocker) >= clear,
  );
}

// A second, content-less party member for the core tests: no atlas is drawn
// here, so any string will do. Her command is "whistle".
const scout: PartyContent = {
  id: "scout",
  name: "Scout",
  atlas: "assets/characters/scout/scout.json",
  box: { width: 50, height: 140 },
  walkCycleUnits: 84,
  sits: false,
  start: false,
  joins: null,
  command: { id: "whistle", label: "Whistle", resting: "catching breath" },
};
const whistle = { calm: 25, great: 10, good: 5, rest: 2 };
const whistleLines = {
  great: "Scout whistles a bright tune. The critter perks right up!",
  good: "Scout whistles. The critter tilts its head.",
  miss: "Scout whistles, but it comes out as a squeak.",
};

function withScout(critter: Critter): Critter {
  return {
    ...critter,
    commands: {
      ...critter.commands,
      friends: { ...critter.commands.friends, whistle },
    },
    lines: {
      ...critter.lines,
      friends: { ...critter.lines.friends, whistle: whistleLines },
    },
  };
}

const twoWorld: World = {
  ...world,
  party: { ...world.party, scout },
  critters: Object.fromEntries(
    Object.entries(world.critters).map(([id, critter]) => [id, withScout(critter)]),
  ),
};

function twoParty(fixture: Fixture): Fixture {
  return { ...fixture, party: ["maddie", "scout"] };
}

describe("party content", () => {
  it("rosters Maddie from content/party with the Play command", () => {
    const maddie = world.party["maddie"];
    expect(maddie).toBeDefined();
    expect(maddie?.command).toEqual({ id: "play", label: "Play", resting: "resting" });
    expect(maddie?.start).toBe(true);
    expect(maddie?.sits).toBe(true);
    expect(Object.keys(world.battle.commands).sort()).toEqual(["run", "snack", "soothe"]);
    const rosterCommands = Object.values(world.party).map((member) => member.command.id);
    for (const critter of Object.values(world.critters)) {
      expect(Object.keys(critter.commands.friends)).toEqual(rosterCommands);
      expect(Object.keys(critter.lines.friends)).toEqual(rosterCommands);
    }
  });

  it("starts every fixture with its own party, else the roster's starting members", () => {
    for (const fixture of Object.values(content.fixtures)) {
      const state = createState(world, fixture);
      expect(state.party.map((member) => member.id)).toEqual(fixture.party ?? ["maddie"]);
    }
  });
});

describe("Maddie as party member 0", () => {
  const scripts = readdirSync("tests/sim/scripts").flatMap((folder) =>
    readdirSync(join("tests/sim/scripts", folder)).map((file) => `${folder}/${file}`),
  );
  const ends: Record<string, (typeof followerEnds)[keyof typeof followerEnds]> = followerEnds;

  // The end states were recorded before the party existed; scripts added since
  // (a new area's run) have no "before" to match, but none may go missing.
  it("still has every replay script whose end state was recorded", () => {
    expect(scripts).toEqual(expect.arrayContaining(Object.keys(ends)));
  });

  for (const [name, end] of Object.entries(ends)) {
    it(`walks exactly where she did before in ${name}`, () => {
      const folder = name.split("/")[0] ?? "";
      const state = replay(world, fixtureFor(folder), join("tests/sim/scripts", name));
      const maddie = state.party[0];
      if (maddie === undefined) throw new Error("no party");
      expect(state.tick).toBe(end.tick);
      expect(state.area).toBe(end.area);
      expect(state.player).toEqual(end.player);
      expect(state.facing).toBe(end.facing);
      expect(maddie.id).toBe("maddie");
      expect(maddie.x).toBeCloseTo(end.follower.x, 9);
      expect(maddie.y).toBeCloseTo(end.follower.y, 9);
      expect(maddie.facing).toBe(end.follower.facing);
      expect(maddie.motion.moving).toBe(end.follower.moving);
      expect(maddie.motion.distance).toBeCloseTo(end.follower.distance, 9);
      expect(maddie.stillTicks).toBe(end.follower.stillTicks);
      expect(maddie.trail.length).toBe(end.follower.trail);
    });
  }
});

describe("a second follower", () => {
  it("spawns behind Maddie on a valid point at every fixture", () => {
    for (const fixture of Object.values(content.fixtures)) {
      const state = createState(twoWorld, twoParty(fixture));
      expect(state.party.map((member) => member.id)).toEqual(["maddie", "scout"]);
      const [maddie, second] = state.party;
      if (maddie === undefined || second === undefined) throw new Error("party short");
      expect(validFollowerPoint(state, second)).toBe(true);
      expect(distance(second, maddie)).toBeGreaterThan(tune.radius * 2);
      expect(distance(second, maddie)).toBeLessThanOrEqual(tune.heel + 10);
      expect(distance(second, state.player)).toBeGreaterThan(tune.radius * 2);
    }
  });

  it("chains behind Maddie through the harness without clipping or teleporting", () => {
    const maxStep = world.tunables.walkSpeed * tune.catchUp + 1e-9;
    let previous: Point | null = null;
    let moved = 0;
    const script = "tests/sim/scripts/harness/harness-600.json";
    const state = replay(twoWorld, twoParty(fixtureFor("harness")), script, (state) => {
      const second = state.party[1];
      if (second === undefined) throw new Error("second follower missing");
      expect(validFollowerPoint(state, second)).toBe(true);
      if (previous !== null) {
        const stepped = distance(previous, second);
        expect(stepped).toBeLessThanOrEqual(maxStep);
        moved += stepped;
      }
      previous = { x: second.x, y: second.y };
    });
    const [maddie, second] = state.party;
    if (maddie === undefined || second === undefined) throw new Error("party short");
    expect(moved).toBeGreaterThan(500);
    expect(distance(second, maddie)).toBeLessThanOrEqual(tune.distance * 1.5);
    expect(distance(second, maddie)).toBeGreaterThan(tune.radius);
    expect(distance(second, state.player)).toBeGreaterThan(distance(maddie, state.player));
  });

  it("does not change where Maddie walks", () => {
    const script = "tests/sim/scripts/harness/harness-600.json";
    const alone = replay(world, fixtureFor("harness"), script);
    const together = replay(twoWorld, twoParty(fixtureFor("harness")), script);
    expect(together.party[0]).toEqual(alone.party[0]);
    expect(together.player).toEqual(alone.player);
  });
});

describe("party battle commands", () => {
  function intoBattle(world: World, fixture: Fixture): State {
    return {
      ...createState(world, fixture),
      battle: {
        critterId: "fountain-frog", den: null,
        entry: { x: 500, y: 500 },
        phase: "command",
        message: "",
        revealed: 0,
        selected: 0,
        command: null,
        energy: 5,
        calm: 0,
        rest: {},
        aim: null,
        lastGrade: null,
        rewardSticker: null,
        aimTick: 0,
        phaseTicks: 0,
      },
    };
  }
  function advance(world: World, state: State, frame: ActionFrame, ticks: number): State {
    for (let tick = 0; tick < ticks; tick += 1) state = step(world, state, frame).state;
    return state;
  }
  function toCommandMenu(world: World, state: State): State {
    for (let tick = 0; tick < 600 && state.battle?.phase !== "command"; tick += 1)
      state = step(world, state, press({ confirm: tick % 2 === 0 })).state;
    if (state.battle?.phase !== "command") throw new Error("never reached the command menu");
    return state;
  }
  const plaza = fixtureFor("plaza");

  it("keeps Soothe, Play, Snack, Run with Maddie alone", () => {
    const state = intoBattle(world, plaza);
    expect(battleCommands(world, state).map((command) => command.id)).toEqual([
      "soothe", "play", "snack", "run",
    ]);
  });

  it("adds each member's command between Soothe and Snack", () => {
    const state = intoBattle(twoWorld, twoParty(plaza));
    const commands = battleCommands(twoWorld, state);
    expect(commands.map((command) => command.id)).toEqual([
      "soothe", "play", "whistle", "snack", "run",
    ]);
    expect(commands[2]?.label).toBe("Whistle");
    expect(commands.every((command) => !command.disabled)).toBe(true);
  });

  it("runs the whistle through aim with its own numbers and its own rest", () => {
    let state = intoBattle(twoWorld, twoParty(plaza));
    const critter = twoWorld.critters[state.battle?.critterId ?? ""];
    if (critter === undefined || state.battle === null) throw new Error("no critter");
    const calmBefore = state.battle.calm;
    state = advance(twoWorld, state, press({ move: { x: 0, y: 1 } }), 1);
    state = advance(twoWorld, state, blankInput(), 1);
    state = advance(twoWorld, state, press({ move: { x: 0, y: 1 } }), 1);
    state = advance(twoWorld, state, blankInput(), 1);
    expect(state.battle?.selected).toBe(2);
    state = advance(twoWorld, state, press({ confirm: true }), 1);
    expect(state.battle?.phase).toBe("aim");
    expect(state.battle?.command).toBe("whistle");
    state = advance(twoWorld, state, blankInput(), critter.timing.targetTick - 1);
    state = advance(twoWorld, state, press({ confirm: true }), 1);
    expect(state.battle?.phase).toBe("result");
    expect(state.battle?.lastGrade).toBe("great");
    expect(state.battle?.calm).toBe(
      Math.min(critter.calmMax, calmBefore + whistle.calm + whistle.great),
    );
    expect(state.battle?.message).toBe(whistleLines.great);
    state = toCommandMenu(twoWorld, advance(twoWorld, state, blankInput(), 1));
    const commands = battleCommands(twoWorld, state);
    expect(commands.find((command) => command.id === "whistle")).toMatchObject({
      disabled: true,
      detail: "catching breath",
    });
    expect(commands.find((command) => command.id === "play")).toMatchObject({ disabled: false });
  });
});

describe("save version", () => {
  it("writes version 5 and refuses version 2", () => {
    const state = createState(world, fixtureFor("new-game"));
    const json = serializeSave(state);
    expect(JSON.parse(json).version).toBe(5);
    expect(parseSave(json, state)).toEqual(state);
    expect(parseSave(JSON.stringify({ version: 2, state }), state)).toBeNull();
  });
});
