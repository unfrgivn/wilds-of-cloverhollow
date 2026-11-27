import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createState,
  moleView,
  newMole,
  type Battle,
} from "../../src/core";
import { loadContent, parseMoleCalibration } from "../../src/content/load";
import {
  classifySnackTheater,
  computeBattleChoreography,
} from "../../src/render/battle-choreography";
import { hudHintKeys } from "../../src/ui/hud-hints";
import { layoutMole } from "../../src/ui/mole-layout";

function baseBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    critterId: "frog",
    den: null,
    entry: { x: 500, y: 500 },
    phase: "result",
    message: "",
    revealed: 0,
    selected: 0,
    command: "snack",
    energy: 5,
    calm: 20,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    rewardSticker: null,
    phaseTicks: 10,
    ...overrides,
  };
}

const partyIds = ["maddie", "sue"] as const;
const partyCommands: Record<string, string | null> = {
  maddie: "play",
  sue: "cast",
};

describe("Milestone 135: Battle Snack & Specialty Treat Sharing Theater", () => {
  it("classifies none, plain snack, specialty treat, and favourite/Sunberry lines accurately",
    () => {
      const { world } = loadContent();

      expect(classifySnackTheater(baseBattle({ phase: "command", command: "snack" }))).toBe("none");
      expect(
        classifySnackTheater(
          baseBattle({ phase: "result", command: "soothe", lastGrade: "great" }),
        ),
      ).toBe("none");
      expect(
        classifySnackTheater({ phase: "result", command: "soothe", message: "Great soothe!" }),
      ).toBe("none");

      // Real core snack/treat results carry `lastGrade: null` with null or prior-turn `command`.
      expect(
        classifySnackTheater(
          baseBattle({
            phase: "result",
            command: null,
            lastGrade: null,
            message: "Crunchy Fish Crackers! Their favourite!",
          }),
        ),
      ).toBe("favourite");
      expect(
        classifySnackTheater(
          baseBattle({
            phase: "result",
            command: "together",
            lastGrade: null,
            message: "Fae shares a chilly Berry Swirl Cone. Sweet and refreshing!",
          }),
        ),
      ).toBe("treat");

      // Every critter's plain snack line classifies as "snack".
      for (const critter of Object.values(world.critters)) {
        expect(
          classifySnackTheater(baseBattle({ message: critter.lines.snack })),
          `plain snack for ${critter.id}`,
        ).toBe("snack");
      }

      // Every specialty treat line in content/treats.json classifies cleanly.
      for (const treat of world.treats) {
        const expectedUse = treat.id === "sunberry-nectar" ? "favourite" : "treat";
        expect(
          classifySnackTheater(baseBattle({ message: treat.useLine })),
          `useLine for ${treat.id}`,
        ).toBe(expectedUse);
        expect(
          classifySnackTheater(baseBattle({ message: treat.favouriteLine })),
          `favouriteLine for ${treat.id}`,
        ).toBe("favourite");
      }

      // US spelling and generic specialty treat wording also classify accurately.
      expect(
        classifySnackTheater(baseBattle({ message: "Their absolute favorite crunch!" })),
      ).toBe("favourite");
      expect(
        classifySnackTheater(baseBattle({ message: "Fae shares a special treat!" })),
      ).toBe("treat");
    },
  );

  it("drives restorative snack VFX, arcing treat hearts, and rich favourite bursts", () => {
    const tick = 20;
    const snackBattle = baseBattle({
      phaseTicks: 10,
      message: "Fae shares a crunchy cracker. Energy up! The frog sniffs, curious.",
    });
    const treatBattle = baseBattle({
      phaseTicks: 10,
      message: "Fae shares a chilly Berry Swirl Cone. Sweet and refreshing!",
    });
    const favBattle = baseBattle({
      phaseTicks: 10,
      message: "Crunchy Fish Crackers! Their favourite! Tail, wings, or flippers wiggle with joy!",
    });
    const idleBattle = baseBattle({ phase: "command", command: null, phaseTicks: 10 });

    const idleChoreo = computeBattleChoreography(idleBattle, null, tick, partyIds, partyCommands);
    const snackChoreo = computeBattleChoreography(snackBattle, null, tick, partyIds, partyCommands);
    const treatChoreo = computeBattleChoreography(treatBattle, null, tick, partyIds, partyCommands);
    const favChoreo = computeBattleChoreography(favBattle, null, tick, partyIds, partyCommands);

    // Classic snack: Fae refreshed bob, warm softGlow, and 5 green-gold sparkles on Fae.
    expect(snackChoreo.fae.offsetY).toBeLessThan(idleChoreo.fae.offsetY - 5);
    expect(snackChoreo.vfx.filter((p) => p.anchor === "fae" && p.texture === "softGlow"))
      .toHaveLength(1);
    const snackSparkles = snackChoreo.vfx.filter(
      (p) => p.anchor === "fae" && p.texture === "sparkle",
    );
    expect(snackSparkles).toHaveLength(5);
    expect(snackSparkles.every((p) => p.tint === 0x9be38a || p.tint === 0xffe58a)).toBe(true);
    expect(snackChoreo.vfx.filter((p) => p.anchor === "between")).toHaveLength(0);

    // Specialty treat: Fae toss lean, critter munch bounce, and 4 arcing particles between them.
    expect(treatChoreo.fae.offsetX).toBeGreaterThan(7);
    expect(treatChoreo.fae.offsetY).toBeLessThan(-4);
    expect(treatChoreo.critter.offsetY).toBeLessThan(idleChoreo.critter.offsetY - 4);
    const treatBetween = treatChoreo.vfx.filter((p) => p.anchor === "between");
    expect(treatBetween).toHaveLength(4);
    expect(treatBetween.some((p) => p.texture === "heart")).toBe(true);
    expect(treatBetween.some((p) => p.texture === "sparkle")).toBe(true);

    // Favourite treat: stronger critter bounce, 7 arcing particles, critter softGlow + 6/6 burst.
    expect(favChoreo.critter.offsetY).toBeLessThan(treatChoreo.critter.offsetY - 3);
    const favBetween = favChoreo.vfx.filter((p) => p.anchor === "between");
    expect(favBetween).toHaveLength(7);
    expect(favBetween.some((p) => p.texture === "heart" && p.tint === 0xffd859)).toBe(true);
    expect(favChoreo.vfx.filter((p) => p.anchor === "critter" && p.texture === "softGlow"))
      .toHaveLength(1);
    expect(favChoreo.vfx.filter((p) => p.anchor === "critter" && p.texture === "heart"))
      .toHaveLength(6);
    expect(favChoreo.vfx.filter((p) => p.anchor === "critter" && p.texture === "sparkle"))
      .toHaveLength(6);

    // Reduced motion keeps steady gentle glow/hearts without bounce or spin jitter.
    const reducedFav = computeBattleChoreography(
      favBattle,
      null,
      tick,
      partyIds,
      partyCommands,
      true,
    );
    expect(reducedFav.fae.offsetX).toBeCloseTo(idleChoreo.fae.offsetX, 5);
    expect(reducedFav.fae.offsetY).toBeCloseTo(idleChoreo.fae.offsetY, 5);
    expect(reducedFav.critter.offsetY).toBeCloseTo(idleChoreo.critter.offsetY, 5);
    expect(reducedFav.vfx.length).toBeGreaterThan(0);
    expect(reducedFav.vfx.every((p) => p.rotation === 0)).toBe(true);

    // Non-snack turns remain unaffected by snack theater.
    const soothe = baseBattle({
      phase: "result",
      command: "soothe",
      lastGrade: "great",
      message: "Their favourite song!",
      phaseTicks: 8,
    });
    const sootheNormal = computeBattleChoreography(soothe, null, tick, partyIds, partyCommands);
    const sootheReduced = computeBattleChoreography(
      soothe,
      null,
      tick,
      partyIds,
      partyCommands,
      true,
    );
    expect(sootheNormal).toEqual(sootheReduced);
    expect(sootheNormal.vfx.some((p) => p.texture === "energyRing")).toBe(true);

    // Turn-2 treat after a Together! turn never leaks together-active stage mood or hit-stop.
    const postTogetherTreat = baseBattle({
      phase: "result",
      command: "together",
      lastGrade: null,
      phaseTicks: 2,
      message: "Fae shares a chilly Berry Swirl Cone. Sweet and refreshing!",
    });
    const postTogetherChoreo = computeBattleChoreography(
      postTogetherTreat,
      null,
      tick,
      partyIds,
      partyCommands,
    );
    expect(postTogetherChoreo.stageMood).toBe("calm-normal");
    expect(postTogetherChoreo.hitStop).toBe(false);
    expect(postTogetherChoreo.vfx.filter((p) => p.anchor === "between")).toHaveLength(4);
  });
});

describe("Milestone 135: Final Gamepad Keycap Parity (HUD Photo/Guide & Boop-a-Mole)", () => {
  it("maps HUD photo and guide keys cleanly for keyboard and gamepad modes", () => {
    expect(hudHintKeys("keyboard")).toMatchObject({
      interact: "Z",
      journal: "J",
      lantern: "L",
      flute: "F",
      mute: "M",
      photo: "P",
      guide: "I",
    });
    expect(hudHintKeys("gamepad")).toMatchObject({
      interact: "A",
      journal: "Y",
      lantern: "X",
      flute: "RB",
      mute: "M",
      photo: "View",
      guide: "View",
    });
  });

  it("switches Boop-a-Mole middle cap from Z to A on gamepad while preserving keyboard layout",
    () => {
      const { world, fixtures } = loadContent();
      const fixture = fixtures.arcade;
      if (fixture === undefined) throw new Error("missing arcade fixture");
      const file = "public/assets/arcade/mole-cabinet.json";
      const calibration = parseMoleCalibration(JSON.parse(readFileSync(file, "utf8")), file);
      const [round] = newMole(world.arcade.mole, createState(world, fixture));
      const view = moleView(world, { ...round, phase: "playing", stage: "up", stageTicks: 2 });

      const defaultLayout = layoutMole(view, calibration, 0.35);
      const keyboardLayout = layoutMole(view, calibration, 0.35, "keyboard");
      const gamepadLayout = layoutMole(view, calibration, 0.35, "gamepad");

      expect(defaultLayout).toEqual(keyboardLayout);
      expect(keyboardLayout.holes.map((h) => [h.hole, h.key.label])).toEqual([
        ["up", "↑"],
        ["left", "←"],
        ["middle", "Z"],
        ["right", "→"],
        ["down", "↓"],
      ]);
      expect(gamepadLayout.holes.map((h) => [h.hole, h.key.label])).toEqual([
        ["up", "↑"],
        ["left", "←"],
        ["middle", "A"],
        ["right", "→"],
        ["down", "↓"],
      ]);
    },
  );
});
