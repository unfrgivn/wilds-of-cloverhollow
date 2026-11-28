import type { SoundCue } from "../core";
import { soundCueRecipes } from "./audio-cue-recipes";

export { soundCueRecipes };
export { effectRecipe, effectRecipes, type CompanionAudioEffect } from "./audio-effects";

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

/** Read-only cue recipe lookup for audio craft verification. */
export function soundCueRecipe(cue: SoundCue): AudioRecipe {
  return soundCueRecipes[cue];
}
