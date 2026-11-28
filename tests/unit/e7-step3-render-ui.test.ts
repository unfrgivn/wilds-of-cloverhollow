import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  DUAL_COMBOS,
  battleView,
  blankInput,
  createCheck,
  createState,
  startBattle,
  startFormationBattle,
  viewCheck,
  type Battle,
  type State,
} from "../../src/core";
import { combineInputFrames } from "../../src/platform/gamepad";
import { TouchInput } from "../../src/platform/touch";
import * as BattleChoreo from "../../src/render/battle-choreography";
import {
  battleLayout,
  computeBattleCheckGeometry,
  computeBattleCheckGeometryV2,
  formationFoeLayouts,
} from "../../src/render/battle-layout";
import * as BattleVfx from "../../src/render/battle-vfx";
import * as BattleVfxCombos from "../../src/render/battle-vfx-combos";
import * as BattleVfxStage from "../../src/render/battle-vfx-stage";
import { areaEntityAtlases } from "../../src/render/overworld-render";
import {
  BATTLE_CHECKS_V2_ATLAS,
  battleCheckOverlay,
  buildBattleHudView,
  buildCommandMenuView,
  keepsBattleArrows,
} from "../../src/shell/assets";
import type { AtlasImage } from "../../src/ui/atlas";
import {
  battleCommandPreview,
  classifyBattlePopup,
  type BattleCommand,
  type BattlePopupSnapshot,
} from "../../src/ui/battle";

const { world, fixtures } = loadContent();
const rawPlaza = fixtures["plaza-party"] ?? fixtures.plaza ?? fixtures["new-game"];
if (rawPlaza === undefined) throw new Error("Missing plaza fixture");
const plazaFixture = rawPlaza;

const dummyAtlas = (name: string): AtlasImage => ({
  src: `assets/battle/battle-checks-v2.webp#${name}`,
  frame: { x: 0, y: 0, w: 160, h: 160 },
  atlas: { w: 640, h: 640 },
});

const partyIds = ["maddie", "sue", "jordan"] as const;
const partyCommands: Readonly<Record<string, string | null>> = {
  maddie: "play",
  sue: "cast",
  jordan: "juggle",
};

function makeState(): State {
  return createState(world, plazaFixture, 1);
}

describe("Track E7 Step 3: Multi-Foe Layout, Atlases & Check Geometry", () => {
  it("loads biome formation partner atlases in formation areas", () => {
    const bay = world.areas.bay;
    const woods = world.areas.woods;
    const arcade = world.areas.arcade;
    if (bay === undefined || woods === undefined || arcade === undefined) {
      throw new Error("Missing expected biome areas");
    }
    const bayAliases = areaEntityAtlases(world, bay).map((a) => a.alias);
    expect(bayAliases).toContain(world.critters.pup?.atlas);
    expect(bayAliases).toContain(world.critters.crab?.atlas);
    expect(bayAliases).toContain(world.critters.bluebird?.atlas);

    const woodsAliases = areaEntityAtlases(world, woods).map((a) => a.alias);
    expect(woodsAliases).toContain(world.critters.raccoon?.atlas);
    expect(woodsAliases).toContain(world.critters.squirrel?.atlas);
    expect(woodsAliases).toContain(world.critters.bunny?.atlas);

    const arcadeAliases = areaEntityAtlases(world, arcade).map((a) => a.alias);
    expect(arcadeAliases).toContain(world.critters["arcade-keeper"]?.atlas);
    expect(arcadeAliases).toContain(world.critters.pup?.atlas);
  });

  it("matches single-foe battleLayout exactly and spreads 2- and 3-foe formations cleanly", () => {
    const single = battleLayout(1280, 720, 1280, 720, 145, 156, 3);
    const f1 = formationFoeLayouts(1280, 720, single.scale, [{ battleHeight: 145 }]);
    expect(f1).toEqual([single.critter]);

    const f2Desktop = formationFoeLayouts(1280, 720, 1, [
      { battleHeight: 140 },
      { battleHeight: 130 },
    ]);
    expect(f2Desktop).toHaveLength(2);
    expect(f2Desktop[0]?.x).toBeCloseTo(1280 * 0.48, 2);
    expect(f2Desktop[1]?.x).toBeCloseTo(1280 * 0.64, 2);

    const f3Phone = formationFoeLayouts(874, 402, 0.56, [
      { battleHeight: 140 },
      { battleHeight: 130 },
      { battleHeight: 120 },
    ]);
    expect(f3Phone).toHaveLength(3);
    expect(f3Phone[0]?.x).toBeCloseTo(874 * 0.42, 2);
    expect(f3Phone[1]?.x).toBeCloseTo(874 * 0.53, 2);
    expect(f3Phone[2]?.x).toBeCloseTo(874 * 0.64, 2);
  });

  it("computes v2 check geometry and centers ring on targeted multi-foe slot", () => {
    const layout = battleLayout(1280, 720, 1280, 720, 145, 156, 3);
    const whichView = viewCheck(
      createCheck(
        { kind: "which-one", showTicks: 24, shuffles: 3, swapTicks: 16, pickTicks: 90 },
        "fae",
        false,
        [1, 0, 1, 2],
      ),
      null,
    );
    const whichGeo = computeBattleCheckGeometryV2(whichView, layout, 1280, 720);
    expect(whichGeo?.kind).toBe("which-one");
    if (whichGeo?.kind === "which-one") {
      expect(whichGeo.cupSize).toBe(96);
      expect(whichGeo.cupSpacing).toBe(132);
    }

    const whackView = viewCheck(
      createCheck(
        { kind: "whack", pops: 4, stayTicks: 24, gapTicks: 8 },
        "fae",
        false,
        [0, 1, 2, 3],
      ),
      null,
    );
    const whackGeo = computeBattleCheckGeometryV2(whackView, layout, 874, 402);
    expect(whackGeo?.kind).toBe("whack");
    if (whackGeo?.kind === "whack") {
      expect(whackGeo.slotSize).toBe(56);
      expect(whackGeo.spread).toBe(62);
    }

    const spinView = viewCheck(
      createCheck(
        {
          kind: "spin-snag",
          spinsNeeded: 6,
          spinTicks: 120,
          snagTicks: 56,
          targetTick: 28,
          greatWindow: 5,
          goodWindow: 11,
        },
        "critter",
        false,
        [],
      ),
      null,
    );
    const spinGeo = computeBattleCheckGeometryV2(spinView, layout, 1280, 720);
    expect(spinGeo?.kind).toBe("spin-snag");
    if (spinGeo?.kind === "spin-snag") {
      expect(spinGeo.rect.width).toBe(220);
      expect(spinGeo.rect.height).toBe(220);
    }

    // Ring check centers on targeted foe slot in a multi-foe formation.
    const state = makeState();
    const formation = startFormationBattle(world, state, ["pup", "crab"], "instant");
    const ringState: State = {
      ...state,
      battle: {
        ...formation,
        phase: "check",
        targetIndex: 1,
        check: createCheck(
          { kind: "ring", ticks: 60, targetTick: 40, greatWindow: 6, goodWindow: 12 },
          "critter",
          false,
          [],
        ),
      },
    };
    const bView = battleView(world, ringState);
    const ringGeo = computeBattleCheckGeometry(world, ringState, bView, layout, 1280, 720);
    expect(ringGeo?.kind).toBe("ring");
    if (ringGeo?.kind === "ring") {
      expect(ringGeo.x).toBeCloseTo(1280 * 0.64, 1);
    }
  });
});

describe("Track E7 Step 3: Dual-Friend Synergy Combo VFX & Stage Mood", () => {
  it("re-exports combo helpers across vfx-combos, vfx-stage, vfx, and choreography", () => {
    expect(BattleVfxStage.isDualComboActive).toBe(BattleVfxCombos.isDualComboActive);
    expect(BattleVfx.isDualComboActive).toBe(BattleVfxCombos.isDualComboActive);
    expect(BattleChoreo.isDualComboActive).toBe(BattleVfxCombos.isDualComboActive);
    expect(BattleVfxStage.applyDualComboTheater).toBe(BattleVfxCombos.applyDualComboTheater);
    expect(BattleVfx.applyDualComboTheater).toBe(BattleVfxCombos.applyDualComboTheater);
    expect(BattleChoreo.applyDualComboTheater).toBe(BattleVfxCombos.applyDualComboTheater);
    expect(BattleChoreo.DUAL_COMBO_PALETTES).toBe(BattleVfxCombos.DUAL_COMBO_PALETTES);

    const comboSrc = readFileSync("src/render/battle-vfx-combos.ts", "utf8");
    expect(comboSrc).not.toMatch(/from\s+["']pixi\.js["']/);
  });

  it("emits bespoke VFX and stage moods for all 4 combos with reducedMotion parity", () => {
    const baseState = makeState();
    const frog = world.critters["fountain-frog"];
    if (frog === undefined) throw new Error("missing fountain-frog");
    const baseBattle = startBattle(world, baseState, frog);

    for (const combo of DUAL_COMBOS) {
      const activeBattle: Battle = {
        ...baseBattle,
        phase: "check",
        command: combo.id,
        phaseTicks: 10,
      };
      expect(BattleChoreo.isDualComboActive(activeBattle)).toBe(true);
      const expectedMood =
        combo.id === "combo:cloverhollow-harmony" ? "together-active" : "together-ready";
      expect(BattleChoreo.battleStageMood(activeBattle, null)).toBe(expectedMood);

      const live = BattleChoreo.computeBattleChoreography(
        activeBattle,
        null,
        24,
        partyIds,
        partyCommands,
        false,
      );
      expect(live.vfx.length).toBeGreaterThanOrEqual(8);
      expect(live.vfx.length).toBeLessThanOrEqual(80);

      const reduced = BattleChoreo.computeBattleChoreography(
        activeBattle,
        null,
        24,
        partyIds,
        partyCommands,
        true,
      );
      expect(reduced.vfx.length).toBeGreaterThanOrEqual(8);
      expect(reduced.vfx.every((p) => p.rotation === 0)).toBe(true);
    }
  });
});

describe("Track E7 Step 3: Touch Target, View Models, Popups & CSS Hygiene", () => {
  it("emits target from TouchInput.tapTarget through combineInputFrames cleanly", () => {
    const touch = new TouchInput();
    expect(touch.sample().target).toBeUndefined();
    touch.tapTarget(2);
    const sampled = touch.sample();
    expect(sampled.target).toBe(2);
    const combined = combineInputFrames(blankInput(), sampled, blankInput());
    expect(combined.target).toBe(2);
    expect(touch.sample().target).toBeUndefined();
    expect(combineInputFrames(blankInput(), blankInput(), blankInput())).toEqual(blankInput());
  });

  it("projects multi-foe HUD, Boss Phase-2 banner/popup, combos, and v2 checks", () => {
    expect(BATTLE_CHECKS_V2_ATLAS).toBe("assets/battle/battle-checks-v2.json");
    expect(keepsBattleArrows("which-one")).toBe(true);
    expect(keepsBattleArrows("whack")).toBe(true);
    expect(keepsBattleArrows("spin-snag")).toBe(true);
    expect(keepsBattleArrows("ring")).toBe(false);

    const castCmd: BattleCommand = {
      id: "cast",
      label: "Cast",
      detail: null,
      disabled: false,
      feeling: null,
    };
    expect(battleCommandPreview(castCmd, "Pup", null, true)).toContain("Splashes adjacent foes!");
    const juggleCmd: BattleCommand = {
      id: "juggle",
      label: "Juggle",
      detail: null,
      disabled: false,
      feeling: null,
    };
    expect(battleCommandPreview(juggleCmd, "Pup", null, true)).toContain(
      "Ricochets across targets!",
    );
    for (const combo of DUAL_COMBOS) {
      const preview = battleCommandPreview(
        {
          id: combo.id,
          label: combo.label,
          detail: `★${combo.cost}`,
          disabled: false,
          feeling: null,
        },
        "Pup",
        null,
        true,
      );
      expect(preview.length).toBeGreaterThan(15);
    }

    // Boss Phase-2 popup triggers strictly on false -> true transition.
    const snapA: BattlePopupSnapshot = {
      battleKey: "gull",
      calm: 40,
      energy: 5,
      poppedCount: 0,
      message: "Go!",
      tick: 100,
      bossPhase2: false,
    };
    expect(classifyBattlePopup(snapA, { ...snapA, bossPhase2: true, tick: 101 })).toEqual([
      { kind: "big", text: "PHASE 2! ★", side: "critter" },
    ]);
    expect(
      classifyBattlePopup(
        { ...snapA, bossPhase2: true, tick: 101 },
        { ...snapA, bossPhase2: true, tick: 102 },
      ),
    ).toEqual([]);

    // Single-foe Turn 1 HUD omits multi-foe plates & Phase-2 banner.
    const baseState = makeState();
    const frog = world.critters["fountain-frog"];
    if (frog === undefined) throw new Error("missing fountain-frog");
    const singleState: State = {
      ...baseState,
      battle: { ...startBattle(world, baseState, frog), phase: "command" },
    };
    const singleHud = buildBattleHudView({
      world,
      state: singleState,
      battle: battleView(world, singleState),
      partyCommands,
      paused: false,
      canPeek: true,
      peekOpen: false,
      speakerPortrait: () => null,
      checkV2Art: dummyAtlas,
    });
    expect(singleHud.foes).toBeUndefined();
    expect(singleHud.bossPhase2).toBeNull();
    expect(singleHud.bossIntent).toBeNull();

    // Multi-foe battle projects foe plates, intents, and combo art.
    const multiBattle: Battle = {
      ...startFormationBattle(world, baseState, ["pup", "crab"], "instant"),
      phase: "command",
      sparkle: 3,
    };
    const multiState: State = { ...baseState, battle: multiBattle };
    const multiView = battleView(world, multiState);
    const multiHud = buildBattleHudView({
      world,
      state: multiState,
      battle: multiView,
      partyCommands,
      paused: false,
      canPeek: true,
      peekOpen: false,
      speakerPortrait: () => null,
      checkV2Art: dummyAtlas,
    });
    expect(multiHud.foes).toHaveLength(2);
    expect(multiHud.foes?.[0]?.targeted).toBe(true);
    expect(multiHud.foes?.[0]?.intent?.art).not.toBeNull();

    const menuView = buildCommandMenuView(multiState, multiView, dummyAtlas);
    const comboItem = menuView.commands.find((c) => c.combo === true);
    expect(comboItem?.comboArt).not.toBeNull();

    // v2 check overlay projection attaches Art Wave B3 frames cleanly.
    const whackBattle: Battle = {
      ...multiBattle,
      phase: "check",
      check: createCheck(
        { kind: "whack", pops: 4, stayTicks: 24, gapTicks: 8 },
        "fae",
        false,
        [0, 1, 2, 3],
      ),
    };
    const whackState: State = { ...baseState, battle: whackBattle };
    const whackView = battleView(world, whackState);
    const layout = battleLayout(1280, 720, 1280, 720, 145, 156, 3);
    const whackGeo = computeBattleCheckGeometry(world, whackState, whackView, layout, 1280, 720);
    const overlay = battleCheckOverlay(whackView, whackGeo, dummyAtlas, dummyAtlas);
    expect(overlay?.kind).toBe("whack");
    if (overlay?.kind === "whack") {
      expect(overlay.art.slot).not.toBeNull();
      expect(overlay.art.pop).not.toBeNull();
      expect(overlay.art.hit).not.toBeNull();
    }
  });

  it("enforces reduced-motion parity and Safari touch hygiene in battle.css", () => {
    const css = readFileSync("src/ui/battle.css", "utf8");
    for (const selector of [
      ".battle-foe-plate",
      ".battle-phase2-banner",
      ".battle-command.is-combo",
      ".battle-which-one-cup",
      ".battle-whack-slot",
      ".battle-spin-snag-petal",
      ".battle-spin-snag-btn",
    ]) {
      expect(css, `missing ${selector}`).toContain(selector);
    }
    expect(css).toContain(':root[data-reduced-motion="on"] .battle-phase2-banner');
    expect(css).toContain(':root[data-reduced-motion="on"] .battle-spin-snag-btn');
    expect(css).toContain(':root[data-touch="on"] .battle-whack-key');
  });
});
