import type { MusicTrack } from "../core";

export type InstrumentVoice =
  | "piano"
  | "celesta"
  | "marimba"
  | "harp"
  | "flute"
  | "bass"
  | "pad"
  | "chip"
  | "shaker"
  | "woodblock";

export type NoteEvent = readonly [
  step: number,
  midi: number,
  durationSteps: number,
  velocity: number,
];

export type ScoreTrack = {
  voice: InstrumentVoice;
  gain: number;
  notes: readonly NoteEvent[];
};

export type Score = {
  bpm: number;
  stepsPerBar: number;
  bars: number;
  tracks: readonly ScoreTrack[];
};

export type PlayableTrack = Exclude<MusicTrack, "silent">;

export function chord(
  step: number,
  midis: readonly number[],
  dur: number,
  vel: number,
): NoteEvent[] {
  return midis.map((midi) => [step, midi, dur, vel] as const);
}

export function arp(
  start: number,
  midis: readonly number[],
  stepSize: number,
  dur: number,
  vel: number,
): NoteEvent[] {
  return midis.map((midi, i) => [start + i * stepSize, midi, dur, vel] as const);
}

export function waltzAccomp(
  bars: readonly (readonly [number, readonly number[]])[],
  vel = 0.52,
): NoteEvent[] {
  const out: NoteEvent[] = [];
  bars.forEach(([root, triad], bar) => {
    const base = bar * 12;
    out.push([base, root, 4, vel * 0.95]);
    out.push(...chord(base + 4, triad, 3.5, vel * 0.78));
    out.push(...chord(base + 8, triad, 3.5, vel * 0.68));
  });
  return out;
}

export function padBars(
  bars: readonly (readonly number[])[],
  stepsPerBar: number,
  vel = 0.42,
): NoteEvent[] {
  const out: NoteEvent[] = [];
  bars.forEach((notes, bar) => {
    out.push(...chord(bar * stepsPerBar, notes, stepsPerBar - 0.5, vel));
  });
  return out;
}

export function pulseBars(
  bars: number,
  stepsPerBar: number,
  hits: readonly (readonly [number, number, number, number])[],
): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    const base = bar * stepsPerBar;
    for (const [offset, midi, dur, vel] of hits) {
      out.push([base + offset, midi, dur, vel]);
    }
  }
  return out;
}

export function phrase(
  start: number,
  items: readonly (readonly [number, number, number, number])[],
): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (const [offset, midi, dur, vel] of items) {
    out.push([start + offset, midi, dur, vel]);
  }
  return out;
}
