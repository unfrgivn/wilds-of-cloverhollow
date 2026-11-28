import { describe, expect, it } from "vitest";
import { blankInput, type SoundCue } from "../../src/core";
import {
  effectRecipe as audioEffectRecipe,
  soundCueRecipe as audioSoundCueRecipe,
} from "../../src/platform/audio";
import {
  effectRecipe,
  effectRecipes,
  soundCueRecipe,
  soundCueRecipes,
  type AudioRecipe,
  type CompanionAudioEffect,
} from "../../src/platform/audio-recipes";
import {
  gamepadFrame,
  gamepadSelectPressed,
  type StandardGamepad,
} from "../../src/platform/gamepad";
import {
  KEEPSAKE_TEXTURE_KEYS,
  type KeepsakeTextureKey,
} from "../../src/render/keepsake-textures";
import {
  KEEPSAKE_TEXTURE_KEYS as VFX_KEEPSAKE_TEXTURE_KEYS,
  type KeepsakeTextureKey as VfxKeepsakeTextureKey,
  type VfxTextureKey,
} from "../../src/render/vfx-textures";

function makePad(options: {
  mapping?: string;
  buttons?: readonly { pressed: boolean; value: number }[];
  pressedIndices?: readonly number[];
  buttonCount?: number;
} = {}): StandardGamepad {
  const count = options.buttonCount ?? 16;
  const pressedSet = new Set(options.pressedIndices ?? []);
  const buttons =
    options.buttons ??
    Array.from({ length: count }, (_, index) => ({
      pressed: pressedSet.has(index),
      value: pressedSet.has(index) ? 1 : 0,
    }));
  return {
    mapping: options.mapping ?? "standard",
    axes: [0, 0],
    buttons,
  };
}

function assertValidRecipe(label: string, recipe: AudioRecipe): void {
  expect(recipe.length, `${label} must have at least one segment`).toBeGreaterThan(0);
  for (const segment of recipe) {
    expect(segment.offset, `${label} offset >= 0`).toBeGreaterThanOrEqual(0);
    expect(segment.duration, `${label} duration > 0`).toBeGreaterThan(0);
    expect(segment.gain, `${label} gain > 0`).toBeGreaterThan(0);
    if (segment.attack !== undefined) {
      expect(segment.attack, `${label} attack > 0`).toBeGreaterThan(0);
    }
    if (segment.wave === "noise") {
      expect(segment.lowpass, `${label} lowpass > 0`).toBeGreaterThan(0);
    } else {
      expect(segment.frequency, `${label} frequency > 0`).toBeGreaterThan(0);
      if (segment.endFrequency !== undefined) {
        expect(segment.endFrequency, `${label} endFrequency > 0`).toBeGreaterThan(0);
      }
      if (segment.vibrato !== undefined) {
        expect(segment.vibrato.rate, `${label} vibrato rate > 0`).toBeGreaterThan(0);
        expect(segment.vibrato.depth, `${label} vibrato depth > 0`).toBeGreaterThan(0);
      }
    }
  }
}

describe("Milestone 114: gamepadSelectPressed parity helper", () => {
  it("returns false for empty, unpressed, short, low-analog, or non-standard pads", () => {
    expect(gamepadSelectPressed([])).toBe(false);
    expect(gamepadSelectPressed([makePad()])).toBe(false);
    expect(gamepadSelectPressed([makePad({ buttonCount: 8 })])).toBe(false);
    expect(gamepadSelectPressed([makePad({ pressedIndices: [0, 1, 2, 3, 4, 5, 9] })])).toBe(false);
    expect(
      gamepadSelectPressed([
        makePad({
          buttons: Array.from({ length: 16 }, (_, index) => ({
            pressed: false,
            value: index === 8 ? 0.49 : 0,
          })),
        }),
      ]),
    ).toBe(false);
    expect(gamepadSelectPressed([makePad({ mapping: "xinput", pressedIndices: [8] })])).toBe(false);
    expect(gamepadSelectPressed([makePad({ mapping: "", pressedIndices: [8] })])).toBe(false);
  });

  it("returns true when button 8 is pressed or analog value >= 0.5 on any standard pad", () => {
    expect(gamepadSelectPressed([makePad({ pressedIndices: [8] })])).toBe(true);
    expect(
      gamepadSelectPressed([
        makePad({
          buttons: Array.from({ length: 16 }, (_, index) => ({
            pressed: false,
            value: index === 8 ? 0.5 : 0,
          })),
        }),
      ]),
    ).toBe(true);
    expect(
      gamepadSelectPressed([
        makePad({ mapping: "nonstandard", pressedIndices: [8] }),
        makePad(),
        makePad({ pressedIndices: [8] }),
      ]),
    ).toBe(true);
  });

  it("leaves ActionFrame and gamepadFrame untouched when Select (button 8) is pressed", () => {
    const frame = gamepadFrame([makePad({ pressedIndices: [8] })]);
    expect(frame).toStrictEqual(blankInput());
  });
});

describe("Milestone 114: modular audio-recipes.ts extraction & audio.ts re-exports", () => {
  const allSoundCues: Record<SoundCue, true> = {
    "dialogue-open": true,
    "dialogue-advance": true,
    "dialogue-blip": true,
    "dialogue-close": true,
    "choice-move": true,
    "choice-select": true,
    "journal-open": true,
    "journal-close": true,
    "footstep-grass": true,
    "footstep-sand": true,
    "footstep-wood": true,
    "footstep-snow": true,
    "footstep-stone": true,
    "footstep-tile": true,
    "footstep-carpet": true,
    door: true,
    "area-arrive": true,
    coin: true,
    item: true,
    sticker: true,
    "lantern-on": true,
    "lantern-off": true,
    "battle-start": true,
    "level-up": true,
    "battle-command": true,
    "battle-together": true,
    "battle-hit": true,
    "battle-recover": true,
    "battle-beat": true,
    "claw-move": true,
    "claw-drop": true,
    "claw-grab": true,
    "claw-miss": true,
    "prize-won": true,
    "skee-aim": true,
    "skee-roll": true,
    "skee-score": true,
    "skee-hundred": true,
    "mole-pop": true,
    "mole-boop": true,
    "mole-whiff": true,
    "comet-move": true,
    "comet-star": true,
    "comet-bump": true,
    "cook-start": true,
    "cook-frozen": true,
    "cook-ding": true,
    "fish-cast": true,
    "fish-nibble": true,
    "fish-bite": true,
    "fish-reel": true,
    "fish-catch": true,
    "taco-top": true,
    "taco-oops": true,
    "taco-order": true,
    "tickets-won": true,
    "battle-win": true,
    "battle-run": true,
    "battle-rest": true,
    "battle-faint": true,
    "chime-red": true,
    "chime-yellow": true,
    "chime-green": true,
    "chime-blue": true,
    flute: true,
    "flute-red": true,
    "flute-yellow": true,
    "flute-green": true,
    "flute-blue": true,
    "lasso-twirl": true,
  };

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
  ];

  it("defines valid non-empty recipes for every SoundCue and matches audio.ts re-exports", () => {
    const entries = Object.entries(soundCueRecipes);
    expect(entries.length).toBe(Object.keys(allSoundCues).length);
    for (const [cue, recipe] of entries) {
      assertValidRecipe(`cue:${cue}`, recipe);
    }
    const sampleCues: readonly SoundCue[] = [
      "dialogue-open",
      "footstep-grass",
      "door",
      "sticker",
      "level-up",
      "battle-together",
      "fish-catch",
      "flute",
      "lasso-twirl",
    ];
    for (const cue of sampleCues) {
      expect(audioSoundCueRecipe(cue)).toBe(soundCueRecipe(cue));
      expect(soundCueRecipe(cue)).toBe(soundCueRecipes[cue]);
    }
  });

  it("defines valid non-empty recipes for every CompanionAudioEffect", () => {
    expect(Object.keys(effectRecipes).sort()).toEqual([...allEffects].sort());
    for (const effect of allEffects) {
      const recipe = effectRecipe(effect);
      assertValidRecipe(`effect:${effect}`, recipe);
      expect(audioEffectRecipe(effect)).toBe(recipe);
      expect(recipe).toBe(effectRecipes[effect]);
    }
  });
});

describe("Milestone 114: modular keepsake-textures.ts & vfx-textures.ts", () => {
  it("covers all 13 keepsake keys identically across both modules", () => {
    const expected: readonly KeepsakeTextureKey[] = [
      "keepsakeCrystal",
      "keepsakePin",
      "keepsakeGeode",
      "keepsakeFeather",
      "keepsakeTaco",
      "keepsakeWreath",
      "keepsakeCompass",
      "keepsakeClover",
      "keepsakeWhistle",
      "keepsakeSketch",
      "keepsakeAurora",
      "keepsakeShell",
      "keepsakeRibbon",
    ];
    expect(KEEPSAKE_TEXTURE_KEYS).toEqual(expected);
    expect(VFX_KEEPSAKE_TEXTURE_KEYS).toBe(KEEPSAKE_TEXTURE_KEYS);

    // Compile-time verification that every KeepsakeTextureKey belongs to VfxTextureKey.
    const asVfxKeys: readonly VfxTextureKey[] = expected;
    const asReexported: readonly VfxKeepsakeTextureKey[] = expected;
    expect(asVfxKeys).toHaveLength(13);
    expect(asReexported).toHaveLength(13);
  });
});
