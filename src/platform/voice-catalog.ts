import type { MusicTrack } from "../core";
import type { VoiceProfile } from "./voices";

export const NARRATION_VOICE: VoiceProfile = {
  wave: "sine",
  notes: [330, 349, 392],
  duration: 0.036,
  gain: 0.028,
};

export const FALLBACK_VOICE: VoiceProfile = {
  wave: "triangle",
  notes: [349, 392, 440, 392],
  duration: 0.048,
  gain: 0.048,
};

export const FAIRY_VOICE: VoiceProfile = {
  wave: "sine",
  notes: [784, 988, 1175, 1319],
  duration: 0.054,
  gain: 0.044,
  harmonic: 2,
};

export const MYSTERY_VOICE: VoiceProfile = {
  wave: "sine",
  notes: [294, 311, 349],
  duration: 0.056,
  gain: 0.048,
  glide: 0.94,
};

export const BIRD_CRITTER_VOICE: VoiceProfile = {
  wave: "sine",
  notes: [659, 784, 880, 988],
  duration: 0.042,
  gain: 0.046,
  glide: 1.1,
};

export const BOOPY_CRITTER_VOICE: VoiceProfile = {
  wave: "triangle",
  notes: [294, 330, 392, 440],
  duration: 0.048,
  gain: 0.052,
  glide: 1.06,
};

export const BOUNCY_CRITTER_VOICE: VoiceProfile = {
  wave: "triangle",
  notes: [494, 554, 587, 659],
  duration: 0.044,
  gain: 0.05,
  glide: 1.08,
};

export const NAMED_VOICES: Readonly<Record<string, VoiceProfile>> = {
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
  "mr. bell": {
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
  "mrs. flurry": {
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
  "dream memory shrine": {
    wave: "sine",
    notes: [659, 784, 988, 1175],
    duration: 0.054,
    gain: 0.044,
    harmonic: 1.5,
  },
  "ms. clover": {
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
  "ms. rowan": {
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
  "ms. coral": {
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
  buster: {
    wave: "triangle",
    notes: [208, 247, 262, 294],
    duration: 0.056,
    gain: 0.056,
  },
  "bay keeper": {
    wave: "sine",
    notes: [392, 440, 494, 440],
    duration: 0.048,
    gain: 0.05,
  },
  "pass keeper": {
    wave: "triangle",
    notes: [330, 392, 440, 392],
    duration: 0.05,
    gain: 0.05,
  },
  "mr. pip": {
    wave: "triangle",
    notes: [330, 392, 440, 392],
    duration: 0.046,
    gain: 0.052,
  },
  baker: {
    wave: "sine",
    notes: [349, 392, 440, 523],
    duration: 0.05,
    gain: 0.052,
  },
  grocer: {
    wave: "triangle",
    notes: [311, 349, 392, 349],
    duration: 0.05,
    gain: 0.052,
  },
  "grocer pippin": {
    wave: "triangle",
    notes: [247, 294, 330, 294],
    duration: 0.052,
    gain: 0.054,
  },
  scoops: {
    wave: "sine",
    notes: [415, 466, 523, 466],
    duration: 0.045,
    gain: 0.05,
    harmonic: 1.5,
  },
  "scooper penny": {
    wave: "sine",
    notes: [494, 587, 659, 587],
    duration: 0.044,
    gain: 0.05,
    harmonic: 1.5,
  },
  "cocoa seller": {
    wave: "sine",
    notes: [330, 392, 440, 392],
    duration: 0.054,
    gain: 0.052,
    glide: 1.03,
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
  flora: {
    wave: "sine",
    notes: [370, 415, 466, 440],
    duration: 0.05,
    gain: 0.052,
  },
  "captain sal": {
    wave: "triangle",
    notes: [196, 220, 262, 233],
    duration: 0.058,
    gain: 0.056,
  },
  "hiker lark": {
    wave: "triangle",
    notes: [330, 392, 440, 392],
    duration: 0.048,
    gain: 0.052,
  },
  mina: {
    wave: "sine",
    notes: [392, 440, 523, 466],
    duration: 0.05,
    gain: 0.052,
  },
  otis: {
    wave: "triangle",
    notes: [185, 220, 247, 220],
    duration: 0.06,
    gain: 0.056,
  },
  "professor pebble": {
    wave: "triangle",
    notes: [262, 311, 349, 392],
    duration: 0.048,
    gain: 0.052,
    harmonic: 1.5,
  },
  "ranger moss": {
    wave: "triangle",
    notes: [233, 262, 294, 262],
    duration: 0.054,
    gain: 0.054,
  },
  sammy: {
    wave: "triangle",
    notes: [440, 523, 587, 659],
    duration: 0.042,
    gain: 0.052,
    glide: 1.05,
  },
  pippa: {
    wave: "sine",
    notes: [523, 587, 659, 740],
    duration: 0.043,
    gain: 0.05,
    glide: 1.06,
  },
  leo: {
    wave: "triangle",
    notes: [392, 440, 494, 523],
    duration: 0.046,
    gain: 0.05,
  },
  maya: {
    wave: "sine",
    notes: [466, 523, 587, 659],
    duration: 0.044,
    gain: 0.05,
  },
  nora: {
    wave: "sine",
    notes: [494, 554, 659, 698],
    duration: 0.043,
    gain: 0.049,
    glide: 1.04,
  },
  sunny: {
    wave: "triangle",
    notes: [440, 494, 554, 587],
    duration: 0.046,
    gain: 0.05,
    harmonic: 1.5,
  },
  "mailman gus": {
    wave: "triangle",
    notes: [208, 247, 294, 262],
    duration: 0.055,
    gain: 0.054,
  },
  "grandma hazel": {
    wave: "sine",
    notes: [330, 370, 415, 392],
    duration: 0.054,
    gain: 0.051,
  },
  bram: {
    wave: "triangle",
    notes: [294, 349, 440, 392],
    duration: 0.049,
    gain: 0.052,
    harmonic: 1.5,
  },
  wren: {
    wave: "sine",
    notes: [523, 587, 698, 659],
    duration: 0.044,
    gain: 0.049,
  },
  tuck: {
    wave: "triangle",
    notes: [466, 554, 622, 698],
    duration: 0.042,
    gain: 0.051,
    glide: 1.07,
  },
  kai: {
    wave: "triangle",
    notes: [415, 494, 554, 523],
    duration: 0.045,
    gain: 0.05,
    glide: 1.03,
  },
  "star-watcher sage": {
    wave: "sine",
    notes: [311, 370, 440, 466],
    duration: 0.056,
    gain: 0.05,
    harmonic: 1.5,
  },
  clara: {
    wave: "sine",
    notes: [349, 415, 466, 440],
    duration: 0.052,
    gain: 0.051,
  },
  bramble: {
    wave: "triangle",
    notes: [277, 330, 392, 349],
    duration: 0.047,
    gain: 0.053,
  },
  "custodian bert": {
    wave: "triangle",
    notes: [175, 208, 233, 220],
    duration: 0.059,
    gain: 0.055,
  },
  poppy: {
    wave: "triangle",
    notes: [494, 587, 659, 740],
    duration: 0.041,
    gain: 0.051,
    glide: 1.06,
  },
  gemma: {
    wave: "sine",
    notes: [554, 622, 698, 784],
    duration: 0.043,
    gain: 0.05,
  },
  theo: {
    wave: "triangle",
    notes: [370, 440, 494, 466],
    duration: 0.047,
    gain: 0.049,
  },
  "mrs. marigold": {
    wave: "sine",
    notes: [349, 392, 440, 415],
    duration: 0.052,
    gain: 0.052,
  },
  danny: {
    wave: "triangle",
    notes: [466, 523, 587, 659],
    duration: 0.043,
    gain: 0.05,
    glide: 1.06,
  },
  "hooded kid": MYSTERY_VOICE,
  "fizzy kid": MYSTERY_VOICE,
  kid: MYSTERY_VOICE,
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
  "sanctuary board": NARRATION_VOICE,
  chalkboard: NARRATION_VOICE,
  flyer: NARRATION_VOICE,
  "glow note": NARRATION_VOICE,
  "trail note": NARRATION_VOICE,
};

export const VOICE_ALIASES: Readonly<Record<string, string>> = {
  barnaby: "grandpa barnaby",
  principal: "mr. bell",
  coach: "coach ash",
  "lodge keeper": "mrs. flurry",
  "ms. maple": "ms. clover",
  teacher: "ms. clover",
  holly: "nurse holly",
  "nurse clover": "nurse holly",
  nurse: "nurse holly",
  "art teacher": "ms. rowan",
  "ms. willow": "ms. reed",
  "music teacher": "ms. reed",
  lifeguard: "ms. coral",
  fern: "ranger fern",
  "arcade keeper": "mr. pip",
  pippin: "grocer pippin",
  penny: "scooper penny",
  sal: "captain sal",
  lark: "hiker lark",
  pebble: "professor pebble",
  moss: "ranger moss",
  gus: "mailman gus",
  hazel: "grandma hazel",
  sage: "star-watcher sage",
  bert: "custodian bert",
  marigold: "mrs. marigold",
};

export const BIRD_KEYWORDS = ["bird", "gull", "owl", "penguin", "bat"] as const;
export const BOOPY_KEYWORDS = ["frog", "mole", "raccoon", "crab"] as const;
export const BOUNCY_KEYWORDS = [
  "pup", "cat", "squirrel", "hamster", "bunny", "lamb", "hedgehog",
] as const;

const F_MAJOR: readonly number[] = [349.23, 392.0, 440.0, 523.25, 587.33, 698.46];
const C_MAJOR: readonly number[] = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
const G_MAJOR: readonly number[] = [392.0, 440.0, 493.88, 587.33, 659.25, 783.99];
const D_MAJOR: readonly number[] = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66];
const EB_MAJOR: readonly number[] = [622.25, 698.46, 783.99, 932.33, 1046.5, 1244.51];
const EB_MAJOR_WARM: readonly number[] = [311.13, 349.23, 392.0, 466.16, 523.25, 622.25];
const A_DORIAN: readonly number[] = [440.0, 493.88, 523.25, 587.33, 659.25, 783.99];
const D_DORIAN: readonly number[] = [293.66, 329.63, 349.23, 392.0, 440.0, 493.88];
const A_MAJOR: readonly number[] = [440.0, 493.88, 554.37, 659.25, 739.99, 880.0];
const BB_MAJOR: readonly number[] = [466.16, 523.25, 587.33, 698.46, 783.99, 932.33];
const F_LYDIAN: readonly number[] = [349.23, 392.0, 440.0, 493.88, 523.25, 659.25];
const D_MINOR_PENTA: readonly number[] = [587.33, 698.46, 783.99, 880.0, 1046.5, 1174.66];

export const TRACK_SCALES: Readonly<Record<MusicTrack, readonly number[]>> = {
  title: F_MAJOR,
  bloom: F_MAJOR,
  road: F_MAJOR,
  canvas: F_MAJOR,
  "enchanted-calm": F_MAJOR,
  talk: F_MAJOR,
  morning: F_MAJOR,
  lodge: F_MAJOR,
  home: C_MAJOR,
  loft: C_MAJOR,
  melody: C_MAJOR,
  clubhouse: C_MAJOR,
  battle: C_MAJOR,
  silent: C_MAJOR,
  school: G_MAJOR,
  cafe: G_MAJOR,
  market: G_MAJOR,
  fishing: G_MAJOR,
  summit: G_MAJOR,
  encore: G_MAJOR,
  bay: D_MAJOR,
  island: D_MAJOR,
  sanctuary: D_MAJOR,
  festival: D_MAJOR,
  pass: EB_MAJOR,
  cottage: EB_MAJOR_WARM,
  hearts: EB_MAJOR_WARM,
  cavern: D_DORIAN,
  woods: A_DORIAN,
  hills: A_MAJOR,
  cabin: A_MAJOR,
  taco: A_MAJOR,
  arcade: BB_MAJOR,
  parlor: BB_MAJOR,
  enchanted: F_LYDIAN,
  boss: D_MINOR_PENTA,
};
