import type { SoundCue } from "../core";

export type CompanionAudioEffect =
  | "pet-cat"
  | "pet-pup"
  | "pet-squirrel"
  | "pet-bunny"
  | "rest-sit"
  | "camera-shutter"
  | "title-move"
  | "title-start"
  | "page-turn"
  | "card-open"
  | "card-close"
  | "toggle-on"
  | "toggle-off";

type Timing = { offset: number; duration: number; gain: number; attack?: number };
export type AudioSegment =
  | (Timing & { wave: "noise"; lowpass: number })
  | (Timing & {
      wave: "sine" | "square" | "triangle";
      frequency: number;
      endFrequency?: number;
      vibrato?: { rate: number; depth: number };
    });
export type AudioRecipe = readonly AudioSegment[];

export const soundCueRecipes: Record<SoundCue, AudioRecipe> = {
  "dialogue-open": [
    { wave: "triangle", frequency: 392, offset: 0, duration: 0.11, gain: 0.11 },
    { wave: "sine", frequency: 587, offset: 0.04, duration: 0.1, gain: 0.05 },
  ],
  "dialogue-advance": [
    { wave: "triangle", frequency: 523, offset: 0, duration: 0.09, gain: 0.09 },
    { wave: "sine", frequency: 784, offset: 0.02, duration: 0.07, gain: 0.035 },
  ],
  "dialogue-blip": [{ wave: "triangle", frequency: 523, offset: 0, duration: 0.04, gain: 0.042 }],
  "dialogue-close": [
    { wave: "triangle", frequency: 392, offset: 0, duration: 0.08, gain: 0.08 },
    { wave: "triangle", frequency: 330, offset: 0.05, duration: 0.11, gain: 0.09 },
  ],
  "choice-move": [{ wave: "triangle", frequency: 466, offset: 0, duration: 0.07, gain: 0.075 }],
  "choice-select": [
    { wave: "triangle", frequency: 587, offset: 0, duration: 0.1, gain: 0.11 },
    { wave: "sine", frequency: 880, offset: 0.045, duration: 0.11, gain: 0.055 },
  ],
  "journal-open": [
    { wave: "noise", offset: 0, duration: 0.06, gain: 0.016, lowpass: 1800 },
    { wave: "triangle", frequency: 392, offset: 0, duration: 0.1, gain: 0.09 },
    { wave: "triangle", frequency: 523, offset: 0.075, duration: 0.14, gain: 0.095 },
  ],
  "journal-close": [
    { wave: "noise", offset: 0, duration: 0.05, gain: 0.014, lowpass: 1400 },
    { wave: "triangle", frequency: 523, offset: 0, duration: 0.09, gain: 0.075 },
    { wave: "triangle", frequency: 330, offset: 0.075, duration: 0.13, gain: 0.075 },
  ],
  "footstep-grass": [
    { wave: "noise", offset: 0, duration: 0.055, gain: 0.02, lowpass: 1350, attack: 0.006 },
    {
      wave: "sine",
      frequency: 135,
      endFrequency: 95,
      offset: 0.004,
      duration: 0.045,
      gain: 0.015,
      attack: 0.004,
    },
  ],
  "footstep-sand": [
    { wave: "noise", offset: 0, duration: 0.07, gain: 0.021, lowpass: 1850, attack: 0.008 },
    {
      wave: "sine",
      frequency: 110,
      endFrequency: 78,
      offset: 0.005,
      duration: 0.05,
      gain: 0.016,
      attack: 0.005,
    },
  ],
  "footstep-wood": [
    {
      wave: "triangle",
      frequency: 168,
      endFrequency: 112,
      offset: 0,
      duration: 0.06,
      gain: 0.028,
      attack: 0.003,
    },
    { wave: "noise", offset: 0, duration: 0.025, gain: 0.016, lowpass: 1900, attack: 0.002 },
  ],
  "footstep-snow": [
    { wave: "noise", offset: 0, duration: 0.055, gain: 0.022, lowpass: 2600, attack: 0.004 },
    { wave: "noise", offset: 0.02, duration: 0.06, gain: 0.018, lowpass: 1450, attack: 0.006 },
  ],
  "footstep-stone": [
    { wave: "noise", offset: 0, duration: 0.03, gain: 0.018, lowpass: 2400, attack: 0.002 },
    {
      wave: "triangle",
      frequency: 290,
      endFrequency: 210,
      offset: 0,
      duration: 0.035,
      gain: 0.022,
      attack: 0.002,
    },
  ],
  "footstep-tile": [
    { wave: "noise", offset: 0, duration: 0.026, gain: 0.016, lowpass: 2700, attack: 0.002 },
    {
      wave: "triangle",
      frequency: 360,
      endFrequency: 260,
      offset: 0,
      duration: 0.03,
      gain: 0.02,
      attack: 0.002,
    },
  ],
  "footstep-carpet": [
    { wave: "noise", offset: 0, duration: 0.045, gain: 0.018, lowpass: 620, attack: 0.006 },
    {
      wave: "sine",
      frequency: 98,
      endFrequency: 72,
      offset: 0.003,
      duration: 0.045,
      gain: 0.016,
      attack: 0.005,
    },
  ],
  door: [
    {
      wave: "triangle",
      frequency: 440,
      endFrequency: 240,
      offset: 0,
      duration: 0.2,
      gain: 0.095,
    },
    { wave: "sine", frequency: 220, offset: 0.04, duration: 0.16, gain: 0.04 },
    { wave: "noise", lowpass: 950, offset: 0.03, duration: 0.14, gain: 0.018 },
  ],
  "area-arrive": [
    { wave: "triangle", frequency: 523, offset: 0, duration: 0.12, gain: 0.085 },
    { wave: "triangle", frequency: 659, offset: 0.09, duration: 0.15, gain: 0.09 },
    { wave: "sine", frequency: 1047, offset: 0.15, duration: 0.18, gain: 0.045 },
  ],
  coin: [
    { wave: "triangle", frequency: 988, offset: 0, duration: 0.07, gain: 0.075 },
    { wave: "sine", frequency: 1319, offset: 0.065, duration: 0.14, gain: 0.085 },
    { wave: "sine", frequency: 2637, offset: 0.065, duration: 0.09, gain: 0.025 },
  ],
  item: [
    { wave: "triangle", frequency: 622, offset: 0, duration: 0.1, gain: 0.08 },
    { wave: "triangle", frequency: 784, offset: 0.08, duration: 0.14, gain: 0.09 },
    { wave: "sine", frequency: 1175, offset: 0.14, duration: 0.15, gain: 0.045 },
  ],
  sticker: [
    { wave: "triangle", frequency: 523.25, offset: 0, duration: 0.11, gain: 0.09, attack: 0.004 },
    {
      wave: "triangle",
      frequency: 659.25,
      offset: 0.06,
      duration: 0.11,
      gain: 0.09,
      attack: 0.004,
    },
    {
      wave: "triangle",
      frequency: 783.99,
      offset: 0.12,
      duration: 0.12,
      gain: 0.095,
      attack: 0.004,
    },
    { wave: "sine", frequency: 987.77, offset: 0.18, duration: 0.13, gain: 0.09, attack: 0.004 },
    { wave: "sine", frequency: 1046.5, offset: 0.24, duration: 0.24, gain: 0.1, attack: 0.004 },
    { wave: "sine", frequency: 2093, offset: 0.26, duration: 0.2, gain: 0.032, attack: 0.004 },
  ],
  "lantern-on": [
    { wave: "triangle", frequency: 392, offset: 0, duration: 0.1, gain: 0.07 },
    { wave: "sine", frequency: 784, offset: 0.09, duration: 0.2, gain: 0.08 },
  ],
  "lantern-off": [
    { wave: "sine", frequency: 784, offset: 0, duration: 0.1, gain: 0.065 },
    { wave: "triangle", frequency: 392, offset: 0.09, duration: 0.18, gain: 0.07 },
  ],
  "battle-start": [
    {
      wave: "triangle",
      frequency: 220,
      endFrequency: 440,
      offset: 0,
      duration: 0.22,
      gain: 0.1,
    },
    { wave: "sine", frequency: 659, offset: 0.18, duration: 0.14, gain: 0.065 },
    { wave: "sine", frequency: 880, offset: 0.25, duration: 0.14, gain: 0.05 },
  ],
  "level-up": [
    { wave: "triangle", frequency: 261.63, offset: 0, duration: 0.46, gain: 0.065, attack: 0.008 },
    { wave: "triangle", frequency: 523.25, offset: 0, duration: 0.09, gain: 0.085, attack: 0.003 },
    {
      wave: "triangle",
      frequency: 587.33,
      offset: 0.055,
      duration: 0.09,
      gain: 0.085,
      attack: 0.003,
    },
    {
      wave: "triangle",
      frequency: 659.25,
      offset: 0.11,
      duration: 0.095,
      gain: 0.09,
      attack: 0.003,
    },
    {
      wave: "triangle",
      frequency: 783.99,
      offset: 0.165,
      duration: 0.1,
      gain: 0.095,
      attack: 0.003,
    },
    { wave: "sine", frequency: 880, offset: 0.22, duration: 0.11, gain: 0.09, attack: 0.003 },
    { wave: "sine", frequency: 1046.5, offset: 0.275, duration: 0.15, gain: 0.095, attack: 0.003 },
    { wave: "sine", frequency: 1318.51, offset: 0.33, duration: 0.22, gain: 0.095, attack: 0.004 },
    { wave: "sine", frequency: 2093, offset: 0.34, duration: 0.18, gain: 0.032, attack: 0.004 },
  ],
  "battle-command": [{ wave: "triangle", frequency: 494, offset: 0, duration: 0.095, gain: 0.085 }],
  "battle-together": [
    { wave: "triangle", frequency: 523, offset: 0, duration: 0.11, gain: 0.095 },
    { wave: "triangle", frequency: 659, offset: 0.055, duration: 0.11, gain: 0.095 },
    { wave: "triangle", frequency: 784, offset: 0.11, duration: 0.12, gain: 0.1 },
    { wave: "triangle", frequency: 988, offset: 0.165, duration: 0.13, gain: 0.1 },
    { wave: "sine", frequency: 1175, offset: 0.22, duration: 0.18, gain: 0.095 },
    { wave: "sine", frequency: 1568, offset: 0.275, duration: 0.26, gain: 0.09 },
    { wave: "sine", frequency: 2349, offset: 0.29, duration: 0.18, gain: 0.035 },
  ],
  "battle-hit": [
    { wave: "noise", offset: 0, duration: 0.055, gain: 0.024, lowpass: 1200 },
    { wave: "triangle", frequency: 247, offset: 0.02, duration: 0.12, gain: 0.07 },
  ],
  "battle-beat": [
    { wave: "sine", frequency: 880, offset: 0, duration: 0.075, gain: 0.055 },
    { wave: "sine", frequency: 1320, offset: 0.01, duration: 0.055, gain: 0.025 },
  ],
  "claw-move": [{ wave: "triangle", frequency: 220, offset: 0, duration: 0.08, gain: 0.05 }],
  "claw-drop": [
    {
      wave: "triangle",
      frequency: 180,
      endFrequency: 110,
      offset: 0,
      duration: 0.16,
      gain: 0.06,
    },
  ],
  "claw-grab": [{ wave: "triangle", frequency: 660, offset: 0, duration: 0.1, gain: 0.07 }],
  "claw-miss": [
    {
      wave: "triangle",
      frequency: 220,
      endFrequency: 180,
      offset: 0,
      duration: 0.12,
      gain: 0.05,
    },
  ],
  "prize-won": [
    { wave: "triangle", frequency: 523, offset: 0, duration: 0.1, gain: 0.08 },
    { wave: "triangle", frequency: 784, offset: 0.09, duration: 0.14, gain: 0.09 },
    { wave: "sine", frequency: 1047, offset: 0.18, duration: 0.2, gain: 0.065 },
  ],
  "skee-aim": [{ wave: "triangle", frequency: 330, offset: 0, duration: 0.06, gain: 0.05 }],
  "skee-roll": [
    {
      wave: "triangle",
      frequency: 150,
      endFrequency: 95,
      offset: 0,
      duration: 0.4,
      gain: 0.05,
    },
  ],
  "skee-score": [
    { wave: "triangle", frequency: 440, offset: 0, duration: 0.08, gain: 0.06 },
    { wave: "triangle", frequency: 660, offset: 0.08, duration: 0.12, gain: 0.07 },
  ],
  "skee-hundred": [
    { wave: "triangle", frequency: 523.25, offset: 0, duration: 0.09, gain: 0.08, attack: 0.003 },
    {
      wave: "triangle",
      frequency: 659.25,
      offset: 0.055,
      duration: 0.095,
      gain: 0.085,
      attack: 0.003,
    },
    {
      wave: "triangle",
      frequency: 783.99,
      offset: 0.11,
      duration: 0.105,
      gain: 0.09,
      attack: 0.003,
    },
    { wave: "sine", frequency: 1046.5, offset: 0.165, duration: 0.14, gain: 0.095, attack: 0.003 },
    { wave: "sine", frequency: 1318.51, offset: 0.22, duration: 0.24, gain: 0.095, attack: 0.004 },
    { wave: "sine", frequency: 2637, offset: 0.235, duration: 0.19, gain: 0.032, attack: 0.004 },
  ],
  "mole-pop": [
    {
      wave: "triangle",
      frequency: 392,
      endFrequency: 587,
      offset: 0,
      duration: 0.09,
      gain: 0.05,
    },
  ],
  "mole-boop": [
    {
      wave: "square",
      frequency: 880,
      endFrequency: 1320,
      offset: 0,
      duration: 0.065,
      gain: 0.036,
    },
    {
      wave: "triangle",
      frequency: 1320,
      endFrequency: 990,
      offset: 0.065,
      duration: 0.08,
      gain: 0.05,
    },
  ],
  "mole-whiff": [
    {
      wave: "triangle",
      frequency: 260,
      endFrequency: 200,
      offset: 0,
      duration: 0.07,
      gain: 0.04,
    },
  ],
  "comet-move": [{ wave: "triangle", frequency: 260, offset: 0, duration: 0.08, gain: 0.04 }],
  "comet-star": [{ wave: "triangle", frequency: 880, offset: 0, duration: 0.09, gain: 0.06 }],
  "comet-bump": [{ wave: "noise", offset: 0, duration: 0.08, gain: 0.04, lowpass: 500 }],
  "cook-start": [
    {
      wave: "triangle",
      frequency: 220,
      endFrequency: 260,
      offset: 0,
      duration: 0.09,
      gain: 0.05,
    },
  ],
  "cook-frozen": [
    {
      wave: "triangle",
      frequency: 330,
      endFrequency: 247,
      offset: 0,
      duration: 0.11,
      gain: 0.05,
    },
  ],
  "cook-ding": [
    { wave: "sine", frequency: 1319, offset: 0, duration: 0.3, gain: 0.095, attack: 0.002 },
    { wave: "sine", frequency: 2637, offset: 0, duration: 0.16, gain: 0.038, attack: 0.002 },
    { wave: "sine", frequency: 3951, offset: 0, duration: 0.09, gain: 0.016, attack: 0.002 },
    { wave: "triangle", frequency: 1047, offset: 0.11, duration: 0.14, gain: 0.06, attack: 0.004 },
    { wave: "sine", frequency: 1568, offset: 0.19, duration: 0.23, gain: 0.075, attack: 0.004 },
  ],
  "fish-cast": [
    { wave: "noise", offset: 0, duration: 0.08, gain: 0.016, lowpass: 1500 },
    {
      wave: "triangle",
      frequency: 310,
      endFrequency: 560,
      offset: 0,
      duration: 0.11,
      gain: 0.06,
    },
    {
      wave: "sine",
      frequency: 520,
      endFrequency: 280,
      offset: 0.12,
      duration: 0.065,
      gain: 0.065,
    },
    {
      wave: "sine",
      frequency: 310,
      endFrequency: 640,
      offset: 0.185,
      duration: 0.085,
      gain: 0.07,
    },
  ],
  "fish-nibble": [
    {
      wave: "sine",
      frequency: 440,
      endFrequency: 660,
      offset: 0,
      duration: 0.06,
      gain: 0.055,
    },
    {
      wave: "sine",
      frequency: 540,
      endFrequency: 784,
      offset: 0.075,
      duration: 0.07,
      gain: 0.06,
    },
  ],
  "fish-bite": [
    { wave: "noise", offset: 0, duration: 0.075, gain: 0.025, lowpass: 1900 },
    {
      wave: "triangle",
      frequency: 587,
      endFrequency: 880,
      offset: 0,
      duration: 0.11,
      gain: 0.09,
    },
    { wave: "sine", frequency: 1175, offset: 0.065, duration: 0.13, gain: 0.085 },
    { wave: "sine", frequency: 1760, offset: 0.11, duration: 0.12, gain: 0.05 },
  ],
  "fish-reel": [
    { wave: "triangle", frequency: 523, offset: 0, duration: 0.055, gain: 0.065 },
    { wave: "triangle", frequency: 659, offset: 0.045, duration: 0.055, gain: 0.065 },
    { wave: "sine", frequency: 784, offset: 0.09, duration: 0.085, gain: 0.07 },
  ],
  "fish-catch": [
    { wave: "triangle", frequency: 523, offset: 0, duration: 0.1, gain: 0.085 },
    { wave: "triangle", frequency: 659, offset: 0.07, duration: 0.1, gain: 0.085 },
    { wave: "triangle", frequency: 784, offset: 0.14, duration: 0.11, gain: 0.09 },
    { wave: "sine", frequency: 988, offset: 0.21, duration: 0.14, gain: 0.085 },
    { wave: "sine", frequency: 1175, offset: 0.28, duration: 0.24, gain: 0.09 },
    { wave: "sine", frequency: 1568, offset: 0.31, duration: 0.18, gain: 0.045 },
  ],
  "tickets-won": [
    { wave: "triangle", frequency: 784, offset: 0, duration: 0.07, gain: 0.07, attack: 0.003 },
    { wave: "triangle", frequency: 880, offset: 0.05, duration: 0.07, gain: 0.075, attack: 0.003 },
    { wave: "triangle", frequency: 1047, offset: 0.1, duration: 0.08, gain: 0.08, attack: 0.003 },
    { wave: "triangle", frequency: 1175, offset: 0.15, duration: 0.09, gain: 0.085, attack: 0.003 },
    { wave: "sine", frequency: 1568, offset: 0.2, duration: 0.2, gain: 0.09, attack: 0.003 },
    { wave: "sine", frequency: 3136, offset: 0.215, duration: 0.15, gain: 0.028, attack: 0.003 },
  ],
  "battle-win": [
    { wave: "triangle", frequency: 523, offset: 0, duration: 0.12, gain: 0.09 },
    { wave: "triangle", frequency: 659, offset: 0.1, duration: 0.12, gain: 0.09 },
    { wave: "triangle", frequency: 784, offset: 0.2, duration: 0.12, gain: 0.1 },
    { wave: "triangle", frequency: 1047, offset: 0.3, duration: 0.22, gain: 0.1 },
    { wave: "sine", frequency: 1319, offset: 0.34, duration: 0.22, gain: 0.045 },
  ],
  "battle-run": [
    {
      wave: "triangle",
      frequency: 330,
      endFrequency: 220,
      offset: 0,
      duration: 0.16,
      gain: 0.07,
    },
  ],
  "battle-rest": [{ wave: "triangle", frequency: 262, offset: 0, duration: 0.16, gain: 0.07 }],
  "chime-red": [
    { wave: "sine", frequency: 523, offset: 0, duration: 0.28, gain: 0.11 },
    { wave: "sine", frequency: 1569, offset: 0, duration: 0.09, gain: 0.027 },
  ],
  "chime-yellow": [
    { wave: "sine", frequency: 659, offset: 0, duration: 0.28, gain: 0.11 },
    { wave: "sine", frequency: 1977, offset: 0, duration: 0.09, gain: 0.027 },
  ],
  "chime-green": [
    { wave: "sine", frequency: 784, offset: 0, duration: 0.28, gain: 0.11 },
    { wave: "sine", frequency: 2352, offset: 0, duration: 0.09, gain: 0.027 },
  ],
  "chime-blue": [
    { wave: "sine", frequency: 1047, offset: 0, duration: 0.34, gain: 0.12 },
    { wave: "sine", frequency: 3141, offset: 0, duration: 0.11, gain: 0.03 },
  ],
  flute: [
    { wave: "noise", lowpass: 1400, offset: 0, duration: 0.2, gain: 0.008 },
    {
      wave: "sine",
      frequency: 784,
      endFrequency: 880,
      offset: 0,
      duration: 0.25,
      gain: 0.07,
      vibrato: { rate: 5, depth: 2 },
    },
    { wave: "noise", lowpass: 1400, offset: 0.23, duration: 0.2, gain: 0.008 },
    {
      wave: "sine",
      frequency: 880,
      endFrequency: 988,
      offset: 0.23,
      duration: 0.25,
      gain: 0.07,
      vibrato: { rate: 5, depth: 2 },
    },
    { wave: "noise", lowpass: 1400, offset: 0.46, duration: 0.22, gain: 0.008 },
    {
      wave: "sine",
      frequency: 988,
      endFrequency: 1175,
      offset: 0.46,
      duration: 0.27,
      gain: 0.075,
      vibrato: { rate: 5, depth: 2 },
    },
    { wave: "noise", lowpass: 1400, offset: 0.71, duration: 0.3, gain: 0.008 },
    {
      wave: "sine",
      frequency: 1175,
      endFrequency: 1170,
      offset: 0.71,
      duration: 0.42,
      gain: 0.08,
      vibrato: { rate: 5, depth: 3 },
    },
  ],
  "flute-red": [
    { wave: "noise", lowpass: 1400, offset: 0, duration: 0.16, gain: 0.008 },
    {
      wave: "sine",
      frequency: 523,
      endFrequency: 540,
      offset: 0,
      duration: 0.22,
      gain: 0.065,
      vibrato: { rate: 5, depth: 2 },
    },
  ],
  "flute-yellow": [
    { wave: "noise", lowpass: 1400, offset: 0, duration: 0.16, gain: 0.008 },
    {
      wave: "sine",
      frequency: 659,
      endFrequency: 680,
      offset: 0,
      duration: 0.22,
      gain: 0.065,
      vibrato: { rate: 5, depth: 2 },
    },
  ],
  "flute-green": [
    { wave: "noise", lowpass: 1400, offset: 0, duration: 0.16, gain: 0.008 },
    {
      wave: "sine",
      frequency: 784,
      endFrequency: 800,
      offset: 0,
      duration: 0.22,
      gain: 0.065,
      vibrato: { rate: 5, depth: 2 },
    },
  ],
  "flute-blue": [
    { wave: "noise", lowpass: 1400, offset: 0, duration: 0.16, gain: 0.008 },
    {
      wave: "sine",
      frequency: 1047,
      endFrequency: 1060,
      offset: 0,
      duration: 0.25,
      gain: 0.07,
      vibrato: { rate: 5, depth: 2 },
    },
  ],
  "lasso-twirl": [
    { wave: "noise", offset: 0, duration: 0.08, gain: 0.018, lowpass: 1600 },
    {
      wave: "triangle",
      frequency: 340,
      endFrequency: 740,
      offset: 0,
      duration: 0.14,
      gain: 0.085,
    },
    {
      wave: "triangle",
      frequency: 520,
      endFrequency: 980,
      offset: 0.09,
      duration: 0.11,
      gain: 0.075,
    },
    { wave: "sine", frequency: 1175, offset: 0.16, duration: 0.16, gain: 0.08 },
    { wave: "sine", frequency: 1760, offset: 0.19, duration: 0.12, gain: 0.045 },
  ],
};

// Companion petting & cozy resting cues kept in the platform shell (zero core SoundCue changes).
export const effectRecipes: Record<CompanionAudioEffect, AudioRecipe> = {
  "pet-cat": [
    {
      wave: "sine",
      frequency: 520,
      endFrequency: 680,
      offset: 0,
      duration: 0.22,
      gain: 0.08,
      attack: 0.015,
      vibrato: { rate: 18, depth: 14 },
    },
    {
      wave: "triangle",
      frequency: 260,
      endFrequency: 310,
      offset: 0.02,
      duration: 0.2,
      gain: 0.032,
      attack: 0.02,
      vibrato: { rate: 22, depth: 8 },
    },
  ],
  "pet-pup": [
    {
      wave: "triangle",
      frequency: 360,
      endFrequency: 490,
      offset: 0,
      duration: 0.095,
      gain: 0.085,
      attack: 0.004,
    },
    {
      wave: "triangle",
      frequency: 420,
      endFrequency: 580,
      offset: 0.11,
      duration: 0.115,
      gain: 0.09,
      attack: 0.004,
    },
  ],
  "pet-squirrel": [
    {
      wave: "sine",
      frequency: 780,
      endFrequency: 960,
      offset: 0,
      duration: 0.07,
      gain: 0.075,
      attack: 0.003,
    },
    {
      wave: "sine",
      frequency: 960,
      endFrequency: 880,
      offset: 0.07,
      duration: 0.07,
      gain: 0.07,
      attack: 0.003,
    },
    {
      wave: "sine",
      frequency: 880,
      endFrequency: 1020,
      offset: 0.14,
      duration: 0.08,
      gain: 0.065,
      attack: 0.003,
    },
  ],
  "pet-bunny": [
    {
      wave: "sine",
      frequency: 660,
      endFrequency: 840,
      offset: 0,
      duration: 0.11,
      gain: 0.075,
      attack: 0.005,
    },
    {
      wave: "sine",
      frequency: 760,
      endFrequency: 920,
      offset: 0.12,
      duration: 0.09,
      gain: 0.055,
      attack: 0.005,
    },
  ],
  "rest-sit": [
    { wave: "triangle", frequency: 349.23, offset: 0, duration: 0.34, gain: 0.065, attack: 0.02 },
    { wave: "sine", frequency: 440, offset: 0.055, duration: 0.32, gain: 0.055, attack: 0.02 },
    { wave: "sine", frequency: 523.25, offset: 0.11, duration: 0.34, gain: 0.05, attack: 0.02 },
  ],
  "camera-shutter": [
    { wave: "noise", offset: 0, duration: 0.022, gain: 0.055, lowpass: 3400, attack: 0.001 },
    {
      wave: "triangle",
      frequency: 1180,
      endFrequency: 520,
      offset: 0,
      duration: 0.024,
      gain: 0.045,
      attack: 0.001,
    },
    { wave: "noise", offset: 0.042, duration: 0.024, gain: 0.048, lowpass: 2800, attack: 0.001 },
    {
      wave: "triangle",
      frequency: 940,
      endFrequency: 420,
      offset: 0.042,
      duration: 0.026,
      gain: 0.038,
      attack: 0.001,
    },
    { wave: "noise", offset: 0.055, duration: 0.065, gain: 0.02, lowpass: 1100, attack: 0.006 },
  ],
  "title-move": [
    {
      wave: "triangle",
      frequency: 494,
      endFrequency: 523,
      offset: 0,
      duration: 0.055,
      gain: 0.06,
      attack: 0.003,
    },
  ],
  "title-start": [
    { wave: "triangle", frequency: 523, offset: 0, duration: 0.14, gain: 0.068, attack: 0.004 },
    { wave: "triangle", frequency: 659, offset: 0.055, duration: 0.15, gain: 0.07, attack: 0.004 },
    { wave: "sine", frequency: 784, offset: 0.11, duration: 0.17, gain: 0.072, attack: 0.004 },
    { wave: "sine", frequency: 1046.5, offset: 0.165, duration: 0.24, gain: 0.075, attack: 0.005 },
    { wave: "sine", frequency: 2093, offset: 0.18, duration: 0.18, gain: 0.022, attack: 0.005 },
  ],
  "page-turn": [
    { wave: "noise", offset: 0, duration: 0.06, gain: 0.018, lowpass: 1700, attack: 0.006 },
    {
      wave: "triangle",
      frequency: 587,
      endFrequency: 659,
      offset: 0.014,
      duration: 0.05,
      gain: 0.055,
      attack: 0.003,
    },
  ],
  "card-open": [
    { wave: "noise", offset: 0, duration: 0.042, gain: 0.015, lowpass: 2100, attack: 0.004 },
    {
      wave: "sine",
      frequency: 523,
      endFrequency: 659,
      offset: 0.008,
      duration: 0.075,
      gain: 0.06,
      attack: 0.004,
    },
  ],
  "card-close": [
    { wave: "noise", offset: 0, duration: 0.038, gain: 0.013, lowpass: 1500, attack: 0.004 },
    {
      wave: "sine",
      frequency: 587,
      endFrequency: 440,
      offset: 0.008,
      duration: 0.068,
      gain: 0.054,
      attack: 0.004,
    },
  ],
  "toggle-on": [
    {
      wave: "triangle",
      frequency: 440,
      endFrequency: 659,
      offset: 0,
      duration: 0.065,
      gain: 0.062,
      attack: 0.003,
    },
  ],
  "toggle-off": [
    {
      wave: "triangle",
      frequency: 523,
      endFrequency: 392,
      offset: 0,
      duration: 0.062,
      gain: 0.055,
      attack: 0.003,
    },
  ],
};

/** Read-only cue recipe lookup for audio craft verification. */
export function soundCueRecipe(cue: SoundCue): AudioRecipe {
  return soundCueRecipes[cue];
}

/** Read-only shell effect recipe lookup for audio craft verification. */
export function effectRecipe(effect: CompanionAudioEffect): AudioRecipe {
  return effectRecipes[effect];
}
