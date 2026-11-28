import type { MusicTrack } from "../core";
import { scores, type InstrumentVoice, type PlayableTrack, type Score } from "./scores";

export type MusicPlayer = {
  setState: (next: { track: MusicTrack; duck: boolean }) => void;
  setMix: (next: { active: boolean; gain: number }) => void;
  isPlaying: () => boolean;
  sync: () => void;
};

type ScheduledNote = {
  voice: InstrumentVoice;
  gain: number;
  midi: number;
  durationSteps: number;
  velocity: number;
};

type CompiledScore = {
  score: Score;
  totalSteps: number;
  stepSeconds: number;
  byStep: Map<number, ScheduledNote[]>;
};

type TrackChannel = {
  gain: GainNode;
  voiceTargets: Readonly<Record<InstrumentVoice, AudioNode>>;
  panners: StereoPannerNode[];
};

export type PhraseDynamics = {
  gainScale: number;
  microDelaySec: number;
  sparkleMidi: number | null;
};

export const VOICE_PAN: Readonly<Record<InstrumentVoice, number>> = {
  bass: 0,
  pad: 0,
  chip: 0,
  flute: -0.08,
  marimba: 0.18,
  piano: -0.22,
  woodblock: 0.26,
  shaker: -0.28,
  celesta: 0.32,
  harp: -0.34,
};

const INTERVAL_MS = 50;
const LOOKAHEAD_SEC = 0.12;
const CROSSFADE_SEC = 0.55;
const DUCK_RAMP_SEC = 0.3;
const DUCK_GAIN = 0.55;
const DUCK_FILTER_Q = 0.55;
export const DUCK_FILTER_OPEN_HZ = 18000;
export const DUCK_FILTER_DUCKED_HZ = 2600;
export const FRESH_START_TRACKS: ReadonlySet<PlayableTrack> = new Set([
  "title", "taco", "battle", "boss", "talk", "morning",
]);
const PHRASE_SPAN_STEPS = 16;
const SPARKLE_VELOCITY_SCALE = 0.16;
const SPARKLE_MAX_MIDI = 76;

export function duckFilterCutoff(duck: boolean): number {
  return duck ? DUCK_FILTER_DUCKED_HZ : DUCK_FILTER_OPEN_HZ;
}

export function resumeBarStep(
  track: PlayableTrack,
  savedStep: number | undefined,
  totalSteps: number,
  stepsPerBar: number,
): number {
  if (
    FRESH_START_TRACKS.has(track) ||
    savedStep === undefined ||
    !Number.isFinite(savedStep) ||
    !Number.isFinite(totalSteps) || totalSteps <= 0 ||
    !Number.isFinite(stepsPerBar) || stepsPerBar <= 0
  ) return 0;
  const wrapped = ((Math.floor(savedStep) % totalSteps) + totalSteps) % totalSteps;
  return Math.floor(wrapped / stepsPerBar) * stepsPerBar;
}

function hasMicroTiming(voice: InstrumentVoice): boolean {
  switch (voice) {
    case "harp":
    case "piano":
    case "marimba":
    case "celesta":
    case "flute":
      return true;
    case "bass":
    case "woodblock":
    case "shaker":
    case "chip":
    case "pad":
      return false;
  }
}

export function phraseDynamics(
  step: number,
  totalSteps: number,
  loopCount: number,
  voice: InstrumentVoice,
  midi: number,
): PhraseDynamics {
  const safeStep = Number.isFinite(step) ? Math.trunc(step) : 0;
  const safeMidi = Number.isFinite(midi) ? Math.trunc(midi) : 0;
  const phase = ((safeStep % PHRASE_SPAN_STEPS) + PHRASE_SPAN_STEPS) % PHRASE_SPAN_STEPS;
  const gainScale = 0.995 + 0.075 * Math.sin((phase / PHRASE_SPAN_STEPS) * Math.PI * 2);

  let microDelaySec = 0;
  if (hasMicroTiming(voice)) {
    const hash = Math.imul((safeStep * 31 + safeMidi) | 0, 2654435761) >>> 0;
    microDelaySec = (hash % 801) / 100_000;
  }

  const halfStep = totalSteps > 0 ? Math.floor(totalSteps / 2) : 0;
  const isDownbeat = safeStep === 0 || (halfStep > 0 && safeStep === halfStep);
  const isShimmerVoice = voice === "harp" || voice === "piano";
  const sparkleMidi =
    loopCount >= 1 && isDownbeat && isShimmerVoice && safeMidi <= SPARKLE_MAX_MIDI
      ? safeMidi + 12
      : null;

  return { gainScale, microDelaySec, sparkleMidi };
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function isPlayableTrack(track: MusicTrack): track is PlayableTrack {
  return track !== "silent";
}

function compileScore(score: Score): CompiledScore {
  const totalSteps = score.stepsPerBar * score.bars;
  const byStep = new Map<number, ScheduledNote[]>();
  for (const track of score.tracks) {
    for (const [step, midi, durationSteps, velocity] of track.notes) {
      const key = Math.floor(step);
      let list = byStep.get(key);
      if (list === undefined) {
        list = [];
        byStep.set(key, list);
      }
      list.push({
        voice: track.voice,
        gain: track.gain,
        midi,
        durationSteps,
        velocity,
      });
    }
  }
  return {
    score,
    totalSteps,
    stepSeconds: 60 / score.bpm / 4,
    byStep,
  };
}

function rampParam(param: AudioParam, target: number, now: number, seconds: number): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(target, now + seconds);
}

export function createMusicPlayer(
  context: AudioContext,
  destination: AudioNode,
): MusicPlayer {
  const compiled = new Map<PlayableTrack, CompiledScore>();
  const getCompiled = (track: PlayableTrack): CompiledScore => {
    const existing = compiled.get(track);
    if (existing !== undefined) return existing;
    const built = compileScore(scores[track]);
    compiled.set(track, built);
    return built;
  };

  let noiseBuffer: AudioBuffer | null = null;
  const getNoise = (): AudioBuffer => {
    if (noiseBuffer !== null) return noiseBuffer;
    const length = Math.max(1, Math.floor(context.sampleRate * 0.25));
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  };

  const masterGain = context.createGain();
  masterGain.gain.value = 0;
  const duckGain = context.createGain();
  duckGain.gain.value = 1;
  let duckFilter: BiquadFilterNode | null = null;
  if (typeof context.createBiquadFilter === "function") {
    duckFilter = context.createBiquadFilter();
    duckFilter.type = "lowpass";
    duckFilter.Q.value = DUCK_FILTER_Q;
    duckFilter.frequency.value = DUCK_FILTER_OPEN_HZ;
    duckGain.connect(duckFilter).connect(masterGain);
  } else {
    duckGain.connect(masterGain);
  }
  masterGain.connect(destination);

  const savedSteps = new Map<PlayableTrack, number>();
  let currentTrack: MusicTrack = "silent";
  let currentDuck = false;
  let mixActive = false;
  let mixGain = 0;
  let lastMasterTarget = -1;
  let trackChannel: TrackChannel | null = null;
  let activeCompiled: CompiledScore | null = null;
  let currentStep = 0;
  let loopCount = 0;
  let nextStepTime = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const createTrackChannel = (now: number, fadeInSec: number): TrackChannel => {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fadeInSec);
    gain.connect(duckGain);

    const panners: StereoPannerNode[] = [];
    const supportsPan = typeof context.createStereoPanner === "function";
    const targetFor = (voice: InstrumentVoice): AudioNode => {
      const pan = VOICE_PAN[voice];
      if (!supportsPan || pan === 0) return gain;
      const panner = context.createStereoPanner();
      panner.pan.setValueAtTime(pan, now);
      panner.connect(gain);
      panners.push(panner);
      return panner;
    };

    const voiceTargets: Readonly<Record<InstrumentVoice, AudioNode>> = {
      piano: targetFor("piano"),
      celesta: targetFor("celesta"),
      marimba: targetFor("marimba"),
      harp: targetFor("harp"),
      flute: targetFor("flute"),
      bass: targetFor("bass"),
      pad: targetFor("pad"),
      chip: targetFor("chip"),
      shaker: targetFor("shaker"),
      woodblock: targetFor("woodblock"),
    };

    return { gain, voiceTargets, panners };
  };

  const scheduleVoice = (
    target: AudioNode,
    note: ScheduledNote,
    start: number,
    duration: number,
  ): void => {
    const amp = Math.max(0.001, Math.min(1, note.gain * note.velocity));
    const freq = midiToHz(note.midi);

    if (note.voice === "shaker") {
      const dur = Math.min(0.05, Math.max(0.025, duration * 0.5));
      const src = context.createBufferSource();
      src.buffer = getNoise();
      const hp = context.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(4800, start);
      const bp = context.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(7200, start);
      bp.Q.setValueAtTime(1.4, start);
      const env = context.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(amp * 0.42, start + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      src.connect(hp).connect(bp).connect(env).connect(target);
      src.onended = () => {
        src.disconnect();
        hp.disconnect();
        bp.disconnect();
        env.disconnect();
      };
      src.start(start);
      src.stop(start + dur + 0.01);
      return;
    }

    if (note.voice === "woodblock") {
      const dur = 0.065;
      const osc = context.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * 1.16, start);
      osc.frequency.exponentialRampToValueAtTime(freq, start + 0.024);
      const click = context.createOscillator();
      click.type = "triangle";
      click.frequency.setValueAtTime(freq * 2.4, start);
      const clickGain = context.createGain();
      clickGain.gain.setValueAtTime(amp * 0.25, start);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.018);
      const bp = context.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(freq * 1.2, start);
      bp.Q.setValueAtTime(2.5, start);
      const env = context.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(amp * 0.6, start + 0.003);
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(bp);
      click.connect(clickGain).connect(bp);
      bp.connect(env).connect(target);
      osc.onended = () => {
        osc.disconnect();
        click.disconnect();
        clickGain.disconnect();
        bp.disconnect();
        env.disconnect();
      };
      osc.start(start);
      click.start(start);
      osc.stop(start + dur + 0.01);
      click.stop(start + 0.025);
      return;
    }

    if (note.voice === "piano") {
      const end = start + duration + 0.28;
      const osc1 = context.createOscillator();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(freq, start);
      const osc2 = context.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq * 2, start);
      const overGain = context.createGain();
      overGain.gain.setValueAtTime(0.26, start);
      overGain.gain.exponentialRampToValueAtTime(0.04, start + duration + 0.12);
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(2600, freq * 5), start);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(460, freq * 1.7),
        start + duration + 0.2,
      );
      const env = context.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(amp * 0.62, start + 0.012);
      env.gain.exponentialRampToValueAtTime(amp * 0.24, start + Math.max(0.08, duration));
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      osc1.connect(filter);
      osc2.connect(overGain).connect(filter);
      filter.connect(env).connect(target);
      osc1.onended = () => {
        osc1.disconnect();
        osc2.disconnect();
        overGain.disconnect();
        filter.disconnect();
        env.disconnect();
      };
      osc1.start(start);
      osc2.start(start);
      osc1.stop(end + 0.02);
      osc2.stop(end + 0.02);
      return;
    }

    if (note.voice === "celesta") {
      const end = start + duration + 0.42;
      const osc1 = context.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(freq, start);
      const osc2 = context.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq * 2, start);
      const g2 = context.createGain();
      g2.gain.setValueAtTime(0.32, start);
      g2.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      const osc3 = context.createOscillator();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(freq * 3, start);
      const g3 = context.createGain();
      g3.gain.setValueAtTime(0.11, start);
      g3.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
      const env = context.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(amp * 0.52, start + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      osc1.connect(env);
      osc2.connect(g2).connect(env);
      osc3.connect(g3).connect(env);
      env.connect(target);
      osc1.onended = () => {
        osc1.disconnect();
        osc2.disconnect();
        osc3.disconnect();
        g2.disconnect();
        g3.disconnect();
        env.disconnect();
      };
      osc1.start(start);
      osc2.start(start);
      osc3.start(start);
      osc1.stop(end + 0.02);
      osc2.stop(start + 0.26);
      osc3.stop(start + 0.12);
      return;
    }

    if (note.voice === "marimba") {
      const end = start + Math.min(0.45, duration + 0.18);
      const osc1 = context.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(freq, start);
      const osc2 = context.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(freq * 4, start);
      const knock = context.createGain();
      knock.gain.setValueAtTime(0.16, start);
      knock.gain.exponentialRampToValueAtTime(0.001, start + 0.042);
      const env = context.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(amp * 0.68, start + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      osc1.connect(env);
      osc2.connect(knock).connect(env);
      env.connect(target);
      osc1.onended = () => {
        osc1.disconnect();
        osc2.disconnect();
        knock.disconnect();
        env.disconnect();
      };
      osc1.start(start);
      osc2.start(start);
      osc1.stop(end + 0.02);
      osc2.stop(start + 0.055);
      return;
    }

    if (note.voice === "harp") {
      const end = start + duration + 0.36;
      const osc1 = context.createOscillator();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(freq, start);
      const osc2 = context.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq * 2, start);
      const g2 = context.createGain();
      g2.gain.setValueAtTime(0.22, start);
      g2.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(3400, freq * 6), start);
      filter.frequency.exponentialRampToValueAtTime(Math.max(480, freq * 1.5), end);
      const env = context.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(amp * 0.58, start + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      osc1.connect(filter);
      osc2.connect(g2).connect(filter);
      filter.connect(env).connect(target);
      osc1.onended = () => {
        osc1.disconnect();
        osc2.disconnect();
        g2.disconnect();
        filter.disconnect();
        env.disconnect();
      };
      osc1.start(start);
      osc2.start(start);
      osc1.stop(end + 0.02);
      osc2.stop(start + 0.22);
      return;
    }

    if (note.voice === "flute") {
      const end = start + duration + 0.12;
      const osc1 = context.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(freq, start);
      const osc2 = context.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(freq, start);
      const g2 = context.createGain();
      g2.gain.setValueAtTime(0.2, start);
      const lfo = context.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(5.2, start);
      const vib = context.createGain();
      vib.gain.setValueAtTime(0.001, start);
      vib.gain.linearRampToValueAtTime(2.6, start + Math.min(0.18, duration * 0.6));
      lfo.connect(vib);
      vib.connect(osc1.frequency);
      vib.connect(osc2.frequency);
      const breath = context.createBufferSource();
      breath.buffer = getNoise();
      const breathFilter = context.createBiquadFilter();
      breathFilter.type = "bandpass";
      breathFilter.frequency.setValueAtTime(Math.min(2800, freq * 2.2), start);
      breathFilter.Q.setValueAtTime(2, start);
      const breathGain = context.createGain();
      breathGain.gain.setValueAtTime(0.0001, start);
      breathGain.gain.linearRampToValueAtTime(amp * 0.07, start + 0.025);
      breathGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(3000, freq * 3.5), start);
      const env = context.createGain();
      const atk = Math.min(0.048, duration * 0.35);
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(amp * 0.56, start + atk);
      env.gain.setValueAtTime(amp * 0.5, start + Math.max(atk, duration - 0.02));
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      osc1.connect(filter);
      osc2.connect(g2).connect(filter);
      breath.connect(breathFilter).connect(breathGain).connect(target);
      filter.connect(env).connect(target);
      osc1.onended = () => {
        osc1.disconnect();
        osc2.disconnect();
        g2.disconnect();
        lfo.disconnect();
        vib.disconnect();
        breath.disconnect();
        breathFilter.disconnect();
        breathGain.disconnect();
        filter.disconnect();
        env.disconnect();
      };
      osc1.start(start);
      osc2.start(start);
      lfo.start(start);
      breath.start(start);
      osc1.stop(end + 0.02);
      osc2.stop(end + 0.02);
      lfo.stop(end + 0.02);
      breath.stop(start + 0.11);
      return;
    }

    if (note.voice === "bass") {
      const end = start + duration + 0.14;
      const osc1 = context.createOscillator();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(freq, start);
      const osc2 = context.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq, start);
      const g2 = context.createGain();
      g2.gain.setValueAtTime(0.55, start);
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(880, freq * 4.2), start);
      filter.frequency.exponentialRampToValueAtTime(Math.max(180, freq * 1.8), end);
      const env = context.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(amp * 0.72, start + 0.01);
      env.gain.exponentialRampToValueAtTime(amp * 0.34, start + Math.max(0.06, duration * 0.8));
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      osc1.connect(filter);
      osc2.connect(g2).connect(filter);
      filter.connect(env).connect(target);
      osc1.onended = () => {
        osc1.disconnect();
        osc2.disconnect();
        g2.disconnect();
        filter.disconnect();
        env.disconnect();
      };
      osc1.start(start);
      osc2.start(start);
      osc1.stop(end + 0.02);
      osc2.stop(end + 0.02);
      return;
    }

    if (note.voice === "pad") {
      const end = start + duration + 0.45;
      const osc1 = context.createOscillator();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(freq, start);
      osc1.detune.setValueAtTime(-4, start);
      const osc2 = context.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq, start);
      osc2.detune.setValueAtTime(4, start);
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1100, start);
      const env = context.createGain();
      const atk = Math.min(0.28, duration * 0.4);
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(amp * 0.34, start + atk);
      env.gain.setValueAtTime(amp * 0.3, start + Math.max(atk, duration - 0.04));
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(env).connect(target);
      osc1.onended = () => {
        osc1.disconnect();
        osc2.disconnect();
        filter.disconnect();
        env.disconnect();
      };
      osc1.start(start);
      osc2.start(start);
      osc1.stop(end + 0.02);
      osc2.stop(end + 0.02);
      return;
    }

    // "chip": warm cozy filtered square + triangle blend
    const end = start + duration + 0.08;
    const osc1 = context.createOscillator();
    osc1.type = "square";
    osc1.frequency.setValueAtTime(freq, start);
    const osc2 = context.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(freq * 0.5, start);
    const g2 = context.createGain();
    g2.gain.setValueAtTime(0.28, start);
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, start);
    const env = context.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(amp * 0.36, start + 0.008);
    env.gain.exponentialRampToValueAtTime(amp * 0.22, start + Math.max(0.04, duration * 0.85));
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    osc1.connect(filter);
    osc2.connect(g2).connect(filter);
    filter.connect(env).connect(target);
    osc1.onended = () => {
      osc1.disconnect();
      osc2.disconnect();
      g2.disconnect();
      filter.disconnect();
      env.disconnect();
    };
    osc1.start(start);
    osc2.start(start);
    osc1.stop(end + 0.02);
    osc2.stop(end + 0.02);
  };

  const canRun = (): boolean =>
    context.state === "running" && mixActive && isPlayableTrack(currentTrack);

  const fadeOutChannel = (channel: TrackChannel | null): void => {
    if (channel === null) return;
    const now = context.currentTime;
    rampParam(channel.gain.gain, 0, now, CROSSFADE_SEC);
    setTimeout(() => {
      for (const panner of channel.panners) panner.disconnect();
      channel.gain.disconnect();
    }, Math.ceil((CROSSFADE_SEC + 0.15) * 1000));
  };

  const stopScheduler = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const tickScheduler = (): void => {
    if (!canRun() || activeCompiled === null || trackChannel === null) {
      stopScheduler();
      return;
    }
    const now = context.currentTime;
    if (nextStepTime < now - 0.1) nextStepTime = now + 0.03;
    const horizon = now + LOOKAHEAD_SEC;
    while (nextStepTime < horizon) {
      const events = activeCompiled.byStep.get(currentStep);
      if (events !== undefined) {
        for (const note of events) {
          const dynamics = phraseDynamics(
            currentStep,
            activeCompiled.totalSteps,
            loopCount,
            note.voice,
            note.midi,
          );
          const noteStart = nextStepTime + dynamics.microDelaySec;
          const noteDuration = note.durationSteps * activeCompiled.stepSeconds;
          const shapedVelocity = note.velocity * dynamics.gainScale;
          scheduleVoice(
            trackChannel.voiceTargets[note.voice],
            { ...note, velocity: shapedVelocity },
            noteStart,
            noteDuration,
          );
          if (dynamics.sparkleMidi !== null) {
            scheduleVoice(
              trackChannel.voiceTargets.celesta,
              {
                voice: "celesta",
                gain: note.gain,
                midi: dynamics.sparkleMidi,
                durationSteps: note.durationSteps,
                velocity: shapedVelocity * SPARKLE_VELOCITY_SCALE,
              },
              noteStart + 0.012,
              noteDuration,
            );
          }
        }
      }
      nextStepTime += activeCompiled.stepSeconds;
      const nextStep = currentStep + 1;
      if (nextStep >= activeCompiled.totalSteps) {
        currentStep = 0;
        loopCount += 1;
      } else {
        currentStep = nextStep;
      }
    }
  };

  const startStepFor = (track: PlayableTrack, score: CompiledScore): number =>
    resumeBarStep(track, savedSteps.get(track), score.totalSteps, score.score.stepsPerBar);

  const sync = (): void => {
    const now = context.currentTime;
    const targetGain = mixActive && isPlayableTrack(currentTrack) ? mixGain : 0;
    if (targetGain !== lastMasterTarget) {
      lastMasterTarget = targetGain;
      rampParam(masterGain.gain, targetGain, now, 0.12);
    }
    if (!canRun()) {
      stopScheduler();
      return;
    }
    if (trackChannel === null && isPlayableTrack(currentTrack)) {
      activeCompiled = getCompiled(currentTrack);
      trackChannel = createTrackChannel(now, 0.2);
      currentStep = startStepFor(currentTrack, activeCompiled);
      loopCount = 0;
      nextStepTime = now + 0.04;
    }
    if (timer === null) {
      nextStepTime = now + 0.04;
      tickScheduler();
      timer = setInterval(tickScheduler, INTERVAL_MS);
    }
  };

  return {
    setState: (next) => {
      if (next.duck !== currentDuck) {
        currentDuck = next.duck;
        const now = context.currentTime;
        rampParam(duckGain.gain, currentDuck ? DUCK_GAIN : 1, now, DUCK_RAMP_SEC);
        if (duckFilter !== null) {
          rampParam(duckFilter.frequency, duckFilterCutoff(currentDuck), now, DUCK_RAMP_SEC);
        }
      }
      if (next.track === currentTrack) {
        sync();
        return;
      }
      if (isPlayableTrack(currentTrack) && !FRESH_START_TRACKS.has(currentTrack)) {
        savedSteps.set(currentTrack, currentStep);
      }
      const hadTrack = trackChannel !== null;
      fadeOutChannel(trackChannel);
      trackChannel = null;
      currentTrack = next.track;
      activeCompiled = isPlayableTrack(currentTrack) ? getCompiled(currentTrack) : null;
      currentStep =
        isPlayableTrack(currentTrack) && activeCompiled !== null
          ? startStepFor(currentTrack, activeCompiled)
          : 0;
      loopCount = 0;
      if (canRun() && activeCompiled !== null) {
        const now = context.currentTime;
        trackChannel = createTrackChannel(now, hadTrack ? CROSSFADE_SEC : 0.2);
        nextStepTime = now + 0.04;
      }
      sync();
    },
    setMix: (next) => {
      mixActive = next.active;
      mixGain = next.gain;
      sync();
    },
    isPlaying: () => canRun(),
    sync,
  };
}
