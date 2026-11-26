import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { ambientFor } from "../../src/content/ambient";
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
  propState,
  propStateName,
  runInk,
  setInkVariables,
  step,
  surfaceAt,
  targetInteractable,
  type ActionFrame,
  type State,
} from "../../src/core";

const { world, fixtures } = loadContent();
const cavern = world.areas.cavern;
const pass = world.areas.pass;
if (cavern === undefined || pass === undefined) throw new Error("cavern or pass missing");

const none: ActionFrame = blankInput();

function runKnot(
  ink: string,
  knot: string,
  choices: number[] = [],
): { ink: string; lines: string[]; sounds: string[]; tags: string[] } {
  let result = runInk(world.story, ink, { type: "start", knot });
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
  let choiceIndex = 0;
  for (let guard = 0; guard < 40 && !result.ended; guard += 1) {
    if (result.choices.length > 0) {
      const pick = choices[choiceIndex] ?? 0;
      choiceIndex += 1;
      result = runInk(world.story, result.ink, { type: "choose", index: pick });
    } else {
      result = runInk(world.story, result.ink, { type: "next" });
    }
    collect();
  }
  return { ink: result.ink, lines, sounds, tags };
}

function advanceDialogue(state: State, choices: number[] = []): State {
  let current = state;
  let choiceIndex = 0;
  for (let guard = 0; guard < 1000 && current.dialogue !== null; guard += 1) {
    if (current.dialogue.revealed < current.dialogue.text.length) {
      current = step(world, current, none).state;
      continue;
    }
    if (current.dialogue.choices.length > 0) {
      const target = choices[choiceIndex] ?? 0;
      choiceIndex += 1;
      for (let move = 0; move < target; move += 1) {
        current = step(world, current, { ...none, move: { x: 0, y: 1 } }).state;
        current = step(world, current, none).state;
      }
    }
    current = step(world, current, { ...none, confirm: true }).state;
    current = step(world, current, none).state;
  }
  return current;
}

describe("Crystal Cavern", () => {
  it("passes geometry, prop, and hiding checks cleanly", () => {
    expect(cavern.name).toBe("Crystal Cavern");
    expect(cavern.land).toBe("pass");
    expect(cavern.width).toBe(1650);
    expect(cavern.height).toBe(1100);
    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party))
      .toEqual([]);
    expect(propDrawingErrors(cavern)).toEqual([]);
    expect(propBlockerErrors(cavern)).toEqual([]);
    expect(hiddenPositions(cavern, world.tunables.playerRadius)).toEqual([]);
  });

  it("locks Pinecone Pass's north entrance before has_lantern and opens it after", () => {
    const passFixture = fixtures.pass;
    if (passFixture === undefined) throw new Error("pass fixture missing");
    const lockedStart: State = {
      ...createState(world, passFixture),
      player: { x: 830, y: 205 },
      facing: "up",
    };
    let locked = lockedStart;
    for (let tick = 0; tick < 20; tick += 1) {
      locked = step(world, locked, { ...none, move: { x: 0, y: -1 } }).state;
      if (locked.dialogue !== null) break;
    }
    expect(locked.area).toBe("pass");
    expect(locked.dialogue?.text).toContain("snow-dusted archway");

    let open: State = {
      ...lockedStart,
      ink: setInkVariables(lockedStart.ink, { has_lantern: true }),
    };
    for (let tick = 0; tick < 60 && open.area === "pass"; tick += 1) {
      const move = open.transition === null ? { x: 0, y: -1 } : { x: 0, y: 0 };
      open = step(world, open, { ...none, move }).state;
    }
    expect(open.area).toBe("cavern");
    expect(open.player).toEqual({
      x: cavern.spawns.entrance?.x,
      y: cavern.spawns.entrance?.y,
    });
  });

  it("keeps the stream crossing solid until the glowing mural lights the stepping stones", () => {
    const fixture = fixtures.cavern;
    if (fixture === undefined) throw new Error("cavern fixture missing");
    const stepsProp = cavern.props.find((prop) => prop.id === "crystal-steps");
    if (stepsProp === undefined) throw new Error("crystal-steps prop missing");

    let state = createState(world, fixture);
    expect(propStateName(world, state.ink, stepsProp)).toBe("default");
    expect(propState(world, state.ink, stepsProp).hidden).toBe(true);

    // Before lighting the stepping stones, walking east into the stream cannot cross onto
    // the east bank (Fae slides along the west shoreline instead of crossing at y = 545).
    let blocked: State = { ...state, player: { x: 740, y: 545 }, facing: "right" };
    for (let tick = 0; tick < 80; tick += 1)
      blocked = step(world, blocked, { ...none, move: { x: 1, y: 0 } }).state;
    expect(blocked.player.x).toBeLessThan(900);
    expect(blocked.player.y).toBeGreaterThan(580);

    // Without lantern, the glowing mural isn't targetable; turning the lantern on exposes it.
    let atMural: State = { ...state, player: { x: 420, y: 425 }, facing: "up", lantern: false };
    expect(targetInteractable(world, atMural)?.id).not.toBe("glow:cavern-mural-glow");
    atMural = step(world, atMural, { ...none, lantern: true }).state;
    atMural = step(world, atMural, none).state;
    expect(atMural.lantern).toBe(true);
    expect(targetInteractable(world, atMural)?.id).toBe("glow:cavern-mural-glow");

    // Reading the glowing mural lights the crystal stepping stones with a chime.
    atMural = step(world, atMural, { ...none, confirm: true }).state;
    atMural = step(world, atMural, none).state;
    atMural = advanceDialogue(atMural);
    expect(world.storyVariable(atMural.ink, "cavern_bridge_lit")).toBe(true);
    expect(propStateName(world, atMural.ink, stepsProp)).toBe("lit");
    expect(propState(world, atMural.ink, stepsProp).flat).toBe(true);
    expect(runKnot(state.ink, "cavern_mural").sounds).toContain("chime-blue");

    // Now Fae can walk straight across the stepping stones onto the east bank.
    let crossed: State = { ...atMural, player: { x: 740, y: 545 }, facing: "right" };
    for (let tick = 0; tick < 80; tick += 1)
      crossed = step(world, crossed, { ...none, move: { x: 1, y: 0 } }).state;
    expect(crossed.player.x).toBeGreaterThan(950);
  });

  it("handles the Star Chime lasso puzzle, coins, and clubhouse chest keepsake", () => {
    const base = createState(world, fixtures["new-game"]!);
    const tooHigh = runKnot(base.ink, "cavern_chime");
    expect(tooHigh.lines.join(" ")).toContain("too high to reach");
    expect(world.storyVariable(tooHigh.ink, "cavern_chime_seen")).toBe(true);
    expect(world.storyVariable(tooHigh.ink, "cavern_chime_rung")).toBe(false);

    const withLasso = setInkVariables(base.ink, { has_lasso: true, has_chest: true });
    const rung = runKnot(withLasso, "cavern_chime", [0]);
    expect(world.storyVariable(rung.ink, "cavern_chime_rung")).toBe(true);
    expect(rung.sounds).toContain("chime-blue");
    expect(rung.tags).toContain("gift: coins 15");

    const chest = runKnot(rung.ink, "club_chest");
    expect(chest.lines.join(" ")).toContain("shimmering star crystal from Crystal Cavern");
  });

  it("handles the Pond Pup crystal spring dive for snacks and coins", () => {
    const base = createState(world, fixtures["new-game"]!);
    const noPup = runKnot(base.ink, "cavern_spring");
    expect(noPup.lines.join(" ")).toContain("too deep to reach");
    expect(world.storyVariable(noPup.ink, "cavern_spring_seen")).toBe(true);
    expect(world.storyVariable(noPup.ink, "cavern_spring_found")).toBe(false);

    const withPup = setInkVariables(base.ink, { pup_friend: true, pup_with_me: true });
    const found = runKnot(withPup, "cavern_spring", [0]);
    expect(world.storyVariable(found.ink, "cavern_spring_found")).toBe(true);
    expect(found.tags).toContain("gift: snack 2");
    expect(found.tags).toContain("gift: coins 10");
  });

  it("registers Duzzy Bat and Glimmer Mole with levels, stickers, and calm knots", () => {
    const bat = world.critters.bat;
    const mole = world.critters["crystal-mole"];
    expect(bat?.name).toBe("Duzzy Bat");
    expect(bat?.calmName).toBe("Cozy Bat");
    expect(bat?.level).toBe(6);
    expect(bat?.burst.check.kind).toBe("lean");
    expect(bat?.calmKnot).toBe("bat_calm");
    expect(world.levels.critters.bat).toEqual({
      level: 6, calmMax: 100, burst: 2, bigBurst: 3, xp: 60,
    });

    expect(mole?.name).toBe("Glimmer Mole");
    expect(mole?.calmName).toBe("Gem Mole");
    expect(mole?.level).toBe(7);
    expect(mole?.burst.check.kind).toBe("chain");
    expect(mole?.calmKnot).toBe("crystal_mole_calm");
    expect(world.levels.critters["crystal-mole"]).toEqual({
      level: 7, calmMax: 100, burst: 2, bigBurst: 3, xp: 70,
    });

    expect(world.stickers.slots).toBe(22);
    expect(world.stickers.catalogue.length).toBe(22);
    expect(world.stickers.catalogue.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["cozy-bat", "gem-mole"]),
    );

    const base = createState(world, fixtures["new-game"]!);
    expect(runKnot(base.ink, "bat_calm").lines.join(" ")).toContain("crystal chimes");
    expect(runKnot(base.ink, "crystal_mole_calm").lines.join(" ")).toContain("goggles");
  });

  it("defines ambient lights, surfaces, journal notes, and never names Milo", () => {
    const flyers = ambientFor(cavern);
    expect(flyers).toHaveLength(5);
    expect(flyers.every((flyer) => flyer.animation === "fairy_light")).toBe(true);

    const surface = world.surfaces.cavern;
    if (surface === undefined) throw new Error("cavern surface map missing");
    expect(surfaceAt(surface, { x: 520, y: 650 })).toBe("sand");
    expect(surfaceAt(surface, { x: 1200, y: 580 })).toBe("sand");
    expect(surfaceAt(surface, { x: 832, y: 550 })).toBe("stone");

    const base = createState(world, fixtures["new-game"]!);
    const richState: State = {
      ...base,
      ink: setInkVariables(base.ink, {
        cavern_bridge_lit: true,
        cavern_chime_seen: true,
        cavern_chime_rung: true,
        cavern_spring_seen: true,
        cavern_spring_found: true,
      }),
    };
    const notes = journalNotes(world, richState);
    expect(notes).toContain(
      "Reading the glowing fairy mural in Crystal Cavern lit three crystal stepping stones " +
        "across the stream!",
    );
    expect(notes).toContain(
      "I lassoed the golden star chime in Crystal Cavern and caught a shimmering star " +
        "crystal!",
    );
    expect(notes).toContain(
      "The Pond Pup dove into Crystal Cavern's glowing spring and fetched a pouch of snacks " +
        "and coins!",
    );

    const knots = [
      "cavern_dark",
      "cavern_tablet",
      "cavern_mural",
      "cavern_lantern_look",
      "cavern_stream",
      "cavern_chime",
      "cavern_spring",
      "bat_calm",
      "crystal_mole_calm",
    ];
    for (const knot of knots) {
      const text = runKnot(richState.ink, knot, [0]).lines.join(" ");
      expect(text, knot).not.toMatch(/\bMilo\b/i);
    }
    expect(notes.join(" ")).not.toMatch(/\bMilo\b/i);
  });
});
