import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import type { Battle, BattleTalk } from "../../src/core";
import { evaluateAtmosphere as evaluateFromRenderer } from "../../src/render/atmosphere";
import { evaluateIndoorAtmosphere } from "../../src/render/atmosphere-indoor";
import { evaluateOutdoorAtmosphere } from "../../src/render/atmosphere-outdoor";
import { evaluateAtmosphere } from "../../src/render/atmosphere-recipes";
import {
  computeBattleChoreography,
  isTalkTheater,
} from "../../src/render/battle-choreography";
import { formatPostcardCompanions, postcardMetadata } from "../../src/ui/postcard";

const { world } = loadContent();

const partyIds = ["maddie", "sue", "jordan"];
const partyCommands: Readonly<Record<string, string | null>> = {
  maddie: "play",
  sue: "cast",
  jordan: "juggle",
};

function makeTalk(overrides: Partial<BattleTalk> = {}): BattleTalk {
  return {
    knot: "kid_talk_1",
    turn: 0,
    speaker: "Hooded Kid",
    text: "You don't even know who I am!",
    revealed: 31,
    choices: ["A friend", "Star Racer fan", "My brother"],
    selected: 0,
    ended: false,
    grade: null,
    ...overrides,
  };
}

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    critterId: "hooded-kid",
    den: null,
    entry: { x: 800, y: 600 },
    phase: "talk",
    message: "",
    revealed: 0,
    selected: 0,
    command: "talk",
    energy: 5,
    calm: 100,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 4,
    windUp: null,
    talkMode: true,
    talk: makeTalk(),
    talkTurns: 1,
    rewardSticker: null,
    phaseTicks: 18,
    ...overrides,
  };
}

describe("Milestone 136: Heart-to-Heart Talk Climax Choreography", () => {
  it("identifies active Talk theater and stays off outside Talk or during soothed/reward", () => {
    expect(isTalkTheater(makeBattle())).toBe(true);
    expect(isTalkTheater(makeBattle({ talk: null }))).toBe(false);
    expect(isTalkTheater(makeBattle({ talk: undefined }))).toBe(false);
    expect(isTalkTheater(makeBattle({ phase: "soothed", talk: makeTalk() }))).toBe(false);
    expect(isTalkTheater(makeBattle({ phase: "reward", talk: makeTalk() }))).toBe(false);
  });

  it("emits empathetic lean, warm glow, and drifting heart/sparkle bridge during Talk", () => {
    const promptBattle = makeBattle({ talk: makeTalk({ grade: null }) });
    const choreo = computeBattleChoreography(promptBattle, null, 36, partyIds, partyCommands);

    expect(choreo.fae.offsetX).toBeCloseTo(6, 5);
    expect(choreo.critter.offsetY).toBeGreaterThan(1);

    const glow = choreo.vfx.filter(
      (particle) => particle.anchor === "critter" && particle.texture === "softGlow",
    );
    expect(glow).toHaveLength(1);
    const halo = glow[0];
    if (halo === undefined) throw new Error("expected talk softGlow");
    expect(halo.tint).toBe(0xffebb8);
    expect(halo.scaleX).toBe(1.9);
    expect(halo.scaleY).toBe(1.6);
    expect(halo.alpha).toBeGreaterThanOrEqual(0.24);
    expect(halo.alpha).toBeLessThanOrEqual(0.34);

    const bridgeHearts = choreo.vfx.filter(
      (particle) => particle.anchor === "between" && particle.texture === "heart",
    );
    expect(bridgeHearts).toHaveLength(4);
    expect(bridgeHearts.map((particle) => particle.tint)).toEqual([
      0xffb7cf, 0xffe599, 0xc5e8d5, 0xd8c4ff,
    ]);
    for (const heart of bridgeHearts) {
      expect(heart.t).toBeGreaterThanOrEqual(0.22);
      expect(heart.t).toBeLessThanOrEqual(0.82);
    }

    const bridgeSparkles = choreo.vfx.filter(
      (particle) => particle.anchor === "between" && particle.texture === "sparkle",
    );
    expect(bridgeSparkles).toHaveLength(3);
    expect(bridgeSparkles.every((particle) => particle.tint === 0xfff0b2)).toBe(true);
    for (const sparkle of bridgeSparkles) {
      expect(sparkle.t).toBeGreaterThanOrEqual(0.22);
      expect(sparkle.t).toBeLessThanOrEqual(0.82);
    }

    // No extra critter sparkles before a reply grade lands.
    const promptCritterSparkles = choreo.vfx.filter(
      (particle) => particle.anchor === "critter" && particle.texture === "sparkle",
    );
    expect(promptCritterSparkles).toHaveLength(0);

    // Graded reply emits 3 extra soft rising golden sparkles around Milo.
    const replyBattle = makeBattle({
      talk: makeTalk({ grade: "great", choices: [], text: "Wait... you really noticed?" }),
    });
    const replyChoreo = computeBattleChoreography(replyBattle, null, 36, partyIds, partyCommands);
    const replySparkles = replyChoreo.vfx.filter(
      (particle) => particle.anchor === "critter" && particle.texture === "sparkle",
    );
    expect(replySparkles).toHaveLength(3);
    expect(replySparkles.every((particle) => particle.tint === 0xfff0b2)).toBe(true);
  });

  it("holds steady glow and still hearts under reducedMotion and clears on soothed/reward", () => {
    const replyBattle = makeBattle({
      talk: makeTalk({ grade: "good", choices: [] }),
    });
    const reducedA = computeBattleChoreography(
      replyBattle,
      null,
      10,
      partyIds,
      partyCommands,
      true,
    );
    const reducedB = computeBattleChoreography(
      replyBattle,
      null,
      125,
      partyIds,
      partyCommands,
      true,
    );
    expect(reducedA.fae).toEqual(reducedB.fae);
    expect(reducedA.critter).toEqual(reducedB.critter);
    expect(reducedA.vfx).toEqual(reducedB.vfx);
    expect(reducedA.fae.offsetX).toBe(6);
    expect(reducedA.vfx.every((particle) => particle.rotation === 0)).toBe(true);

    // Soothed and reward emit Relief Bloom / radial burst only, never Talk bridge VFX.
    const soothed = computeBattleChoreography(
      makeBattle({ phase: "soothed", talk: null, phaseTicks: 15 }),
      null,
      36,
      partyIds,
      partyCommands,
    );
    const reward = computeBattleChoreography(
      makeBattle({ phase: "reward", talk: null, phaseTicks: 15 }),
      null,
      36,
      partyIds,
      partyCommands,
    );
    expect(soothed.vfx.filter((particle) => particle.anchor === "between")).toHaveLength(0);
    expect(reward.vfx.filter((particle) => particle.anchor === "between")).toHaveLength(0);
    expect(
      reward.vfx.filter(
        (particle) => particle.anchor === "critter" && particle.texture === "softGlow",
      ),
    ).toHaveLength(0);
  });
});

describe("Milestone 136: Photo Mode Postcard Companion Stamp", () => {
  it("formats 0, 1, 2, 3, 4, and 5+ companion names cleanly while deduplicating", () => {
    expect(formatPostcardCompanions([])).toBe("");
    expect(formatPostcardCompanions(["  ", ""])).toBe("");
    expect(formatPostcardCompanions(["Maddie"])).toBe("with Maddie");
    expect(formatPostcardCompanions([" Maddie ", "maddie", ""])).toBe("with Maddie");
    expect(formatPostcardCompanions(["Maddie", "Sue"])).toBe("with Maddie & Sue");
    expect(formatPostcardCompanions(["Maddie", "Sue", "Jordan"])).toBe(
      "with Maddie, Sue & Jordan",
    );
    expect(formatPostcardCompanions(["Maddie", "Sue", "Jordan", "Pond Pup"])).toBe(
      "with Maddie, Sue, Jordan & Pond Pup",
    );
    expect(
      formatPostcardCompanions(["Maddie", "Sue", "Jordan", "Pond Pup", "Acorn Squirrel"]),
    ).toBe("with Maddie, Sue, Jordan & friends");
  });

  it("extends postcardMetadata with companions while staying byte-identical when omitted", () => {
    expect(postcardMetadata("plaza", "Cloverhollow Plaza", "Cloverhollow")).toEqual({
      filename: "cloverhollow-postcard-plaza.png",
      caption: "Cloverhollow Plaza · Wilds of Cloverhollow",
      subcaption: "Cloverhollow",
    });
    expect(postcardMetadata("plaza", "Cloverhollow Plaza", "Cloverhollow", [])).toEqual({
      filename: "cloverhollow-postcard-plaza.png",
      caption: "Cloverhollow Plaza · Wilds of Cloverhollow",
      subcaption: "Cloverhollow",
    });
    expect(
      postcardMetadata("plaza", "Cloverhollow Plaza", "Cloverhollow", ["Maddie"]),
    ).toEqual({
      filename: "cloverhollow-postcard-plaza.png",
      caption: "Cloverhollow Plaza · Wilds of Cloverhollow",
      subcaption: "Cloverhollow · with Maddie",
    });
    expect(
      postcardMetadata("woods", "Whispering Woods", "", ["Maddie", "Sue", "Jordan"]),
    ).toEqual({
      filename: "cloverhollow-postcard-woods.png",
      caption: "Whispering Woods · Wilds of Cloverhollow",
      subcaption: "with Maddie, Sue & Jordan",
    });
  });
});

describe("Milestone 136: Modular Atmosphere Split", () => {
  it("produces deterministic valid particles across all 31 playable areas", () => {
    const playable = Object.values(world.areas).filter((area) => area.id !== "harness");
    expect(playable).toHaveLength(31);
    expect(evaluateAtmosphere("harness", 1200, 800, 120)).toEqual([]);

    let outdoorCount = 0;
    let indoorCount = 0;
    for (const area of playable) {
      const a = evaluateAtmosphere(area.id, area.width, area.height, 120);
      const b = evaluateFromRenderer(area.id, area.width, area.height, 120);
      expect(a, `area ${area.id} determinism`).toEqual(b);
      expect(a.length, `area ${area.id} emits particles`).toBeGreaterThan(0);

      const outdoor = evaluateOutdoorAtmosphere(area.id, area.width, area.height, 120);
      const indoor = evaluateIndoorAtmosphere(area.id, area.width, area.height, 120);
      expect(
        (outdoor !== null) !== (indoor !== null),
        `area ${area.id} belongs to exactly one atmosphere module`,
      ).toBe(true);
      if (outdoor !== null) {
        outdoorCount += 1;
        expect(outdoor).toEqual(a);
      }
      if (indoor !== null) {
        indoorCount += 1;
        expect(indoor).toEqual(a);
      }

      for (const particle of a) {
        expect(Number.isFinite(particle.x)).toBe(true);
        expect(Number.isFinite(particle.y)).toBe(true);
        expect(particle.alpha).toBeGreaterThanOrEqual(0);
        expect(particle.alpha).toBeLessThanOrEqual(1);
      }

      const reduced0 = evaluateAtmosphere(area.id, area.width, area.height, 0, {
        reducedMotion: true,
      });
      const reduced240 = evaluateAtmosphere(area.id, area.width, area.height, 240, {
        reducedMotion: true,
      });
      expect(reduced0, `area ${area.id} reducedMotion steady`).toEqual(reduced240);
    }
    expect(outdoorCount).toBe(13);
    expect(indoorCount).toBe(18);
  });

  it("keeps atmosphere-recipes.ts under 120 lines and all atmosphere modules Pixi-free", () => {
    const recipesLines = readFileSync("src/render/atmosphere-recipes.ts", "utf8")
      .trimEnd()
      .split("\n").length;
    expect(recipesLines).toBeLessThan(120);
    for (const file of [
      "src/render/atmosphere-shared.ts",
      "src/render/atmosphere-outdoor.ts",
      "src/render/atmosphere-indoor.ts",
      "src/render/atmosphere-recipes.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} must not import pixi.js`).not.toMatch(/from\s+["']pixi\.js["']/);
    }
  });
});
