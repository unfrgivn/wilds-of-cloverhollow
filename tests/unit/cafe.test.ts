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
  type ActionFrame,
  type State,
} from "../../src/core";
import { evaluateAtmosphere } from "../../src/render/atmosphere";

const { world, fixtures } = loadContent();
const cafe = world.areas.cafe;
const plaza = world.areas.plaza;
const park = world.areas.park;
if (cafe === undefined || plaza === undefined || park === undefined)
  throw new Error("cafe, plaza, or park missing");

const none: ActionFrame = blankInput();

function runKnot(
  ink: string,
  knot: string,
  choices: number[] = [],
  stickers: string[] = [],
  coins = 0,
): { ink: string; lines: string[]; sounds: string[]; tags: string[]; choices: string[] } {
  const calmed: Record<string, boolean> = {};
  for (const sticker of stickers) {
    const critter = Object.values(world.critters).find((item) => item.sticker.id === sticker);
    if (critter !== undefined) {
      calmed[critter.id] = true;
      calmed[critter.species] = true;
    }
  }
  const facts = {
    calmed,
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
  let seenChoices: string[] = [];
  const collect = (): void => {
    if (result.line !== null) {
      lines.push(result.line.text);
      if (result.line.sound !== undefined) sounds.push(result.line.sound);
      tags.push(...result.line.tags);
    }
    if (result.choices.length > 0 && seenChoices.length === 0)
      seenChoices = [...result.choices];
  };
  collect();
  let choiceIndex = 0;
  for (let guard = 0; guard < 40 && !result.ended; guard += 1) {
    if (result.choices.length > 0) {
      const pick = choices[choiceIndex] ?? 0;
      choiceIndex += 1;
      result = runInk(world.story, result.ink, { type: "choose", index: pick }, facts);
    } else {
      result = runInk(world.story, result.ink, { type: "next" }, facts);
    }
    collect();
  }
  return { ink: result.ink, lines, sounds, tags, choices: seenChoices };
}

describe("Bon Appetit Café and Cloverhollow Town Life", () => {
  it("passes geometry, prop, hiding, and plaza door checks cleanly", () => {
    expect(cafe.name).toBe("Bon Appetit Café");
    expect(cafe.land).toBe("cloverhollow");
    expect(cafe.width).toBe(1200);
    expect(cafe.height).toBe(800);
    expect(cafe.npcs.map((npc) => npc.id)).toEqual([
      "chef", "dad", "barnaby", "bree", "toby",
    ]);
    expect(cafe.interactables.map((item) => item.id)).toEqual([
      "cafe-pastries", "cafe-menu", "cafe-window",
    ]);
    expect(world.characters.toby?.scale).toBe(0.47);
    for (const id of ["dad", "chef", "barnaby", "bree", "toby"])
      expect(world.characters[id], id).toBeDefined();

    // Plaza's existing storefront talk windows remain untouched.
    expect(plaza.interactables.find((item) => item.id === "bakery")?.point)
      .toEqual({ x: 1180, y: 420 });
    expect(plaza.interactables.find((item) => item.id === "grocery")?.point)
      .toEqual({ x: 655, y: 345 });
    expect(plaza.interactables.find((item) => item.id === "ice-cream")?.point)
      .toEqual({ x: 895, y: 340 });

    const doorTrigger = plaza.triggers.find((trigger) => trigger.id === "cafe-door");
    expect(doorTrigger?.target).toEqual({ area: "cafe", spawn: "door" });
    expect(plaza.spawns["cafe-door"]).toEqual({ x: 1068, y: 452, facing: "down" });

    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party))
      .toEqual([]);
    expect(propDrawingErrors(cafe)).toEqual([]);
    expect(propBlockerErrors(cafe)).toEqual([]);
    expect(hiddenPositions(cafe, world.tunables.playerRadius)).toEqual([]);
  });

  it("steps cleanly between plaza's cafe-door and Bon Appetit Café", () => {
    const plazaFixture = fixtures.plaza;
    if (plazaFixture === undefined) throw new Error("plaza fixture missing");
    let entering: State = {
      ...createState(world, plazaFixture),
      player: { x: 1068, y: 430 },
      facing: "up",
    };
    for (let tick = 0; tick < 60 && entering.area === "plaza"; tick += 1) {
      const move = entering.transition === null ? { x: 0, y: -1 } : { x: 0, y: 0 };
      entering = step(world, entering, { ...none, move }).state;
    }
    expect(entering.area).toBe("cafe");
    expect(entering.player).toEqual({
      x: cafe.spawns.door?.x,
      y: cafe.spawns.door?.y,
    });

    let leaving: State = {
      ...entering,
      player: { x: 315, y: 500 },
      facing: "up",
    };
    for (let tick = 0; tick < 60 && leaving.area === "cafe"; tick += 1) {
      const move = leaving.transition === null ? { x: -1, y: -1 } : { x: 0, y: 0 };
      leaving = step(world, leaving, { ...none, move }).state;
    }
    expect(leaving.area).toBe("plaza");
    expect(leaving.player).toEqual({ x: 1068, y: 452 });
  });

  it("handles Dad's warm first-visit gift and dynamic progress revisits", () => {
    const base = createState(world, fixtures["new-game"]!);
    const first = runKnot(base.ink, "dad");
    expect(world.storyVariable(first.ink, "met_dad")).toBe(true);
    expect(first.lines.join(" ")).toContain("journal");
    expect(first.lines.join(" ")).toContain("Oliver");
    expect(first.tags).toContain("gift: snack 1");
    expect(first.tags).toContain("gift: coins 10");

    const plainRevisit = runKnot(first.ink, "dad");
    expect(plainRevisit.tags).toEqual([]);
    expect(plainRevisit.lines.join(" ")).toContain("school and around town");

    const clubhouseRevisit = runKnot(
      setInkVariables(first.ink, { clubhouse_claimed: true }),
      "dad",
    );
    expect(clubhouseRevisit.lines.join(" ")).toContain("woodland clubhouse");

    const lanternRevisit = runKnot(
      setInkVariables(first.ink, { has_lantern: true, clubhouse_claimed: true }),
      "dad",
    );
    expect(lanternRevisit.lines.join(" ")).toContain("hiking lantern");
  });

  it("handles Chef Bea's Star Cinnamon errand, park tin, keepsake pin, and café shop", () => {
    const base = createState(world, fixtures["new-game"]!);

    // Looking at the park spice tin before Chef Bea's quest doesn't spoil or collect it.
    const earlyTin = runKnot(base.ink, "park_spice_tin");
    expect(earlyTin.lines.join(" ")).toContain("warm cinnamon and vanilla");
    expect(world.storyVariable(earlyTin.ink, "spice_found")).toBe(false);

    // First talk to Chef Bea starts spice_quest and offers sticky café shopping.
    const startQuest = runKnot(base.ink, "chef_bea", [1], [], 10);
    expect(world.storyVariable(startQuest.ink, "spice_quest")).toBe(true);
    expect(startQuest.choices).toEqual([
      "Buy a warm cinnamon bun (5 coins)",
      "Just saying hi!",
    ]);

    // Reminder while searching.
    const remind = runKnot(startQuest.ink, "chef_bea", [0], [], 0);
    expect(remind.lines.join(" ")).toContain("picnic blanket");
    expect(remind.choices).toEqual(["Just saying hi!"]);

    // Finding the Star Cinnamon tin in Meadow Park.
    const picked = runKnot(startQuest.ink, "park_spice_tin");
    expect(world.storyVariable(picked.ink, "spice_found")).toBe(true);
    expect(picked.lines.join(" ")).toContain("Bon Appetit Star Cinnamon");

    // Returning to Chef Bea rewards 2 snacks + 15 coins + Star Pin and allows buying a bun.
    const completed = runKnot(picked.ink, "chef_bea", [0], [], 15);
    expect(world.storyVariable(completed.ink, "spice_returned")).toBe(true);
    expect(completed.tags).toContain("gift: snack 2");
    expect(completed.tags).toContain("gift: coins 15");
    expect(completed.tags).toContain("buy: snack 5");
    expect(completed.sounds).toContain("chime-blue");

    // Bon Appetit Star Pin appears in Fae's clubhouse keepsake chest.
    const chest = runKnot(
      setInkVariables(completed.ink, { has_chest: true }),
      "club_chest",
    );
    expect(chest.lines.join(" ")).toContain(
      "Chef Bea's golden Bon Appetit Star Pin! It still smells faintly like warm cinnamon.",
    );

    // Sticky shop works on subsequent visits too.
    const again = runKnot(completed.ink, "chef_bea", [0], [], 20);
    expect(again.tags).toContain("buy: snack 5");
  });

  it("handles Grandpa Barnaby, Bree, Toby, Look spots, atmosphere, audio, and surfaces", () => {
    const base = createState(world, fixtures["new-game"]!);

    // Grandpa Barnaby: lore & no gift before calming a critter outside Cloverhollow.
    const earlyBarnaby = runKnot(base.ink, "barnaby", [], ["fountain-frog"]);
    expect(earlyBarnaby.lines.join(" ")).toContain("Ancient Tree");
    expect(earlyBarnaby.lines.join(" ")).toContain("grumpy frog");
    expect(world.storyVariable(earlyBarnaby.ink, "barnaby_gift")).toBe(false);

    // After calming an out-of-town critter, Barnaby celebrates and gifts 15 coins once.
    const giftedBarnaby = runKnot(base.ink, "barnaby", [], ["fountain-frog", "bay-bluebird"]);
    expect(world.storyVariable(giftedBarnaby.ink, "barnaby_gift")).toBe(true);
    expect(giftedBarnaby.tags).toContain("gift: coins 15");
    const repeatBarnaby = runKnot(giftedBarnaby.ink, "barnaby", [], ["bay-bluebird", "cozy-bat"]);
    expect(repeatBarnaby.tags).toEqual([]);
    expect(repeatBarnaby.lines.join(" ")).toContain("bat");

    // Bree: invites to star sign early; tips off Crystal Cavern after rode_bus or has_lantern.
    const earlyBree = runKnot(base.ink, "bree");
    expect(earlyBree.lines.join(" ")).toContain("star sign");
    expect(earlyBree.lines.join(" ")).not.toContain("Crystal Cavern");
    const cavernTipBree = runKnot(setInkVariables(base.ink, { has_lantern: true }), "bree");
    expect(cavernTipBree.lines.join(" ")).toContain("Crystal Cavern");

    // Toby: arcade hype + Favourite Treats tip.
    const toby = runKnot(base.ink, "toby");
    expect(toby.lines.join(" ")).toContain("Boop-a-Mole");
    expect(toby.lines.join(" ")).toContain("Star Racer");
    expect(toby.lines.join(" ")).toContain("Favourite Treats");

    // Surfaces: wood default + carpet doormat by the entrance.
    const surface = world.surfaces.cafe;
    if (surface === undefined) throw new Error("cafe surface map missing");
    expect(surfaceAt(surface, { x: 600, y: 550 })).toBe("wood");
    expect(surfaceAt(surface, { x: 316, y: 496 })).toBe("carpet");

    // Soundtrack: Cloverhollow Town + hearth room ambience.
    const cafeState = createState(world, fixtures.cafe!);
    expect(soundtrackFor(world, cafeState, { titleOpen: false })).toEqual({
      track: "home",
      ambience: "hearth",
      duck: false,
      title: "Cloverhollow Town",
    });

    // Atmosphere: warm counter glows, window sunbeams, and rising cocoa-steam motes.
    const particles = evaluateAtmosphere("cafe", cafe.width, cafe.height, 120);
    expect(particles.some((item) => item.texture === "softGlow" && item.layer === "emissive"))
      .toBe(true);
    expect(particles.some((item) => item.texture === "sunbeam" && item.layer === "over"))
      .toBe(true);
    expect(particles.filter((item) => item.texture === "sparkle")).toHaveLength(10);
  });

  it("writes journal notes cleanly and NEVER names Milo in any Milestone 79 line", () => {
    const base = createState(world, fixtures["new-game"]!);
    const rich: State = {
      ...base,
      ink: setInkVariables(base.ink, {
        met_dad: true,
        spice_quest: true,
        spice_found: true,
        spice_returned: true,
        has_lantern: true,
        rode_bus: true,
      }),
    };
    const notes = journalNotes(world, rich);
    expect(notes).toContain(
      "I bumped into Dad at Bon Appetit Cafe! He gave me a warm cinnamon bun and ten coins for " +
        "my adventure.",
    );
    expect(notes).toContain(
      "I found Chef Bea's Star Cinnamon tin in Meadow Park and earned a golden Bon Appetit " +
        "Star Pin!",
    );

    const knots = [
      "dad",
      "chef_bea",
      "park_spice_tin",
      "barnaby",
      "bree",
      "toby",
      "cafe_pastries",
      "cafe_menu",
      "cafe_window",
    ];
    for (const knot of knots) {
      const freshText = runKnot(base.ink, knot, [0], ["hooded-kid"], 20).lines.join(" ");
      const richText = runKnot(rich.ink, knot, [0], ["hooded-kid"], 20).lines.join(" ");
      expect(freshText, `${knot} (fresh)`).not.toMatch(/\bMilo\b/i);
      expect(richText, `${knot} (rich)`).not.toMatch(/\bMilo\b/i);
    }
    expect(notes.join(" ")).not.toMatch(/\bMilo\b/i);
  });
});
