import { describe, expect, it } from "vitest";
import type { Battle, BattleView } from "../../src/core";
import {
  battleStageMood,
  computeBattleChoreography,
} from "../../src/render/battle-choreography";
import { battleCommandPreview, type BattleCommand } from "../../src/ui/battle";

function baseBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    critterId: "frog",
    den: null,
    entry: { x: 500, y: 500 },
    phase: "command",
    message: "",
    revealed: 0,
    selected: 0,
    command: null,
    energy: 5,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    rewardSticker: null,
    phaseTicks: 0,
    ...overrides,
  };
}

function baseBattleView(battle: Battle, overrides: Partial<BattleView> = {}): BattleView {
  return {
    critterId: battle.critterId,
    critterName: "Chaos Frog",
    battleHeight: 190,
    auraCentre: { x: 256, y: 256 },
    bodyCentre: { x: 256, y: 256 },
    phase: battle.phase,
    message: battle.message,
    revealed: battle.revealed,
    commands: [
      { id: "soothe", label: "Soothe", detail: null, disabled: false, feeling: null },
      { id: "play", label: "Play", detail: null, disabled: false, feeling: null },
      { id: "cast", label: "Cast", detail: null, disabled: false, feeling: null },
      { id: "juggle", label: "Juggle", detail: null, disabled: false, feeling: null },
      { id: "snack", label: "Snack", detail: null, disabled: false, feeling: null },
      { id: "run", label: "Run", detail: null, disabled: false, feeling: null },
    ],
    selected: battle.selected,
    energy: battle.energy,
    energyMax: 5,
    calm: battle.calm,
    calmMax: 100,
    check: null,
    hint: null,
    feelings: null,
    windUp: null,
    puff: 0,
    lastGrade: battle.lastGrade,
    rewardSticker: battle.rewardSticker,
    talk: null,
    sparkle: null,
    fluteAssist: null,
    burstSoften: 0,
    lassoAssist: null,
    lassoSteady: false,
    treatTray: null,
    ...overrides,
  };
}

describe("Milestone 83: battleStageMood", () => {
  it("classifies all five dynamic battle stage moods with proper priority", () => {
    const normal = baseBattle({ phase: "command" });
    expect(battleStageMood(normal, baseBattleView(normal))).toBe("calm-normal");

    const windup = baseBattle({
      phase: "command",
      windUp: { feelings: ["grumpy", "hungry"], popped: [false, false], left: 1 },
    });
    expect(battleStageMood(windup, baseBattleView(windup, { puff: 2 }))).toBe("windup");

    const ready = baseBattle({ phase: "command", sparkle: 3 });
    expect(
      battleStageMood(
        ready,
        baseBattleView(ready, { sparkle: { count: 3, max: 3, ready: true }, puff: 2 }),
      ),
    ).toBe("together-ready");

    const activeCheck = baseBattle({ phase: "check", command: "together" });
    expect(battleStageMood(activeCheck, baseBattleView(activeCheck))).toBe("together-active");

    const activeResult = baseBattle({ phase: "result", command: "together", lastGrade: "great" });
    expect(battleStageMood(activeResult, baseBattleView(activeResult))).toBe("together-active");

    const soothed = baseBattle({ phase: "soothed", command: "together" });
    expect(
      battleStageMood(
        soothed,
        baseBattleView(soothed, { sparkle: { count: 3, max: 3, ready: true } }),
      ),
    ).toBe("soothed");

    const reward = baseBattle({ phase: "reward" });
    expect(battleStageMood(reward, baseBattleView(reward))).toBe("soothed");
  });
});

describe("Milestone 83: Together! theater, hit-stop, and Relief Bloom choreography", () => {
  const partyIds = ["maddie", "sue", "jordan"] as const;
  const partyCommands: Record<string, string | null> = {
    maddie: "play",
    sue: "cast",
    jordan: "juggle",
  };

  it("emits eager party bounce and golden sparkle tether when Together! is ready", () => {
    const battle = baseBattle({ phase: "command", sparkle: 3 });
    const view = baseBattleView(battle, {
      sparkle: { count: 3, max: 3, ready: true },
    });
    const choreo = computeBattleChoreography(battle, view, 15, partyIds, partyCommands);
    expect(choreo.stageMood).toBe("together-ready");
    expect(choreo.hitStop).toBe(false);
    expect(choreo.fae.offsetY).toBeLessThan(0);
    expect(choreo.party.maddie?.offsetY).toBeLessThan(0);
    expect(choreo.party.sue?.offsetY).toBeLessThan(0);
    const tetherSparkles = choreo.vfx.filter(
      (particle) => particle.texture === "sparkle" && particle.anchor === "fae",
    );
    expect(tetherSparkles.length).toBeGreaterThanOrEqual(5);
    expect(
      choreo.vfx.some(
        (particle) => particle.texture === "softGlow" && particle.anchor === "fae",
      ),
    ).toBe(true);
  });

  it("choreographs synchronized team wave-hops and sunburst cascade on Together! active", () => {
    const battle = baseBattle({ phase: "check", command: "together", phaseTicks: 10 });
    const choreo = computeBattleChoreography(
      battle,
      baseBattleView(battle),
      10,
      partyIds,
      partyCommands,
    );
    expect(choreo.stageMood).toBe("together-active");
    expect(choreo.fae.offsetY).toBeLessThan(-4);
    for (const id of partyIds) {
      expect(choreo.party[id]?.offsetY ?? 0).toBeLessThan(0);
    }
    expect(choreo.vfx.some((particle) => particle.texture === "softGlow")).toBe(true);
    expect(choreo.vfx.some((particle) => particle.texture === "energyRing")).toBe(true);
    expect(choreo.vfx.some((particle) => particle.texture === "sparkle")).toBe(true);
    expect(choreo.vfx.some((particle) => particle.texture === "heart")).toBe(true);
  });

  it("triggers 3-tick hit-stop squash, starburst flash, and shake on impactful results", () => {
    const greatEarly = baseBattle({
      phase: "result",
      command: "soothe",
      lastGrade: "great",
      phaseTicks: 2,
    });
    const earlyChoreo = computeBattleChoreography(
      greatEarly,
      null,
      20,
      partyIds,
      partyCommands,
    );
    expect(earlyChoreo.hitStop).toBe(true);
    expect(earlyChoreo.critter.scaleX).toBeCloseTo(1.12, 3);
    expect(earlyChoreo.critter.scaleY).toBeCloseTo(0.88, 3);
    expect(Math.abs(earlyChoreo.stageShake.x)).toBeGreaterThan(0);
    expect(Math.abs(earlyChoreo.stageShake.x)).toBeLessThanOrEqual(3.5);
    expect(
      earlyChoreo.vfx.some(
        (particle) =>
          particle.texture === "sparkle" &&
          particle.anchor === "critter" &&
          particle.scaleX >= 1.3 &&
          particle.blend === "add",
      ),
    ).toBe(true);

    const answeredGood = baseBattle({
      phase: "result",
      command: "play",
      lastGrade: "good",
      answered: true,
      phaseTicks: 0,
    });
    expect(
      computeBattleChoreography(answeredGood, null, 20, partyIds, partyCommands).hitStop,
    ).toBe(true);

    const togetherGood = baseBattle({
      phase: "result",
      command: "together",
      lastGrade: "good",
      phaseTicks: 1,
    });
    expect(
      computeBattleChoreography(togetherGood, null, 20, partyIds, partyCommands).hitStop,
    ).toBe(true);

    const togetherMiss = baseBattle({
      phase: "result",
      command: "together",
      lastGrade: "miss",
      phaseTicks: 1,
    });
    expect(
      computeBattleChoreography(togetherMiss, null, 20, partyIds, partyCommands).hitStop,
    ).toBe(false);

    const answeredMiss = baseBattle({
      phase: "result",
      command: "soothe",
      lastGrade: "miss",
      answered: true,
      phaseTicks: 1,
    });
    const answeredMissChoreo = computeBattleChoreography(
      answeredMiss,
      null,
      20,
      partyIds,
      partyCommands,
    );
    expect(answeredMissChoreo.hitStop).toBe(false);
    expect(answeredMissChoreo.stageShake).toEqual({ x: 0, y: 0 });

    const afterHitStop = baseBattle({ ...greatEarly, phaseTicks: 4 });
    const laterChoreo = computeBattleChoreography(
      afterHitStop,
      null,
      24,
      partyIds,
      partyCommands,
    );
    expect(laterChoreo.hitStop).toBe(false);
    expect(laterChoreo.stageShake).toEqual({ x: 0, y: 0 });

    const plainMiss = baseBattle({
      phase: "result",
      command: "soothe",
      lastGrade: "miss",
      answered: false,
      phaseTicks: 1,
    });
    expect(
      computeBattleChoreography(plainMiss, null, 20, partyIds, partyCommands).hitStop,
    ).toBe(false);
  });

  it("emits eight gently rising pastel Relief Bloom petals on soothed and reward", () => {
    const soothed = baseBattle({ phase: "soothed", phaseTicks: 8 });
    const soothedChoreo = computeBattleChoreography(soothed, null, 20, partyIds, partyCommands);
    const soothedPetals = soothedChoreo.vfx.filter((particle) => particle.texture === "petal");
    expect(soothedChoreo.stageMood).toBe("soothed");
    // 8 rising Relief Bloom petals + 5 drifting pastel confetti petals on soothed (Milestone 155).
    expect(soothedPetals).toHaveLength(13);
    expect(soothedPetals.slice(0, 8).filter((petal) => petal.alpha > 0.05).length)
      .toBeGreaterThanOrEqual(7);
    const nextChoreo = computeBattleChoreography(soothed, null, 22, partyIds, partyCommands);
    const nextPetals = nextChoreo.vfx.filter((particle) => particle.texture === "petal");
    expect(nextPetals[0]?.offsetY ?? 0).toBeLessThan(soothedPetals[0]?.offsetY ?? 0);

    const reward = baseBattle({ phase: "reward", phaseTicks: 12 });
    const rewardChoreo = computeBattleChoreography(reward, null, 35, partyIds, partyCommands);
    const rewardPetals = rewardChoreo.vfx.filter((particle) => particle.texture === "petal");
    expect(rewardChoreo.stageMood).toBe("soothed");
    expect(rewardPetals).toHaveLength(8);
  });
});

describe("Milestone 83: battleCommandPreview", () => {
  const cmd = (overrides: Partial<BattleCommand>): BattleCommand => ({
    id: "soothe",
    label: "Soothe",
    detail: null,
    disabled: false,
    feeling: null,
    ...overrides,
  });

  it("returns concise previews for every command kind", () => {
    expect(battleCommandPreview(cmd({ id: "soothe" }), "Fizzy Frog", null)).toBe(
      "Hum a gentle tune to calm Fizzy Frog.",
    );
    expect(battleCommandPreview(cmd({ id: "play", label: "Play" }), "Fizzy Frog", null)).toContain(
      "Maddie",
    );
    expect(battleCommandPreview(cmd({ id: "cast", label: "Cast" }), "Fizzy Frog", null)).toContain(
      "Sue",
    );
    expect(
      battleCommandPreview(cmd({ id: "juggle", label: "Juggle" }), "Fizzy Frog", null),
    ).toContain("Jordan");
    expect(
      battleCommandPreview(cmd({ id: "snack", label: "Snack" }), "Fizzy Frog", null),
    ).toContain("snack");
    expect(battleCommandPreview(cmd({ id: "talk", label: "Talk" }), "Hooded Kid", null)).toContain(
      "heart",
    );
    expect(battleCommandPreview(cmd({ id: "run", label: "Run" }), "Fizzy Frog", null)).toContain(
      "explore",
    );
    expect(
      battleCommandPreview(cmd({ id: "whistle", label: "Whistle" }), "Fizzy Frog", null),
    ).toBe("Whistle helps calm Fizzy Frog.");
  });

  it("appends feeling match callouts and formats disabled cooldowns and empty snacks", () => {
    expect(
      battleCommandPreview(
        cmd({ id: "play", label: "Play", feeling: "zoomy" }),
        "Zoomie Pup",
        "Zoomy",
      ),
    ).toContain("Matches Zoomy!");

    expect(
      battleCommandPreview(
        cmd({
          id: "cast",
          label: "Cast",
          disabled: true,
          detail: "reeling in",
          feeling: "curious",
        }),
        "Fizzy Frog",
        "Curious",
      ),
    ).toBe("Catching a breath (reeling in).");

    expect(
      battleCommandPreview(
        cmd({ id: "snack", label: "Snack", disabled: true, detail: "×0" }),
        "Fizzy Frog",
        null,
      ),
    ).toBe("No snacks or treats left right now.");
  });
});
