import type { MusicTrack, State, World } from "../core";
import type { PlayableTrack } from "./scores";
import { trackScaleNotes } from "./voices";

export const JOURNAL_FILTER_HZ = 1400;
export const JOURNAL_DUCK_GAIN = 0.46;
export const NORMAL_DUCK_GAIN = 0.55;
export const OPEN_FILTER_HZ = 18000;
export const DUCK_FILTER_HZ = 2600;
export const AMBIENCE_JOURNAL_FILTER_HZ = 1400;
export const AMBIENCE_OPEN_FILTER_HZ = 18000;
export const AMBIENCE_JOURNAL_GAIN_SCALE = 0.62;
export const LANTERN_SHIMMER_GAIN = 0.24;
export const TENSION_PERCUSSION_BOOST = 1.18;

export type MusicAdaptiveState = {
  journalWarm: boolean;
  lanternLayer: boolean;
  tensionLayer: boolean;
  filterCutoffHz: number;
  duckGain: number;
  ambienceFilterHz: number;
  ambienceGainScale: number;
};

export type VerticalNote = {
  voice: "celesta" | "shaker" | "woodblock" | "bass";
  gain: number;
  midi: number;
  durationSteps: number;
  velocity: number;
};

const TENSION_CALM_PHASES: ReadonlySet<string> = new Set([
  "reward",
  "rest",
  "soothed",
  "run",
]);

const CELESTA_MIN_MIDI = 79;
const CELESTA_MAX_MIDI = 93;
const BOSS_BASS_MIN_MIDI = 43;
const BOSS_BASS_MAX_MIDI = 55;

const SHIMMER_SLOTS_4_4: readonly number[] = [0, 6, 10, 14];
const SHIMMER_SLOTS_3_4: readonly number[] = [0, 4, 8];
const SHIMMER_CONTOUR: readonly number[] = [0, 2, 4, 3, 1, 4, 2, 5];
const SHIMMER_VELOCITIES: readonly number[] = [0.28, 0.24, 0.26, 0.22];

function positiveMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

/** Pure projection of adaptive music filter, ambience warmth, and vertical layers. */
export function projectMusicMix(
  world: Pick<World, "critters">,
  state: Pick<State, "area" | "arcade" | "battle" | "finale" | "journalOpen" | "lantern">,
  options: { titleOpen: boolean; jukeboxActive: boolean; track: MusicTrack; duck: boolean },
): MusicAdaptiveState {
  const journalWarm =
    state.journalOpen &&
    !options.titleOpen &&
    !options.jukeboxActive &&
    options.track !== "silent";

  const filterCutoffHz = journalWarm
    ? JOURNAL_FILTER_HZ
    : options.duck
      ? DUCK_FILTER_HZ
      : OPEN_FILTER_HZ;
  const duckGain = journalWarm
    ? JOURNAL_DUCK_GAIN
    : options.duck
      ? NORMAL_DUCK_GAIN
      : 1;
  const ambienceFilterHz = journalWarm
    ? AMBIENCE_JOURNAL_FILTER_HZ
    : AMBIENCE_OPEN_FILTER_HZ;
  const ambienceGainScale = journalWarm ? AMBIENCE_JOURNAL_GAIN_SCALE : 1;

  const lanternLayer =
    state.lantern &&
    !options.titleOpen &&
    !options.jukeboxActive &&
    state.battle === null &&
    state.arcade === null &&
    state.finale === null &&
    state.area !== "harness" &&
    options.track !== "silent";

  let tensionLayer = false;
  if (
    !options.titleOpen &&
    !options.jukeboxActive &&
    state.battle !== null &&
    (options.track === "battle" || options.track === "boss") &&
    !TENSION_CALM_PHASES.has(state.battle.phase)
  ) {
    if (state.battle.windUp !== null) {
      tensionLayer = true;
    } else {
      const critter = world.critters[state.battle.critterId];
      const isBoss =
        critter !== undefined &&
        (critter.windUp !== null || critter.talk !== null || !critter.canRun);
      if (isBoss && critter.calmMax > 0 && state.battle.calm * 2 >= critter.calmMax) {
        tensionLayer = true;
      }
    }
  }

  return {
    journalWarm,
    lanternLayer,
    tensionLayer,
    filterCutoffHz,
    duckGain,
    ambienceFilterHz,
    ambienceGainScale,
  };
}

/** Converts a frequency in Hz to the nearest equal-temperament MIDI note number. */
export function hzToMidi(hz: number): number {
  if (!Number.isFinite(hz) || hz <= 0) return 69;
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

/** Returns a track's harmonic scale transposed into the celesta shimmer register [G5..A6]. */
export function trackScaleMidi(track: MusicTrack): readonly number[] {
  return trackScaleNotes(track).map((hz) => {
    let midi = hzToMidi(hz);
    while (midi < CELESTA_MIN_MIDI) midi += 12;
    while (midi > CELESTA_MAX_MIDI) midi -= 12;
    return midi;
  });
}

/** Latches an adaptive layer cleanly on bar downbeats, with optional immediate release. */
export function nextBarAdaptiveState(
  committed: boolean,
  desired: boolean,
  stepInBar: number,
  immediateRelease = false,
): boolean {
  if (immediateRelease && !desired) return false;
  if (stepInBar === 0) return desired;
  return committed;
}

/** Deterministic dreamy celesta shimmer note matching the active track's scale. */
export function lanternShimmerNote(
  track: PlayableTrack,
  stepInBar: number,
  stepsPerBar: number,
  barIndex: number,
): VerticalNote | null {
  const slots = stepsPerBar === 12 ? SHIMMER_SLOTS_3_4 : SHIMMER_SLOTS_4_4;
  const slotIndex = slots.indexOf(stepInBar);
  if (slotIndex === -1) return null;

  const scale = trackScaleMidi(track);
  if (scale.length === 0) return null;

  const safeBar = Number.isFinite(barIndex) ? Math.trunc(barIndex) : 0;
  const contourIndex = positiveMod(safeBar * 3 + slotIndex, SHIMMER_CONTOUR.length);
  const scaleDegree = SHIMMER_CONTOUR[contourIndex] ?? 0;
  const midi = scale[scaleDegree % scale.length] ?? scale[0] ?? 84;
  const velocity = SHIMMER_VELOCITIES[slotIndex] ?? 0.24;

  return {
    voice: "celesta",
    gain: LANTERN_SHIMMER_GAIN,
    midi,
    durationSteps: 2,
    velocity,
  };
}

/** Subtle rhythmic tension percussion (and boss tonic bass pulse) for Wind-Up / Phase-2 lifts. */
export function battleTensionNotes(
  track: PlayableTrack,
  stepInBar: number,
  stepsPerBar: number,
  barIndex: number,
): readonly VerticalNote[] {
  if (track !== "battle" && track !== "boss") return [];

  const notes: VerticalNote[] = [];
  const isWaltz = stepsPerBar === 12;
  const safeBar = Number.isFinite(barIndex) ? Math.trunc(barIndex) : 0;

  const isShakerStep = isWaltz
    ? stepInBar === 2 || stepInBar === 6 || stepInBar === 10
    : stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14;
  if (isShakerStep) {
    const velocity =
      stepInBar === 6 || stepInBar === 14 ? 0.34 : stepInBar === 10 ? 0.31 : 0.28;
    notes.push({
      voice: "shaker",
      gain: 0.24,
      midi: 78,
      durationSteps: 1,
      velocity,
    });
  }

  const isOddBar = positiveMod(safeBar, 2) === 1;
  const isWoodblockStep = isWaltz
    ? stepInBar === 4 || stepInBar === 10
    : stepInBar === 4 || stepInBar === 12 || (isOddBar && stepInBar === 14);
  if (isWoodblockStep) {
    const midi = stepInBar === 14 ? 79 : stepInBar === 12 ? 76 : 74;
    const velocity = stepInBar === 12 ? 0.3 : stepInBar === 4 ? 0.27 : 0.24;
    notes.push({
      voice: "woodblock",
      gain: 0.22,
      midi,
      durationSteps: 1,
      velocity,
    });
  }

  if (track === "boss" && (stepInBar === 0 || stepInBar === 8)) {
    const tonic = trackScaleMidi(track)[0] ?? 86;
    let bassMidi = tonic - 36;
    while (bassMidi < BOSS_BASS_MIN_MIDI) bassMidi += 12;
    while (bassMidi > BOSS_BASS_MAX_MIDI) bassMidi -= 12;
    notes.push({
      voice: "bass",
      gain: 0.22,
      midi: bassMidi,
      durationSteps: 2,
      velocity: 0.26,
    });
  }

  return notes;
}
