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
  npcVisible,
  runInk,
  setInkVariables,
  soundtrackFor,
  step,
  surfaceAt,
  targetInteractable,
  type ActionFrame,
  type State,
} from "../../src/core";
import { evaluateAtmosphere } from "../../src/render/atmosphere";
import { findRestSpot, REST_SPOTS } from "../../src/render/companions";
import { INDOOR_AREAS } from "../../src/render/overworld-render";

const { world, fixtures } = loadContent();
const park = world.areas.park;
const miloHouse = world.areas["milo-house"];
const rosieCottage = world.areas["rosie-cottage"];
if (park === undefined || miloHouse === undefined || rosieCottage === undefined) {
  throw new Error("park, milo-house, or rosie-cottage missing");
}

const none: ActionFrame = blankInput();

function runKnot(
  ink: string,
  knot: string,
  calmed: Record<string, boolean> = {},
): { ink: string; lines: string[]; sounds: string[]; tags: string[] } {
  const facts = {
    calmed,
    coins: 20,
    snacks: 2,
    prizes: [],
    plushesLeft: 0,
    tickets: 0,
  };
  let result = runInk(world.story, ink, { type: "start", knot }, facts);
  const lines: string[] = [];
  const sounds: string[] = [];
  const tags: string[] = [];
  const collect = (): void => {
    if (result.line !== null) {
      lines.push(result.line.text);
      if (result.line.sound !== undefined) sounds.push(result.line.sound);
      tags.push(...result.line.tags);
    }
  };
  collect();
  for (let guard = 0; guard < 40 && !result.ended; guard += 1) {
    result = runInk(world.story, result.ink, { type: "next" }, facts);
    collect();
  }
  return { ink: result.ink, lines, sounds, tags };
}

describe("Other Kids' Houses: Milo's Sketch Loft & Rosie's Flower Cottage", () => {
  it("passes geometry, prop, hiding, and connection checks across all 31 areas", () => {
    expect(Object.keys(world.areas).length).toBeGreaterThanOrEqual(31);

    expect(miloHouse.name).toBe("Milo's Sketch Loft");
    expect(miloHouse.land).toBe("cloverhollow");
    expect(miloHouse.width).toBe(1200);
    expect(miloHouse.height).toBe(800);
    expect(miloHouse.interactables.map((item) => item.id)).toEqual([
      "milo-desk",
      "milo-bed",
      "milo-comics",
      "milo-cushion",
    ]);
    expect(miloHouse.glows.map((glow) => glow.id)).toEqual(["milo-loft-glow"]);
    expect(miloHouse.npcs.map((npc) => npc.id)).toEqual(["milo"]);
    expect(miloHouse.props.map((prop) => prop.id)).toEqual(["cushion-stack"]);

    expect(rosieCottage.name).toBe("Rosie's Flower Cottage");
    expect(rosieCottage.land).toBe("cloverhollow");
    expect(rosieCottage.width).toBe(1200);
    expect(rosieCottage.height).toBe(800);
    expect(rosieCottage.interactables.map((item) => item.id)).toEqual([
      "rosie-table",
      "rosie-bed",
      "rosie-plants",
    ]);
    expect(rosieCottage.glows.map((glow) => glow.id)).toEqual(["rosie-cottage-glow"]);
    expect(rosieCottage.npcs.map((npc) => npc.id)).toEqual(["rosie"]);
    expect(rosieCottage.props.map((prop) => prop.id)).toEqual(["rattan-stool"]);

    expect(park.triggers.find((trigger) => trigger.id === "milo-house")?.target).toEqual({
      area: "milo-house",
      spawn: "door",
    });
    expect(park.spawns["milo-house"]).toEqual({ x: 235, y: 465, facing: "right" });
    expect(park.triggers.find((trigger) => trigger.id === "rosie-cottage")?.target).toEqual({
      area: "rosie-cottage",
      spawn: "door",
    });
    expect(park.spawns["rosie-cottage"]).toEqual({ x: 490, y: 340, facing: "down" });

    expect(
      areaConnectionErrors(world.areas, world.tunables, world.critters, world.party),
    ).toEqual([]);
    for (const room of [miloHouse, rosieCottage, park]) {
      expect(propDrawingErrors(room), room.id).toEqual([]);
      expect(propBlockerErrors(room), room.id).toEqual([]);
      expect(hiddenPositions(room, world.tunables.playerRadius), room.id).toEqual([]);
    }
  });

  it("steps cleanly between Meadow Park and both neighborhood homes", () => {
    const parkFixture = fixtures.park;
    if (parkFixture === undefined) throw new Error("park fixture missing");

    // Enter Milo's Sketch Loft from Meadow Park's WNW fence gap.
    let enteringMilo: State = {
      ...createState(world, parkFixture),
      player: { x: 185, y: 475 },
      facing: "left",
    };
    for (let tick = 0; tick < 60 && enteringMilo.area === "park"; tick += 1) {
      const move = enteringMilo.transition === null ? { x: -1, y: 0 } : { x: 0, y: 0 };
      enteringMilo = step(world, enteringMilo, { ...none, move }).state;
    }
    expect(enteringMilo.area).toBe("milo-house");
    expect(enteringMilo.player).toEqual({
      x: miloHouse.spawns.door?.x,
      y: miloHouse.spawns.door?.y,
    });

    // Exit Milo's Sketch Loft back onto Meadow Park.
    let leavingMilo: State = {
      ...enteringMilo,
      player: { x: 235, y: 515 },
      facing: "left",
    };
    for (let tick = 0; tick < 60 && leavingMilo.area === "milo-house"; tick += 1) {
      const move = leavingMilo.transition === null ? { x: -1, y: -1 } : { x: 0, y: 0 };
      leavingMilo = step(world, leavingMilo, { ...none, move }).state;
    }
    expect(leavingMilo.area).toBe("park");
    expect(leavingMilo.player).toEqual({ x: 235, y: 465 });

    // Enter Rosie's Flower Cottage from Meadow Park's NNW sunlit gap.
    let enteringRosie: State = {
      ...leavingMilo,
      player: { x: 465, y: 310 },
      facing: "up",
    };
    for (let tick = 0; tick < 60 && enteringRosie.area === "park"; tick += 1) {
      const move = enteringRosie.transition === null ? { x: 0, y: -1 } : { x: 0, y: 0 };
      enteringRosie = step(world, enteringRosie, { ...none, move }).state;
    }
    expect(enteringRosie.area).toBe("rosie-cottage");
    expect(enteringRosie.player).toEqual({
      x: rosieCottage.spawns.door?.x,
      y: rosieCottage.spawns.door?.y,
    });

    // Exit Rosie's Flower Cottage back onto Meadow Park.
    let leavingRosie: State = {
      ...enteringRosie,
      player: { x: 240, y: 505 },
      facing: "left",
    };
    for (let tick = 0; tick < 60 && leavingRosie.area === "rosie-cottage"; tick += 1) {
      const move = leavingRosie.transition === null ? { x: -1, y: -1 } : { x: 0, y: 0 };
      leavingRosie = step(world, leavingRosie, { ...none, move }).state;
    }
    expect(leavingRosie.area).toBe("park");
    expect(leavingRosie.player).toEqual({ x: 490, y: 340 });
  });

  it("delivers Milo's subtle foreshadowing with zero spoilers and post-finale loft hangout", () => {
    const miloFixture = fixtures["milo-house"];
    if (miloFixture === undefined) throw new Error("milo-house fixture missing");
    const miloState = createState(world, miloFixture);
    const miloNpc = miloHouse.npcs.find((npc) => npc.id === "milo");
    if (miloNpc === undefined) throw new Error("milo npc missing");

    // Pre-finale: Milo is NOT yet hanging out at his loft.
    expect(npcVisible(world, miloState, miloNpc)).toBe(false);

    // Desk sets milo_loft_visited and awards 10 stray coins once.
    const deskFirst = runKnot(miloState.ink, "milo_desk");
    expect(world.storyVariable(deskFirst.ink, "milo_loft_visited")).toBe(true);
    expect(world.storyVariable(deskFirst.ink, "milo_desk_checked")).toBe(true);
    expect(deskFirst.lines.join(" ")).toContain("Star Racer");
    expect(deskFirst.tags).toContain("gift: coins 10");
    expect(deskFirst.sounds).toContain("chime-yellow");
    expect(runKnot(deskFirst.ink, "milo_desk").tags).toEqual([]);

    // Bed, comics, and cushion spots.
    expect(runKnot(miloState.ink, "milo_bed").lines.join(" ")).toContain("sketchbook");
    expect(runKnot(miloState.ink, "milo_comics").lines.join(" ")).toContain("trophies");
    expect(runKnot(miloState.ink, "milo_cushion").lines.join(" ")).toContain("blacklight lantern");

    // Blacklight secret glow: poignant foreshadowing + 10 coins once, targetable only with lantern.
    const glowFirst = runKnot(deskFirst.ink, "milo_loft_glow");
    expect(world.storyVariable(glowFirst.ink, "milo_loft_glow_read")).toBe(true);
    expect(glowFirst.lines.join(" ")).toContain("nobody would ever leave me behind");
    expect(glowFirst.tags).toContain("gift: coins 10");
    expect(glowFirst.sounds).toContain("chime-blue");
    expect(runKnot(glowFirst.ink, "milo_loft_glow").tags).toEqual([]);

    const nearGlow: State = {
      ...miloState,
      player: { x: 815, y: 535 },
      facing: "right",
      lantern: false,
    };
    expect(targetInteractable(world, nearGlow)).toBeUndefined();
    expect(targetInteractable(world, { ...nearGlow, lantern: true })?.id).toBe(
      "glow:milo-loft-glow",
    );

    // CRITICAL STORY RULE: ZERO hooded-kid / purple-hood / fizz / Mystic Pond spoilers pre-finale!
    const preFinaleKnots = [
      "milo_desk",
      "milo_bed",
      "milo_comics",
      "milo_cushion",
      "milo_loft_glow",
      "rosie_home",
      "rosie_table",
      "rosie_bed",
      "rosie_plants",
      "rosie_cottage_glow",
    ];
    for (const knot of preFinaleKnots) {
      const text = runKnot(miloState.ink, knot).lines.join(" ");
      expect(text, `${knot} no hood spoiler`).not.toMatch(/\bhood(ed)?\b/i);
      expect(text, `${knot} no fizz spoiler`).not.toMatch(/\bfizz(y|ing)?\b/i);
      expect(text, `${knot} no pond spoiler`).not.toMatch(/Mystic Pond/i);
    }

    // Post-finale: once milo_revealed is true, Milo stands on his starry rug for a warm hangout.
    const postFinale: State = {
      ...miloState,
      ink: setInkVariables(miloState.ink, { milo_revealed: true }),
    };
    expect(npcVisible(world, postFinale, miloNpc)).toBe(true);
    const talk = runKnot(postFinale.ink, "milo_loft_talk", { "hooded-kid": true });
    expect(talk.lines.join(" ")).toContain("Ancient Tree");
    expect(talk.lines.join(" ")).toContain("watercolor mural");
  });

  it("delivers Rosie's tea snack, Pressed Clover Craft ribbon reward, looks, and glow", () => {
    const rosieFixture = fixtures["rosie-cottage"];
    if (rosieFixture === undefined) throw new Error("rosie-cottage fixture missing");
    const rosieState = createState(world, rosieFixture);
    const rosieNpc = rosieCottage.npcs.find((npc) => npc.id === "rosie");
    if (rosieNpc === undefined) throw new Error("rosie npc missing");

    // Rosie is at school before hall_pass, and home crafting once hall_pass is true.
    const beforePass: State = {
      ...rosieState,
      ink: setInkVariables(rosieState.ink, { hall_pass: false }),
    };
    expect(npcVisible(world, beforePass, rosieNpc)).toBe(false);
    expect(npcVisible(world, rosieState, rosieNpc)).toBe(true);

    // First visit: Sunlit Clover Tea Snack (+1 snack, chime-green, rosie_cottage_visited).
    const first = runKnot(rosieState.ink, "rosie_home");
    expect(world.storyVariable(first.ink, "rosie_cottage_visited")).toBe(true);
    expect(world.storyVariable(first.ink, "rosie_clover_gift")).toBe(false);
    expect(first.lines.join(" ")).toContain("Sunlit Clover Tea Snack");
    expect(first.tags).toContain("gift: snack 1");
    expect(first.sounds).toContain("chime-green");

    // Revisit before Clover Hills / Sanctuary: warm Meadow Park & Clover Hills tip, no extra gift.
    const revisitEarly = runKnot(first.ink, "rosie_home");
    expect(revisitEarly.lines.join(" ")).toContain("Clover Hills");
    expect(revisitEarly.tags).toEqual([]);

    // After visiting Clover Hills (or Sanctuary): Pressed Clover Craft lucky ribbon (+15 coins).
    const afterHillsInk = setInkVariables(first.ink, { visited_hills: true });
    const craft = runKnot(afterHillsInk, "rosie_home");
    expect(world.storyVariable(craft.ink, "rosie_clover_gift")).toBe(true);
    expect(craft.lines.join(" ")).toContain("pressed-clover meadow ribbon");
    expect(craft.tags).toContain("gift: coins 15");
    expect(craft.sounds).toContain("chime-yellow");
    expect(runKnot(craft.ink, "rosie_home").tags).toEqual([]);

    // Look spots & blacklight Four-Leaf Clover Fairy Doodle.
    expect(runKnot(rosieState.ink, "rosie_table").lines.join(" ")).toContain("ribbon spools");
    expect(runKnot(rosieState.ink, "rosie_bed").lines.join(" ")).toContain("lavender");
    expect(runKnot(rosieState.ink, "rosie_plants").lines.join(" ")).toContain("terracotta");

    const glowFirst = runKnot(rosieState.ink, "rosie_cottage_glow");
    expect(world.storyVariable(glowFirst.ink, "rosie_cottage_glow_read")).toBe(true);
    expect(glowFirst.lines.join(" ")).toContain("Enchanted Forest");
    expect(glowFirst.tags).toContain("gift: coins 10");
    expect(glowFirst.sounds).toContain("chime-yellow");
    expect(runKnot(glowFirst.ink, "rosie_cottage_glow").tags).toEqual([]);

    const nearGlow: State = {
      ...rosieState,
      player: { x: 465, y: 535 },
      facing: "left",
      lantern: false,
    };
    expect(targetInteractable(world, nearGlow)).toBeUndefined();
    expect(targetInteractable(world, { ...nearGlow, lantern: true })?.id).toBe(
      "glow:rosie-cottage-glow",
    );
  });

  it("configures atmosphere, soundtrack, surfaces, indoor status, rest, and journal", () => {
    const miloSurface = world.surfaces["milo-house"];
    const rosieSurface = world.surfaces["rosie-cottage"];
    if (miloSurface === undefined || rosieSurface === undefined) {
      throw new Error("missing milo-house or rosie-cottage surface maps");
    }
    expect(surfaceAt(miloSurface, { x: 290, y: 545 })).toBe("wood");
    expect(surfaceAt(miloSurface, { x: 540, y: 565 })).toBe("carpet");
    expect(surfaceAt(miloSurface, { x: 196, y: 520 })).toBe("carpet");
    expect(surfaceAt(rosieSurface, { x: 295, y: 540 })).toBe("wood");
    expect(surfaceAt(rosieSurface, { x: 595, y: 580 })).toBe("carpet");
    expect(surfaceAt(rosieSurface, { x: 205, y: 515 })).toBe("carpet");

    const miloState = createState(world, fixtures["milo-house"]!);
    const rosieState = createState(world, fixtures["rosie-cottage"]!);
    for (const [id, state] of [
      ["milo-house", miloState],
      ["rosie-cottage", rosieState],
    ] as const) {
      expect(INDOOR_AREAS.has(id), id).toBe(true);
      expect(soundtrackFor(world, state, { titleOpen: false }), id).toEqual({
        track: "home",
        ambience: "none",
        duck: false,
        title: "Cloverhollow Town",
      });
      const atmo = evaluateAtmosphere(id, 1200, 800, 90);
      expect(atmo.filter((p) => p.texture === "sunbeam"), id).toHaveLength(2);
      expect(atmo.filter((p) => p.texture === "sparkle"), id).toHaveLength(10);
    }

    for (const id of ["milo-starry-rug", "rosie-floral-rug"] as const) {
      const spot = REST_SPOTS.find((item) => item.id === id);
      if (spot === undefined) throw new Error(`Missing rest spot ${id}`);
      const base = spot.area === "milo-house" ? miloState : rosieState;
      const atSpot: State = {
        ...base,
        player: { x: spot.x, y: spot.y },
        facing: spot.facing,
        party: [],
      };
      expect(targetInteractable(world, atSpot), id).toBeUndefined();
      expect(findRestSpot(world, atSpot)?.id, id).toBe(id);
    }

    const visited: State = {
      ...miloState,
      ink: setInkVariables(miloState.ink, {
        milo_loft_visited: true,
        rosie_cottage_visited: true,
      }),
    };
    const notes = journalNotes(world, visited);
    const miloNote = notes.find((line) => line.includes("Milo's sunlit sketch loft"));
    const rosieNote = notes.find((line) => line.includes("Rosie's flower cottage"));
    expect(miloNote).toBeDefined();
    expect(rosieNote).toBeDefined();
    expect(`${miloNote ?? ""} ${rosieNote ?? ""}`).not.toMatch(/\bhood(ed)?\b/i);
    expect(`${miloNote ?? ""} ${rosieNote ?? ""}`).not.toMatch(/\bfizz/i);
  });
});
