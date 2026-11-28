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
  ambientChatterSegments,
  createAudioOutputGraph,
  createNoiseBuffer,
  extractBlipChar,
  resolveCueRecipe,
  scheduleRecipe,
  voiceBlipSegments,
} from "./audio-playback";
import {
  effectRecipe,
  effectRecipes,
  soundCueRecipe,
  type AudioRecipe,
  type AudioSegment,
  type CompanionAudioEffect,
} from "./audio-recipes";
import { createMusicPlayer, type MusicPlayer } from "./music";
import {
  AMBIENCE_OPEN_FILTER_HZ,
  DUCK_FILTER_HZ,
  NORMAL_DUCK_GAIN,
  OPEN_FILTER_HZ,
  projectMusicMix,
  type MusicAdaptiveState,
} from "./music-mix";
import { createPreferenceStore } from "./preference-store";
import {
  applyExpressionProsody,
  blipFrequency,
  dialogueProsody,
  type VoiceExpression,
} from "./voices";
import { resolveSoundtrackWeather, type ActiveWeatherKind } from "./weather-ambience";

export {
  effectRecipe,
  projectMusicMix,
  resolveSoundtrackWeather,
  soundCueRecipe,
  type AudioRecipe,
  type AudioSegment,
  type CompanionAudioEffect,
  type MusicAdaptiveState,
};

export type SoundLogEntry = { tick: number; cue: SoundCue; played: boolean };
export type SoundPlayContext = {
  speaker?: string | null;
  text?: string;
  revealed?: number;
  choiceIndex?: number;
  expression?: VoiceExpression;
  inPause?: boolean;
};
// WebKit adds "interrupted" (no gesture yet, or the audio session was taken)
// to the standard states, so the DOM type doesn't cover what it reports.
export type AudioState = "running" | "suspended" | "interrupted" | "closed" | "unavailable";

export type MusicDebugInfo = {
  track: MusicTrack;
  ambience: AmbienceBed;
  weather: ActiveWeatherKind;
  duck: boolean;
  title: string;
  playing: boolean;
  muted: boolean;
  level: AudioLevel;
  ambienceMuted: boolean;
  adaptive: {
    journalWarm: boolean;
    lanternLayer: boolean;
    tensionLayer: boolean;
    filterCutoffHz: number;
  };
};

const DEFAULT_ADAPTIVE_STATE: MusicAdaptiveState = {
  journalWarm: false,
  lanternLayer: false,
  tensionLayer: false,
  filterCutoffHz: OPEN_FILTER_HZ,
  duckGain: 1,
  ambienceFilterHz: AMBIENCE_OPEN_FILTER_HZ,
  ambienceGainScale: 1,
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
  playAmbientChatter: (speaker: string) => void;
  playEffect: (effect: CompanionAudioEffect) => void;
  effects: () => readonly CompanionAudioEffect[];
  clearEffects: () => void;
  toggle: () => void;
  muted: () => boolean;
  setLevel: (level: AudioLevel) => void;
  level: () => AudioLevel;
  setSoundtrack: (next: SoundtrackState, adaptive?: MusicAdaptiveState) => void;
  setWeather: (weather: ActiveWeatherKind) => void;
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

const preferenceKey = "cloverhollow-audio";

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
  let adaptiveState: MusicAdaptiveState = DEFAULT_ADAPTIVE_STATE;
  let currentWeather: ActiveWeatherKind = "clear";
  const store = createPreferenceStore(preferenceKey);
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let musicPlayer: MusicPlayer | null = null;
  let ambiencePlayer: AmbiencePlayer | null = null;
  let noise: AudioBuffer | null = null;

  // One shared quarter second of white noise; segments are shorter and just play its head.
  const noiseBuffer = (audio: AudioContext): AudioBuffer => {
    noise ??= createNoiseBuffer(audio);
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
      writeAudioPreferences({ muted, level, musicMuted, musicLevel, ambienceMuted }),
    );
  };

  const commitPref = (update: () => void): void => {
    store.markDirty();
    update();
    if (store.isLoaded()) persist();
  };

  const applyLevel = (next: AudioLevel): void => {
    level = next;
    if (master !== null) master.gain.value = gainForAudioLevel(level);
  };

  const toggle = (): void => commitPref(() => { muted = !muted; syncPlayers(); });
  const setLevel = (next: AudioLevel): void => commitPref(() => applyLevel(next));
  const toggleMusic = (): void => commitPref(() => { musicMuted = !musicMuted; syncPlayers(); });
  const setMusicLevel = (next: AudioLevel): void =>
    commitPref(() => { musicLevel = next; syncPlayers(); });
  const toggleAmbience = (): void =>
    commitPref(() => { ambienceMuted = !ambienceMuted; syncPlayers(); });

  const syncSoundtrackPlayers = (): void => {
    musicPlayer?.setState({
      track: soundtrack.track,
      duck: soundtrack.duck,
      journalWarm: adaptiveState.journalWarm,
      lanternLayer: adaptiveState.lanternLayer,
      tensionLayer: adaptiveState.tensionLayer,
    });
    ambiencePlayer?.setBed(soundtrack.ambience);
    ambiencePlayer?.setWarmFilter(adaptiveState.journalWarm);
  };

  const setSoundtrack = (next: SoundtrackState, adaptive?: MusicAdaptiveState): void => {
    const nextAdaptive: MusicAdaptiveState = adaptive ?? {
      ...DEFAULT_ADAPTIVE_STATE,
      filterCutoffHz: next.duck ? DUCK_FILTER_HZ : OPEN_FILTER_HZ,
      duckGain: next.duck ? NORMAL_DUCK_GAIN : 1,
    };
    if (
      next.track === soundtrack.track &&
      next.ambience === soundtrack.ambience &&
      next.duck === soundtrack.duck &&
      nextAdaptive.journalWarm === adaptiveState.journalWarm &&
      nextAdaptive.lanternLayer === adaptiveState.lanternLayer &&
      nextAdaptive.tensionLayer === adaptiveState.tensionLayer
    ) return;
    soundtrack = next;
    adaptiveState = nextAdaptive;
    syncSoundtrackPlayers();
  };

  const setWeather = (next: ActiveWeatherKind): void => {
    if (next === currentWeather) return;
    currentWeather = next;
    ambiencePlayer?.setWeather(next);
  };

  const ensureContext = (): AudioContext | null => {
    if (context !== null) return context;
    const Constructor = globalThis.AudioContext;
    if (Constructor === undefined) return null;
    context = new Constructor();
    const graph = createAudioOutputGraph(context, gainForAudioLevel(level));
    master = graph.master;

    musicPlayer = createMusicPlayer(context, graph.musicOutput);
    ambiencePlayer = createAmbiencePlayer(context, graph.ambienceOutput);
    syncSoundtrackPlayers();
    ambiencePlayer.setWeather(currentWeather);
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

  const dialogueBlipRecipe = (tick: number, info?: SoundPlayContext): AudioSegment[] | null => {
    if (info?.inPause === true) return null;
    const text = info?.text;
    const revealed = info?.revealed;
    const char = extractBlipChar(text, revealed);
    const prosody = applyExpressionProsody(dialogueProsody(text, revealed), info?.expression);
    const blip = blipFrequency(info?.speaker ?? null, revealed ?? tick, char, prosody);
    return blip === null ? null : voiceBlipSegments(blip, blip.duration, blip.gain, 0.002, 0.28);
  };

  const playRecipe = (cue: SoundCue, tick: number, info?: SoundPlayContext): boolean => {
    if (muted) return false;
    unlock();
    const audio = context;
    if (audio === null || master === null || stateOf(audio) !== "running") return false;
    const recipe: AudioRecipe | null = cue === "dialogue-blip"
      ? dialogueBlipRecipe(tick, info)
      : resolveCueRecipe(cue, soundtrack.track, tick, info?.choiceIndex);
    if (recipe === null) return true;
    scheduleRecipe(audio, master, noiseBuffer, recipe);
    return true;
  };

  const playEffect = (effect: CompanionAudioEffect): void => {
    if (muted) return;
    unlock();
    const audio = context;
    if (audio === null || master === null || stateOf(audio) !== "running") return;
    scheduleRecipe(audio, master, noiseBuffer, effectRecipes[effect]);
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

  const playAmbientChatter = (speaker: string): void => {
    if (muted || !pageVisible()) return;
    const audio = context;
    if (audio === null || master === null || stateOf(audio) !== "running") return;
    const segments = ambientChatterSegments(speaker);
    if (segments !== null) scheduleRecipe(audio, master, noiseBuffer, segments);
  };

  return {
    play: (cue, tick, info) => {
      const entry = { tick, cue, played: playRecipe(cue, tick, info) };
      entries.push(entry);
      if (entries.length > 120) entries.shift();
      return entry;
    },
    playAmbientChatter,
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
    setWeather,
    toggleMusic,
    musicMuted: () => musicMuted,
    setMusicLevel,
    musicLevel: () => musicLevel,
    toggleAmbience,
    ambienceMuted: () => ambienceMuted,
    music: () => ({
      track: soundtrack.track,
      ambience: soundtrack.ambience,
      weather: currentWeather,
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
      adaptive: {
        journalWarm: adaptiveState.journalWarm,
        lanternLayer: adaptiveState.lanternLayer,
        tensionLayer: adaptiveState.tensionLayer,
        filterCutoffHz: adaptiveState.filterCutoffHz,
      },
    }),
    log: () => entries.slice(),
    state: () => stateOf(context),
  };
}
