import type { MusicTrack } from "../core";

export type VoiceProfile = {
  wave: "sine" | "triangle";
  notes: readonly number[];
  duration: number;
  gain: number;
  glide?: number;
  harmonic?: number;
};

export type BlipSynth = {
  frequency: number;
  endFrequency?: number;
  wave: "sine" | "triangle";
  duration: number;
  gain: number;
  harmonic?: number;
};

const NARRATION_VOICE: VoiceProfile = {
  wave: "sine",
  notes: [330, 349, 392],
  duration: 0.036,
  gain: 0.028,
};

const FALLBACK_VOICE: VoiceProfile = {
  wave: "triangle",
  notes: [349, 392, 440, 392],
  duration: 0.048,
  gain: 0.048,
};

const FAIRY_VOICE: VoiceProfile = {
  wave: "sine",
  notes: [784, 988, 1175, 1319],
  duration: 0.054,
  gain: 0.044,
  harmonic: 2,
};

const MYSTERY_VOICE: VoiceProfile = {
  wave: "sine",
  notes: [294, 311, 349],
  duration: 0.056,
  gain: 0.048,
  glide: 0.94,
};

const BIRD_CRITTER_VOICE: VoiceProfile = {
  wave: "sine",
  notes: [659, 784, 880, 988],
  duration: 0.042,
  gain: 0.046,
  glide: 1.1,
};

const BOOPY_CRITTER_VOICE: VoiceProfile = {
  wave: "triangle",
  notes: [294, 330, 392, 440],
  duration: 0.048,
  gain: 0.052,
  glide: 1.06,
};

const BOUNCY_CRITTER_VOICE: VoiceProfile = {
  wave: "triangle",
  notes: [494, 554, 587, 659],
  duration: 0.044,
  gain: 0.05,
  glide: 1.08,
};

const NAMED_VOICES: Record<string, VoiceProfile> = {
  fae: {
    wave: "triangle",
    notes: [523, 587, 659, 784],
    duration: 0.044,
    gain: 0.052,
    harmonic: 1.5,
  },
  mom: {
    wave: "sine",
    notes: [392, 440, 494, 440],
    duration: 0.052,
    gain: 0.055,
  },
  dad: {
    wave: "triangle",
    notes: [220, 247, 262, 247],
    duration: 0.058,
    gain: 0.058,
  },
  oliver: {
    wave: "sine",
    notes: [784, 880, 1047],
    duration: 0.042,
    gain: 0.046,
    glide: 1.12,
  },
  maddie: {
    wave: "sine",
    notes: [587, 659, 740],
    duration: 0.046,
    gain: 0.048,
    glide: 1.18,
  },
  sue: {
    wave: "triangle",
    notes: [494, 554, 659, 587],
    duration: 0.044,
    gain: 0.052,
  },
  jordan: {
    wave: "triangle",
    notes: [349, 392, 440, 392],
    duration: 0.05,
    gain: 0.054,
  },
  "grandpa barnaby": {
    wave: "triangle",
    notes: [185, 208, 220, 208],
    duration: 0.06,
    gain: 0.056,
  },
  barnaby: {
    wave: "triangle",
    notes: [185, 208, 220, 208],
    duration: 0.06,
    gain: 0.056,
  },
  "mr. bell": {
    wave: "triangle",
    notes: [196, 220, 247, 220],
    duration: 0.058,
    gain: 0.056,
  },
  principal: {
    wave: "triangle",
    notes: [196, 220, 247, 220],
    duration: 0.058,
    gain: 0.056,
  },
  "coach ash": {
    wave: "triangle",
    notes: [208, 233, 262, 233],
    duration: 0.056,
    gain: 0.056,
  },
  coach: {
    wave: "triangle",
    notes: [208, 233, 262, 233],
    duration: 0.056,
    gain: 0.056,
  },
  "mrs. flurry": {
    wave: "triangle",
    notes: [220, 247, 262, 247],
    duration: 0.056,
    gain: 0.054,
  },
  "lodge keeper": {
    wave: "triangle",
    notes: [220, 247, 262, 247],
    duration: 0.056,
    gain: 0.054,
  },
  "chef bea": {
    wave: "triangle",
    notes: [349, 392, 440, 392],
    duration: 0.048,
    gain: 0.052,
  },
  "chef mateo": {
    wave: "triangle",
    notes: [262, 294, 330, 392],
    duration: 0.05,
    gain: 0.054,
  },
  "fizzy chef mateo": {
    wave: "triangle",
    notes: [262, 294, 330, 392],
    duration: 0.05,
    gain: 0.054,
  },
  "ms. clover": {
    wave: "sine",
    notes: [370, 415, 440, 415],
    duration: 0.05,
    gain: 0.052,
  },
  "ms. maple": {
    wave: "sine",
    notes: [370, 415, 440, 415],
    duration: 0.05,
    gain: 0.052,
  },
  teacher: {
    wave: "sine",
    notes: [370, 415, 440, 415],
    duration: 0.05,
    gain: 0.052,
  },
  "nurse holly": {
    wave: "sine",
    notes: [392, 440, 466, 440],
    duration: 0.052,
    gain: 0.052,
  },
  holly: {
    wave: "sine",
    notes: [392, 440, 466, 440],
    duration: 0.052,
    gain: 0.052,
  },
  "ms. rowan": {
    wave: "triangle",
    notes: [349, 392, 466, 415],
    duration: 0.048,
    gain: 0.052,
  },
  "art teacher": {
    wave: "triangle",
    notes: [349, 392, 466, 415],
    duration: 0.048,
    gain: 0.052,
  },
  "ms. reed": {
    wave: "sine",
    notes: [392, 440, 466, 440],
    duration: 0.05,
    gain: 0.052,
    harmonic: 1.5,
  },
  "ms. willow": {
    wave: "sine",
    notes: [392, 440, 466, 440],
    duration: 0.05,
    gain: 0.052,
    harmonic: 1.5,
  },
  "music teacher": {
    wave: "sine",
    notes: [392, 440, 466, 440],
    duration: 0.05,
    gain: 0.052,
    harmonic: 1.5,
  },
  "ms. coral": {
    wave: "triangle",
    notes: [370, 415, 466, 415],
    duration: 0.048,
    gain: 0.052,
  },
  lifeguard: {
    wave: "triangle",
    notes: [370, 415, 466, 415],
    duration: 0.048,
    gain: 0.052,
  },
  bree: {
    wave: "triangle",
    notes: [330, 370, 415, 370],
    duration: 0.048,
    gain: 0.052,
  },
  "ranger fern": {
    wave: "sine",
    notes: [349, 392, 440, 494],
    duration: 0.05,
    gain: 0.052,
  },
  fern: {
    wave: "sine",
    notes: [349, 392, 440, 494],
    duration: 0.05,
    gain: 0.052,
  },
  "mr. pip": {
    wave: "triangle",
    notes: [330, 392, 440, 392],
    duration: 0.046,
    gain: 0.052,
  },
  "arcade keeper": {
    wave: "triangle",
    notes: [330, 392, 440, 392],
    duration: 0.046,
    gain: 0.052,
  },
  baker: {
    wave: "sine",
    notes: [349, 392, 440, 392],
    duration: 0.05,
    gain: 0.05,
  },
  grocer: {
    wave: "triangle",
    notes: [330, 370, 415, 370],
    duration: 0.05,
    gain: 0.05,
  },
  scoops: {
    wave: "sine",
    notes: [415, 440, 466, 440],
    duration: 0.046,
    gain: 0.05,
  },
  "cocoa seller": {
    wave: "sine",
    notes: [370, 415, 440, 415],
    duration: 0.05,
    gain: 0.05,
  },
  milo: {
    wave: "triangle",
    notes: [440, 494, 554, 587],
    duration: 0.045,
    gain: 0.05,
  },
  rosie: {
    wave: "triangle",
    notes: [466, 523, 587, 622],
    duration: 0.044,
    gain: 0.05,
  },
  toby: {
    wave: "triangle",
    notes: [415, 466, 523, 554],
    duration: 0.046,
    gain: 0.05,
  },
  "hooded kid": MYSTERY_VOICE,
  "purple hood": MYSTERY_VOICE,
  "kid in purple": MYSTERY_VOICE,
  "mysterious voice": MYSTERY_VOICE,
  "???": MYSTERY_VOICE,
  lavender: FAIRY_VOICE,
  mint: FAIRY_VOICE,
  sky: FAIRY_VOICE,
  peach: FAIRY_VOICE,
  sign: NARRATION_VOICE,
  "notice board": NARRATION_VOICE,
  chalkboard: NARRATION_VOICE,
};

const BIRD_KEYWORDS = ["bird", "gull", "owl", "penguin", "bat"] as const;
const BOOPY_KEYWORDS = ["frog", "mole", "raccoon", "crab"] as const;
const BOUNCY_KEYWORDS = [
  "pup",
  "cat",
  "squirrel",
  "hamster",
  "bunny",
  "lamb",
  "hedgehog",
] as const;

const SILENT_CHAR = /^[\s.,!?;:\u2014\u2013-]$/;

export function voiceForSpeaker(speaker: string | null): VoiceProfile {
  if (speaker === null) return NARRATION_VOICE;
  const key = speaker.trim().toLowerCase();
  if (key.length === 0) return NARRATION_VOICE;
  const named = NAMED_VOICES[key];
  if (named !== undefined) return named;
  if (key.includes("fairy")) return FAIRY_VOICE;
  if (BIRD_KEYWORDS.some((word) => key.includes(word))) return BIRD_CRITTER_VOICE;
  if (BOOPY_KEYWORDS.some((word) => key.includes(word))) return BOOPY_CRITTER_VOICE;
  if (BOUNCY_KEYWORDS.some((word) => key.includes(word))) return BOUNCY_CRITTER_VOICE;
  return FALLBACK_VOICE;
}

export function blipFrequency(
  speaker: string | null,
  stepIndex: number,
  char?: string,
): BlipSynth | null {
  if (char !== undefined && SILENT_CHAR.test(char)) return null;
  const voice = voiceForSpeaker(speaker);
  const code = char === undefined ? 0 : char.charCodeAt(0);
  const hash = Math.imul(Math.abs(Math.trunc(stepIndex)) + 1, 7) + Math.imul(code, 13);
  const index = ((hash % voice.notes.length) + voice.notes.length) % voice.notes.length;
  const frequency = voice.notes[index] ?? voice.notes[0] ?? 440;
  return {
    frequency,
    endFrequency:
      voice.glide === undefined ? undefined : Number((frequency * voice.glide).toFixed(2)),
    wave: voice.wave,
    duration: voice.duration,
    gain: voice.gain,
    harmonic: voice.harmonic,
  };
}

const F_MAJOR: readonly number[] = [349.23, 392.0, 440.0, 523.25, 587.33, 698.46];
const C_MAJOR: readonly number[] = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
const G_MAJOR: readonly number[] = [392.0, 440.0, 493.88, 587.33, 659.25, 783.99];
const D_MAJOR: readonly number[] = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66];
const EB_MAJOR: readonly number[] = [622.25, 698.46, 783.99, 932.33, 1046.5, 1244.51];
const A_DORIAN: readonly number[] = [440.0, 493.88, 523.25, 587.33, 659.25, 783.99];
const D_DORIAN: readonly number[] = [293.66, 329.63, 349.23, 392.0, 440.0, 493.88];
const A_MAJOR: readonly number[] = [440.0, 493.88, 554.37, 659.25, 739.99, 880.0];
const BB_MAJOR: readonly number[] = [466.16, 523.25, 587.33, 698.46, 783.99, 932.33];
const F_LYDIAN: readonly number[] = [349.23, 392.0, 440.0, 493.88, 523.25, 659.25];
const D_MINOR_PENTA: readonly number[] = [587.33, 698.46, 783.99, 880.0, 1046.5, 1174.66];

const TRACK_SCALES: Record<MusicTrack, readonly number[]> = {
  title: F_MAJOR,
  "enchanted-calm": F_MAJOR,
  talk: F_MAJOR,
  morning: F_MAJOR,
  home: C_MAJOR,
  battle: C_MAJOR,
  silent: C_MAJOR,
  school: G_MAJOR,
  cafe: G_MAJOR,
  bay: D_MAJOR,
  pass: EB_MAJOR,
  cavern: D_DORIAN,
  woods: A_DORIAN,
  hills: A_MAJOR,
  arcade: BB_MAJOR,
  enchanted: F_LYDIAN,
  boss: D_MINOR_PENTA,
};

export function trackScaleNotes(track: MusicTrack): readonly number[] {
  return TRACK_SCALES[track];
}

// Deterministic per-stride organic pitch variation in [0.94, 1.06] (zero Math.random).
export function footstepPitchFactor(tick: number): number {
  const step = Math.trunc(tick);
  let hash = Math.imul(step ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35) >>> 0;
  hash = (hash ^ (hash >>> 16)) >>> 0;
  const unit = hash / 0xffffffff;
  return Number((0.94 + unit * 0.12).toFixed(4));
}
