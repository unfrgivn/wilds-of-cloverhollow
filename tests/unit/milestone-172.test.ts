import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { battleView, createState, type Battle } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { effectRecipe as audioEffectRecipe } from "../../src/platform/audio";
import {
  effectRecipe as effectsEffectRecipe,
  effectRecipes as effectsEffectRecipes,
  type CompanionAudioEffect,
} from "../../src/platform/audio-effects";
import {
  effectRecipe as recipesEffectRecipe,
  effectRecipes as recipesEffectRecipes,
} from "../../src/platform/audio-recipes";
import {
  computeBattleChoreography,
  isRecoverTheater,
  RECOVER_SPARKLE_TINTS,
} from "../../src/render/battle-choreography";
import { isRecoverTheater as vfxIsRecoverTheater } from "../../src/render/battle-vfx";
import { buildBattleHudView } from "../../src/shell/view-models";
import { classifyBattlePopup, type BattlePopupSnapshot } from "../../src/ui/battle-popups";

function baseBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    critterId: "fountain-frog",
    den: null,
    entry: { x: 500, y: 500 },
    phase: "result",
    message: "Fae takes a slow, steady breath and catches her energy.",
    revealed: 0,
    selected: 1,
    command: "recover",
    energy: 5,
    calm: 20,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 1,
    actorIndex: 0,
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

describe("Milestone 172: Per-Member Recover Theater VFX & Popup", () => {
  it("classifies Recover theater strictly on result phase with recover command", () => {
    expect(isRecoverTheater).toBe(vfxIsRecoverTheater);
    expect(isRecoverTheater(baseBattle())).toBe(true);
    expect(isRecoverTheater(baseBattle({ phase: "command", command: "recover" }))).toBe(false);
    expect(isRecoverTheater(baseBattle({ phase: "check", command: "recover" }))).toBe(false);
    expect(isRecoverTheater(baseBattle({ phase: "burst", command: "recover" }))).toBe(false);
    expect(isRecoverTheater(baseBattle({ phase: "soothed", command: "recover" }))).toBe(false);
    expect(isRecoverTheater(baseBattle({ phase: "result", command: "soothe" }))).toBe(false);
    expect(isRecoverTheater(baseBattle({ phase: "result", command: "snack" }))).toBe(false);
    expect(isRecoverTheater(baseBattle({ phase: "result", command: null }))).toBe(false);
  });

  it("animates Fae inhale-exhale bob + clover glow + 6 rising sparkles and honours reducedMotion",
    () => {
      const idleRef = computeBattleChoreography(
        baseBattle({ phase: "command", command: null }),
        null,
        30,
        partyIds,
        partyCommands,
        false,
      );
      const active = computeBattleChoreography(
        baseBattle({ actorIndex: 0, phaseTicks: 10 }),
        null,
        30,
        partyIds,
        partyCommands,
        false,
      );

      // Cozy upward inhale bob on Fae only; party members stay at idle baseline.
      expect(active.fae.offsetY).toBeLessThan(idleRef.fae.offsetY - 4);
      expect(active.fae.scaleY).toBeGreaterThan(idleRef.fae.scaleY);
      expect(active.party.maddie).toEqual(idleRef.party.maddie);
      expect(active.party.sue).toEqual(idleRef.party.sue);

      const glows = active.vfx.filter((p) => p.texture === "softGlow");
      const sparkles = active.vfx.filter((p) => p.texture === "sparkle");
      expect(glows).toHaveLength(1);
      expect(glows[0]?.anchor).toBe("fae");
      expect(glows[0]?.actorId).toBeUndefined();
      expect(glows[0]?.tint).toBe(0x9be38a);

      expect(sparkles).toHaveLength(6);
      for (const sparkle of sparkles) {
        expect(sparkle.anchor).toBe("fae");
        expect(sparkle.actorId).toBeUndefined();
        expect(RECOVER_SPARKLE_TINTS).toContain(sparkle.tint);
      }

      // Sparkles rise over time between early and mid phaseTicks.
      const early = computeBattleChoreography(
        baseBattle({ actorIndex: 0, phaseTicks: 2 }),
        null,
        22,
        partyIds,
        partyCommands,
        false,
      );
      const earlyMeanY =
        early.vfx
          .filter((p) => p.texture === "sparkle")
          .reduce((sum, p) => sum + p.offsetY, 0) / 6;
      const midMeanY = sparkles.reduce((sum, p) => sum + p.offsetY, 0) / 6;
      expect(midMeanY).toBeLessThan(earlyMeanY - 10);

      // Reduced motion: zero bob, steady glow & upright sparkles across ticks.
      const rmA = computeBattleChoreography(
        baseBattle({ actorIndex: 0, phaseTicks: 10 }),
        null,
        30,
        partyIds,
        partyCommands,
        true,
      );
      const rmB = computeBattleChoreography(
        baseBattle({ actorIndex: 0, phaseTicks: 10 }),
        null,
        44,
        partyIds,
        partyCommands,
        true,
      );
      expect(rmA.fae.offsetY).toBe(idleRef.fae.offsetY);
      expect(rmA.fae.scaleY).toBe(idleRef.fae.scaleY);
      const rmGlowA = rmA.vfx.find((p) => p.texture === "softGlow");
      const rmGlowB = rmB.vfx.find((p) => p.texture === "softGlow");
      expect(rmGlowA?.alpha).toBe(rmGlowB?.alpha);
      expect(rmGlowA?.scaleX).toBe(rmGlowB?.scaleX);
      const rmSparkles = rmA.vfx.filter((p) => p.texture === "sparkle");
      expect(rmSparkles).toHaveLength(6);
      for (const sparkle of rmSparkles) {
        expect(sparkle.anchor).toBe("fae");
        expect(sparkle.rotation).toBe(0);
      }
    },
  );

  it("anchors Recover bob, clover glow, and 6 sparkles onto the recovering party member", () => {
    const idleRef = computeBattleChoreography(
      baseBattle({ phase: "command", command: null, actorIndex: 2 }),
      null,
      36,
      partyIds,
      partyCommands,
      false,
    );
    const sueRecover = computeBattleChoreography(
      baseBattle({
        actorIndex: 2,
        phaseTicks: 12,
        message: "Sue reels in her line and takes a calm breath.",
      }),
      null,
      36,
      partyIds,
      partyCommands,
      false,
    );

    // Sue gets the inhale bob; Fae and Maddie stay at idle baseline.
    expect(sueRecover.party.sue?.offsetY).toBeLessThan((idleRef.party.sue?.offsetY ?? 0) - 5);
    expect(sueRecover.fae.offsetY).toBe(idleRef.fae.offsetY);
    expect(sueRecover.party.maddie).toEqual(idleRef.party.maddie);

    const glows = sueRecover.vfx.filter((p) => p.texture === "softGlow");
    const sparkles = sueRecover.vfx.filter((p) => p.texture === "sparkle");
    expect(glows).toHaveLength(1);
    expect(glows[0]?.anchor).toBe("party");
    expect(glows[0]?.actorId).toBe("sue");
    expect(glows[0]?.tint).toBe(0x9be38a);

    expect(sparkles).toHaveLength(6);
    for (const sparkle of sparkles) {
      expect(sparkle.anchor).toBe("party");
      expect(sparkle.actorId).toBe("sue");
      expect(RECOVER_SPARKLE_TINTS).toContain(sparkle.tint);
    }

    // Maddie under reducedMotion: zero bob, steady party-anchored glow & 6 upright sparkles.
    const maddieRm = computeBattleChoreography(
      baseBattle({
        actorIndex: 1,
        phaseTicks: 10,
        message: "Maddie curls up for a quick stretch, tail wagging again!",
      }),
      null,
      36,
      partyIds,
      partyCommands,
      true,
    );
    expect(maddieRm.party.maddie).toEqual(idleRef.party.maddie);
    const maddieGlow = maddieRm.vfx.find((p) => p.texture === "softGlow");
    expect(maddieGlow?.anchor).toBe("party");
    expect(maddieGlow?.actorId).toBe("maddie");
    const maddieSparkles = maddieRm.vfx.filter((p) => p.texture === "sparkle");
    expect(maddieSparkles).toHaveLength(6);
    for (const sparkle of maddieSparkles) {
      expect(sparkle.anchor).toBe("party");
      expect(sparkle.actorId).toBe("maddie");
      expect(sparkle.rotation).toBe(0);
    }
  });

  it("emits READY! ✦ on Recover at full energy and avoids double-popping when +1 ⚡ fires", () => {
    const prevFull: BattlePopupSnapshot = {
      battleKey: "fountain-frog",
      calm: 20,
      energy: 5,
      poppedCount: 0,
      message: "What should Fae do?",
      tick: 120,
      recovered: false,
    };
    const nextFull: BattlePopupSnapshot = {
      ...prevFull,
      message: "Fae takes a slow, steady breath and catches her energy.",
      tick: 121,
      recovered: true,
    };
    expect(classifyBattlePopup(prevFull, nextFull)).toEqual([
      { kind: "energy", text: "READY! ✦", side: "fae" },
    ]);

    // When energy rises (4 -> 5), only +1 ⚡ fires (no double-pop).
    const prevSpent: BattlePopupSnapshot = { ...prevFull, energy: 4 };
    const nextRestored: BattlePopupSnapshot = { ...nextFull, energy: 5 };
    expect(classifyBattlePopup(prevSpent, nextRestored)).toEqual([
      { kind: "energy", text: "+1 ⚡", side: "fae" },
    ]);

    // Steady recovered true->true, open/close, battle switch, and tick rewind emit [].
    expect(classifyBattlePopup(nextFull, { ...nextFull, tick: 122 })).toEqual([]);
    expect(classifyBattlePopup(null, nextFull)).toEqual([]);
    expect(classifyBattlePopup(nextFull, null)).toEqual([]);
    expect(classifyBattlePopup(prevFull, { ...nextFull, battleKey: "gull" })).toEqual([]);
    expect(classifyBattlePopup(prevFull, { ...nextFull, tick: 119 })).toEqual([]);

    // buildBattleHudView populates popupSnapshot.recovered cleanly.
    const { world, fixtures } = loadContent();
    const plaza = fixtures.plaza;
    if (plaza === undefined) throw new Error("Missing plaza fixture");
    const state = createState(world, plaza, 1);
    const recoverState = { ...state, battle: baseBattle() };
    const hud = buildBattleHudView({
      world,
      state: recoverState,
      battle: battleView(world, recoverState),
      partyCommands,
      paused: false,
      canPeek: false,
      peekOpen: false,
      speakerPortrait: () => null,
    });
    expect(hud.popupSnapshot?.recovered).toBe(true);

    const menuState = { ...state, battle: baseBattle({ phase: "command", command: null }) };
    const menuHud = buildBattleHudView({
      world,
      state: menuState,
      battle: battleView(world, menuState),
      partyCommands,
      paused: false,
      canPeek: false,
      peekOpen: false,
      speakerPortrait: () => null,
    });
    expect(menuHud.popupSnapshot?.recovered).toBe(false);
  });
});

describe("Milestone 172: Modular src/platform/audio-effects.ts Extraction", () => {
  const allEffects: readonly CompanionAudioEffect[] = [
    "pet-cat",
    "pet-pup",
    "pet-squirrel",
    "pet-bunny",
    "rest-sit",
    "camera-shutter",
    "title-move",
    "title-start",
    "page-turn",
    "card-open",
    "card-close",
    "toggle-on",
    "toggle-off",
    "tool-sparkle",
    "paper-flip",
    "sticker-peel",
    "atlas-pin",
    "beach-ball-boop",
    "pebble-skip",
    "shop-bell",
    "arcade-bell",
    "sanctuary-hop",
  ];

  it("re-exports effectRecipes and effectRecipe identically with gentle gains and lean modules",
    () => {
      expect(effectsEffectRecipes).toBe(recipesEffectRecipes);
      expect(effectsEffectRecipe).toBe(recipesEffectRecipe);
      expect(effectsEffectRecipe).toBe(audioEffectRecipe);
      expect(Object.keys(effectsEffectRecipes).sort()).toEqual([...allEffects].sort());

      for (const effect of allEffects) {
        const recipe = effectsEffectRecipe(effect);
        expect(recipe.length, `effect ${effect} must have segments`).toBeGreaterThan(0);
        for (const segment of recipe) {
          expect(segment.duration, `${effect} duration`).toBeGreaterThan(0);
          expect(segment.gain, `${effect} gain > 0`).toBeGreaterThan(0);
          expect(segment.gain, `${effect} gain <= 0.14`).toBeLessThanOrEqual(0.14);
        }
      }

      const recipesSource = readFileSync("src/platform/audio-recipes.ts", "utf8");
      const effectsSource = readFileSync("src/platform/audio-effects.ts", "utf8");
      expect(recipesSource.trimEnd().split("\n").length).toBeLessThan(740);
      expect(effectsSource.trimEnd().split("\n").length).toBeLessThan(220);
      // Type-only import prevents any circular runtime dependency.
      expect(effectsSource).toContain('import type { AudioRecipe } from "./audio-recipes";');
      expect(effectsSource).not.toMatch(/^import\s+\{[^}]*\}\s+from\s+"\.\/audio-recipes"/m);
    },
  );
});
