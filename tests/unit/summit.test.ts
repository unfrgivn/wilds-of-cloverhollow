import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  areaConnectionErrors,
  hiddenPositions,
  propBlockerErrors,
  propDrawingErrors,
} from "../../src/content/area-checks";
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
const pass = world.areas.pass;
const summit = world.areas.summit;
if (pass === undefined || summit === undefined) {
  throw new Error("pass or summit area missing");
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

describe("Alpine Summit Overlook & Rideable Pinecone Pass Ski Lift", () => {
  it("passes geometry, prop, hiding, and connection checks across all 32 areas", () => {
    expect(Object.keys(world.areas).length).toBeGreaterThanOrEqual(32);

    expect(summit.name).toBe("Alpine Summit Overlook");
    expect(summit.land).toBe("pass");
    expect(summit.width).toBe(1650);
    expect(summit.height).toBe(1100);
    expect(summit.triggers).toEqual([]);
    expect(summit.interactables.map((item) => item.id)).toEqual([
      "summit-lift",
      "summit-telescope",
      "summit-thermos",
      "summit-cabin",
    ]);
    expect(summit.glows.map((glow) => glow.id)).toEqual([
      "summit-aurora-1",
      "summit-aurora-2",
      "summit-aurora-3",
      "summit-cairn-glow",
    ]);
    expect(summit.props.map((prop) => prop.id)).toEqual(["stone-cairn", "bench-thermos"]);
    expect(pass.spawns["ski-lift"]).toEqual({ x: 485, y: 490, facing: "down" });

    expect(
      areaConnectionErrors(world.areas, world.tunables, world.critters, world.party),
    ).toEqual([]);
    for (const room of [summit, pass]) {
      expect(propDrawingErrors(room), room.id).toEqual([]);
      expect(propBlockerErrors(room), room.id).toEqual([]);
      expect(hiddenPositions(room, world.tunables.playerRadius), room.id).toEqual([]);
    }
  });

  it("preserves the lasso scarf quest before offering the summit ride after lodge-keeper", () => {
    const passFixture = fixtures.pass;
    if (passFixture === undefined) throw new Error("pass fixture missing");
    const freshInk = createState(world, passFixture).ink;

    // Early pass: just creaking chairs.
    const early = runKnot(freshInk, "ski_lift");
    expect(early.lines).toEqual([
      "The ski lift creaks along its cable, the empty chairs swinging.",
    ]);
    expect(early.firstChoices).toEqual([]);

    // Has lasso, scarf not down yet, EVEN WITH lodge-keeper calmed -> scarf quest takes priority!
    const withLassoInk = setInkVariables(freshInk, { has_lasso: true, scarf_down: false });
    const scarfFirst = runKnot(withLassoInk, "ski_lift", [0], { "lodge-keeper": true });
    expect(scarfFirst.firstChoices).toEqual(["Lasso it down", "Leave it"]);
    expect(world.storyVariable(scarfFirst.ink, "scarf_down")).toBe(true);

    // After lodge-keeper is calmed (and no stuck scarf): ride up to Alpine Summit Overlook!
    const ride = runKnot(scarfFirst.ink, "ski_lift", [0], { "lodge-keeper": true });
    expect(ride.firstChoices).toEqual(["Ride up to Alpine Summit!", "Stay at Pinecone Pass"]);
    expect(ride.tags).toContain("travel: summit.lift-top");
    expect(ride.sounds).toContain("chime-blue");

    // Staying leaves Fae at Pinecone Pass.
    const stay = runKnot(scarfFirst.ink, "ski_lift", [1], { "lodge-keeper": true });
    expect(stay.tags).toEqual([]);
  });

  it("rides cleanly round-trip from Pinecone Pass ski-lift up to summit and back down", () => {
    const passFixture = fixtures["pass-party"];
    if (passFixture === undefined) throw new Error("pass-party fixture missing");
    const basePass = createState(world, passFixture);
    let state: State = {
      ...basePass,
      player: { x: 500, y: 455 },
      facing: "up",
      calms: { ...basePass.calms, "lodge-keeper": 1 },
      stickers: [...basePass.stickers, "lodge-keeper"],
    };
    expect(targetInteractable(world, state)?.id).toBe("ski-lift");
    state = step(world, state, { ...none, confirm: true }).state;
    expect(state.dialogue?.knot).toBe("ski_lift");
    state = advanceDialogue(state, [0]);
    expect(state.area).toBe("summit");
    expect(state.player).toEqual({
      x: summit.spawns["lift-top"]?.x,
      y: summit.spawns["lift-top"]?.y,
    });

    // Ride back down from summit-lift to pass.ski-lift!
    let atLift: State = {
      ...state,
      player: { x: 465, y: 875 },
      facing: "left",
    };
    expect(targetInteractable(world, atLift)?.id).toBe("summit-lift");
    atLift = step(world, atLift, { ...none, confirm: true }).state;
    expect(atLift.dialogue?.knot).toBe("summit_lift");
    atLift = advanceDialogue(atLift, [0]);
    expect(atLift.area).toBe("pass");
    expect(atLift.player).toEqual({ x: 485, y: 490 });
  });

  it("delivers panoramic telescope views, cocoa thermos, cabin plaque, aurora glow, no spoilers",
    () => {
      const summitFixture = fixtures.summit;
      if (summitFixture === undefined) throw new Error("summit fixture missing");
      const base = createState(world, summitFixture);
      const partyInk = setInkVariables(base.ink, { sue_joined: true, jordan_joined: true });

      // Panoramic telescope: first use sets flags + 10 coins + chime-yellow, sticky 4-way menu!
      const teleFirst = runKnot(partyInk, "summit_telescope", [0, 1, 2, 3]);
      expect(world.storyVariable(teleFirst.ink, "summit_visited")).toBe(true);
      expect(world.storyVariable(teleFirst.ink, "summit_telescope_used")).toBe(true);
      expect(teleFirst.tags).toContain("gift: coins 10");
      expect(teleFirst.sounds).toContain("chime-yellow");
      expect(teleFirst.firstChoices).toEqual([
        "Look south toward Cloverhollow",
        "Look east toward Bubblegum Bay",
        "Look west toward Whispering Woods & the Ancient Tree",
        "Step back from the telescope",
      ]);
      const teleJoined = teleFirst.lines.join(" ");
      expect(teleJoined).toContain("Bon Appetit Cafe");
      expect(teleJoined).toContain("wooden fishing dock");
      expect(teleJoined).toContain("Ancient Tree");
      expect(teleJoined).toContain("violet shimmer");

      // Revisit awards no extra coins, and post-finale west view warmly celebrates calm valley!
      const teleAgain = runKnot(teleFirst.ink, "summit_telescope", [2, 3], { "hooded-kid": true });
      expect(teleAgain.tags).toEqual([]);
      expect(teleAgain.lines.join(" ")).toContain("Milo");

      // Warming-hut cocoa thermos: +2 snacks + chime-green once!
      const cocoaFirst = runKnot(partyInk, "summit_thermos");
      expect(world.storyVariable(cocoaFirst.ink, "summit_cocoa_taken")).toBe(true);
      expect(cocoaFirst.tags).toContain("gift: snack 2");
      expect(cocoaFirst.sounds).toContain("chime-green");
      expect(cocoaFirst.lines.join(" ")).toContain("Mrs. Flurry");
      expect(runKnot(cocoaFirst.ink, "summit_thermos").tags).toEqual([]);

      // Warming cabin plaque.
      const cabinText = runKnot(partyInk, "summit_cabin").lines.join(" ");
      expect(cabinText).toContain("cedar smoke");
      expect(cabinText).toContain("stone cairn");

      // Blacklight aurora cairn: targetable only with lantern on, +15 coins + chime-red once!
      const nearCairn: State = {
        ...base,
        player: { x: 565, y: 560 },
        facing: "left",
        lantern: false,
      };
      expect(targetInteractable(world, nearCairn)).toBeUndefined();
      expect(targetInteractable(world, { ...nearCairn, lantern: true })?.id).toBe(
        "glow:summit-cairn-glow",
      );
      const auroraFirst = runKnot(partyInk, "summit_cairn_glow");
      expect(world.storyVariable(auroraFirst.ink, "summit_aurora_read")).toBe(true);
      expect(auroraFirst.tags).toContain("gift: coins 15");
      expect(auroraFirst.sounds).toContain("chime-red");
      expect(auroraFirst.lines.join(" ")).toContain("lavender and gold light");
      expect(runKnot(auroraFirst.ink, "summit_cairn_glow").tags).toEqual([]);

      // CRITICAL STORY RULE: ZERO Milo spoilers before calmed("hooded-kid")!
      const preFinaleOutputs = [
        runKnot(partyInk, "summit_lift", [1]).lines.join(" "),
        runKnot(partyInk, "summit_telescope", [0, 1, 2, 3]).lines.join(" "),
        runKnot(partyInk, "summit_thermos").lines.join(" "),
        runKnot(partyInk, "summit_cabin").lines.join(" "),
        runKnot(partyInk, "summit_cairn_glow").lines.join(" "),
      ];
      for (const text of preFinaleOutputs) {
        expect(text).not.toMatch(/\bMilo\b/i);
      }

      // Journal notes for visiting summit & reading aurora cairn.
      const journalState: State = {
        ...base,
        ink: setInkVariables(partyInk, { summit_visited: true, summit_aurora_read: true }),
      };
      const notes = journalNotes(world, journalState);
      expect(notes.some((line) => line.includes("Alpine Summit Overlook"))).toBe(true);
      expect(notes.some((line) => line.includes("aurora runes"))).toBe(true);
      for (const line of notes.filter((n) => n.includes("Alpine Summit"))) {
        expect(line).not.toMatch(/\bMilo\b/i);
      }
    });

  it("configures aurora + snow + chimney atmosphere, time-of-day, audio, surfaces & rest spot",
    () => {
      const summitFixture = fixtures.summit;
      if (summitFixture === undefined) throw new Error("summit fixture missing");
      const summitState = createState(world, summitFixture);

      // Soundtrack: pass theme + mountain-wind ambience.
      expect(soundtrackFor(world, summitState, { titleOpen: false })).toEqual({
        track: "pass",
        ambience: "mountain-wind",
        duck: false,
        title: "Pinecone Snowfall",
      });

      // Time-of-day: golden-hour with has_lantern, neutral day without.
      expect(storyTimeOfDay(world, summitState).phase).toBe("golden-hour");
      const noLantern: State = {
        ...summitState,
        ink: setInkVariables(summitState.ink, { has_lantern: false }),
      };
      expect(storyTimeOfDay(world, noLantern).phase).toBe("day");

      // Atmosphere: aurora softGlow + sunbeam in y=70..220, snow petals, 6 chimney smoke wisps.
      const particles = evaluateAtmosphere("summit", summit.width, summit.height, 120);
      const auroraGlows = particles.filter(
        (p) => p.layer === "emissive" && p.texture === "softGlow",
      );
      const auroraBeams = particles.filter(
        (p) => p.layer === "emissive" && p.texture === "sunbeam",
      );
      const flakes = particles.filter((p) => p.texture === "petal");
      const smoke = particles.filter((p) => p.texture === "mistWisp");
      expect(auroraGlows).toHaveLength(6);
      expect(auroraBeams).toHaveLength(3);
      expect(flakes).toHaveLength(22);
      expect(smoke).toHaveLength(6);
      for (const p of [...auroraGlows, ...auroraBeams]) {
        expect(p.y).toBeGreaterThanOrEqual(70);
        expect(p.y).toBeLessThanOrEqual(220);
      }
      for (const wisp of smoke) {
        expect(wisp.x).toBeGreaterThanOrEqual(1445);
        expect(wisp.y).toBeLessThanOrEqual(380);
      }
      expect(evaluateAtmosphere("summit", summit.width, summit.height, 0, { reducedMotion: true }))
        .toEqual(
          evaluateAtmosphere("summit", summit.width, summit.height, 240, { reducedMotion: true }),
        );

      // Surface map: snow default, stone under cabin steps & cairn, wood on ski-lift deck.
      const surface = world.surfaces.summit;
      if (surface === undefined) throw new Error("summit surface missing");
      expect(surfaceAt(surface, { x: 800, y: 600 })).toBe("snow");
      expect(surfaceAt(surface, { x: 1200, y: 740 })).toBe("stone");
      expect(surfaceAt(surface, { x: 436, y: 550 })).toBe("stone");
      expect(surfaceAt(surface, { x: 410, y: 865 })).toBe("wood");

      // Companion rest spot summit-bench resolves cleanly in all 4 directions without conflict.
      const spot = REST_SPOTS.find((item) => item.id === "summit-bench");
      if (spot === undefined) throw new Error("summit-bench rest spot missing");
      const directions: readonly Direction[] = ["up", "down", "left", "right"];
      for (const facing of directions) {
        const atSpot: State = {
          ...summitState,
          player: { x: spot.x, y: spot.y },
          facing,
          party: [],
        };
        expect(targetInteractable(world, atSpot), `facing ${facing}`).toBeUndefined();
        expect(findRestSpot(world, atSpot)?.id, `facing ${facing}`).toBe("summit-bench");
      }
    });
});
