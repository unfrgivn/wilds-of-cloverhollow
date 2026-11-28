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

export type VoiceProsodyMood = "neutral" | "question" | "exclaim" | "whisper";
export type VoiceExpression = "neutral" | "happy" | "worried" | "determined" | "surprised";

export type VoiceProsody = {
  mood: VoiceProsodyMood;
  pitchScale: number;
  gainScale: number;
  glideScale: number;
  durationScale?: number;
  upbeatStep?: boolean;
  steadyGlide?: boolean;
};

export type ExpressionVoiceModifier = {
  pitchScale: number;
  gainScale: number;
  glideScale: number;
  durationScale: number;
  upbeatStep?: boolean;
  steadyGlide?: boolean;
};

const EXPRESSION_VOICE_MODIFIERS: Readonly<Record<VoiceExpression, ExpressionVoiceModifier>> = {
  neutral: { pitchScale: 1, gainScale: 1, glideScale: 1, durationScale: 1 },
  happy: {
    pitchScale: 1.07,
    gainScale: 1.05,
    glideScale: 1.05,
    durationScale: 0.94,
    upbeatStep: true,
  },
  worried: { pitchScale: 0.93, gainScale: 0.84, glideScale: 0.94, durationScale: 1.12 },
  surprised: { pitchScale: 1.12, gainScale: 1.08, glideScale: 1.13, durationScale: 0.85 },
  determined: {
    pitchScale: 0.98,
    gainScale: 1.08,
    glideScale: 1,
    durationScale: 1.04,
    steadyGlide: true,
  },
};

export function expressionVoiceModifier(expression?: VoiceExpression): ExpressionVoiceModifier {
  return EXPRESSION_VOICE_MODIFIERS[expression ?? "neutral"];
}

/**
 * Modulates sentence-aware voice prosody by the speaker's active portrait
 * expression (`happy`, `worried`, `surprised`, `determined`, or `neutral`).
 * Returns `prosody` unchanged when expression is omitted or `"neutral"`.
 */
export function applyExpressionProsody(
  prosody: VoiceProsody,
  expression?: VoiceExpression,
): VoiceProsody {
  if (expression === undefined || expression === "neutral") return prosody;
  const mod = EXPRESSION_VOICE_MODIFIERS[expression];
  const clamp = (value: number, low: number, high: number): number =>
    Number(Math.min(high, Math.max(low, value)).toFixed(4));
  return {
    mood: prosody.mood,
    pitchScale: clamp(prosody.pitchScale * mod.pitchScale, 0.82, 1.28),
    gainScale: clamp(prosody.gainScale * mod.gainScale, 0.62, 1.25),
    glideScale: mod.steadyGlide === true
      ? clamp(1 + (prosody.glideScale - 1) * 0.4, 0.86, 1.24)
      : clamp(prosody.glideScale * mod.glideScale, 0.86, 1.24),
    durationScale: clamp((prosody.durationScale ?? 1) * mod.durationScale, 0.78, 1.25),
    ...(mod.upbeatStep === true ? { upbeatStep: true } : {}),
    ...(mod.steadyGlide === true ? { steadyGlide: true } : {}),
  };
}

export const NEUTRAL_PROSODY: VoiceProsody = {
  mood: "neutral",
  pitchScale: 1,
  gainScale: 1,
  glideScale: 1,
};

const WHISPER_PROSODY: VoiceProsody = {
  mood: "whisper",
  pitchScale: 0.94,
  gainScale: 0.74,
  glideScale: 0.97,
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

const VOICE_ALIASES: Record<string, string> = {
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

const BIRD_KEYWORDS = ["bird", "gull", "owl", "penguin", "bat"] as const;
const BOOPY_KEYWORDS = ["frog", "mole", "raccoon", "crab"] as const;
const BOUNCY_KEYWORDS = [
  "pup", "cat", "squirrel", "hamster", "bunny", "lamb", "hedgehog",
] as const;

const SILENT_CHAR = /^[\s.,!?;:\u2014\u2013-]$/;
const TRAILING_CLOSER = /^["'\u201d\u2019)\]]$/;
const LEADING_OPENER = /^["'\u201c\u2018(\[]$/;

function ellipsisBounds(text: string, index: number): { start: number; end: number } | null {
  if (text[index] === "\u2026") return { start: index, end: index };
  if (text[index] !== "." || (text[index - 1] !== "." && text[index + 1] !== ".")) return null;
  let start = index;
  while (start > 0 && text[start - 1] === ".") start -= 1;
  let end = index;
  while (end + 1 < text.length && text[end + 1] === ".") end += 1;
  return { start, end };
}

function isTerminatingEllipsis(text: string, ellStart: number, ellEnd: number): boolean {
  let left = ellStart - 1;
  while (left >= 0 && (text[left] === " " || LEADING_OPENER.test(text[left] ?? ""))) left -= 1;
  if (left < 0) return false;
  const prev = text[left] ?? "";
  if (prev === "!" || prev === "?" || prev === "." || prev === "\u2026") return false;
  let right = ellEnd + 1;
  let sawCloser = false;
  while (right < text.length && TRAILING_CLOSER.test(text[right] ?? "")) {
    sawCloser = true;
    right += 1;
  }
  while (right < text.length && /\s/.test(text[right] ?? "")) right += 1;
  if (right >= text.length || sawCloser) return true;
  const next = text[right] ?? "";
  return /[A-Z]/.test(next) || LEADING_OPENER.test(next);
}

function isWordEmphasized(text: string, pos: number): boolean {
  const isLetter = (idx: number): boolean => /[A-Za-z]/.test(text[idx] ?? "");
  const isWordChar = (idx: number): boolean =>
    isLetter(idx) ||
    ((text[idx] === "'" || text[idx] === "\u2019") && isLetter(idx - 1) && isLetter(idx + 1));
  if (!isWordChar(pos)) return false;
  let left = pos;
  while (left > 0 && isWordChar(left - 1)) left -= 1;
  let right = pos;
  while (right + 1 < text.length && isWordChar(right + 1)) right += 1;
  const word = text.slice(left, right + 1);
  return word.length >= 2 && word === word.toUpperCase() && /[A-Z]{2,}/.test(word);
}

export function dialogueProsody(
  text: string | undefined,
  revealed: number | undefined,
): VoiceProsody {
  if (
    text === undefined ||
    revealed === undefined ||
    text.length === 0 ||
    !Number.isFinite(revealed) ||
    revealed <= 0
  ) {
    return NEUTRAL_PROSODY;
  }
  const pos = Math.min(text.length - 1, Math.max(0, Math.floor(revealed) - 1));
  const posEll = ellipsisBounds(text, pos);
  let scanBack = posEll !== null ? posEll.start - 1 : pos - 1;
  const posChar = text[pos] ?? "";
  if (posEll === null && (posChar === "!" || posChar === "?" || TRAILING_CLOSER.test(posChar))) {
    while (scanBack >= 0) {
      const ch = text[scanBack] ?? "";
      if (ch !== "!" && ch !== "?" && !TRAILING_CLOSER.test(ch)) break;
      scanBack -= 1;
    }
  }
  let start = 0;
  for (let i = scanBack; i >= 0; i -= 1) {
    const ell = ellipsisBounds(text, i);
    if (ell !== null) {
      if (isTerminatingEllipsis(text, ell.start, ell.end)) {
        start = ell.end + 1;
        while (start < text.length && TRAILING_CLOSER.test(text[start] ?? "")) start += 1;
        break;
      }
      i = ell.start;
      continue;
    }
    const ch = text[i];
    if (ch === "!" || ch === "?" || ch === ".") {
      start = i + 1;
      while (start < text.length && TRAILING_CLOSER.test(text[start] ?? "")) start += 1;
      break;
    }
  }
  while (start < pos && /\s/.test(text[start] ?? "")) start += 1;

  let end = text.length - 1;
  for (let i = Math.max(pos, start); i < text.length; i += 1) {
    const ell = ellipsisBounds(text, i);
    if (ell !== null) {
      if (isTerminatingEllipsis(text, ell.start, ell.end)) {
        end = ell.end;
        while (end + 1 < text.length && TRAILING_CLOSER.test(text[end + 1] ?? "")) end += 1;
        break;
      }
      i = ell.end;
      continue;
    }
    const ch = text[i];
    if (ch === "!" || ch === "?" || ch === ".") {
      end = i;
      while (end + 1 < text.length && (text[end + 1] === "!" || text[end + 1] === "?")) end += 1;
      while (end + 1 < text.length && TRAILING_CLOSER.test(text[end + 1] ?? "")) end += 1;
      break;
    }
  }

  let lead = start;
  while (lead <= end && LEADING_OPENER.test(text[lead] ?? "")) lead += 1;
  const leadEll = lead <= end ? ellipsisBounds(text, lead) : null;
  const isLeadingWhisper =
    leadEll !== null && leadEll.start === lead && pos >= start && pos - (leadEll.end + 1) <= 14;
  let tailIdx = end;
  while (
    tailIdx >= start &&
    (TRAILING_CLOSER.test(text[tailIdx] ?? "") || /\s/.test(text[tailIdx] ?? ""))
  ) {
    tailIdx -= 1;
  }
  const tailChar = tailIdx >= start ? text[tailIdx] : undefined;
  const isTrailingWhisper =
    tailChar === "\u2026" || (tailIdx >= start && ellipsisBounds(text, tailIdx) !== null);
  if (isLeadingWhisper || isTrailingWhisper) return WHISPER_PROSODY;

  let mood: VoiceProsodyMood = "neutral";
  let pitchScale = 1;
  let gainScale = 1;
  let glideScale = 1;
  if (tailChar === "?") {
    mood = "question";
    const span = end - start;
    const progress = span <= 0 ? 1 : Math.min(1, Math.max(0, (pos - start) / span));
    const tail = Math.max(0, (progress - 0.5) / 0.5);
    pitchScale = Number((1 + tail * 0.11).toFixed(4));
    glideScale = tail > 0 ? Number((1 + tail * 0.08).toFixed(4)) : 1;
  } else if (tailChar === "!") {
    mood = "exclaim";
    pitchScale = 1.07;
    gainScale = 1.1;
    glideScale = 1.04;
  }
  if (isWordEmphasized(text, pos)) {
    pitchScale = Number(Math.min(1.25, Math.max(0.85, pitchScale * 1.05)).toFixed(4));
    gainScale = Number(Math.min(1.25, Math.max(0.65, gainScale * 1.06)).toFixed(4));
  } else if (mood === "neutral") {
    return NEUTRAL_PROSODY;
  }
  return { mood, pitchScale, gainScale, glideScale };
}

export function voiceForSpeaker(speaker: string | null): VoiceProfile {
  if (speaker === null) return NARRATION_VOICE;
  const key = speaker.trim().toLowerCase();
  if (key.length === 0) return NARRATION_VOICE;
  const named = NAMED_VOICES[VOICE_ALIASES[key] ?? key];
  if (named !== undefined) return named;
  const unfizzed = key.startsWith("fizzy ") ? key.slice(6).trim() : null;
  if (unfizzed !== null && unfizzed.length > 0) {
    const baseNamed = NAMED_VOICES[VOICE_ALIASES[unfizzed] ?? unfizzed];
    if (baseNamed !== undefined) return baseNamed;
  }
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
  prosody?: VoiceProsody,
  expression?: VoiceExpression,
): BlipSynth | null {
  if (char !== undefined && SILENT_CHAR.test(char)) return null;
  const voice = voiceForSpeaker(speaker);
  const code = char === undefined ? 0 : char.charCodeAt(0);
  const step = Math.abs(Math.trunc(stepIndex));
  const hash = Math.imul(step + 1, 7) + Math.imul(code, 13);
  const index = ((hash % voice.notes.length) + voice.notes.length) % voice.notes.length;
  const baseFrequency = voice.notes[index] ?? voice.notes[0] ?? 440;
  const effective = applyExpressionProsody(prosody ?? NEUTRAL_PROSODY, expression);
  if (effective === NEUTRAL_PROSODY) {
    return {
      frequency: baseFrequency,
      endFrequency:
        voice.glide === undefined ? undefined : Number((baseFrequency * voice.glide).toFixed(2)),
      wave: voice.wave,
      duration: voice.duration,
      gain: voice.gain,
      harmonic: voice.harmonic,
    };
  }
  const upbeat = effective.upbeatStep === true && step % 2 === 1 ? 1.03 : 1;
  const frequency = Number((baseFrequency * effective.pitchScale * upbeat).toFixed(2));
  const gain = Number((voice.gain * effective.gainScale).toFixed(4));
  const duration =
    effective.durationScale === undefined
      ? voice.duration
      : Number((voice.duration * effective.durationScale).toFixed(4));
  const baseGlide =
    effective.steadyGlide === true && voice.glide !== undefined
      ? 1 + (voice.glide - 1) * 0.45
      : (voice.glide ?? 1);
  const hasGlide = voice.glide !== undefined || effective.glideScale !== 1;
  const endFrequency = hasGlide
    ? Number((frequency * baseGlide * effective.glideScale).toFixed(2))
    : undefined;
  return {
    frequency,
    endFrequency,
    wave: voice.wave,
    duration,
    gain,
    harmonic: voice.harmonic,
  };
}

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

const TRACK_SCALES: Record<MusicTrack, readonly number[]> = {
  title: F_MAJOR,
  bloom: F_MAJOR,
  road: F_MAJOR,
  "enchanted-calm": F_MAJOR,
  talk: F_MAJOR,
  morning: F_MAJOR,
  lodge: F_MAJOR,
  home: C_MAJOR,
  loft: C_MAJOR,
  clubhouse: C_MAJOR,
  battle: C_MAJOR,
  silent: C_MAJOR,
  school: G_MAJOR,
  cafe: G_MAJOR,
  market: G_MAJOR,
  fishing: G_MAJOR,
  summit: G_MAJOR,
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
