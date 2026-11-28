import type { MusicTrack } from "../core";
import {
  BIRD_CRITTER_VOICE,
  BIRD_KEYWORDS,
  BOOPY_CRITTER_VOICE,
  BOOPY_KEYWORDS,
  BOUNCY_CRITTER_VOICE,
  BOUNCY_KEYWORDS,
  FAIRY_VOICE,
  FALLBACK_VOICE,
  NAMED_VOICES,
  NARRATION_VOICE,
  TRACK_SCALES,
  VOICE_ALIASES,
} from "./voice-catalog";

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

const SILENT_CHAR = /^[\s.,!?;:\u2014\u2013-]$/;
const TRAILING_CLOSER = /^["'\u201d\u2019)\]]$/;
const LEADING_OPENER = /^["'\u201c\u2018([]$/;

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
