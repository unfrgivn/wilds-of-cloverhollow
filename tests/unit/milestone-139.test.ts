import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateOverworldEmotes, type OverworldEmoteInput } from "../../src/render/emotes";
import {
  computeCompanionEmoteSpecs,
  computeGlowTransform,
  computeLanternMote,
  LANTERN_MOTE_COUNT,
} from "../../src/render/overworld-render";

function sampleEmoteInput(tick: number, reducedMotion?: boolean): OverworldEmoteInput {
  return {
    areaId: "park",
    tick,
    player: { x: 400, y: 400 },
    dialogueOpen: false,
    roamers: [
      { x: 300, y: 360, height: 64, notice: 4, noticeTicks: 24, chasing: false },
      { x: 520, y: 380, height: 68, notice: 27, noticeTicks: 24, chasing: true },
    ],
    calmedCritters: [
      { x: 440, y: 410, height: 58, index: 1 },
    ],
    nappingMembers: [
      { x: 360, y: 420, height: 50, stillTicks: 300, index: 0 },
    ],
    recentTalk: { x: 460, y: 390, height: 114, elapsed: 12 },
    ...(reducedMotion === undefined ? {} : { reducedMotion }),
  };
}

describe("Milestone 139: Overworld Emotes Reduced-Motion Parity", () => {
  it("holds ?, !, note, Zzz, and heart upright and tick-invariant under reducedMotion", () => {
    const at10 = evaluateOverworldEmotes(sampleEmoteInput(10, true));
    const at55 = evaluateOverworldEmotes(sampleEmoteInput(55, true));

    expect(at10.map((item) => item.texture)).toEqual([
      "emoteQuestion",
      "emoteExclaim",
      "emoteNote",
      "emoteZzz",
      "emoteHeart",
    ]);
    expect(at10).toEqual(at55);

    for (const emote of at10) {
      expect(emote.rotation).toBe(0);
    }

    const question = at10[0];
    const exclaim = at10[1];
    const note = at10[2];
    const zzz = at10[3];
    const heart = at10[4];
    expect(question).toMatchObject({ x: 300, y: 360 - 64 - 18, scale: 0.88, alpha: 0.94 });
    expect(exclaim).toMatchObject({ x: 520, y: 380 - 68 - 20, scale: 0.95, alpha: 1 });
    expect(note).toMatchObject({ x: 440, scale: 0.66, alpha: 0.85 });
    expect(zzz).toMatchObject({ x: 370, scale: 0.66, alpha: 0.85 });
    expect(heart).toMatchObject({ x: 460, rotation: 0 });
    expect(heart?.alpha).toBeGreaterThan(0);

    // Heart gently fades in/out without horizontal sway or tilt across elapsed ticks.
    const earlyHeart = evaluateOverworldEmotes({
      ...sampleEmoteInput(10, true),
      recentTalk: { x: 460, y: 390, height: 114, elapsed: 1 },
    }).find((item) => item.texture === "emoteHeart");
    const lateHeart = evaluateOverworldEmotes({
      ...sampleEmoteInput(55, true),
      recentTalk: { x: 460, y: 390, height: 114, elapsed: 34 },
    }).find((item) => item.texture === "emoteHeart");
    expect(earlyHeart?.x).toBe(460);
    expect(lateHeart?.x).toBe(460);
    expect(earlyHeart?.rotation).toBe(0);
    expect(lateHeart?.rotation).toBe(0);
    expect(earlyHeart?.alpha).toBeLessThan(heart?.alpha ?? 1);
    expect(lateHeart?.alpha).toBeLessThan(heart?.alpha ?? 1);
  });

  it("keeps reducedMotion: false identical to omitted default motion", () => {
    const omitted10 = evaluateOverworldEmotes(sampleEmoteInput(10));
    const explicitFalse10 = evaluateOverworldEmotes(sampleEmoteInput(10, false));
    const explicitFalse55 = evaluateOverworldEmotes(sampleEmoteInput(55, false));

    expect(explicitFalse10).toEqual(omitted10);
    expect(explicitFalse10).not.toEqual(explicitFalse55);
    expect(explicitFalse10[0]?.rotation).not.toBe(0);
    expect(explicitFalse10[2]?.x).not.toBe(440);
  });
});

describe("Milestone 139: Lantern Motes, Glows & Companion Pet/Rest Reduced Motion", () => {
  it("holds lantern motes and blacklight glows steady under reducedMotion", () => {
    for (let i = 0; i < LANTERN_MOTE_COUNT; i += 1) {
      const reducedA = computeLanternMote(i, LANTERN_MOTE_COUNT, 500, 400, 10, 1, true);
      const reducedB = computeLanternMote(i, LANTERN_MOTE_COUNT, 500, 400, 95, 1, true);
      expect(reducedA).toEqual(reducedB);
      expect(reducedA.alpha).toBeCloseTo(0.42, 6);

      const defaultA = computeLanternMote(i, LANTERN_MOTE_COUNT, 500, 400, 10, 1);
      const falseA = computeLanternMote(i, LANTERN_MOTE_COUNT, 500, 400, 10, 1, false);
      const falseB = computeLanternMote(i, LANTERN_MOTE_COUNT, 500, 400, 95, 1, false);
      expect(falseA).toEqual(defaultA);
      expect(falseA).not.toEqual(falseB);
    }

    const glow = { id: "g1", frame: "glow_arrow", point: { x: 540, y: 420 } };
    const player = { x: 500, y: 400 };
    expect(computeGlowTransform(glow, player, 10, 0, 1, true)).toEqual(
      computeGlowTransform(glow, player, 65, 0, 1, true),
    );
    expect(computeGlowTransform(glow, player, 10, 0, 1, false)).toEqual(
      computeGlowTransform(glow, player, 10, 0, 1),
    );
    expect(computeGlowTransform(glow, player, 10, 0, 1, false)).not.toEqual(
      computeGlowTransform(glow, player, 65, 0, 1, false),
    );
  });

  it("holds companion pet/rest emotes upright and steady under reducedMotion", () => {
    const petPos = { x: 320, y: 410 };
    const playerPos = { x: 360, y: 410 };

    const reducedAt20 = computeCompanionEmoteSpecs(petPos, 50, 20, playerPos, 15, true);
    const reducedAt26 = computeCompanionEmoteSpecs(petPos, 50, 26, playerPos, 62, true);
    expect(reducedAt20.length).toBeGreaterThan(0);
    expect(reducedAt20).toEqual(reducedAt26);
    for (const item of reducedAt20) {
      expect(item.rotation).toBe(0);
    }

    const restNote = reducedAt20.find((item) => item.textureKey === "emoteNote");
    expect(restNote).toMatchObject({
      x: playerPos.x + 12,
      scale: 0.66,
      alpha: 0.85,
      rotation: 0,
    });

    const normalDefault = computeCompanionEmoteSpecs(petPos, 50, 20, playerPos, 15);
    const normalFalse = computeCompanionEmoteSpecs(petPos, 50, 20, playerPos, 15, false);
    const normalLater = computeCompanionEmoteSpecs(petPos, 50, 26, playerPos, 62, false);
    expect(normalFalse).toEqual(normalDefault);
    expect(normalFalse).not.toEqual(normalLater);
    expect(normalFalse.some((item) => item.rotation !== 0)).toBe(true);
  });
});

describe("Milestone 139: Universal Safari / iOS Tap-Selection Hygiene", () => {
  const cssExpectations: readonly { file: string; selectors: readonly string[] }[] = [
    { file: "src/ui/title.css", selectors: [".title-screen", ".title-option"] },
    {
      file: "src/ui/battle.css",
      selectors: [
        ".battle-command",
        ".battle-together-btn",
        ".battle-flute-btn",
        ".battle-lasso-btn",
        ".battle-echo-chime",
        ".battle-calm",
        ".battle-reward",
        ".battle-check-tap",
        ".battle-peek-close",
      ],
    },
    {
      file: "src/ui/journal.css",
      selectors: [
        ".journal-tab",
        ".journal-close",
        ".journal-slot",
        ".journal-opt-toggle",
        ".journal-opt-slider",
        ".journal-jukebox-btn",
        ".journal-map-land",
        ".journal-treasures-btn",
        ".journal-field-close",
        ".journal-treasures-close",
      ],
    },
    {
      file: "src/ui/sticker.css",
      selectors: [
        ".sticker-dialogue",
        ".sticker-choice",
        ".sticker-prompt",
        ".photo-touch-btn",
      ],
    },
    {
      file: "src/ui/touch-controls.css",
      selectors: [".touch-controls", ".touch-button", ".touch-stick", ".touch-arrow"],
    },
    { file: "src/ui/credits.css", selectors: [".credits-screen"] },
  ];

  it("declares user-select and -webkit-touch-callout none across all 6 UI stylesheets", () => {
    for (const { file, selectors } of cssExpectations) {
      const css = readFileSync(file, "utf8");
      expect(css, `${file} missing user-select: none`).toContain("user-select: none;");
      expect(css, `${file} missing -webkit-user-select: none`).toContain(
        "-webkit-user-select: none;",
      );
      expect(css, `${file} missing -webkit-touch-callout: none`).toContain(
        "-webkit-touch-callout: none;",
      );
      for (const selector of selectors) {
        expect(css, `${file} missing selector ${selector}`).toContain(selector);
      }
      expect(css).not.toContain(".qa-console");
    }
  });
});
