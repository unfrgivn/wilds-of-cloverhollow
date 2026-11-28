import { describe, expect, it } from "vitest";
import {
  auditAreaNavigation,
  blankInput,
  createState,
  mapBusRoutes,
  partySlots,
  runInk,
  soundtrackFor,
  step,
  surfaceAt,
  type ActionFrame,
  type Area,
  type State,
  type SurfaceMap,
} from "../../src/core";
import { areaConnectionErrors } from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";
import { evaluateOutdoorAtmosphere } from "../../src/render/atmosphere-outdoor";
import { storyTimeOfDay } from "../../src/render/time-of-day";

const { world } = loadContent();
const radius = world.tunables.playerRadius;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}

function surfaceFor(id: string): SurfaceMap {
  const surface = world.surfaces[id];
  if (surface === undefined) throw new Error(`surface ${id} missing`);
  return surface;
}

function walkThrough(state: State, move: { x: number; y: number }): State {
  const from = state.area;
  for (let tick = 0; tick < 400; tick += 1) {
    state = step(world, state, press({ move })).state;
    if (state.area !== from && state.transition === null) return state;
  }
  throw new Error(`never transitioned out of ${from}`);
}

function readBusChoices(state: State): string[] {
  let choices: string[] = [];
  state = step(world, state, blankInput()).state;
  state = step(world, state, press({ confirm: true })).state;
  if (state.dialogue === null) throw new Error("bus stop dialogue did not open");
  for (let tick = 0; tick < 600 && state.dialogue !== null; tick += 1) {
    const dialogue = state.dialogue;
    if (dialogue.choices.length > 0 && choices.length === 0) choices = [...dialogue.choices];
    const frame = dialogue.choices.length > 0 && dialogue.revealed >= dialogue.text.length
      ? press({ choose: dialogue.choices.length - 1 })
      : press({ confirm: tick % 2 === 1 });
    state = step(world, state, frame).state;
  }
  return choices;
}

describe("east road coastal route (lane, crossing, boardwalk)", () => {
  const eastRoadIds = ["lane", "crossing", "boardwalk"] as const;

  it("spans three 2520x1080 open-world areas (7,560 logical units, >5 screens)", () => {
    let totalWidth = 0;
    for (const id of eastRoadIds) {
      const area = areaFor(id);
      expect(area.width).toBe(2520);
      expect(area.height).toBe(1080);
      expect(area.ground).toBe(id);
      totalWidth += area.width;
    }
    expect(totalWidth).toBe(7560);
    expect(totalWidth).toBeGreaterThan(5 * 1280);
  });

  it("wires plaza <-> lane <-> crossing <-> boardwalk <-> bay bidirectionally", () => {
    const links: [string, string, string, string][] = [
      ["plaza", "bay-road", "lane", "plaza"],
      ["lane", "plaza", "plaza", "bay-road"],
      ["lane", "crossing", "crossing", "lane"],
      ["crossing", "lane", "lane", "crossing"],
      ["crossing", "boardwalk", "boardwalk", "crossing"],
      ["boardwalk", "crossing", "crossing", "boardwalk"],
      ["boardwalk", "bay", "bay", "plaza-road"],
      ["bay", "plaza-road", "boardwalk", "bay"],
    ];
    for (const [fromId, triggerId, toId, spawnId] of links) {
      const from = areaFor(fromId);
      const trigger = from.triggers.find((item) => item.id === triggerId);
      expect(trigger?.target, `${fromId}.${triggerId}`).toEqual({ area: toId, spawn: spawnId });
      expect(areaFor(toId).spawns[spawnId], `${toId}.${spawnId}`).toBeDefined();
    }
  });

  it("passes full-roster party slots, area checks, and navigation audits", () => {
    const roster = Object.values(world.party);
    for (const id of eastRoadIds) {
      const area = areaFor(id);
      for (const [name, spawn] of Object.entries(area.spawns)) {
        const slots = partySlots(area, spawn, world.tunables.follow, roster);
        expect(slots.every((entry) => entry.slot !== undefined), `${id}.${name}`).toBe(true);
      }
      const nav = auditAreaNavigation(area, radius);
      expect(nav.unreachableCells, `${id} unreachable`).toBe(0);
      expect(nav.minSpawnClearance, `${id} spawn clearance`).toBeGreaterThanOrEqual(radius);
    }
    const errors = areaConnectionErrors(world.areas, world.tunables, world.critters, world.party);
    expect(errors).toEqual([]);
  }, 60_000);

  it("maps grass, sand, and wood surfaces along each route painting", () => {
    expect(surfaceAt(surfaceFor("lane"), { x: 400, y: 760 })).toBe("grass");
    expect(surfaceAt(surfaceFor("lane"), { x: 140, y: 490 })).toBe("sand");
    expect(surfaceAt(surfaceFor("crossing"), { x: 500, y: 700 })).toBe("grass");
    expect(surfaceAt(surfaceFor("crossing"), { x: 1360, y: 550 })).toBe("wood");
    expect(surfaceAt(surfaceFor("crossing"), { x: 140, y: 415 })).toBe("sand");
    expect(surfaceAt(surfaceFor("boardwalk"), { x: 140, y: 205 })).toBe("sand");
    expect(surfaceAt(surfaceFor("boardwalk"), { x: 1120, y: 650 })).toBe("wood");
    expect(surfaceAt(surfaceFor("boardwalk"), { x: 2370, y: 480 })).toBe("sand");
  });

  it("provides dialogue knots for every east-road interactable", () => {
    const state = createState(world, { area: "lane", spawn: "plaza", seed: 1 });
    const knots = [
      "lane_signpost",
      "lane_bench",
      "lane_berries",
      "crossing_signpost",
      "crossing_bench",
      "boardwalk_signpost",
      "boardwalk_bench",
    ];
    for (const knot of knots) {
      const result = runInk(world.story, state.ink, { type: "start", knot });
      expect(result.line?.text.length ?? 0, knot).toBeGreaterThan(0);
    }
  });

  it("registers music, ambience, golden-hour lighting, and outdoor atmosphere", () => {
    const cases: [string, string, string][] = [
      ["lane", "hills", "town-breeze"],
      ["crossing", "hills", "forest"],
      ["boardwalk", "bay", "ocean"],
    ];
    for (const [id, track, ambience] of cases) {
      const state = createState(world, {
        area: id,
        spawn: Object.keys(areaFor(id).spawns)[0] ?? "",
        variables: { has_lantern: true },
      });
      const sound = soundtrackFor(world, state, { titleOpen: false });
      expect({ track: sound.track, ambience: sound.ambience }, id).toEqual({ track, ambience });
      expect(storyTimeOfDay(world, state).phase, id).toBe("golden-hour");
      const particles = evaluateOutdoorAtmosphere(id, 2520, 1080, 60);
      expect(particles !== null && particles.length > 0, id).toBe(true);
    }
  });
});

describe("discover-on-foot Star-Line bus unlock and Cliffside Trail gate", () => {
  it("keeps Bubblegum Bay locked on the bus until Fae actually arrives in bay on foot", () => {
    const plazaBefore = createState(world, {
      area: "plaza",
      spawn: "bus-stop",
      variables: { club_open: true },
    });
    const beforeStop: State = { ...plazaBefore, player: { x: 878, y: 985 }, facing: "up" };
    expect(readBusChoices(beforeStop)).toEqual([]);

    const atBoardwalkEast = createState(world, { area: "boardwalk", spawn: "bay", seed: 1 });
    expect(world.storyVariable(atBoardwalkEast.ink, "visited_bay")).toBe(false);
    const inBay = walkThrough(atBoardwalkEast, { x: 1, y: 0 });
    expect(inBay.area).toBe("bay");
    expect(world.storyVariable(inBay.ink, "visited_bay")).toBe(true);

    const plazaAfter: State = {
      ...createState(world, { area: "plaza", spawn: "bus-stop", seed: 1 }),
      ink: inBay.ink,
      player: { x: 878, y: 985 },
      facing: "up",
    };
    expect(readBusChoices(plazaAfter)).toEqual(["Bubblegum Bay!", "Not yet."]);
  });

  it("unlocks Pinecone Pass on the bus once Fae arrives in pass on foot", () => {
    const atTrailTop = createState(world, {
      area: "trail",
      spawn: "pass",
      variables: { visited_bay: true },
      seed: 1,
    });
    expect(world.storyVariable(atTrailTop.ink, "visited_pass")).toBe(false);
    const inPass = walkThrough(atTrailTop, { x: -1, y: 0 });
    expect(inPass.area).toBe("pass");
    expect(world.storyVariable(inPass.ink, "visited_pass")).toBe(true);

    const plazaAfter: State = {
      ...createState(world, { area: "plaza", spawn: "bus-stop", seed: 1 }),
      ink: inPass.ink,
      player: { x: 878, y: 985 },
      facing: "up",
    };
    expect(readBusChoices(plazaAfter)).toEqual(["Pinecone Pass!", "Bubblegum Bay!", "Not yet."]);

    const bayAfter: State = {
      ...createState(world, { area: "bay", spawn: "bus-stop", seed: 1 }),
      ink: inPass.ink,
      player: { x: 355, y: 545 },
      facing: "up",
    };
    expect(readBusChoices(bayAfter)).toEqual(["Cloverhollow!", "Pinecone Pass!", "Not yet."]);
  });

  it("reflects visited_bay/sue_joined and visited_pass/rode_bus in mapBusRoutes", () => {
    expect(mapBusRoutes(world.lands, (name) => name === "club_open")).toEqual([
      { from: "cloverhollow", to: "bay", open: false },
      { from: "cloverhollow", to: "pass", open: false },
      { from: "bay", to: "pass", open: false },
    ]);
    expect(mapBusRoutes(world.lands, (name) => name === "visited_bay")).toEqual([
      { from: "cloverhollow", to: "bay", open: true },
      { from: "cloverhollow", to: "pass", open: false },
      { from: "bay", to: "pass", open: false },
    ]);
    expect(
      mapBusRoutes(world.lands, (name) => name === "visited_bay" || name === "visited_pass"),
    ).toEqual([
      { from: "cloverhollow", to: "bay", open: true },
      { from: "cloverhollow", to: "pass", open: true },
      { from: "bay", to: "pass", open: true },
    ]);
  });

  it("gates bay -> trail on bluebird_calmed and sets it in on_calm", () => {
    const bay = areaFor("bay");
    expect(bay.triggers.find((trigger) => trigger.id === "trail")?.requires).toEqual({
      variable: "bluebird_calmed",
      knot: "bay_cliff_path",
    });
    const base = createState(world, { area: "bay", spawn: "plaza-road", seed: 1 });
    expect(world.storyVariable(base.ink, "bluebird_calmed")).toBe(false);
    const calmed = runInk(
      world.story,
      base.ink,
      { type: "start", knot: "on_calm" },
      { calmed: { bluebird: true }, coins: 0, snacks: 0, prizes: [], plushesLeft: 0, tickets: 0 },
    );
    expect(world.storyVariable(calmed.ink, "bluebird_calmed")).toBe(true);
  });
});
