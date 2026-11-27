import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createState, runInk, setInkVariables } from "../../src/core";
import { evaluateAtmosphere } from "../../src/render/atmosphere";

const { world, fixtures } = loadContent();
const cafe = world.areas.cafe;
const plaza = world.areas.plaza;
const pass = world.areas.pass;
if (cafe === undefined || plaza === undefined || pass === undefined) {
  throw new Error("cafe, plaza, or pass area missing");
}

function runKnot(
  ink: string,
  knot: string,
  options?: {
    choices?: number[];
    calmed?: string[];
    coins?: number;
  },
): { ink: string; lines: string[]; tags: string[] } {
  const calmed: Record<string, boolean> = {};
  for (const id of options?.calmed ?? []) {
    calmed[id] = true;
    const critter = world.critters[id];
    if (critter !== undefined) calmed[critter.species] = true;
  }
  const facts = {
    calmed,
    coins: options?.coins ?? 0,
    snacks: 2,
    prizes: [],
    plushesLeft: 0,
    tickets: 0,
  };
  let result = runInk(world.story, ink, { type: "start", knot }, facts);
  const lines: string[] = [];
  const tags: string[] = [];
  const collect = (): void => {
    if (result.line !== null) {
      lines.push(result.line.text);
      tags.push(...result.line.tags);
    }
  };
  collect();
  let choiceIndex = 0;
  for (let guard = 0; guard < 40 && !result.ended; guard += 1) {
    if (result.choices.length > 0) {
      const pick = options?.choices?.[choiceIndex] ?? result.choices.length - 1;
      choiceIndex += 1;
      result = runInk(world.story, result.ink, { type: "choose", index: pick }, facts);
    } else {
      result = runInk(world.story, result.ink, { type: "next" }, facts);
    }
    collect();
  }
  return { ink: result.ink, lines, tags };
}

function assertTwoLineFit(lines: readonly string[], label: string): void {
  for (const line of lines) {
    expect(line.length, `${label}: "${line}"`).toBeLessThanOrEqual(105);
  }
}

describe("Milestone 107: Living Valley Townspeople Milestone Reactions", () => {
  const baseInk = createState(world, fixtures["new-game"]!).ink;

  it("Dad reacts warmly to late-game valley milestones and never names Milo early", () => {
    const metInk = setInkVariables(baseInk, { met_dad: true });

    const friends = runKnot(
      setInkVariables(metInk, { sue_compass: true, jordan_clover: true }),
      "dad",
    );
    expect(friends.lines.join(" ")).toContain("Sue's beach cottage");
    expect(friends.lines.join(" ")).toContain("Jordan's mountain cabin");
    assertTwoLineFit(friends.lines, "dad friends");

    const starLine = runKnot(setInkVariables(metInk, { buster_reward: true }), "dad");
    expect(starLine.lines.join(" ")).toContain("Star-Line Explorer");
    assertTwoLineFit(starLine.lines, "dad buster_reward");

    const sanctuary = runKnot(setInkVariables(metInk, { sanctuary_reward_14: true }), "dad");
    expect(sanctuary.lines.join(" ")).toContain("Sanctuary Clover Wreath");
    assertTwoLineFit(sanctuary.lines, "dad sanctuary_reward_14");

    const gems = runKnot(setInkVariables(metInk, { gem_reward_all: true }), "dad");
    expect(gems.lines.join(" ")).toContain("seven Star Gems");
    assertTwoLineFit(gems.lines, "dad gem_reward_all");

    // Before milo_revealed, calming hooded-kid must NEVER name Milo.
    const preReveal = runKnot(
      setInkVariables(metInk, { has_lantern: true }),
      "dad",
      { calmed: ["hooded-kid"] },
    );
    expect(preReveal.lines.join(" ")).not.toMatch(/\bMilo\b/i);

    const revealed = runKnot(setInkVariables(metInk, { milo_revealed: true }), "dad");
    expect(revealed.lines.join(" ")).toContain("Milo");
    assertTwoLineFit(revealed.lines, "dad milo_revealed");
  });

  it("Chef Bea celebrates Chef Mateo, Buster's Star-Line, and Bubblegum Bay rowboats", () => {
    const returnedInk = setInkVariables(baseInk, {
      spice_quest: true,
      spice_found: true,
      spice_returned: true,
    });

    const plain = runKnot(returnedInk, "chef_bea");
    expect(plain.lines[0]).toContain("Star Cinnamon buns are rising golden");

    const boat = runKnot(setInkVariables(returnedInk, { bay_boat_charm: true }), "chef_bea");
    expect(boat.lines.join(" ")).toContain("Bubblegum Bay's sunny cove");
    assertTwoLineFit(boat.lines.slice(0, 2), "chef_bea bay_boat_charm");

    const starLine = runKnot(setInkVariables(returnedInk, { buster_reward: true }), "chef_bea");
    expect(starLine.lines.join(" ")).toContain("Star-Line riders");
    assertTwoLineFit(starLine.lines.slice(0, 2), "chef_bea buster_reward");

    const mateo = runKnot(returnedInk, "chef_bea", { calmed: ["taco-chef"] });
    expect(mateo.lines.join(" ")).toContain("Chef Mateo");
    assertTwoLineFit(mateo.lines.slice(0, 2), "chef_bea taco-chef");
  });

  it("Grandpa Barnaby admires Sanctuary, Star-Line Whistle, and friend-home keepsakes", () => {
    const gemDoneInk = setInkVariables(baseInk, {
      gem_reward_3: true,
      gem_reward_all: true,
    });

    const friends = runKnot(
      setInkVariables(gemDoneInk, { sue_compass: true, jordan_clover: true }),
      "barnaby",
    );
    expect(friends.lines.at(-1)).toContain("sea-glass compass");
    expect(friends.lines.at(-1)).toContain("pressed clover");
    assertTwoLineFit([friends.lines.at(-1) ?? ""], "barnaby friends");

    const whistle = runKnot(setInkVariables(gemDoneInk, { buster_reward: true }), "barnaby");
    expect(whistle.lines.at(-1)).toContain("Golden Star-Line Whistle");
    assertTwoLineFit([whistle.lines.at(-1) ?? ""], "barnaby buster_reward");

    const wreath = runKnot(
      setInkVariables(gemDoneInk, { sanctuary_reward_14: true }),
      "barnaby",
    );
    expect(wreath.lines.at(-1)).toContain("Sanctuary Clover Wreath");
    assertTwoLineFit([wreath.lines.at(-1) ?? ""], "barnaby sanctuary_reward_14");
  });

  it("Bree and Toby keep first-visit lines intact and react to valley milestones", () => {
    const plainBree = runKnot(baseInk, "bree");
    expect(plainBree.lines).toHaveLength(3);
    expect(plainBree.lines.join(" ")).not.toMatch(/\bMilo\b/i);

    const breePrincipal = runKnot(baseInk, "bree", { calmed: ["principal"] });
    expect(breePrincipal.lines.at(-1)).toContain("Mr. Bell");
    assertTwoLineFit([breePrincipal.lines.at(-1) ?? ""], "bree principal");

    const breeHomes = runKnot(
      setInkVariables(baseInk, { sue_cottage_visited: true, jordan_cabin_visited: true }),
      "bree",
    );
    expect(breeHomes.lines.at(-1)).toContain("Sue's beach cottage");
    expect(breeHomes.lines.at(-1)).toContain("Jordan's mountain cabin");
    assertTwoLineFit([breeHomes.lines.at(-1) ?? ""], "bree homes");

    const breeSanctuary = runKnot(setInkVariables(baseInk, { sanctuary_visited: true }), "bree");
    expect(breeSanctuary.lines.at(-1)).toContain("Wildlife Sanctuary");
    assertTwoLineFit([breeSanctuary.lines.at(-1) ?? ""], "bree sanctuary");

    const breeBuster = runKnot(setInkVariables(baseInk, { buster_reward: true }), "bree");
    expect(breeBuster.lines.at(-1)).toContain("Star-Line Stamp Card");
    assertTwoLineFit([breeBuster.lines.at(-1) ?? ""], "bree buster");

    const breeMilo = runKnot(setInkVariables(baseInk, { milo_revealed: true }), "bree");
    expect(breeMilo.lines.at(-1)).toContain("Milo");
    assertTwoLineFit([breeMilo.lines.at(-1) ?? ""], "bree milo");

    const plainToby = runKnot(baseInk, "toby");
    expect(plainToby.lines).toHaveLength(5);
    expect(plainToby.lines.join(" ")).not.toMatch(/\bMilo\b/i);

    const tobyPrincipal = runKnot(baseInk, "toby", { calmed: ["principal"] });
    expect(tobyPrincipal.lines.at(-1)).toContain("Mr. Bell");
    assertTwoLineFit([tobyPrincipal.lines.at(-1) ?? ""], "toby principal");

    const tobyHomes = runKnot(
      setInkVariables(baseInk, { sue_cottage_visited: true, jordan_cabin_visited: true }),
      "toby",
    );
    expect(tobyHomes.lines.at(-1)).toContain("Sue's beach cottage");
    assertTwoLineFit([tobyHomes.lines.at(-1) ?? ""], "toby homes");

    const tobySanctuary = runKnot(setInkVariables(baseInk, { sanctuary_visited: true }), "toby");
    expect(tobySanctuary.lines.at(-1)).toContain("Wildlife Sanctuary");
    assertTwoLineFit([tobySanctuary.lines.at(-1) ?? ""], "toby sanctuary");

    const tobyBuster = runKnot(setInkVariables(baseInk, { buster_reward: true }), "toby");
    expect(tobyBuster.lines.at(-1)).toContain("Star-Line Stamp Card");
    assertTwoLineFit([tobyBuster.lines.at(-1) ?? ""], "toby buster");

    const tobyMilo = runKnot(setInkVariables(baseInk, { milo_revealed: true }), "toby");
    expect(tobyMilo.lines.join(" ")).toContain("Milo");
    expect(tobyMilo.lines.join(" ")).not.toContain("Nobody knows");
    assertTwoLineFit([tobyMilo.lines[2] ?? ""], "toby milo");
  });

  it("Buster reacts after buster_reward to rowboats, friend homes, and Sanctuary", () => {
    const afterInk = setInkVariables(baseInk, { buster_reward: true });

    const boat = runKnot(setInkVariables(afterInk, { bay_boat_charm: true }), "buster");
    expect(boat.lines[1]).toContain("pastel rowboat");
    assertTwoLineFit(boat.lines, "buster bay_boat_charm");

    const homes = runKnot(
      setInkVariables(afterInk, { sue_cottage_visited: true, jordan_cabin_visited: true }),
      "buster",
    );
    expect(homes.lines[1]).toContain("Sue's beach cottage");
    expect(homes.lines[1]).toContain("Jordan's mountain cabin");
    assertTwoLineFit(homes.lines, "buster homes");

    const sanctuary = runKnot(setInkVariables(afterInk, { sanctuary_visited: true }), "buster");
    expect(sanctuary.lines[1]).toContain("Sanctuary meadow");
    assertTwoLineFit(sanctuary.lines, "buster sanctuary");
  });

  it("School & biome friends react warmly on post-calm revisits", () => {
    // Mrs. Flurry post-calm revisit
    const flurryFirst = runKnot(baseInk, "lodge_keeper");
    const flurryCabin = runKnot(
      setInkVariables(flurryFirst.ink, { jordan_cabin_visited: true }),
      "lodge_keeper",
    );
    expect(flurryCabin.lines.at(-1)).toContain("Jordan's mountain cabin");
    assertTwoLineFit([flurryCabin.lines.at(-1) ?? ""], "lodge_keeper jordan_cabin");

    const flurryGift = runKnot(
      setInkVariables(flurryFirst.ink, { sanctuary_gift: true }),
      "lodge_keeper",
    );
    expect(flurryGift.lines.at(-1)).toContain("Sanctuary Ranger Basket");
    assertTwoLineFit([flurryGift.lines.at(-1) ?? ""], "lodge_keeper sanctuary_gift");

    // Ms. Coral post-calm revisit
    const coralFirst = runKnot(baseInk, "lifeguard");
    const coralCottage = runKnot(
      setInkVariables(coralFirst.ink, { sue_cottage_visited: true }),
      "lifeguard",
    );
    expect(coralCottage.lines.at(-1)).toContain("Sue's beach cottage");
    assertTwoLineFit([coralCottage.lines.at(-1) ?? ""], "lifeguard sue_cottage");

    const coralBoat = runKnot(
      setInkVariables(coralFirst.ink, { bay_boat_charm: true }),
      "lifeguard",
    );
    expect(coralBoat.lines.at(-1)).toContain("pastel rowboat");
    assertTwoLineFit([coralBoat.lines.at(-1) ?? ""], "lifeguard bay_boat_charm");

    // Mr. Bell post-calm revisit
    const bellFirst = runKnot(baseInk, "principal");
    const bellSchool = runKnot(
      setInkVariables(bellFirst.ink, { has_flute: true, has_lasso: true }),
      "principal",
      { calmed: ["art-teacher"] },
    );
    expect(bellSchool.lines.at(-1)).toContain("Art, music, and gym");
    assertTwoLineFit([bellSchool.lines.at(-1) ?? ""], "principal school");

    const bellStar = runKnot(
      setInkVariables(bellFirst.ink, { buster_reward: true }),
      "principal",
    );
    expect(bellStar.lines.at(-1)).toContain("Star-Line Explorer");
    assertTwoLineFit([bellStar.lines.at(-1) ?? ""], "principal buster_reward");

    // Ranger Fern revisit
    const fernVisited = setInkVariables(baseInk, { sanctuary_visited: true });
    const fernGift = runKnot(
      setInkVariables(fernVisited, { sanctuary_gift: true }),
      "ranger_fern",
    );
    expect(fernGift.lines.at(-1)).toContain("Pinecone Pass trail board");
    assertTwoLineFit([fernGift.lines.at(-1) ?? ""], "ranger_fern sanctuary_gift");

    const fernBuster = runKnot(
      setInkVariables(fernVisited, { buster_reward: true }),
      "ranger_fern",
    );
    expect(fernBuster.lines.at(-1)).toContain("Star-Line Explorer");
    assertTwoLineFit([fernBuster.lines.at(-1) ?? ""], "ranger_fern buster_reward");
  });

  it("never mentions Milo in any of the 10 knots before milo_revealed is true", () => {
    const allPreRevealInk = setInkVariables(baseInk, {
      met_dad: true,
      spice_quest: true,
      spice_found: true,
      spice_returned: true,
      gem_reward_3: true,
      gem_reward_all: true,
      sanctuary_visited: true,
      sanctuary_reward_14: true,
      sue_cottage_visited: true,
      sue_compass: true,
      jordan_cabin_visited: true,
      jordan_clover: true,
      buster_reward: true,
      bay_boat_charm: true,
      sanctuary_gift: true,
      has_flute: true,
      has_lasso: true,
    });
    const calmedAll = ["hooded-kid", "taco-chef", "principal", "art-teacher"];
    for (const knot of [
      "dad",
      "chef_bea",
      "barnaby",
      "bree",
      "toby",
      "buster",
      "lodge_keeper",
      "lifeguard",
      "principal",
      "ranger_fern",
    ]) {
      const first = runKnot(allPreRevealInk, knot, { calmed: calmedAll });
      const second = runKnot(first.ink, knot, { calmed: calmedAll });
      expect(first.lines.join(" "), `${knot} first`).not.toMatch(/\bMilo\b/i);
      expect(second.lines.join(" "), `${knot} second`).not.toMatch(/\bMilo\b/i);
    }
  });
});

describe("Milestone 107: Story-Reactive World Atmosphere", () => {
  it("adds 6 warm rising cinnamon steam wisps/sparkles in cafe only when cafeCinnamonSteam", () => {
    const base = evaluateAtmosphere("cafe", cafe.width, cafe.height, 120);
    const disabled = evaluateAtmosphere("cafe", cafe.width, cafe.height, 120, {
      cafeCinnamonSteam: false,
    });
    expect(disabled).toEqual(base);

    const active = evaluateAtmosphere("cafe", cafe.width, cafe.height, 120, {
      cafeCinnamonSteam: true,
    });
    expect(active.length).toBe(base.length + 6);
    const added = active.slice(base.length);
    for (const mote of added) {
      expect(mote.layer).toBe("over");
      expect(["mistWisp", "sparkle"]).toContain(mote.texture);
      expect(mote.tint).toBe(0xffe2a8);
      expect(mote.x).toBeGreaterThanOrEqual(420);
      expect(mote.x).toBeLessThanOrEqual(660);
      expect(mote.y).toBeGreaterThanOrEqual(240);
      expect(mote.y).toBeLessThanOrEqual(360);
      expect(mote.alpha).toBeGreaterThanOrEqual(0.18);
      expect(mote.alpha).toBeLessThanOrEqual(0.34);
    }

    // Reduced motion holds the story-reactive motes still across ticks.
    const calm0 = evaluateAtmosphere("cafe", cafe.width, cafe.height, 0, {
      cafeCinnamonSteam: true,
      reducedMotion: true,
    }).slice(base.length);
    const calm240 = evaluateAtmosphere("cafe", cafe.width, cafe.height, 240, {
      cafeCinnamonSteam: true,
      reducedMotion: true,
    }).slice(base.length);
    expect(calm240).toEqual(calm0);
  });

  it("adds 8 pastel-gold fountain mist sparkles in plaza only when plazaStarGlow", () => {
    const base = evaluateAtmosphere("plaza", plaza.width, plaza.height, 120);
    const disabled = evaluateAtmosphere("plaza", plaza.width, plaza.height, 120, {
      plazaStarGlow: false,
    });
    expect(disabled).toEqual(base);

    const active = evaluateAtmosphere("plaza", plaza.width, plaza.height, 120, {
      plazaStarGlow: true,
    });
    expect(active.length).toBe(base.length + 8);
    const added = active.slice(base.length);
    for (const mote of added) {
      expect(mote.layer).toBe("over");
      expect(mote.texture).toBe("sparkle");
      expect([0xffe89a, 0xb8e8ff]).toContain(mote.tint);
      expect(mote.x).toBeGreaterThanOrEqual(820);
      expect(mote.x).toBeLessThanOrEqual(950);
      expect(mote.y).toBeGreaterThanOrEqual(540);
      expect(mote.y).toBeLessThanOrEqual(640);
      expect(mote.alpha).toBeGreaterThanOrEqual(0.24);
      expect(mote.alpha).toBeLessThanOrEqual(0.44);
    }

    const calm0 = evaluateAtmosphere("plaza", plaza.width, plaza.height, 0, {
      plazaStarGlow: true,
      reducedMotion: true,
    }).slice(base.length);
    const calm180 = evaluateAtmosphere("plaza", plaza.width, plaza.height, 180, {
      plazaStarGlow: true,
      reducedMotion: true,
    }).slice(base.length);
    expect(calm180).toEqual(calm0);
  });

  it("adds 6 cream-gold hearth chimney wisps in pass only when passHearthWisps", () => {
    const base = evaluateAtmosphere("pass", pass.width, pass.height, 120);
    const disabled = evaluateAtmosphere("pass", pass.width, pass.height, 120, {
      passHearthWisps: false,
    });
    expect(disabled).toEqual(base);

    const active = evaluateAtmosphere("pass", pass.width, pass.height, 120, {
      passHearthWisps: true,
    });
    expect(active.length).toBe(base.length + 6);
    const added = active.slice(base.length);
    for (const mote of added) {
      expect(mote.layer).toBe("over");
      expect(mote.texture).toBe("mistWisp");
      expect(mote.tint).toBe(0xfff5df);
      expect(mote.x).toBeGreaterThanOrEqual(1210);
      expect(mote.x).toBeLessThanOrEqual(1310);
      expect(mote.y).toBeGreaterThanOrEqual(190);
      expect(mote.y).toBeLessThanOrEqual(310);
      expect(mote.alpha).toBeGreaterThanOrEqual(0.18);
      expect(mote.alpha).toBeLessThanOrEqual(0.32);
    }

    const calm0 = evaluateAtmosphere("pass", pass.width, pass.height, 0, {
      passHearthWisps: true,
      reducedMotion: true,
    }).slice(base.length);
    const calm200 = evaluateAtmosphere("pass", pass.width, pass.height, 200, {
      passHearthWisps: true,
      reducedMotion: true,
    }).slice(base.length);
    expect(calm200).toEqual(calm0);
  });
});
