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
  rollWild,
  runInk,
  setInkVariables,
  soundtrackFor,
  step,
  surfaceAt,
  targetInteractable,
  type ActionFrame,
  type State,
} from "../../src/core";
import { voiceForSpeaker } from "../../src/platform/voices";
import { evaluateAtmosphere } from "../../src/render/atmosphere";
import { findRestSpot, REST_SPOTS } from "../../src/render/companions";
import {
  ADULT_NPCS,
  computeNpcOverworldHeight,
  computeNpcShadow,
  INDOOR_AREAS,
} from "../../src/render/overworld-render";
import { NEUTRAL_POSE } from "../../src/render/motion";
import { speakerAccent, speakerPortraitSource } from "../../src/ui/portraits";

const { world, fixtures } = loadContent();
const plaza = world.areas.plaza;
const market = world.areas.market;
const parlor = world.areas.parlor;
if (plaza === undefined || market === undefined || parlor === undefined) {
  throw new Error("plaza, market, or parlor missing");
}

const none: ActionFrame = blankInput();

function runKnot(
  ink: string,
  knot: string,
  choices: readonly number[] = [],
  coins = 40,
): {
  ink: string;
  lines: string[];
  sounds: string[];
  tags: string[];
  offered: string[][];
} {
  const facts = {
    calmed: {},
    coins,
    snacks: 2,
    prizes: [],
    plushesLeft: 0,
    tickets: 0,
  };
  let result = runInk(world.story, ink, { type: "start", knot }, facts);
  const lines: string[] = [];
  const sounds: string[] = [];
  const tags: string[] = [];
  const offered: string[][] = [];
  let cursor = 0;
  const collect = (): void => {
    if (result.line !== null) {
      lines.push(result.line.text);
      if (result.line.sound !== undefined) sounds.push(result.line.sound);
      tags.push(...result.line.tags);
    }
  };
  collect();
  for (let guard = 0; guard < 40 && !result.ended; guard += 1) {
    if (result.choices.length > 0) {
      offered.push([...result.choices]);
      const pick = choices[cursor] ?? result.choices.length - 1;
      cursor += 1;
      result = runInk(world.story, result.ink, { type: "choose", index: pick }, facts);
    } else {
      result = runInk(world.story, result.ink, { type: "next" }, facts);
    }
    collect();
  }
  return { ink: result.ink, lines, sounds, tags, offered };
}

describe("Cloverhollow's Final Two Plaza Shops: Market & Ice Cream Parlor", () => {
  it("passes geometry, prop, hiding, and connection checks across all 29 areas", () => {
    expect(Object.keys(world.areas).length).toBeGreaterThanOrEqual(29);
    expect(market.name).toBe("Cloverhollow Grocery Market");
    expect(market.land).toBe("cloverhollow");
    expect(market.width).toBe(1200);
    expect(market.height).toBe(800);
    expect(market.npcs.map((npc) => npc.id)).toEqual(["pippin", "marigold"]);
    expect(market.interactables.map((item) => item.id)).toEqual([
      "market-produce",
      "market-shelves",
      "market-berries",
    ]);
    expect(market.glows.map((glow) => glow.id)).toEqual(["market-list-glow"]);
    expect(market.props.map((prop) => prop.id)).toEqual(["produce-island", "berry-barrel"]);

    expect(parlor.name).toBe("Sweet Scoop Ice Cream Parlor");
    expect(parlor.land).toBe("cloverhollow");
    expect(parlor.width).toBe(1200);
    expect(parlor.height).toBe(800);
    expect(parlor.npcs.map((npc) => npc.id)).toEqual(["penny", "danny"]);
    expect(parlor.interactables.map((item) => item.id)).toEqual([
      "parlor-gelato",
      "parlor-menu",
      "parlor-window",
    ]);
    expect(parlor.glows.map((glow) => glow.id)).toEqual(["parlor-secret-glow"]);
    expect(parlor.props.map((prop) => prop.id)).toEqual(["table-west", "table-east"]);

    // Plaza door triggers & return spawns stay clear of sidewalk grocery & ice-cream windows.
    expect(plaza.interactables.find((item) => item.id === "grocery")?.point)
      .toEqual({ x: 655, y: 345 });
    expect(plaza.interactables.find((item) => item.id === "ice-cream")?.point)
      .toEqual({ x: 895, y: 340 });
    expect(plaza.triggers.find((trigger) => trigger.id === "market-door")?.target)
      .toEqual({ area: "market", spawn: "door" });
    expect(plaza.triggers.find((trigger) => trigger.id === "parlor-door")?.target)
      .toEqual({ area: "parlor", spawn: "door" });
    expect(plaza.spawns["market-door"]).toEqual({ x: 685, y: 415, facing: "down" });
    expect(plaza.spawns["parlor-door"]).toEqual({ x: 948, y: 410, facing: "down" });

    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party))
      .toEqual([]);
    for (const room of [market, parlor]) {
      expect(propDrawingErrors(room), room.id).toEqual([]);
      expect(propBlockerErrors(room), room.id).toEqual([]);
      expect(hiddenPositions(room, world.tunables.playerRadius), room.id).toEqual([]);
    }
  });

  it("steps cleanly between plaza doors and both shop interiors, keeping exit dens quiet", () => {
    const plazaFixture = fixtures.plaza;
    if (plazaFixture === undefined) throw new Error("plaza fixture missing");

    // Enter market through market-door from north plaza apron.
    let enteringMarket: State = {
      ...createState(world, plazaFixture),
      player: { x: 695, y: 376 },
      facing: "up",
    };
    for (let tick = 0; tick < 60 && enteringMarket.area === "plaza"; tick += 1) {
      const move = enteringMarket.transition === null ? { x: 0, y: -1 } : { x: 0, y: 0 };
      enteringMarket = step(world, enteringMarket, { ...none, move }).state;
    }
    expect(enteringMarket.area).toBe("market");
    expect(enteringMarket.player).toEqual({
      x: market.spawns.door?.x,
      y: market.spawns.door?.y,
    });

    // Exit market back to plaza.market-door with fountain-frog calmed: den 0 stays quiet!
    let leavingMarket: State = {
      ...enteringMarket,
      critters: { ...enteringMarket.critters, "fountain-frog": "calm" },
      player: { x: 235, y: 505 },
      facing: "left",
    };
    for (let tick = 0; tick < 60 && leavingMarket.area === "market"; tick += 1) {
      const move = leavingMarket.transition === null ? { x: -1, y: -1 } : { x: 0, y: 0 };
      leavingMarket = step(world, leavingMarket, { ...none, move }).state;
    }
    expect(leavingMarket.area).toBe("plaza");
    expect(leavingMarket.player).toEqual({ x: 685, y: 415 });
    expect(leavingMarket.wild.some((critter) => critter.den === 0)).toBe(false);

    // Enter parlor through parlor-door from north plaza apron.
    let enteringParlor: State = {
      ...leavingMarket,
      player: { x: 938, y: 374 },
      facing: "up",
    };
    for (let tick = 0; tick < 60 && enteringParlor.area === "plaza"; tick += 1) {
      const move = enteringParlor.transition === null ? { x: 0, y: -1 } : { x: 0, y: 0 };
      enteringParlor = step(world, enteringParlor, { ...none, move }).state;
    }
    expect(enteringParlor.area).toBe("parlor");
    expect(enteringParlor.player).toEqual({
      x: parlor.spawns.door?.x,
      y: parlor.spawns.door?.y,
    });

    // Exit parlor back to plaza.parlor-door: den 0 stays quiet!
    let leavingParlor: State = {
      ...enteringParlor,
      player: { x: 215, y: 515 },
      facing: "left",
    };
    for (let tick = 0; tick < 60 && leavingParlor.area === "parlor"; tick += 1) {
      const move = leavingParlor.transition === null ? { x: -1, y: -1 } : { x: 0, y: 0 };
      leavingParlor = step(world, leavingParlor, { ...none, move }).state;
    }
    expect(leavingParlor.area).toBe("plaza");
    expect(leavingParlor.player).toEqual({ x: 948, y: 410 });
    expect(leavingParlor.wild.some((critter) => critter.den === 0)).toBe(false);

    // Direct rollWild check: arriving at market-door suppresses den 0 while still advancing rng.
    const quietStart: State = {
      ...createState(world, { area: "plaza", spawn: "market-door", seed: 7 }),
      critters: { "fountain-frog": "calm" },
    };
    const rolled = rollWild(world, quietStart, plaza);
    expect(rolled.wild.some((critter) => critter.den === 0)).toBe(false);
    expect(rolled.rng).not.toBe(quietStart.rng);
  });

  it("delivers Grocer Pippin's sample, sticky treat shop, looks, and blacklight note", () => {
    const base = createState(world, fixtures["new-game"]!);
    const withLantern = setInkVariables(base.ink, { has_lantern: true });

    // First visit: free apple sample + buy Orchard Apple (choice 0).
    const first = runKnot(withLantern, "grocer_pippin", [0]);
    expect(world.storyVariable(first.ink, "market_visited")).toBe(true);
    expect(first.tags).toContain("gift: snack 1");
    expect(first.tags).toContain("buy-treat: orchard-apple 8");
    expect(first.offered[0]).toEqual([
      "Orchard Apple — 8 coins (sweet critters love it!)",
      "Fish Cracker — 8 coins (pond & bay friends love it!)",
      "Trail Snack — 5 coins",
      "Just browsing!",
    ]);

    // Repeat visit: no second free sample; sticky choices still offer Fish Cracker & Trail Snack.
    const repeatFish = runKnot(first.ink, "grocer_pippin", [1]);
    expect(repeatFish.tags).not.toContain("gift: snack 1");
    expect(repeatFish.tags).toContain("buy-treat: fish-cracker 8");
    const repeatSnack = runKnot(repeatFish.ink, "grocer_pippin", [2]);
    expect(repeatSnack.tags).toContain("buy: snack 5");

    // Look spots & blacklight glow note.
    expect(runKnot(withLantern, "market_produce").lines.join(" ")).toContain("apples");
    expect(runKnot(withLantern, "market_shelves").lines.join(" ")).toContain("strawberry jam");
    expect(runKnot(withLantern, "market_berries").lines.join(" ")).toContain("blacklight lantern");

    const noteFirst = runKnot(withLantern, "market_list_glow");
    expect(world.storyVariable(noteFirst.ink, "market_note_read")).toBe(true);
    expect(noteFirst.lines.join(" ")).toContain("SECRET ORCHARD TIP");
    expect(noteFirst.tags).toContain("gift: coins 10");
    expect(noteFirst.sounds).toContain("chime-yellow");
    expect(runKnot(noteFirst.ink, "market_list_glow").tags).toEqual([]);

    // Blacklight glow is only targetable while lantern is switched on.
    const marketFixture = fixtures.market;
    if (marketFixture === undefined) throw new Error("market fixture missing");
    const nearGlow: State = {
      ...createState(world, marketFixture),
      player: { x: 505, y: 440 },
      facing: "up",
      lantern: false,
    };
    expect(targetInteractable(world, nearGlow)).toBeUndefined();
    expect(targetInteractable(world, { ...nearGlow, lantern: true })?.id)
      .toBe("glow:market-list-glow");
  });

  it("delivers Scooper Penny's Dream Sundae tasting, sticky treat shop, looks, and glow", () => {
    const base = createState(world, fixtures["new-game"]!);
    const withTeam = setInkVariables(base.ink, {
      sue_joined: true,
      jordan_joined: true,
      has_lantern: true,
    });

    // Test all three Dream Sundae flavors on first visit!
    for (const [flavorIndex, keyword] of [
      [0, "Strawberry Swirl"],
      [1, "Mint Cloud Chip"],
      [2, "Warm Honey Caramel"],
    ] as const) {
      const visit = runKnot(withTeam, "scooper_penny", [flavorIndex, 2]);
      expect(world.storyVariable(visit.ink, "parlor_visited")).toBe(true);
      expect(visit.lines.join(" ")).toContain(keyword);
      expect(visit.tags).toContain("gift: snack 1");
      expect(visit.sounds).toContain("chime-blue");
      expect(visit.offered[0]).toEqual([
        "Strawberry Swirl!",
        "Mint Cloud Chip!",
        "Warm Honey Caramel!",
      ]);
      expect(visit.offered[1]).toEqual([
        "Berry Swirl Cone — 10 coins (sunny friends & shopkeepers love it!)",
        "Cozy Cocoa Sundae — 12 coins (cozy winter & cave friends love it!)",
        "Just admiring the flavors!",
      ]);
    }

    // Repeat visit: buys Berry Swirl Cone (10) and Cozy Cocoa Sundae (12) without re-gifting.
    const afterFirst = runKnot(withTeam, "scooper_penny", [0, 0]);
    expect(afterFirst.tags).toContain("buy-treat: berry-cone 10");
    const repeatCocoa = runKnot(afterFirst.ink, "scooper_penny", [1]);
    expect(repeatCocoa.tags).not.toContain("gift: snack 1");
    expect(repeatCocoa.tags).toContain("buy-treat: cocoa-sundae 12");

    // Look spots & blacklight glow doodle.
    expect(runKnot(withTeam, "parlor_gelato").lines.join(" ")).toContain("Seven pastel tubs");
    expect(runKnot(withTeam, "parlor_menu").lines.join(" ")).toContain("Rainbow Bowls");
    expect(runKnot(withTeam, "parlor_window").lines.join(" ")).toContain("Secret Sundae Club");

    const glowFirst = runKnot(withTeam, "parlor_secret_glow");
    expect(world.storyVariable(glowFirst.ink, "parlor_note_read")).toBe(true);
    expect(glowFirst.lines.join(" ")).toContain("SCOOP MASTER SECRET");
    expect(glowFirst.tags).toContain("gift: coins 10");
    expect(glowFirst.sounds).toContain("chime-yellow");
    expect(runKnot(glowFirst.ink, "parlor_secret_glow").tags).toEqual([]);

    // Blacklight glow is only targetable while lantern is switched on.
    const parlorFixture = fixtures.parlor;
    if (parlorFixture === undefined) throw new Error("parlor fixture missing");
    const nearGlow: State = {
      ...createState(world, parlorFixture),
      player: { x: 865, y: 632 },
      facing: "right",
      lantern: false,
    };
    expect(targetInteractable(world, nearGlow)).toBeUndefined();
    expect(targetInteractable(world, { ...nearGlow, lantern: true })?.id)
      .toBe("glow:parlor-secret-glow");
  });

  it("configures atmosphere, soundtrack, surfaces, adult NPCs, voices, portraits, rest & journal",
    () => {
      // Surfaces
      expect(surfaceAt(world.surfaces.market!, { x: 315, y: 535 })).toBe("wood");
      expect(surfaceAt(world.surfaces.market!, { x: 215, y: 505 })).toBe("carpet");
      expect(surfaceAt(world.surfaces.market!, { x: 895, y: 568 })).toBe("carpet");
      expect(surfaceAt(world.surfaces.parlor!, { x: 280, y: 555 })).toBe("tile");
      expect(surfaceAt(world.surfaces.parlor!, { x: 185, y: 520 })).toBe("carpet");

      // Soundtrack
      const marketState = createState(world, fixtures.market!);
      const parlorState = createState(world, fixtures.parlor!);
      expect(soundtrackFor(world, marketState, { titleOpen: false })).toEqual({
        track: "market",
        ambience: "cafe-murmur",
        duck: false,
        title: "Pippin's Basket Waltz",
      });
      expect(soundtrackFor(world, parlorState, { titleOpen: false })).toEqual({
        track: "parlor",
        ambience: "cafe-murmur",
        duck: false,
        title: "Sweet Scoop Rag",
      });

      // Atmosphere
      const marketAtmo = evaluateAtmosphere("market", market.width, market.height, 90);
      expect(marketAtmo.filter((p) => p.texture === "sunbeam")).toHaveLength(2);
      expect(marketAtmo.filter((p) => p.texture === "sparkle")).toHaveLength(10);
      const parlorAtmo = evaluateAtmosphere("parlor", parlor.width, parlor.height, 90);
      expect(parlorAtmo.filter((p) => p.texture === "sunbeam")).toHaveLength(2);
      expect(parlorAtmo.filter((p) => p.texture === "sparkle")).toHaveLength(10);

      // Indoor rooms, adult NPCs, portraits, and distinct voices
      expect(INDOOR_AREAS.has("market")).toBe(true);
      expect(INDOOR_AREAS.has("parlor")).toBe(true);
      expect(ADULT_NPCS.has("pippin")).toBe(true);
      expect(ADULT_NPCS.has("penny")).toBe(true);
      const keepers = [...market.npcs, ...parlor.npcs].filter(
        (npc) => npc.id === "pippin" || npc.id === "penny",
      );
      for (const npc of keepers) {
        expect(computeNpcOverworldHeight(npc, undefined)).toBe(132);
        expect(computeNpcShadow(npc.id, npc.point, NEUTRAL_POSE, 0.24).width).toBe(52);
      }
      expect(speakerAccent("Grocer Pippin")).toBe("town");
      expect(speakerAccent("Scooper Penny")).toBe("town");
      expect(speakerPortraitSource(world, "Grocer Pippin")).toEqual({
        atlas: "assets/characters/pippin/pippin.json",
        frame: "down_idle_01",
        cropMode: "adult",
      });
      expect(speakerPortraitSource(world, "Scooper Penny")).toEqual({
        atlas: "assets/characters/penny/penny.json",
        frame: "down_idle_01",
        cropMode: "adult",
      });
      const fallback = voiceForSpeaker("Unknown Stranger");
      expect(voiceForSpeaker("Grocer Pippin")).not.toEqual(fallback);
      expect(voiceForSpeaker("Scooper Penny")).not.toEqual(fallback);
      expect(voiceForSpeaker("Grocer Pippin")).not.toEqual(voiceForSpeaker("Scooper Penny"));

      // Rest spots resolve cleanly with zero interactable conflict.
      for (const id of ["market-rug", "parlor-sunbeam"] as const) {
        const spot = REST_SPOTS.find((item) => item.id === id);
        if (spot === undefined) throw new Error(`Missing rest spot ${id}`);
        const base = spot.area === "market" ? marketState : parlorState;
        const atSpot: State = {
          ...base,
          player: { x: spot.x, y: spot.y },
          facing: spot.facing,
          party: [],
        };
        expect(targetInteractable(world, atSpot), id).toBeUndefined();
        expect(findRestSpot(world, atSpot)?.id, id).toBe(id);
      }

      // Journal notes & zero Milo mentions across every new knot!
      const visited: State = {
        ...marketState,
        ink: setInkVariables(marketState.ink, {
          market_visited: true,
          parlor_visited: true,
          sue_joined: true,
          jordan_joined: true,
          has_lantern: true,
        }),
      };
      const notes = journalNotes(world, visited);
      expect(notes.some((line) => line.includes("Cloverhollow Grocery Market"))).toBe(true);
      expect(notes.some((line) => line.includes("Sweet Scoop Ice Cream Parlor"))).toBe(true);
      expect(notes.join(" ")).not.toMatch(/\bMilo\b/i);

      const freshInk = createState(world, fixtures["new-game"]!).ink;
      for (const knot of [
        "grocer_pippin",
        "market_produce",
        "market_shelves",
        "market_berries",
        "market_list_glow",
        "scooper_penny",
        "parlor_gelato",
        "parlor_menu",
        "parlor_window",
        "parlor_secret_glow",
      ]) {
        expect(runKnot(freshInk, knot, [0, 0]).lines.join(" "), `${knot} fresh`)
          .not.toMatch(/\bMilo\b/i);
        expect(runKnot(visited.ink, knot, [0, 0]).lines.join(" "), `${knot} visited`)
          .not.toMatch(/\bMilo\b/i);
      }
    });
});
