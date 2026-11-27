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
  type State,
} from "../../src/core";
import { evaluateAtmosphere } from "../../src/render/atmosphere";

const { world, fixtures } = loadContent();
const bay = world.areas.bay;
const pass = world.areas.pass;
const sueCottage = world.areas["sue-cottage"];
const jordanCabin = world.areas["jordan-cabin"];
if (bay === undefined || pass === undefined || sueCottage === undefined ||
    jordanCabin === undefined) {
  throw new Error("bay, pass, sue-cottage, or jordan-cabin missing");
}

const none: ActionFrame = blankInput();

function runKnot(
  ink: string,
  knot: string,
): { ink: string; lines: string[]; sounds: string[]; tags: string[] } {
  const facts = {
    calmed: {},
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

describe("Other Kids' Houses: Sue's Beach Cottage & Jordan's Mountain Cabin", () => {
  it("passes geometry, prop, hiding, and connection checks across all 27 areas", () => {
    expect(Object.keys(world.areas).length).toBeGreaterThanOrEqual(27);
    expect(sueCottage.name).toBe("Sue's Beach Cottage");
    expect(sueCottage.land).toBe("bay");
    expect(sueCottage.width).toBe(1200);
    expect(sueCottage.height).toBe(800);
    expect(sueCottage.interactables.map((item) => item.id)).toEqual([
      "sue-workbench", "sue-bed", "sue-lamp", "sue-snacks",
    ]);
    expect(sueCottage.glows.map((glow) => glow.id)).toEqual(["sue-secret-note"]);
    expect(sueCottage.props.map((prop) => prop.id)).toEqual(["snack-basket"]);

    expect(jordanCabin.name).toBe("Jordan's Mountain Cabin");
    expect(jordanCabin.land).toBe("pass");
    expect(jordanCabin.width).toBe(1200);
    expect(jordanCabin.height).toBe(800);
    expect(jordanCabin.interactables.map((item) => item.id)).toEqual([
      "jordan-table", "jordan-bed", "jordan-rack", "jordan-firewood",
    ]);
    expect(jordanCabin.glows.map((glow) => glow.id)).toEqual(["jordan-map-glow"]);
    expect(jordanCabin.props.map((prop) => prop.id)).toEqual(["firewood-basket"]);

    expect(bay.triggers.find((trigger) => trigger.id === "sue-cottage")?.target)
      .toEqual({ area: "sue-cottage", spawn: "door" });
    expect(bay.spawns["sue-cottage"]).toEqual({ x: 285, y: 190, facing: "down" });
    expect(pass.triggers.find((trigger) => trigger.id === "jordan-cabin")?.target)
      .toEqual({ area: "jordan-cabin", spawn: "door" });
    expect(pass.spawns["jordan-cabin"]).toEqual({ x: 325, y: 575, facing: "right" });

    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party))
      .toEqual([]);
    for (const room of [sueCottage, jordanCabin]) {
      expect(propDrawingErrors(room), room.id).toEqual([]);
      expect(propBlockerErrors(room), room.id).toEqual([]);
      expect(hiddenPositions(room, world.tunables.playerRadius), room.id).toEqual([]);
    }
  });

  it("gates both doors before Sue and Jordan join, then enters and exits cleanly", () => {
    const bayFixture = fixtures.bay;
    const passFixture = fixtures.pass;
    if (bayFixture === undefined || passFixture === undefined) {
      throw new Error("bay or pass fixture missing");
    }

    // Locked before sue_joined.
    let bayLocked: State = {
      ...createState(world, bayFixture),
      player: { x: 285, y: 120 },
      facing: "up",
    };
    for (let tick = 0; tick < 30 && bayLocked.dialogue === null; tick += 1) {
      bayLocked = step(world, bayLocked, { ...none, move: { x: 0, y: -1 } }).state;
    }
    expect(bayLocked.area).toBe("bay");
    expect(bayLocked.dialogue?.knot).toBe("sue_cottage_locked");

    // Unlocked once sue_joined is true.
    let enteringSue: State = {
      ...createState(world, bayFixture),
      ink: setInkVariables(createState(world, bayFixture).ink, { sue_joined: true }),
      player: { x: 285, y: 120 },
      facing: "up",
    };
    for (let tick = 0; tick < 60 && enteringSue.area === "bay"; tick += 1) {
      const move = enteringSue.transition === null ? { x: 0, y: -1 } : { x: 0, y: 0 };
      enteringSue = step(world, enteringSue, { ...none, move }).state;
    }
    expect(enteringSue.area).toBe("sue-cottage");
    expect(enteringSue.player).toEqual({
      x: sueCottage.spawns.door?.x,
      y: sueCottage.spawns.door?.y,
    });

    // Exit Sue's cottage back to Bubblegum Bay.
    let leavingSue: State = {
      ...enteringSue,
      player: { x: 235, y: 510 },
      facing: "left",
    };
    for (let tick = 0; tick < 60 && leavingSue.area === "sue-cottage"; tick += 1) {
      const move = leavingSue.transition === null ? { x: -1, y: -1 } : { x: 0, y: 0 };
      leavingSue = step(world, leavingSue, { ...none, move }).state;
    }
    expect(leavingSue.area).toBe("bay");
    expect(leavingSue.player).toEqual({ x: 285, y: 190 });

    // Locked before jordan_joined.
    let passLocked: State = {
      ...createState(world, passFixture),
      player: { x: 245, y: 580 },
      facing: "left",
    };
    for (let tick = 0; tick < 30 && passLocked.dialogue === null; tick += 1) {
      passLocked = step(world, passLocked, { ...none, move: { x: -1, y: 0 } }).state;
    }
    expect(passLocked.area).toBe("pass");
    expect(passLocked.dialogue?.knot).toBe("jordan_cabin_locked");

    // Unlocked once jordan_joined is true.
    let enteringJordan: State = {
      ...createState(world, passFixture),
      ink: setInkVariables(createState(world, passFixture).ink, { jordan_joined: true }),
      player: { x: 245, y: 580 },
      facing: "left",
    };
    for (let tick = 0; tick < 60 && enteringJordan.area === "pass"; tick += 1) {
      const move = enteringJordan.transition === null ? { x: -1, y: 0 } : { x: 0, y: 0 };
      enteringJordan = step(world, enteringJordan, { ...none, move }).state;
    }
    expect(enteringJordan.area).toBe("jordan-cabin");
    expect(enteringJordan.player).toEqual({
      x: jordanCabin.spawns.door?.x,
      y: jordanCabin.spawns.door?.y,
    });

    // Exit Jordan's cabin back to Pinecone Pass.
    let leavingJordan: State = {
      ...enteringJordan,
      player: { x: 235, y: 515 },
      facing: "left",
    };
    for (let tick = 0; tick < 60 && leavingJordan.area === "jordan-cabin"; tick += 1) {
      const move = leavingJordan.transition === null ? { x: -1, y: -1 } : { x: 0, y: 0 };
      leavingJordan = step(world, leavingJordan, { ...none, move }).state;
    }
    expect(leavingJordan.area).toBe("pass");
    expect(leavingJordan.player).toEqual({ x: 325, y: 575 });
  });

  it("awards keepsakes, gifts, blacklight secrets, and club_chest entries once", () => {
    const base = createState(world, fixtures["new-game"]!);
    const withTeam = setInkVariables(base.ink, {
      sue_joined: true,
      jordan_joined: true,
      has_lantern: true,
      has_chest: true,
    });

    // Sue's workbench: fishing tip + Sea-Glass Compass + 10 coins (once).
    const wbFirst = runKnot(withTeam, "sue_workbench");
    expect(world.storyVariable(wbFirst.ink, "sue_cottage_visited")).toBe(true);
    expect(world.storyVariable(wbFirst.ink, "sue_compass")).toBe(true);
    expect(wbFirst.lines.join(" ")).toContain("Golden Starfish Crown");
    expect(wbFirst.lines.join(" ")).toContain("RARE");
    expect(wbFirst.tags).toContain("gift: coins 10");
    expect(wbFirst.sounds).toContain("chime-blue");
    const wbRepeat = runKnot(wbFirst.ink, "sue_workbench");
    expect(wbRepeat.tags).toEqual([]);

    // Sue's snack basket: 2 free beach snacks (once).
    const snacksFirst = runKnot(wbFirst.ink, "sue_snacks");
    expect(world.storyVariable(snacksFirst.ink, "sue_basket_taken")).toBe(true);
    expect(snacksFirst.tags).toContain("gift: snack 2");
    expect(runKnot(snacksFirst.ink, "sue_snacks").tags).toEqual([]);

    // Sue's bed & lamp banter + glow-ink hint.
    expect(runKnot(withTeam, "sue_bed").lines.join(" ")).toContain("bandanas");
    expect(runKnot(withTeam, "sue_lamp").lines.join(" ")).toContain("blacklight lantern");

    // Sue's blacklight secret note: Bay Explorers Club star chart + 10 coins (once).
    const sueNote = runKnot(snacksFirst.ink, "sue_secret_note");
    expect(world.storyVariable(sueNote.ink, "sue_note_read")).toBe(true);
    expect(sueNote.lines.join(" ")).toContain("BAY EXPLORERS CLUB");
    expect(sueNote.tags).toContain("gift: coins 10");
    expect(sueNote.sounds).toContain("chime-yellow");
    expect(runKnot(sueNote.ink, "sue_secret_note").tags).toEqual([]);

    // Jordan's table: grandma's story + Pressed Alpine Clover + 1 cocoa snack (once).
    const jtFirst = runKnot(sueNote.ink, "jordan_table");
    expect(world.storyVariable(jtFirst.ink, "jordan_cabin_visited")).toBe(true);
    expect(world.storyVariable(jtFirst.ink, "jordan_clover")).toBe(true);
    expect(jtFirst.lines.join(" ")).toContain("calm valleys grow the sweetest berries");
    expect(jtFirst.tags).toContain("gift: snack 1");
    expect(jtFirst.sounds).toContain("chime-green");
    expect(runKnot(jtFirst.ink, "jordan_table").tags).toEqual([]);

    // Jordan's bed, rack & firewood banter + invisible ink map hint.
    expect(runKnot(withTeam, "jordan_bed").lines.join(" ")).toContain("quilt");
    expect(runKnot(withTeam, "jordan_rack").lines.join(" ")).toContain("invisible ink");
    expect(runKnot(withTeam, "jordan_firewood").lines.join(" ")).toContain("cedar");

    // Jordan's blacklight secret map: Crystal Cavern & Wildlife Sanctuary + 10 coins (once).
    const jordanNote = runKnot(jtFirst.ink, "jordan_map_glow");
    expect(world.storyVariable(jordanNote.ink, "jordan_note_read")).toBe(true);
    expect(jordanNote.lines.join(" ")).toContain("Crystal Cavern");
    expect(jordanNote.lines.join(" ")).toContain("Wildlife Sanctuary");
    expect(jordanNote.tags).toContain("gift: coins 10");
    expect(jordanNote.sounds).toContain("chime-blue");
    expect(runKnot(jordanNote.ink, "jordan_map_glow").tags).toEqual([]);

    // Both keepsakes appear in Fae's clubhouse keepsake chest.
    const chest = runKnot(jordanNote.ink, "club_chest");
    expect(chest.lines.join(" ")).toContain(
      "Sue's Sea-Glass Compass from her beach cottage. Its needle always points toward the bay!",
    );
    expect(chest.lines.join(" ")).toContain(
      "Jordan's Pressed Alpine Clover from his grandma's botany book.",
    );

    // Blacklight glows are targetable only while the lantern is switched on.
    const sueFixture = fixtures["sue-cottage"];
    const jordanFixture = fixtures["jordan-cabin"];
    if (sueFixture === undefined || jordanFixture === undefined) {
      throw new Error("cottage or cabin fixture missing");
    }
    const nearSueGlow: State = {
      ...createState(world, sueFixture),
      player: { x: 800, y: 478 },
      facing: "right",
      lantern: false,
    };
    expect(targetInteractable(world, nearSueGlow)).toBeUndefined();
    expect(targetInteractable(world, { ...nearSueGlow, lantern: true })?.id)
      .toBe("glow:sue-secret-note");

    const nearJordanGlow: State = {
      ...createState(world, jordanFixture),
      player: { x: 870, y: 512 },
      facing: "right",
      lantern: false,
    };
    expect(targetInteractable(world, nearJordanGlow)).toBeUndefined();
    expect(targetInteractable(world, { ...nearJordanGlow, lantern: true })?.id)
      .toBe("glow:jordan-map-glow");
  });

  it("configures surfaces, soundtracks, atmospheres, journal notes, and zero Milo mentions", () => {
    const sueSurface = world.surfaces["sue-cottage"];
    const jordanSurface = world.surfaces["jordan-cabin"];
    if (sueSurface === undefined || jordanSurface === undefined) {
      throw new Error("missing friend house surface maps");
    }
    expect(surfaceAt(sueSurface, { x: 290, y: 540 })).toBe("wood");
    expect(surfaceAt(sueSurface, { x: 582, y: 554 })).toBe("carpet");
    expect(surfaceAt(sueSurface, { x: 196, y: 518 })).toBe("carpet");
    expect(surfaceAt(jordanSurface, { x: 290, y: 545 })).toBe("wood");
    expect(surfaceAt(jordanSurface, { x: 552, y: 584 })).toBe("carpet");
    expect(surfaceAt(jordanSurface, { x: 196, y: 522 })).toBe("carpet");

    const sueState = createState(world, fixtures["sue-cottage"]!);
    expect(soundtrackFor(world, sueState, { titleOpen: false })).toEqual({
      track: "cottage",
      ambience: "ocean",
      duck: false,
      title: "Sea-Glass Sunroom",
    });

    const jordanState = createState(world, fixtures["jordan-cabin"]!);
    expect(soundtrackFor(world, jordanState, { titleOpen: false })).toEqual({
      track: "cabin",
      ambience: "hearth",
      duck: false,
      title: "Timber & Tea",
    });

    const sueAtmo = evaluateAtmosphere("sue-cottage", sueCottage.width, sueCottage.height, 90);
    expect(sueAtmo.some((item) => item.texture === "softGlow" && item.layer === "emissive"))
      .toBe(true);
    expect(sueAtmo.some((item) => item.texture === "sunbeam" && item.layer === "over"))
      .toBe(true);
    expect(sueAtmo.filter((item) => item.texture === "sparkle")).toHaveLength(10);

    const jordanAtmo = evaluateAtmosphere(
      "jordan-cabin", jordanCabin.width, jordanCabin.height, 90,
    );
    expect(jordanAtmo.some((item) => item.texture === "sunbeam" && item.layer === "over"))
      .toBe(true);
    expect(jordanAtmo.filter((item) => item.texture === "softGlow" && item.layer === "emissive"))
      .toHaveLength(2);
    expect(jordanAtmo.filter((item) => item.texture === "mistWisp")).toHaveLength(6);

    const rich: State = {
      ...sueState,
      ink: setInkVariables(sueState.ink, {
        sue_cottage_visited: true,
        jordan_cabin_visited: true,
      }),
    };
    const notes = journalNotes(world, rich);
    expect(notes.some((line) => line.includes("Sue's mint-green beach cottage"))).toBe(true);
    expect(notes.some((line) => line.includes("Jordan's timber cabin"))).toBe(true);
    expect(notes.join(" ")).not.toMatch(/\bMilo\b/i);

    const freshInk = createState(world, fixtures["new-game"]!).ink;
    const allKnots = [
      "sue_cottage_locked",
      "jordan_cabin_locked",
      "sue_workbench",
      "sue_bed",
      "sue_lamp",
      "sue_snacks",
      "sue_secret_note",
      "jordan_table",
      "jordan_bed",
      "jordan_rack",
      "jordan_firewood",
      "jordan_map_glow",
    ];
    for (const knot of allKnots) {
      expect(runKnot(freshInk, knot).lines.join(" "), `${knot} (fresh)`).not.toMatch(/\bMilo\b/i);
      expect(runKnot(rich.ink, knot).lines.join(" "), `${knot} (rich)`).not.toMatch(/\bMilo\b/i);
    }
  });
});
