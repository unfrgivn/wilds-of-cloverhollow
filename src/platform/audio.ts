import { Preferences } from "@capacitor/preferences";
import {
  trackTitles,
  type AmbienceBed,
  type MusicTrack,
  type SoundCue,
  type SoundtrackState,
} from "../core";
import {
  DEFAULT_AUDIO_LEVEL,
  DEFAULT_MUSIC_LEVEL,
  gainForAmbienceLevel,
  gainForAudioLevel,
  gainForMusicLevel,
  readAudioPreferences,
  writeAudioPreferences,
  type AudioLevel,
} from "./audio-settings";
import { createAmbiencePlayer, type AmbiencePlayer } from "./ambience";
import { createMusicPlayer, type MusicPlayer } from "./music";
import { blipFrequency, trackScaleNotes } from "./voices";

export type SoundLogEntry = { tick: number; cue: SoundCue; played: boolean };
export type SoundPlayContext = {
  speaker?: string | null;
  text?: string;
  revealed?: number;
  choiceIndex?: number;
};
// WebKit adds "interrupted" (no gesture yet, or the audio session was taken)
// to the standard states, so the DOM type doesn't cover what it reports.
export type AudioState = "running" | "suspended" | "interrupted" | "closed" | "unavailable";

export type MusicDebugInfo = {
  track: MusicTrack;
  ambience: AmbienceBed;
  duck: boolean;
  title: string;
  playing: boolean;
  muted: boolean;
  level: AudioLevel;
  ambienceMuted: boolean;
};

function stateOf(audio: AudioContext | null): AudioState {
  if (audio === null) return "unavailable";
  const state: string = audio.state;
  return state === "running" || state === "closed" || state === "interrupted" ? state : "suspended";
}

export type AudioController = {
  play: (cue: SoundCue, tick: number, context?: SoundPlayContext) => SoundLogEntry;
  toggle: () => void;
  muted: () => boolean;
  setLevel: (level: AudioLevel) => void;
  level: () => AudioLevel;
  setSoundtrack: (next: SoundtrackState) => void;
  toggleMusic: () => void;
  musicMuted: () => boolean;
  setMusicLevel: (level: AudioLevel) => void;
  musicLevel: () => AudioLevel;
  toggleAmbience: () => void;
  ambienceMuted: () => boolean;
  music: () => MusicDebugInfo;
  log: () => SoundLogEntry[];
  state: () => AudioState;
};

type Timing = { offset: number; duration: number; gain: number; attack?: number };
type Segment =
  | (Timing & { wave: "noise"; lowpass: number })
  | (Timing & {
      wave: "sine" | "square" | "triangle";
      frequency: number;
      endFrequency?: number;
      vibrato?: { rate: number; depth: number };
    });
type Recipe = readonly Segment[];

const preferenceKey = "cloverhollow-audio";
const recipes: Record<SoundCue, Recipe> = {
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
  "footstep-grass": [{ wave: "noise", offset: 0, duration: 0.06, gain: 0.022, lowpass: 980 }],
  "footstep-sand": [{ wave: "noise", offset: 0, duration: 0.075, gain: 0.022, lowpass: 620 }],
  "footstep-wood": [
    { wave: "triangle", frequency: 145, offset: 0, duration: 0.055, gain: 0.024 },
    { wave: "noise", offset: 0.01, duration: 0.035, gain: 0.013, lowpass: 1250 },
  ],
  "footstep-snow": [{ wave: "noise", offset: 0, duration: 0.095, gain: 0.021, lowpass: 400 }],
  "footstep-stone": [{ wave: "triangle", frequency: 840, offset: 0, duration: 0.034, gain: 0.021 }],
  "footstep-tile": [{ wave: "square", frequency: 980, offset: 0, duration: 0.026, gain: 0.016 }],
  "footstep-carpet": [{ wave: "noise", offset: 0, duration: 0.07, gain: 0.019, lowpass: 480 }],
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
    { wave: "triangle", frequency: 523, offset: 0, duration: 0.12, gain: 0.095 },
    { wave: "triangle", frequency: 659, offset: 0.085, duration: 0.12, gain: 0.095 },
    { wave: "triangle", frequency: 784, offset: 0.17, duration: 0.16, gain: 0.105 },
    { wave: "sine", frequency: 1047, offset: 0.25, duration: 0.22, gain: 0.06 },
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
    { wave: "triangle", frequency: 523, offset: 0, duration: 0.1, gain: 0.1 },
    { wave: "triangle", frequency: 659, offset: 0.085, duration: 0.1, gain: 0.1 },
    { wave: "triangle", frequency: 784, offset: 0.17, duration: 0.12, gain: 0.105 },
    { wave: "sine", frequency: 1047, offset: 0.26, duration: 0.24, gain: 0.09 },
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
    { wave: "triangle", frequency: 523, offset: 0, duration: 0.08, gain: 0.07 },
    { wave: "triangle", frequency: 659, offset: 0.08, duration: 0.08, gain: 0.07 },
    { wave: "triangle", frequency: 784, offset: 0.16, duration: 0.08, gain: 0.08 },
    { wave: "triangle", frequency: 1047, offset: 0.24, duration: 0.2, gain: 0.08 },
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
    { wave: "sine", frequency: 1319, offset: 0, duration: 0.28, gain: 0.09 },
    { wave: "sine", frequency: 2637, offset: 0, duration: 0.14, gain: 0.035 },
  ],
  "tickets-won": [
    { wave: "triangle", frequency: 880, offset: 0, duration: 0.04, gain: 0.05 },
    { wave: "triangle", frequency: 880, offset: 0.07, duration: 0.04, gain: 0.05 },
    { wave: "triangle", frequency: 880, offset: 0.14, duration: 0.04, gain: 0.05 },
    { wave: "triangle", frequency: 1175, offset: 0.21, duration: 0.14, gain: 0.07 },
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

function createReverbImpulse(audio: AudioContext): AudioBuffer {
  const length = Math.max(1, Math.floor(audio.sampleRate * 1.0));
  const buffer = audio.createBuffer(2, length, audio.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i += 1) {
      const decay = Math.pow(1 - i / length, 2.6);
      const white = (Math.random() * 2 - 1) * decay;
      lp = lp * 0.72 + white * 0.28;
      data[i] = lp;
    }
  }
  return buffer;
}

// The context is made at boot and resumed at every chance: browsers keep it
// suspended until a key, click, or tap (a gamepad press never counts), while
// the iOS app's web view lets it run at once (Capacitor clears
// `mediaTypesRequiringUserActionForPlayback`), so a pad-only player there
// hears the game from the start. WebKit's default `ambient` session lets the
// ring/silent switch mute it, as a game's sound should.
export function createAudio(
  onStateChange: (state: AudioState) => void = () => undefined,
): AudioController {
  let muted = false;
  let level: AudioLevel = DEFAULT_AUDIO_LEVEL;
  let musicMuted = false;
  let musicLevel: AudioLevel = DEFAULT_MUSIC_LEVEL;
  let ambienceMuted = false;
  let soundtrack: SoundtrackState = {
    track: "silent",
    ambience: "none",
    duck: false,
    title: trackTitles.silent,
  };
  let preferenceLoaded = false;
  let locallyChanged = false;
  let preferenceWrite = Promise.resolve();
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let musicPlayer: MusicPlayer | null = null;
  let ambiencePlayer: AmbiencePlayer | null = null;
  let noise: AudioBuffer | null = null;

  // One shared quarter second of white noise; segments are shorter and just play its head.
  const noiseBuffer = (audio: AudioContext): AudioBuffer => {
    if (noise !== null) return noise;
    noise = audio.createBuffer(1, Math.floor(audio.sampleRate / 4), audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    return noise;
  };
  const entries: SoundLogEntry[] = [];

  const pageVisible = (): boolean =>
    typeof document === "undefined" || !document.hidden;

  const syncPlayers = (): void => {
    const visible = pageVisible();
    musicPlayer?.setMix({
      active: visible && !muted && !musicMuted,
      gain: gainForMusicLevel(musicLevel),
    });
    ambiencePlayer?.setMix({
      active: visible && !muted && !ambienceMuted,
      gain: gainForAmbienceLevel(musicLevel),
    });
  };

  const persist = (): void => {
    const value = writeAudioPreferences({
      muted,
      level,
      musicMuted,
      musicLevel,
      ambienceMuted,
    });
    preferenceWrite = preferenceWrite.then(() =>
      Preferences.set({ key: preferenceKey, value }),
    );
  };

  const toggle = (): void => {
    muted = !muted;
    locallyChanged = true;
    syncPlayers();
    if (preferenceLoaded) persist();
  };

  const applyLevel = (next: AudioLevel): void => {
    level = next;
    if (master !== null) master.gain.value = gainForAudioLevel(level);
  };

  const setLevel = (next: AudioLevel): void => {
    locallyChanged = true;
    applyLevel(next);
    if (preferenceLoaded) persist();
  };

  const toggleMusic = (): void => {
    musicMuted = !musicMuted;
    locallyChanged = true;
    syncPlayers();
    if (preferenceLoaded) persist();
  };

  const setMusicLevel = (next: AudioLevel): void => {
    musicLevel = next;
    locallyChanged = true;
    syncPlayers();
    if (preferenceLoaded) persist();
  };

  const toggleAmbience = (): void => {
    ambienceMuted = !ambienceMuted;
    locallyChanged = true;
    syncPlayers();
    if (preferenceLoaded) persist();
  };

  const setSoundtrack = (next: SoundtrackState): void => {
    if (
      next.track === soundtrack.track &&
      next.ambience === soundtrack.ambience &&
      next.duck === soundtrack.duck
    ) return;
    soundtrack = next;
    musicPlayer?.setState({ track: next.track, duck: next.duck });
    ambiencePlayer?.setBed(next.ambience);
  };

  const ensureContext = (): AudioContext | null => {
    if (context !== null) return context;
    const Constructor = globalThis.AudioContext;
    if (Constructor === undefined) return null;
    context = new Constructor();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.15;
    compressor.connect(context.destination);

    master = context.createGain();
    master.gain.value = gainForAudioLevel(level);
    master.connect(compressor);

    const musicOutput = context.createGain();
    musicOutput.gain.value = 1;
    const musicDry = context.createGain();
    musicDry.gain.value = 0.85;
    musicOutput.connect(musicDry).connect(compressor);
    if (typeof context.createConvolver === "function") {
      const convolver = context.createConvolver();
      convolver.buffer = createReverbImpulse(context);
      const musicWet = context.createGain();
      musicWet.gain.value = 0.22;
      musicOutput.connect(convolver).connect(musicWet).connect(compressor);
    }

    const ambienceOutput = context.createGain();
    ambienceOutput.gain.value = 1;
    ambienceOutput.connect(compressor);

    musicPlayer = createMusicPlayer(context, musicOutput);
    ambiencePlayer = createAmbiencePlayer(context, ambienceOutput);
    musicPlayer.setState({ track: soundtrack.track, duck: soundtrack.duck });
    ambiencePlayer.setBed(soundtrack.ambience);
    syncPlayers();
    return context;
  };

  const unlock = (): void => {
    const audio = ensureContext();
    // A refused resume (no gesture yet) rejects in some browsers; the next
    // gesture or cue tries again.
    const state = stateOf(audio);
    if (audio !== null && state !== "running" && state !== "closed") {
      audio.resume().then(() => syncPlayers()).catch(() => undefined);
    }
  };

  const playSegment = (audio: AudioContext, segment: Segment, start: number): void => {
    if (master === null) return;
    const gain = audio.createGain();
    const end = start + segment.duration;
    const attack = Math.min(segment.attack ?? 0.006, segment.duration * 0.4);
    gain.gain.setValueAtTime(0.001, start);
    if (segment.attack !== undefined) {
      gain.gain.linearRampToValueAtTime(segment.gain, start + attack);
    } else {
      gain.gain.exponentialRampToValueAtTime(segment.gain, start + attack);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    if (segment.wave === "noise") {
      const source = audio.createBufferSource();
      source.buffer = noiseBuffer(audio);
      const filter = audio.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = segment.lowpass;
      source.connect(filter).connect(gain).connect(master);
      source.start(start);
      source.stop(end);
      return;
    }
    const oscillator = audio.createOscillator();
    oscillator.type = segment.wave;
    // Square blips get a hair of pitch wobble so text doesn't sound like a dial tone.
    const jitter = segment.wave === "square" ? (Math.random() - 0.5) * 18 : 0;
    oscillator.frequency.setValueAtTime(segment.frequency + jitter, start);
    if (segment.endFrequency !== undefined)
      oscillator.frequency.linearRampToValueAtTime(segment.endFrequency, end);
    if (segment.vibrato !== undefined) {
      const vibrato = audio.createOscillator();
      const depth = audio.createGain();
      vibrato.frequency.value = segment.vibrato.rate;
      depth.gain.value = segment.vibrato.depth;
      vibrato.connect(depth).connect(oscillator.frequency);
      vibrato.start(start);
      vibrato.stop(end);
    }
    oscillator.connect(gain).connect(master);
    oscillator.start(start);
    oscillator.stop(end);
  };

  const dialogueBlipRecipe = (tick: number, info?: SoundPlayContext): Segment[] | null => {
    const text = info?.text;
    const revealed = info?.revealed;
    let char: string | undefined;
    if (text !== undefined && revealed !== undefined && revealed > 0) {
      const current = text[revealed - 1];
      const previous = revealed >= 2 ? text[revealed - 2] : undefined;
      char = current !== undefined && /^[\s.,!?;:\u2014\u2013-]$/.test(current)
        ? previous
        : current;
    }
    const blip = blipFrequency(info?.speaker ?? null, revealed ?? tick, char);
    if (blip === null) return null;
    const segments: Segment[] = [
      {
        wave: blip.wave,
        frequency: blip.frequency,
        endFrequency: blip.endFrequency,
        offset: 0,
        duration: blip.duration,
        gain: blip.gain,
        attack: 0.002,
      },
    ];
    if (blip.harmonic !== undefined) {
      segments.push({
        wave: "sine",
        frequency: blip.frequency * blip.harmonic,
        endFrequency:
          blip.endFrequency === undefined ? undefined : blip.endFrequency * blip.harmonic,
        offset: 0,
        duration: blip.duration * 0.85,
        gain: blip.gain * 0.28,
        attack: 0.002,
      });
    }
    return segments;
  };

  const scaleChoiceRecipe = (
    cue: "choice-move" | "battle-command" | "choice-select",
    tick: number,
    info?: SoundPlayContext,
  ): Segment[] => {
    const scale = trackScaleNotes(soundtrack.track);
    if (cue === "choice-select") {
      const root = scale[0] ?? 523.25;
      const fifth = scale[3] ?? 783.99;
      return [
        { wave: "triangle", frequency: root, offset: 0, duration: 0.095, gain: 0.1 },
        { wave: "sine", frequency: fifth, offset: 0.045, duration: 0.115, gain: 0.075 },
      ];
    }
    const raw = info?.choiceIndex ?? tick;
    const index = ((Math.trunc(raw) % scale.length) + scale.length) % scale.length;
    const note = scale[index] ?? 523.25;
    const isCommand = cue === "battle-command";
    return [
      {
        wave: "triangle",
        frequency: note,
        offset: 0,
        duration: isCommand ? 0.09 : 0.072,
        gain: isCommand ? 0.082 : 0.074,
        attack: 0.003,
      },
      {
        wave: "sine",
        frequency: note * 2,
        offset: 0,
        duration: isCommand ? 0.055 : 0.045,
        gain: 0.022,
        attack: 0.003,
      },
    ];
  };

  const playRecipe = (cue: SoundCue, tick: number, info?: SoundPlayContext): boolean => {
    if (muted) return false;
    unlock();
    const audio = context;
    if (audio === null || master === null || stateOf(audio) !== "running") return false;
    let recipe: Recipe | null;
    if (cue === "dialogue-blip") {
      recipe = dialogueBlipRecipe(tick, info);
    } else if (cue === "choice-move" || cue === "battle-command" || cue === "choice-select") {
      recipe = scaleChoiceRecipe(cue, tick, info);
    } else {
      recipe = recipes[cue];
    }
    if (recipe === null) return true;
    const now = audio.currentTime;
    recipe.forEach((segment) => playSegment(audio, segment, now + segment.offset));
    return true;
  };

  const booted = ensureContext();
  if (booted === null) onStateChange(stateOf(booted));
  else {
    booted.addEventListener("statechange", () => {
      syncPlayers();
      onStateChange(stateOf(booted));
    });
    onStateChange(stateOf(booted));
    unlock();
  }
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", (event) => {
    unlock();
    if (
      event.code === "KeyM" &&
      !(
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea") !== null
      )
    )
      toggle();
  });
  document.addEventListener("visibilitychange", syncPlayers);
  void Preferences.get({ key: preferenceKey }).then(({ value }) => {
    preferenceLoaded = true;
    if (locallyChanged) persist();
    else {
      const preferences = readAudioPreferences(value);
      muted = preferences.muted;
      applyLevel(preferences.level);
      musicMuted = preferences.musicMuted;
      musicLevel = preferences.musicLevel;
      ambienceMuted = preferences.ambienceMuted;
      syncPlayers();
    }
  });

  return {
    play: (cue, tick, info) => {
      const entry = { tick, cue, played: playRecipe(cue, tick, info) };
      entries.push(entry);
      if (entries.length > 120) entries.shift();
      return entry;
    },
    toggle,
    muted: () => muted,
    setLevel,
    level: () => level,
    setSoundtrack,
    toggleMusic,
    musicMuted: () => musicMuted,
    setMusicLevel,
    musicLevel: () => musicLevel,
    toggleAmbience,
    ambienceMuted: () => ambienceMuted,
    music: () => ({
      track: soundtrack.track,
      ambience: soundtrack.ambience,
      duck: soundtrack.duck,
      title: soundtrack.title,
      playing:
        stateOf(context) === "running" &&
        pageVisible() &&
        !muted &&
        !musicMuted &&
        soundtrack.track !== "silent",
      muted: musicMuted,
      level: musicLevel,
      ambienceMuted,
    }),
    log: () => entries.slice(),
    state: () => stateOf(context),
  };
}
