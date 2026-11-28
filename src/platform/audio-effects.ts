import type { AudioRecipe } from "./audio-recipes";

export type CompanionAudioEffect =
  | "pet-cat" | "pet-pup" | "pet-squirrel" | "pet-bunny"
  | "rest-sit" | "camera-shutter"
  | "title-move" | "title-start" | "page-turn"
  | "card-open" | "card-close"
  | "toggle-on" | "toggle-off" | "tool-sparkle"
  | "paper-flip" | "sticker-peel" | "atlas-pin";

// Companion petting, cozy resting, and storybook UI foley kept in the platform shell.
export const effectRecipes: Record<CompanionAudioEffect, AudioRecipe> = {
  "pet-cat": [
    {
      wave: "sine", frequency: 520, endFrequency: 680, offset: 0, duration: 0.22,
      gain: 0.08, attack: 0.015, vibrato: { rate: 18, depth: 14 },
    },
    {
      wave: "triangle", frequency: 260, endFrequency: 310, offset: 0.02, duration: 0.2,
      gain: 0.032, attack: 0.02, vibrato: { rate: 22, depth: 8 },
    },
  ],
  "pet-pup": [
    {
      wave: "triangle", frequency: 360, endFrequency: 490, offset: 0, duration: 0.095,
      gain: 0.085, attack: 0.004,
    },
    {
      wave: "triangle", frequency: 420, endFrequency: 580, offset: 0.11, duration: 0.115,
      gain: 0.09, attack: 0.004,
    },
  ],
  "pet-squirrel": [
    {
      wave: "sine", frequency: 780, endFrequency: 960, offset: 0, duration: 0.07,
      gain: 0.075, attack: 0.003,
    },
    {
      wave: "sine", frequency: 960, endFrequency: 880, offset: 0.07, duration: 0.07,
      gain: 0.07, attack: 0.003,
    },
    {
      wave: "sine", frequency: 880, endFrequency: 1020, offset: 0.14, duration: 0.08,
      gain: 0.065, attack: 0.003,
    },
  ],
  "pet-bunny": [
    {
      wave: "sine", frequency: 660, endFrequency: 840, offset: 0, duration: 0.11,
      gain: 0.075, attack: 0.005,
    },
    {
      wave: "sine", frequency: 760, endFrequency: 920, offset: 0.12, duration: 0.09,
      gain: 0.055, attack: 0.005,
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
      wave: "triangle", frequency: 1180, endFrequency: 520, offset: 0, duration: 0.024,
      gain: 0.045, attack: 0.001,
    },
    { wave: "noise", offset: 0.042, duration: 0.024, gain: 0.048, lowpass: 2800, attack: 0.001 },
    {
      wave: "triangle", frequency: 940, endFrequency: 420, offset: 0.042, duration: 0.026,
      gain: 0.038, attack: 0.001,
    },
    { wave: "noise", offset: 0.055, duration: 0.065, gain: 0.02, lowpass: 1100, attack: 0.006 },
  ],
  "title-move": [
    {
      wave: "triangle", frequency: 494, endFrequency: 523, offset: 0, duration: 0.055,
      gain: 0.06, attack: 0.003,
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
      wave: "triangle", frequency: 587, endFrequency: 659, offset: 0.014, duration: 0.05,
      gain: 0.055, attack: 0.003,
    },
  ],
  "card-open": [
    { wave: "noise", offset: 0, duration: 0.042, gain: 0.015, lowpass: 2100, attack: 0.004 },
    {
      wave: "sine", frequency: 523, endFrequency: 659, offset: 0.008, duration: 0.075,
      gain: 0.06, attack: 0.004,
    },
  ],
  "card-close": [
    { wave: "noise", offset: 0, duration: 0.038, gain: 0.013, lowpass: 1500, attack: 0.004 },
    {
      wave: "sine", frequency: 587, endFrequency: 440, offset: 0.008, duration: 0.068,
      gain: 0.054, attack: 0.004,
    },
  ],
  "toggle-on": [
    {
      wave: "triangle", frequency: 440, endFrequency: 659, offset: 0, duration: 0.065,
      gain: 0.062, attack: 0.003,
    },
  ],
  "toggle-off": [
    {
      wave: "triangle", frequency: 523, endFrequency: 392, offset: 0, duration: 0.062,
      gain: 0.055, attack: 0.003,
    },
  ],
  "tool-sparkle": [
    { wave: "sine", frequency: 659, offset: 0, duration: 0.14, gain: 0.055, attack: 0.004 },
    { wave: "sine", frequency: 880, offset: 0.055, duration: 0.15, gain: 0.05, attack: 0.004 },
    { wave: "sine", frequency: 1318.5, offset: 0.11, duration: 0.2, gain: 0.045, attack: 0.004 },
  ],
  "paper-flip": [
    { wave: "noise", offset: 0, duration: 0.048, gain: 0.017, lowpass: 1900, attack: 0.006 },
    { wave: "noise", offset: 0.032, duration: 0.052, gain: 0.015, lowpass: 1250, attack: 0.008 },
    {
      wave: "triangle", frequency: 360, endFrequency: 260, offset: 0.008, duration: 0.036,
      gain: 0.042, attack: 0.004,
    },
    {
      wave: "sine", frequency: 587, endFrequency: 659, offset: 0.026, duration: 0.055,
      gain: 0.034, attack: 0.005,
    },
  ],
  "sticker-peel": [
    { wave: "noise", offset: 0, duration: 0.058, gain: 0.019, lowpass: 2350, attack: 0.005 },
    {
      wave: "sine", frequency: 440, endFrequency: 660, offset: 0.01, duration: 0.068,
      gain: 0.044, attack: 0.004,
    },
    {
      wave: "triangle", frequency: 659, endFrequency: 784, offset: 0.046, duration: 0.052,
      gain: 0.048, attack: 0.003,
    },
  ],
  "atlas-pin": [
    {
      wave: "triangle", frequency: 420, endFrequency: 285, offset: 0, duration: 0.038,
      gain: 0.052, attack: 0.003,
    },
    { wave: "noise", offset: 0.004, duration: 0.036, gain: 0.016, lowpass: 1450, attack: 0.004 },
    {
      wave: "sine", frequency: 880, endFrequency: 988, offset: 0.012, duration: 0.085,
      gain: 0.038, attack: 0.003,
    },
  ],
};

/** Read-only shell effect recipe lookup for audio craft verification. */
export function effectRecipe(effect: CompanionAudioEffect): AudioRecipe {
  return effectRecipes[effect];
}
