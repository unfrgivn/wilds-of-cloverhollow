import type { AmbienceBed } from "../core";
import { createAmbienceAccents } from "./ambience-accents";
import {
  AMBIENCE_JOURNAL_FILTER_HZ,
  AMBIENCE_JOURNAL_GAIN_SCALE,
  AMBIENCE_OPEN_FILTER_HZ,
} from "./music-mix";
import { createWeatherAmbienceLayer, type ActiveWeatherKind } from "./weather-ambience";

export type AmbiencePlayer = {
  setBed: (bed: AmbienceBed) => void;
  setWeather: (weather: ActiveWeatherKind) => void;
  setMix: (next: { active: boolean; gain: number }) => void;
  setWarmFilter: (warm: boolean) => void;
  sync: () => void;
};

type ActiveBed = {
  bed: Exclude<AmbienceBed, "none">;
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  timer: ReturnType<typeof setTimeout> | null;
  accentSeed: number;
  stopped: boolean;
};

const FADE_SEC = 0.7;
const GOLDEN_ANGLE = 2.399963229728653;

const AMBIENCE_STEREO: Readonly<Record<AmbienceBed, { width: number; phase: number }>> = {
  none: { width: 0, phase: 0 },
  "town-breeze": { width: 0.48, phase: 0.4 },
  ocean: { width: 0.44, phase: 1.1 },
  "mountain-wind": { width: 0.36, phase: 0.8 },
  hearth: { width: 0.28, phase: 0.2 },
  forest: { width: 0.52, phase: 0.7 },
  "enchanted-shimmer": { width: 0.55, phase: 1.4 },
  "arcade-hum": { width: 0.16, phase: 0.5 },
  "cavern-drips": { width: 0.54, phase: 1.9 },
  "cafe-murmur": { width: 0.42, phase: 2.3 },
};

export const AMBIENCE_ACCENT_CADENCE_MS: Readonly<
  Record<Exclude<AmbienceBed, "none">, number>
> = {
  "town-breeze": 4200,
  ocean: 5600,
  "mountain-wind": 5400,
  hearth: 1200,
  forest: 5200,
  "enchanted-shimmer": 3000,
  "cavern-drips": 2600,
  "cafe-murmur": 4400,
  "arcade-hum": 4800,
};

export function ambiencePan(bed: AmbienceBed, seed: number): number {
  const { width, phase } = AMBIENCE_STEREO[bed];
  if (width === 0) return 0;
  const safeSeed = Number.isFinite(seed) ? seed : 0;
  return Math.sin(safeSeed * GOLDEN_ANGLE + phase) * width;
}

function rampParam(param: AudioParam, target: number, now: number, seconds: number): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(target, now + seconds);
}

// Paul Kellet's pink noise filter, crossfaded at the loop boundary so looping is seamless.
function createPinkNoiseBuffer(context: AudioContext): AudioBuffer {
  const seconds = 3;
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(2, length, context.sampleRate);
  const fadeSamples = Math.min(2048, Math.floor(length / 8));
  for (let ch = 0; ch < 2; ch += 1) {
    const out = buffer.getChannelData(ch);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      out[i] = sample;
    }
    for (let i = 0; i < fadeSamples; i += 1) {
      const t = i / fadeSamples;
      const tail = out[length - fadeSamples + i] ?? 0;
      const head = out[i] ?? 0;
      out[i] = head * t + tail * (1 - t);
    }
  }
  return buffer;
}

export function createAmbiencePlayer(
  context: AudioContext,
  destination: AudioNode,
): AmbiencePlayer {
  let pinkBuffer: AudioBuffer | null = null;
  const getPink = (): AudioBuffer => {
    if (pinkBuffer === null) pinkBuffer = createPinkNoiseBuffer(context);
    return pinkBuffer;
  };

  const masterGain = context.createGain();
  masterGain.gain.value = 0;
  const warmGain = context.createGain();
  warmGain.gain.value = 1;
  let warmFilter: BiquadFilterNode | null = null;
  if (typeof context.createBiquadFilter === "function") {
    warmFilter = context.createBiquadFilter();
    warmFilter.type = "lowpass";
    warmFilter.Q.value = 0.55;
    warmFilter.frequency.value = AMBIENCE_OPEN_FILTER_HZ;
    masterGain.connect(warmFilter).connect(warmGain).connect(destination);
  } else {
    masterGain.connect(warmGain).connect(destination);
  }

  let desiredBed: AmbienceBed = "none";
  let desiredWeather: ActiveWeatherKind = "clear";
  let mixActive = false;
  let mixGain = 0;
  let lastMasterTarget = -1;
  let warmActive = false;
  let activeBed: ActiveBed | null = null;
  const weatherLayer = createWeatherAmbienceLayer(context, masterGain, getPink);
  const {
    playBirdChirp, playWaveShimmer, playHearthCrackle, playEnchantedChime,
    playCaveDrop, playCafeClink, playMountainGust, playArcadeChime,
  } = createAmbienceAccents(context, getPink);

  const canRunAudio = (): boolean => context.state === "running" && mixActive;
  const canRunBed = (): boolean => canRunAudio() && desiredBed !== "none";
  const hasActiveLayer = (): boolean => desiredBed !== "none" || desiredWeather !== "clear";

  const stopBed = (bed: ActiveBed | null, immediate = false): void => {
    if (bed === null || bed.stopped) return;
    bed.stopped = true;
    if (bed.timer !== null) {
      clearTimeout(bed.timer);
      bed.timer = null;
    }
    const now = context.currentTime;
    const dur = immediate ? 0.06 : FADE_SEC;
    rampParam(bed.gain.gain, 0, now, dur);
    setTimeout(() => {
      for (const source of bed.sources) {
        try { source.stop(); } catch { /* Already stopped. */ }
        source.disconnect();
      }
      for (const node of bed.nodes) node.disconnect();
      bed.gain.disconnect();
    }, Math.ceil((dur + 0.12) * 1000));
  };

  const scheduleAccent = (bed: ActiveBed, delayMs: number, play: (pan: number) => void): void => {
    bed.timer = setTimeout(() => {
      if (bed.stopped || context.state !== "running") return;
      const pan = ambiencePan(bed.bed, bed.accentSeed);
      bed.accentSeed += 1;
      play(pan);
      scheduleAccent(bed, delayMs * (0.7 + Math.random() * 0.7), play);
    }, delayMs);
  };

  const startBed = (kind: Exclude<AmbienceBed, "none">): ActiveBed => {
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE_SEC);
    gain.connect(masterGain);

    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];

    const addPink = (): AudioBufferSourceNode => {
      const src = context.createBufferSource();
      src.buffer = getPink();
      src.loop = true;
      sources.push(src);
      return src;
    };
    const makeFilter = (type: BiquadFilterType, freq: number, q?: number): BiquadFilterNode => {
      const filter = context.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(freq, now);
      if (q !== undefined) filter.Q.setValueAtTime(q, now);
      nodes.push(filter);
      return filter;
    };
    const makeGain = (value: number): GainNode => {
      const g = context.createGain();
      g.gain.setValueAtTime(value, now);
      nodes.push(g);
      return g;
    };
    const makeLfo = (freq: number, depth: number): [OscillatorNode, GainNode] => {
      const lfo = context.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(freq, now);
      sources.push(lfo);
      return [lfo, makeGain(depth)];
    };

    const bed: ActiveBed = {
      bed: kind, gain, sources, nodes, timer: null, accentSeed: 0, stopped: false,
    };

    if (kind === "town-breeze") {
      const src = addPink();
      src.connect(makeFilter("bandpass", 750, 0.7)).connect(makeGain(0.55)).connect(gain);
      src.start(now);
      scheduleAccent(bed, AMBIENCE_ACCENT_CADENCE_MS[kind], (pan) => playBirdChirp(gain, pan));
    } else if (kind === "ocean") {
      const src = addPink();
      const waveGain = makeGain(0.65);
      const [lfo, lfoDepth] = makeLfo(0.13, 0.32);
      lfo.connect(lfoDepth).connect(waveGain.gain);
      src.connect(makeFilter("lowpass", 480, 0.6)).connect(waveGain).connect(gain);
      src.start(now);
      lfo.start(now);
      scheduleAccent(bed, AMBIENCE_ACCENT_CADENCE_MS[kind], (pan) => playWaveShimmer(gain, pan));
    } else if (kind === "mountain-wind") {
      const src = addPink();
      const bp = makeFilter("bandpass", 580, 1.6);
      const [lfo, depth] = makeLfo(0.09, 220);
      lfo.connect(depth).connect(bp.frequency);
      src.connect(bp).connect(makeGain(0.7)).connect(gain);
      src.start(now);
      lfo.start(now);
      scheduleAccent(bed, AMBIENCE_ACCENT_CADENCE_MS[kind], (pan) => playMountainGust(gain, pan));
    } else if (kind === "hearth") {
      const src = addPink();
      src.connect(makeFilter("lowpass", 260, 0.8)).connect(makeGain(0.85)).connect(gain);
      src.start(now);
      scheduleAccent(bed, AMBIENCE_ACCENT_CADENCE_MS[kind], (pan) => playHearthCrackle(gain, pan));
    } else if (kind === "forest") {
      const src = addPink();
      src.connect(makeFilter("bandpass", 1100, 0.9)).connect(makeGain(0.5)).connect(gain);
      src.connect(makeFilter("lowpass", 320)).connect(makeGain(0.35)).connect(gain);
      src.start(now);
      scheduleAccent(bed, AMBIENCE_ACCENT_CADENCE_MS[kind], (pan) =>
        playBirdChirp(gain, pan, 0.085),
      );
    } else if (kind === "enchanted-shimmer") {
      const src = addPink();
      src.connect(makeFilter("bandpass", 1300, 1)).connect(makeGain(0.38)).connect(gain);
      src.start(now);
      scheduleAccent(bed, AMBIENCE_ACCENT_CADENCE_MS[kind], (pan) => playEnchantedChime(gain, pan));
    } else if (kind === "cavern-drips") {
      const src = addPink();
      src.connect(makeFilter("lowpass", 280, 0.7)).connect(makeGain(0.34)).connect(gain);
      src.connect(makeFilter("bandpass", 950, 1.1)).connect(makeGain(0.18)).connect(gain);
      src.start(now);
      scheduleAccent(bed, AMBIENCE_ACCENT_CADENCE_MS[kind], (pan) => playCaveDrop(gain, pan));
    } else if (kind === "cafe-murmur") {
      const src = addPink();
      src.connect(makeFilter("lowpass", 360, 0.7)).connect(makeGain(0.42)).connect(gain);
      src.start(now);
      scheduleAccent(bed, AMBIENCE_ACCENT_CADENCE_MS[kind], (pan) => playCafeClink(gain, pan));
    } else {
      // "arcade-hum": soft warm indoor room tone
      const src = addPink();
      const [hum, humGain] = makeLfo(120, 0.06);
      src.connect(makeFilter("lowpass", 300)).connect(makeGain(0.45)).connect(gain);
      hum.connect(humGain).connect(gain);
      src.start(now);
      hum.start(now);
      scheduleAccent(bed, AMBIENCE_ACCENT_CADENCE_MS[kind], (pan) => playArcadeChime(gain, pan));
    }
    return bed;
  };

  const sync = (): void => {
    const now = context.currentTime;
    const targetGain = canRunAudio() && hasActiveLayer() ? mixGain : 0;
    if (targetGain !== lastMasterTarget) {
      lastMasterTarget = targetGain;
      rampParam(masterGain.gain, targetGain, now, 0.2);
    }
    weatherLayer.sync(mixActive);
    if (!canRunBed()) {
      if (activeBed !== null) {
        stopBed(activeBed, true);
        activeBed = null;
      }
      return;
    }
    if (desiredBed === "none") return;
    if (activeBed !== null && activeBed.bed === desiredBed) return;
    if (activeBed !== null) {
      stopBed(activeBed, false);
      activeBed = null;
    }
    activeBed = startBed(desiredBed);
  };

  return {
    setBed: (bed) => {
      if (bed === desiredBed) {
        sync();
        return;
      }
      desiredBed = bed;
      sync();
    },
    setWeather: (weather) => {
      if (weather === desiredWeather) {
        weatherLayer.sync(mixActive);
        return;
      }
      desiredWeather = weather;
      weatherLayer.setWeather(weather);
      sync();
    },
    setMix: (next) => {
      mixActive = next.active;
      mixGain = next.gain;
      sync();
    },
    setWarmFilter: (warm) => {
      if (warm === warmActive) return;
      warmActive = warm;
      const now = context.currentTime;
      if (warmFilter !== null) {
        rampParam(
          warmFilter.frequency,
          warmActive ? AMBIENCE_JOURNAL_FILTER_HZ : AMBIENCE_OPEN_FILTER_HZ,
          now,
          0.3,
        );
      }
      rampParam(warmGain.gain, warmActive ? AMBIENCE_JOURNAL_GAIN_SCALE : 1, now, 0.3);
    },
    sync,
  };
}
