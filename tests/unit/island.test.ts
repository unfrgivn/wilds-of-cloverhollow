import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  areaConnectionErrors,
  hiddenPositions,
  propBlockerErrors,
  propDrawingErrors,
} from "../../src/content/area-checks";
import { ambientFor } from "../../src/content/ambient";
import {
  blankInput,
  createState,
  journalNotes,
  runInk,
  setInkVariables,
  soundtrackFor,
  step,
  surfaceAt,
  targetInteractable,
  type ActionFrame,
  type Direction,
  type State,
} from "../../src/core";
import { evaluateAtmosphere } from "../../src/render/atmosphere";
import { findRestSpot, REST_SPOTS } from "../../src/render/companions";
import { storyTimeOfDay } from "../../src/render/time-of-day";

const { world, fixtures } = loadContent();
const bay = world.areas.bay;
const island = world.areas.island;
if (bay === undefined || island === undefined) {
  throw new Error("bay or island area missing");
}

const none: ActionFrame = blankInput();

function runKnot(
  ink: string,
  knot: string,
  choices: number[] = [],
  calmed: Record<string, boolean> = {},
): { ink: string; lines: string[]; sounds: string[]; tags: string[]; firstChoices: string[] } {
  const facts = {
    calmed,
    coins: 20,
    snacks: 2,
    prizes: [],
    plushesLeft: 0,
    tickets: 0,
  };
  let result = runInk(world.story, ink, { type: "start", knot }, facts);
  const queue = choices.slice();
  const lines: string[] = [];
  const sounds: string[] = [];
  const tags: string[] = [];
  let firstChoices: string[] = [];
  const collect = (): void => {
    if (result.line !== null) {
      lines.push(result.line.text);
      if (result.line.sound !== undefined) sounds.push(result.line.sound);
      tags.push(...result.line.tags);
    }
    if (firstChoices.length === 0 && result.choices.length > 0) {
      firstChoices = [...result.choices];
    }
  };
  collect();
  for (let guard = 0; guard < 60 && !result.ended; guard += 1) {
    if (result.choices.length > 0) {
      const pick = queue.shift();
      if (pick === undefined) break;
      result = runInk(world.story, result.ink, { type: "choose", index: pick }, facts);
    } else {
      result = runInk(world.story, result.ink, { type: "next" }, facts);
    }
    collect();
  }
  return { ink: result.ink, lines, sounds, tags, firstChoices };
}

function advanceDialogue(state: State, choices: number[] = []): State {
  const wanted = choices.slice();
  let cur = state;
  for (let tick = 0; tick < 600 && cur.dialogue !== null; tick += 1) {
    const dlg = cur.dialogue;
    if (dlg.revealed < dlg.text.length || dlg.choices.length === 0) {
      cur = step(world, cur, { ...none, confirm: tick % 2 === 0 }).state;
      continue;
    }
    const pick = wanted.shift() ?? 0;
    cur = step(world, cur, { ...none, choose: pick }).state;
  }
  for (let tick = 0; tick < 90 && cur.transition !== null; tick += 1) {
    cur = step(world, cur, none).state;
  }
  return cur;
}

describe("Starlight Island & Bubblegum Bay Rowboat Crossing", () => {
  it("passes geometry, prop, hiding, ambient, and connection checks across all 33 areas", () => {
    expect(Object.keys(world.areas).length).toBeGreaterThanOrEqual(33);

    expect(island.name).toBe("Starlight Island");
    expect(island.land).toBe("bay");
    expect(island.width).toBe(1650);
    expect(island.height).toBe(1100);
    expect(island.triggers).toEqual([]);
    expect(island.interactables.map((item) => item.id)).toEqual([
      "island-boat",
      "island-shells",
      "island-lighthouse",
      "island-bottle",
    ]);
    expect(island.glows.map((glow) => glow.id)).toEqual([
      "island-star-1",
      "island-star-2",
      "island-beacon-glow",
    ]);
    expect(island.props.map((prop) => prop.id)).toEqual([
      "lighthouse",
      "driftwood-log",
      "west-palm",
      "east-palm",
    ]);
    expect(ambientFor(island)).toHaveLength(4);
    expect(bay.spawns.boats).toEqual({ x: 1450, y: 685, facing: "left" });

    // bay.spawns.boats must sit > 250u clear of every Bubblegum Bay recurring den.
    const boatsSpawn = bay.spawns.boats;
    if (boatsSpawn === undefined) throw new Error("bay.spawns.boats missing");
    for (const den of bay.recurring?.dens ?? []) {
      expect(Math.hypot(boatsSpawn.x - den.point.x, boatsSpawn.y - den.point.y)).toBeGreaterThan(
        250,
      );
    }

    expect(
      areaConnectionErrors(world.areas, world.tunables, world.critters, world.party),
    ).toEqual([]);
    for (const room of [island, bay]) {
      expect(propDrawingErrors(room), room.id).toEqual([]);
      expect(propBlockerErrors(room), room.id).toEqual([]);
      expect(hiddenPositions(room, world.tunables.playerRadius), room.id).toEqual([]);
    }
  });

  it("keeps bay_boats choice 0 sunny cove intact and adds Starlight Island ride once Sue joins",
    () => {
      const bayFixture = fixtures.bay;
      if (bayFixture === undefined) throw new Error("bay fixture missing");
      const freshInk = createState(world, bayFixture).ink;

      // Before Sue joins: 2 choices preserved verbatim so milestone-101 stays untouched.
      const beforeSue = runKnot(freshInk, "bay_boats", [1]);
      expect(beforeSue.firstChoices).toEqual([
        "Take a row out to the sunny cove",
        "Stay by the pier",
      ]);

      // Once Sue joins: choice 0 stays sunny cove, choice 1 rows to Starlight Island, 2 stays.
      const withSue = setInkVariables(freshInk, { sue_joined: true });
      const cove = runKnot(withSue, "bay_boats", [0]);
      expect(cove.firstChoices).toEqual([
        "Take a row out to the sunny cove",
        "Row out to Starlight Island!",
        "Stay by the pier",
      ]);
      expect(cove.tags).toContain("gift: coins 10");
      expect(world.storyVariable(cove.ink, "bay_boat_charm")).toBe(true);

      const sail = runKnot(withSue, "bay_boats", [1]);
      expect(sail.tags).toContain("travel: island.pier");
      expect(sail.sounds).toContain("chime-blue");

      const stay = runKnot(withSue, "bay_boats", [2]);
      expect(stay.tags).toEqual([]);
    });

  it("rows cleanly round-trip from Bubblegum Bay bay-boats to Starlight Island and back", () => {
    const bayFixture = fixtures.bay;
    if (bayFixture === undefined) throw new Error("bay fixture missing");
    const baseBay = createState(world, bayFixture);
    let state: State = {
      ...baseBay,
      player: { x: 1350, y: 690 },
      facing: "up",
      ink: setInkVariables(baseBay.ink, { sue_joined: true }),
    };
    expect(targetInteractable(world, state)?.id).toBe("bay-boats");
    state = step(world, state, { ...none, confirm: true }).state;
    expect(state.dialogue?.knot).toBe("bay_boats");
    state = advanceDialogue(state, [1]);
    expect(state.area).toBe("island");
    expect(state.player).toEqual({
      x: island.spawns.pier?.x,
      y: island.spawns.pier?.y,
    });

    // Row back from island-boat on the SW landing pier to bay.boats!
    let atPier: State = {
      ...state,
      player: { x: 405, y: 810 },
      facing: "left",
    };
    expect(targetInteractable(world, atPier)?.id).toBe("island-boat");
    atPier = step(world, atPier, { ...none, confirm: true }).state;
    expect(atPier.dialogue?.knot).toBe("island_boat");
    atPier = advanceDialogue(atPier, [0]);
    expect(atPier.area).toBe("bay");
    expect(atPier.player).toEqual({ x: 1450, y: 685 });
  });

  it("delivers 4-note seashell puzzle + flute bonus, lighthouse snacks, bottle, glow & no spoilers",
    () => {
      const islandFixture = fixtures.island;
      if (islandFixture === undefined) throw new Error("island fixture missing");
      const base = createState(world, islandFixture);
      const partyInk = setInkVariables(base.ink, {
        sue_joined: true,
        jordan_joined: true,
        has_lantern: true,
        has_flute: true,
      });

      // Seashell chime puzzle: playful chord first (choice 1), then 4-note harmony (choice 0).
      const shellsSolved = runKnot(partyInk, "island_shells", [1, 0]);
      expect(shellsSolved.firstChoices).toEqual([
        "Tap the shells from left to right: Red, Yellow, Green, Blue!",
        "Tap a playful random chord",
        "Just listen to the waves",
      ]);
      expect(world.storyVariable(shellsSolved.ink, "island_shells_solved")).toBe(true);
      expect(shellsSolved.sounds).toEqual([
        "chime-yellow",
        "chime-red",
        "chime-yellow",
        "chime-green",
        "chime-blue",
      ]);
      expect(shellsSolved.tags).toContain("gift: coins 20");
      expect(shellsSolved.lines.join(" ")).toContain("silver flute");
      expect(shellsSolved.lines.join(" ")).toContain("Tide-Pool Pearl Cache");

      // Without flute: still solves cleanly without the flute bonus line.
      const noFluteInk = setInkVariables(partyInk, { has_flute: false });
      const noFlute = runKnot(noFluteInk, "island_shells", [0]);
      expect(noFlute.tags).toContain("gift: coins 20");
      expect(noFlute.lines.join(" ")).not.toContain("silver flute");

      // Post-solve replay: plays all 4 chimes again with ZERO extra coins!
      const replay = runKnot(shellsSolved.ink, "island_shells", [0]);
      expect(replay.firstChoices).toEqual([
        "Play the four-note seashell harmony again",
        "Just listen to the waves",
      ]);
      expect(replay.sounds).toEqual(["chime-red", "chime-yellow", "chime-green", "chime-blue"]);
      expect(replay.tags.some((tag) => tag.startsWith("gift:"))).toBe(false);

      // Tide-Pool Lighthouse: sets island_visited + island_lighthouse_checked + 2 snacks once!
      const lighthouseFirst = runKnot(partyInk, "island_lighthouse");
      expect(world.storyVariable(lighthouseFirst.ink, "island_visited")).toBe(true);
      expect(world.storyVariable(lighthouseFirst.ink, "island_lighthouse_checked")).toBe(true);
      expect(lighthouseFirst.tags).toContain("gift: snack 2");
      expect(lighthouseFirst.sounds).toContain("chime-yellow");
      expect(lighthouseFirst.lines.join(" ")).toContain("Lighthouse Sea-Breeze Snack Tin");
      expect(runKnot(lighthouseFirst.ink, "island_lighthouse").tags).toEqual([]);

      // Message-in-a-Bottle: sets island_bottle_found + 15 coins + chime-green once!
      const bottleFirst = runKnot(partyInk, "island_bottle");
      expect(world.storyVariable(bottleFirst.ink, "island_bottle_found")).toBe(true);
      expect(bottleFirst.tags).toContain("gift: coins 15");
      expect(bottleFirst.sounds).toContain("chime-green");
      expect(bottleFirst.lines.join(" ")).toContain("old Bubblegum Bay explorer");
      expect(runKnot(bottleFirst.ink, "island_bottle").tags).toEqual([]);

      // Blacklight Starlight Runes: targetable only with lantern on, +10 coins + chime-red once!
      const nearGlow: State = {
        ...base,
        player: { x: 980, y: 484 },
        facing: "up",
        lantern: false,
      };
      expect(targetInteractable(world, nearGlow)).toBeUndefined();
      expect(targetInteractable(world, { ...nearGlow, lantern: true })?.id).toBe(
        "glow:island-beacon-glow",
      );
      const glowFirst = runKnot(partyInk, "island_beacon_glow");
      expect(world.storyVariable(glowFirst.ink, "island_glow_read")).toBe(true);
      expect(glowFirst.tags).toContain("gift: coins 10");
      expect(glowFirst.sounds).toContain("chime-red");
      expect(glowFirst.lines.join(" ")).toContain("STARLIGHT BEACON VERSE");
      expect(runKnot(glowFirst.ink, "island_beacon_glow").tags).toEqual([]);

      // CRITICAL STORY RULE: ZERO Milo spoilers before calmed("hooded-kid")!
      const preFinaleOutputs = [
        runKnot(partyInk, "island_boat", [1]).lines.join(" "),
        runKnot(partyInk, "island_shells", [1, 0]).lines.join(" "),
        runKnot(partyInk, "island_lighthouse").lines.join(" "),
        runKnot(partyInk, "island_bottle").lines.join(" "),
        runKnot(partyInk, "island_beacon_glow").lines.join(" "),
      ];
      for (const text of preFinaleOutputs) {
        expect(text).not.toMatch(/\bMilo\b/i);
      }

      // Journal notes for visiting Starlight Island & solving the 4-note Seashell Chime.
      const journalState: State = {
        ...base,
        ink: setInkVariables(partyInk, { island_visited: true, island_shells_solved: true }),
      };
      const notes = journalNotes(world, journalState);
      expect(notes.some((line) => line.includes("Starlight Island") && line.includes("Lighthouse")))
        .toBe(true);
      expect(notes.some((line) => line.includes("four giant pastel seashells"))).toBe(true);
      for (const line of notes.filter((n) => n.includes("Starlight Island"))) {
        expect(line).not.toMatch(/\bMilo\b/i);
      }
    });

  it("configures lighthouse halo + water glints atmosphere, time-of-day, audio, surfaces & mat",
    () => {
      const islandFixture = fixtures.island;
      if (islandFixture === undefined) throw new Error("island fixture missing");
      const islandState = createState(world, islandFixture);

      // Soundtrack: island theme + ocean ambience.
      expect(soundtrackFor(world, islandState, { titleOpen: false })).toEqual({
        track: "island",
        ambience: "ocean",
        duck: false,
        title: "Starlight Beacon",
      });

      // Time-of-day: golden-hour with has_lantern, neutral day without.
      expect(storyTimeOfDay(world, islandState).phase).toBe("golden-hour");
      const noLantern: State = {
        ...islandState,
        ink: setInkVariables(islandState.ink, { has_lantern: false }),
      };
      expect(storyTimeOfDay(world, noLantern).phase).toBe("day");

      // Atmosphere: emissive lighthouse halo at (1260, 152), 14 water glints, 10 sea-breeze motes.
      const particles = evaluateAtmosphere("island", island.width, island.height, 120);
      const beaconHalos = particles.filter(
        (p) => p.layer === "emissive" && p.texture === "softGlow",
      );
      const glints = particles.filter((p) => p.texture === "waterGlint");
      const motes = particles.filter((p) => p.texture === "sparkle");
      expect(beaconHalos).toHaveLength(2);
      for (const halo of beaconHalos) {
        expect(halo.x).toBe(1260);
        expect(halo.y).toBe(152);
      }
      expect(glints).toHaveLength(14);
      expect(motes).toHaveLength(10);
      expect(evaluateAtmosphere("island", island.width, island.height, 0, { reducedMotion: true }))
        .toEqual(
          evaluateAtmosphere("island", island.width, island.height, 240, { reducedMotion: true }),
        );

      // Surface map: sand default, wood on pier, carpet on woven beach mat, grass on meadow/bluff.
      const surface = world.surfaces.island;
      if (surface === undefined) throw new Error("island surface missing");
      expect(surfaceAt(surface, { x: 560, y: 700 })).toBe("sand");
      expect(surfaceAt(surface, { x: 365, y: 830 })).toBe("wood");
      expect(surfaceAt(surface, { x: 1160, y: 796 })).toBe("carpet");
      expect(surfaceAt(surface, { x: 820, y: 580 })).toBe("grass");
      expect(surfaceAt(surface, { x: 1180, y: 440 })).toBe("grass");

      // Companion rest spot island-mat resolves cleanly in all 4 directions without conflict.
      const spot = REST_SPOTS.find((item) => item.id === "island-mat");
      if (spot === undefined) throw new Error("island-mat rest spot missing");
      const directions: readonly Direction[] = ["up", "down", "left", "right"];
      for (const facing of directions) {
        const atSpot: State = {
          ...islandState,
          player: { x: spot.x, y: spot.y },
          facing,
          party: [],
        };
        expect(targetInteractable(world, atSpot), `facing ${facing}`).toBeUndefined();
        expect(findRestSpot(world, atSpot)?.id, `facing ${facing}`).toBe("island-mat");
      }
    });
});
