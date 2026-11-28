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
  inkFacts,
  isSpeciesCalmed,
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
import { speakerAccent, speakerPortraitSource } from "../../src/ui/portraits";
import { voiceForSpeaker } from "../../src/platform/voices";

const { world, fixtures } = loadContent();
const sanctuary = world.areas.sanctuary;
const hills = world.areas.hills;
if (sanctuary === undefined || hills === undefined)
  throw new Error("sanctuary or hills missing");

const none: ActionFrame = blankInput();

const SANCTUARY_SPECIES = [
  "fountain-frog",
  "pup",
  "cat",
  "raccoon",
  "bluebird",
  "crab",
  "hamster",
  "penguin",
  "bunny",
  "squirrel",
  "gull",
  "owl",
  "lamb",
  "hedgehog",
  "bat",
  "crystal-mole",
  "moon-owl",
] as const;

function withCalmed(base: State, ids: readonly string[]): State {
  const calms: Record<string, number> = { ...base.calms };
  const critters = { ...base.critters };
  const stickers = [...base.stickers];
  for (const id of ids) {
    const kind = world.critters[id];
    if (kind === undefined) throw new Error(`unknown critter ${id}`);
    calms[kind.species] = (calms[kind.species] ?? 0) + 1;
    if (critters[id] !== undefined) critters[id] = "calm";
    if (!stickers.includes(kind.sticker.id)) stickers.push(kind.sticker.id);
  }
  return { ...base, calms, critters, stickers };
}

function runKnot(
  state: State,
  knot: string,
): {
  ink: string;
  lines: string[];
  speakers: (string | null)[];
  sounds: string[];
  tags: string[];
} {
  const facts = inkFacts(world, state);
  let result = runInk(world.story, state.ink, { type: "start", knot }, facts);
  const lines: string[] = [];
  const speakers: (string | null)[] = [];
  const sounds: string[] = [];
  const tags: string[] = [];
  const collect = (): void => {
    if (result.line !== null) {
      lines.push(result.line.text);
      speakers.push(result.line.speaker);
      if (result.line.sound !== undefined) sounds.push(result.line.sound);
      tags.push(...result.line.tags);
    }
  };
  collect();
  for (let guard = 0; guard < 50 && !result.ended; guard += 1) {
    result = runInk(world.story, result.ink, { type: "next" }, facts);
    collect();
  }
  return { ink: result.ink, lines, speakers, sounds, tags };
}

describe("The Wildlife Sanctuary", () => {
  it("passes geometry, prop, hiding, and hills connection checks across all areas", () => {
    expect(Object.keys(world.areas).length).toBeGreaterThanOrEqual(25);
    expect(sanctuary.name).toBe("Wildlife Sanctuary");
    expect(sanctuary.land).toBe("hills");
    expect(sanctuary.width).toBe(1650);
    expect(sanctuary.height).toBe(1100);
    expect(sanctuary.props).toHaveLength(8);
    expect(sanctuary.npcs).toHaveLength(22);
    expect(sanctuary.interactables.map((item) => item.id)).toEqual([
      "sanctuary-board",
      "sanctuary-picnic",
      "sanctuary-barn",
      "dream-shrine",
    ]);

    expect(world.characters.fern).toEqual({
      atlas: "assets/characters/fern/fern.json",
      idleTicks: [175, 8],
    });
    expect(hills.triggers.find((trigger) => trigger.id === "sanctuary")?.target).toEqual({
      area: "sanctuary",
      spawn: "entrance",
    });
    expect(hills.spawns.sanctuary).toEqual({ x: 1495, y: 405, facing: "left" });

    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party))
      .toEqual([]);
    expect(propDrawingErrors(sanctuary)).toEqual([]);
    expect(propBlockerErrors(sanctuary)).toEqual([]);
    expect(hiddenPositions(sanctuary, world.tunables.playerRadius)).toEqual([]);
  });

  it("walks cleanly between Clover Hills east meadow and the Wildlife Sanctuary", () => {
    const hillsFixture = fixtures.hills;
    if (hillsFixture === undefined) throw new Error("hills fixture missing");
    let entering: State = {
      ...createState(world, hillsFixture),
      player: { x: 1525, y: 408 },
      facing: "right",
    };
    for (let tick = 0; tick < 80 && entering.area === "hills"; tick += 1) {
      const move = entering.transition === null ? { x: 1, y: 0 } : { x: 0, y: 0 };
      entering = step(world, entering, { ...none, move }).state;
    }
    expect(entering.area).toBe("sanctuary");
    expect(entering.player).toEqual({
      x: sanctuary.spawns.entrance?.x,
      y: sanctuary.spawns.entrance?.y,
    });

    let leaving: State = {
      ...entering,
      player: { x: 345, y: 805 },
      facing: "left",
    };
    for (let tick = 0; tick < 80 && leaving.area === "sanctuary"; tick += 1) {
      const move = leaving.transition === null ? { x: -1, y: 1 } : { x: 0, y: 0 };
      leaving = step(world, leaving, { ...none, move }).state;
    }
    expect(leaving.area).toBe("hills");
    expect(leaving.player).toEqual({ x: 1495, y: 405 });
  });

  it("shows only calmed species in the sanctuary and hides uncalmed ones", () => {
    const fresh = createState(world, { area: "sanctuary", spawn: "entrance", seed: 1 });
    const visibleFresh = sanctuary.npcs.filter((npc) => npcVisible(world, fresh, npc));
    expect(visibleFresh.map((npc) => npc.id)).toEqual(["fern"]);

    const frogNpc = sanctuary.npcs.find((npc) => npc.id === "sanctuary-frog");
    const batNpc = sanctuary.npcs.find((npc) => npc.id === "sanctuary-bat");
    if (frogNpc === undefined || batNpc === undefined)
      throw new Error("frog or bat sanctuary npc missing");

    // Uncalmed animal isn't targetable or solid.
    const nearFrogFresh: State = {
      ...fresh,
      player: { x: frogNpc.point.x, y: frogNpc.point.y + 42 },
      facing: "up",
    };
    expect(targetInteractable(world, nearFrogFresh)).toBeUndefined();

    // Calming frog + bat makes ONLY those two appear alongside Ranger Fern.
    const twoCalm = withCalmed(fresh, ["fountain-frog", "bat"]);
    expect(isSpeciesCalmed(world, twoCalm, "fountain-frog")).toBe(true);
    expect(isSpeciesCalmed(world, twoCalm, "bat")).toBe(true);
    expect(isSpeciesCalmed(world, twoCalm, "moon-owl")).toBe(false);
    expect(
      sanctuary.npcs.filter((npc) => npcVisible(world, twoCalm, npc)).map((npc) => npc.id),
    ).toEqual(["fern", "sanctuary-frog", "sanctuary-bat"]);

    const nearFrogCalm: State = {
      ...twoCalm,
      player: { x: frogNpc.point.x, y: frogNpc.point.y + 42 },
      facing: "up",
    };
    expect(targetInteractable(world, nearFrogCalm)).toMatchObject({
      id: "npc:sanctuary-frog",
      knot: "pet_frog",
      prompt: "Pet",
    });

    // Sanctuary fixture populates 8 calmed animals + Ranger Fern.
    const fixture = fixtures.sanctuary;
    if (fixture === undefined) throw new Error("sanctuary fixture missing");
    const fixtureState = createState(world, fixture);
    expect(
      sanctuary.npcs.filter((npc) => npcVisible(world, fixtureState, npc)),
    ).toHaveLength(9);
  });

  it("awards Ranger Fern's 3, 8, and 14+ milestone rewards and Clover Wreath keepsake", () => {
    const fresh = createState(world, { area: "sanctuary", spawn: "entrance", seed: 1 });

    // 0 calmed animals: warm welcome, no reward.
    const zero = runKnot(fresh, "ranger_fern");
    expect(zero.lines.join(" ")).toContain("Wildlife Sanctuary");
    expect(zero.lines.join(" ")).toContain("0 of 17");
    expect(world.storyVariable(zero.ink, "sanctuary_visited")).toBe(true);
    expect(world.storyVariable(zero.ink, "sanctuary_reward_3")).toBe(false);

    // 3 calmed animals: +15 coins, +1 snack, chime-yellow.
    const threeState = withCalmed({ ...fresh, ink: zero.ink }, SANCTUARY_SPECIES.slice(0, 3));
    const three = runKnot(threeState, "ranger_fern");
    expect(three.lines.join(" ")).toContain("3 of 17");
    expect(three.tags).toContain("gift: coins 15");
    expect(three.tags).toContain("gift: snack 1");
    expect(three.sounds).toContain("chime-yellow");
    expect(world.storyVariable(three.ink, "sanctuary_reward_3")).toBe(true);
    expect(world.storyVariable(three.ink, "sanctuary_reward_8")).toBe(false);

    // 8 calmed animals: +25 coins, +2 snacks, chime-blue.
    const eightState = withCalmed({ ...fresh, ink: three.ink }, SANCTUARY_SPECIES.slice(0, 8));
    const eight = runKnot(eightState, "ranger_fern");
    expect(eight.lines.join(" ")).toContain("8 of 17");
    expect(eight.tags).toContain("gift: coins 25");
    expect(eight.tags).toContain("gift: snack 2");
    expect(eight.sounds).toContain("chime-blue");
    expect(world.storyVariable(eight.ink, "sanctuary_reward_8")).toBe(true);
    expect(world.storyVariable(eight.ink, "sanctuary_reward_14")).toBe(false);

    // 14 calmed animals: +40 coins, +2 snacks, chime-red, Sanctuary Clover Wreath.
    const fourteenState = withCalmed(
      { ...fresh, ink: eight.ink },
      SANCTUARY_SPECIES.slice(0, 14),
    );
    const fourteen = runKnot(fourteenState, "ranger_fern");
    expect(fourteen.lines.join(" ")).toContain("14 of 17");
    expect(fourteen.lines.join(" ")).toContain("Sanctuary Clover Wreath");
    expect(fourteen.tags).toContain("gift: coins 40");
    expect(fourteen.tags).toContain("gift: snack 2");
    expect(fourteen.sounds).toContain("chime-red");
    expect(world.storyVariable(fourteen.ink, "sanctuary_reward_14")).toBe(true);

    // Club chest shows the Sanctuary Clover Wreath keepsake once earned.
    const chestState: State = {
      ...fourteenState,
      ink: setInkVariables(fourteen.ink, { has_chest: true }),
    };
    const chest = runKnot(chestState, "club_chest");
    expect(chest.lines.join(" ")).toContain("Sanctuary Clover Wreath");

    // 17 calmed animals: celebratory full-house line.
    const allState = withCalmed({ ...fresh, ink: fourteen.ink }, SANCTUARY_SPECIES);
    const all = runKnot(allState, "ranger_fern");
    expect(all.lines.join(" ")).toContain("All 17 of 17");
  });

  it("provides 17 charming pet knots, live board, picnic, barn, journal, and zero Milo", () => {
    const fresh = createState(world, { area: "sanctuary", spawn: "entrance", seed: 1 });
    const allText: string[] = [];

    const animalNpcs = sanctuary.npcs.filter((npc) => npc.visibleWhenCalmed !== undefined);
    expect(animalNpcs).toHaveLength(17);
    for (const npc of animalNpcs) {
      expect(npc.prompt).toBe("Pet");
      const result = runKnot(fresh, npc.knot);
      expect(result.lines.length, npc.knot).toBeGreaterThanOrEqual(1);
      expect(
        result.sounds.some((s) => s === "chime-green" || s === "chime-yellow"),
        npc.knot,
      ).toBe(true);
      const speaker = result.speakers[0] ?? null;
      expect(speakerPortraitSource(world, speaker), npc.knot).not.toBeNull();
      allText.push(...result.lines);
    }

    // Board shows live count + regional hints, then celebrates at 17/17.
    const board0 = runKnot(fresh, "sanctuary_board");
    expect(board0.lines.join(" ")).toContain("0 of 17");
    expect(board0.lines.length).toBeGreaterThan(2);
    const board17 = runKnot(withCalmed(fresh, SANCTUARY_SPECIES), "sanctuary_board");
    expect(board17.lines.join(" ")).toContain("17 of 17");
    allText.push(...board0.lines, ...board17.lines);

    // Picnic reacts to party & gives once-only +1 snack.
    const partyInk = setInkVariables(fresh.ink, { sue_joined: true, jordan_joined: true });
    const picnic1 = runKnot(
      withCalmed({ ...fresh, ink: partyInk }, SANCTUARY_SPECIES.slice(0, 8)),
      "sanctuary_picnic",
    );
    expect(picnic1.lines.join(" ")).toContain("Sue");
    expect(picnic1.lines.join(" ")).toContain("Jordan");
    expect(picnic1.tags).toContain("gift: snack 1");
    expect(world.storyVariable(picnic1.ink, "sanctuary_picnic_basket")).toBe(true);
    const picnic2 = runKnot({ ...fresh, ink: picnic1.ink }, "sanctuary_picnic");
    expect(picnic2.tags).not.toContain("gift: snack 1");
    allText.push(...picnic1.lines);

    const barn = runKnot(fresh, "sanctuary_barn");
    expect(barn.lines.join(" ")).toContain("clover");
    allText.push(...barn.lines);

    // Journal notes update for visiting and earning the Clover Wreath.
    const visitedState: State = {
      ...fresh,
      ink: setInkVariables(fresh.ink, { sanctuary_visited: true }),
    };
    expect(journalNotes(world, visitedState)[0]).toContain("Wildlife Sanctuary");
    const wreathState: State = {
      ...fresh,
      ink: setInkVariables(fresh.ink, { sanctuary_visited: true, sanctuary_reward_14: true }),
    };
    expect(journalNotes(world, wreathState)[0]).toContain("Sanctuary Clover Wreath");
    allText.push(...journalNotes(world, visitedState), ...journalNotes(world, wreathState));

    // Milo remains 100% unnamed in all Sanctuary content.
    expect(allText.join(" ").toLowerCase()).not.toContain("milo");
  });

  it("wires atmosphere, soundtrack, surfaces, Ranger Fern portrait and voice", () => {
    const particles = evaluateAtmosphere("sanctuary", sanctuary.width, sanctuary.height, 120);
    expect(particles.some((p) => p.texture === "sunbeam")).toBe(true);
    expect(particles.some((p) => p.texture === "waterGlint")).toBe(true);
    expect(particles.some((p) => p.texture === "sparkle")).toBe(true);

    const fresh = createState(world, { area: "sanctuary", spawn: "entrance", seed: 1 });
    expect(soundtrackFor(world, fresh, { titleOpen: false })).toMatchObject({
      track: "sanctuary",
      ambience: "forest",
      duck: false,
      title: "Meadow of Friends",
    });

    const map = world.surfaces.sanctuary;
    if (map === undefined) throw new Error("sanctuary surface map missing");
    expect(surfaceAt(map, { x: 465, y: 695 })).toBe("sand");
    expect(surfaceAt(map, { x: 966, y: 904 })).toBe("carpet");
    expect(surfaceAt(map, { x: 875, y: 565 })).toBe("grass");

    expect(speakerAccent("Ranger Fern")).toBe("town");
    expect(speakerPortraitSource(world, "Ranger Fern")).toEqual({
      atlas: "assets/characters/fern/fern.json",
      frame: "down_idle_01",
      cropMode: "adult",
    });
    expect(voiceForSpeaker("Ranger Fern").notes).toEqual([349, 392, 440, 494]);
  });
});
