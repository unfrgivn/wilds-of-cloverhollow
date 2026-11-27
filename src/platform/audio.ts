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
import {
  effectRecipe,
  effectRecipes,
  soundCueRecipe,
  soundCueRecipes,
  type AudioRecipe,
  type AudioSegment,
  type CompanionAudioEffect,
} from "./audio-recipes";
import { createMusicPlayer, type MusicPlayer } from "./music";
import { createPreferenceStore } from "./preference-store";
import { blipFrequency, footstepPitchFactor, trackScaleNotes } from "./voices";

export {
  effectRecipe,
  soundCueRecipe,
  type AudioRecipe,
  type AudioSegment,
  type CompanionAudioEffect,
};

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

export function shouldResumeAudioOnVisible(hidden: boolean, state: AudioState): boolean {
  return !hidden && (state === "interrupted" || state === "suspended");
}

export type AudioController = {
  play: (cue: SoundCue, tick: number, context?: SoundPlayContext) => SoundLogEntry;
  playEffect: (effect: CompanionAudioEffect) => void;
  effects: () => readonly CompanionAudioEffect[];
  clearEffects: () => void;
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

type Segment = AudioSegment;
type Recipe = AudioRecipe;

const preferenceKey = "cloverhollow-audio";

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
  const store = createPreferenceStore(preferenceKey);
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
  const playedEffects: CompanionAudioEffect[] = [];

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
    void store.save(
      writeAudioPreferences({
        muted,
        level,
        musicMuted,
        musicLevel,
        ambienceMuted,
      }),
    );
  };

  const toggle = (): void => {
    muted = !muted;
    store.markDirty();
    syncPlayers();
    if (store.isLoaded()) persist();
  };

  const applyLevel = (next: AudioLevel): void => {
    level = next;
    if (master !== null) master.gain.value = gainForAudioLevel(level);
  };

  const setLevel = (next: AudioLevel): void => {
    store.markDirty();
    applyLevel(next);
    if (store.isLoaded()) persist();
  };

  const toggleMusic = (): void => {
    musicMuted = !musicMuted;
    store.markDirty();
    syncPlayers();
    if (store.isLoaded()) persist();
  };

  const setMusicLevel = (next: AudioLevel): void => {
    musicLevel = next;
    store.markDirty();
    syncPlayers();
    if (store.isLoaded()) persist();
  };

  const toggleAmbience = (): void => {
    ambienceMuted = !ambienceMuted;
    store.markDirty();
    syncPlayers();
    if (store.isLoaded()) persist();
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

  const scaleRecipePitch = (recipe: Recipe, factor: number): Segment[] =>
    recipe.map((segment) =>
      segment.wave === "noise"
        ? { ...segment, lowpass: segment.lowpass * factor }
        : {
            ...segment,
            frequency: segment.frequency * factor,
            endFrequency:
              segment.endFrequency === undefined ? undefined : segment.endFrequency * factor,
          },
    );

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
    } else if (cue.startsWith("footstep-")) {
      recipe = scaleRecipePitch(soundCueRecipes[cue], footstepPitchFactor(tick));
    } else {
      recipe = soundCueRecipes[cue];
    }
    if (recipe === null) return true;
    const now = audio.currentTime;
    recipe.forEach((segment) => playSegment(audio, segment, now + segment.offset));
    return true;
  };

  const playEffect = (effect: CompanionAudioEffect): void => {
    if (muted) return;
    unlock();
    const audio = context;
    if (audio === null || master === null || stateOf(audio) !== "running") return;
    const now = audio.currentTime;
    effectRecipes[effect].forEach((segment) => playSegment(audio, segment, now + segment.offset));
    playedEffects.push(effect);
    if (playedEffects.length > 64) playedEffects.shift();
  };

  let hasUserGesture = false;
  const unlockFromGesture = (): void => {
    hasUserGesture = true;
    unlock();
  };
  const handleVisible = (): void => {
    const current = stateOf(context);
    if (
      shouldResumeAudioOnVisible(document.hidden, current) &&
      (current === "interrupted" || hasUserGesture)
    ) {
      unlock();
    }
    syncPlayers();
  };

  const booted = ensureContext();
  if (booted === null) onStateChange(stateOf(booted));
  else {
    if (stateOf(booted) === "running") hasUserGesture = true;
    booted.addEventListener("statechange", () => {
      if (stateOf(booted) === "running") hasUserGesture = true;
      syncPlayers();
      onStateChange(stateOf(booted));
    });
    onStateChange(stateOf(booted));
    unlock();
  }
  window.addEventListener("pointerdown", unlockFromGesture, { passive: true });
  window.addEventListener("touchstart", unlockFromGesture, { passive: true });
  window.addEventListener("keydown", (event) => {
    unlockFromGesture();
    if (
      event.code === "KeyM" &&
      !(
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea") !== null
      )
    )
      toggle();
  });
  document.addEventListener("visibilitychange", handleVisible);
  window.addEventListener("pageshow", handleVisible);
  void store.load((value) => {
    if (store.isDirty()) persist();
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
    playEffect,
    effects: () => playedEffects.slice(),
    clearEffects: () => {
      playedEffects.length = 0;
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
