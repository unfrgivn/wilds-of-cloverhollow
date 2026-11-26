import type { AmbienceBed } from "../core";

export type AmbiencePlayer = {
  setBed: (bed: AmbienceBed) => void;
  setMix: (next: { active: boolean; gain: number }) => void;
  sync: () => void;
};

type ActiveBed = {
  bed: Exclude<AmbienceBed, "none">;
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  timer: ReturnType<typeof setTimeout> | null;
  stopped: boolean;
};

const FADE_SEC = 0.7;

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
  masterGain.connect(destination);

  let desiredBed: AmbienceBed = "none";
  let mixActive = false;
  let mixGain = 0;
  let lastMasterTarget = -1;
  let activeBed: ActiveBed | null = null;

  const canRun = (): boolean =>
    context.state === "running" && mixActive && desiredBed !== "none";

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
        try {
          source.stop();
        } catch {
          // Already stopped.
        }
        source.disconnect();
      }
      for (const node of bed.nodes) node.disconnect();
      bed.gain.disconnect();
    }, Math.ceil((dur + 0.12) * 1000));
  };

  const scheduleAccent = (bed: ActiveBed, delayMs: number, play: () => void): void => {
    bed.timer = setTimeout(() => {
      if (bed.stopped || context.state !== "running") return;
      play();
      scheduleAccent(bed, delayMs * (0.7 + Math.random() * 0.7), play);
    }, delayMs);
  };

  const playBirdChirp = (target: GainNode): void => {
    const pentatonic = [1046.5, 1174.66, 1318.51, 1567.98, 1760];
    const base = pentatonic[Math.floor(Math.random() * pentatonic.length)] ?? 1318.51;
    const now = context.currentTime + 0.02;
    for (let note = 0; note < 2; note += 1) {
      const start = now + note * 0.14;
      const osc = context.createOscillator();
      osc.type = "sine";
      const freq = note === 0 ? base : base * 1.12;
      osc.frequency.setValueAtTime(freq * 0.94, start);
      osc.frequency.exponentialRampToValueAtTime(freq, start + 0.045);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.98, start + 0.11);
      const env = context.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(0.11, start + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      osc.connect(env).connect(target);
      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
      };
      osc.start(start);
      osc.stop(start + 0.14);
    }
  };

  const playHearthCrackle = (target: GainNode): void => {
    const now = context.currentTime + 0.01;
    const src = context.createBufferSource();
    src.buffer = getPink();
    const hp = context.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(2400 + Math.random() * 1400, now);
    const env = context.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.16, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
    src.connect(hp).connect(env).connect(target);
    src.onended = () => {
      src.disconnect();
      hp.disconnect();
      env.disconnect();
    };
    src.start(now, Math.random() * 2, 0.04);
  };

  const playEnchantedChime = (target: GainNode): void => {
    // F Lydian high twinkles (C6, D6, E6, F6, G6, A6, B6)
    const freqs = [1046.5, 1174.66, 1318.51, 1396.91, 1567.98, 1760, 1975.53];
    const freq = freqs[Math.floor(Math.random() * freqs.length)] ?? 1396.91;
    const now = context.currentTime + 0.02;
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    const over = context.createOscillator();
    over.type = "sine";
    over.frequency.setValueAtTime(freq * 2, now);
    const overGain = context.createGain();
    overGain.gain.setValueAtTime(0.2, now);
    overGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    const env = context.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.09, now + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    osc.connect(env);
    over.connect(overGain).connect(env);
    env.connect(target);
    osc.onended = () => {
      osc.disconnect();
      over.disconnect();
      overGain.disconnect();
      env.disconnect();
    };
    osc.start(now);
    over.start(now);
    osc.stop(now + 0.95);
    over.stop(now + 0.3);
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

    const bed: ActiveBed = { bed: kind, gain, sources, nodes, timer: null, stopped: false };

    if (kind === "town-breeze") {
      const src = addPink();
      const bp = context.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(750, now);
      bp.Q.setValueAtTime(0.7, now);
      const level = context.createGain();
      level.gain.setValueAtTime(0.55, now);
      nodes.push(bp, level);
      src.connect(bp).connect(level).connect(gain);
      src.start(now);
      scheduleAccent(bed, 4200, () => playBirdChirp(gain));
    } else if (kind === "ocean") {
      const src = addPink();
      const lp = context.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(480, now);
      lp.Q.setValueAtTime(0.6, now);
      const waveGain = context.createGain();
      waveGain.gain.setValueAtTime(0.65, now);
      const lfo = context.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.13, now);
      const lfoDepth = context.createGain();
      lfoDepth.gain.setValueAtTime(0.32, now);
      sources.push(lfo);
      nodes.push(lp, waveGain, lfoDepth);
      lfo.connect(lfoDepth).connect(waveGain.gain);
      src.connect(lp).connect(waveGain).connect(gain);
      src.start(now);
      lfo.start(now);
    } else if (kind === "mountain-wind") {
      const src = addPink();
      const bp = context.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(580, now);
      bp.Q.setValueAtTime(1.6, now);
      const lfo = context.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.09, now);
      const depth = context.createGain();
      depth.gain.setValueAtTime(220, now);
      const level = context.createGain();
      level.gain.setValueAtTime(0.7, now);
      sources.push(lfo);
      nodes.push(bp, depth, level);
      lfo.connect(depth).connect(bp.frequency);
      src.connect(bp).connect(level).connect(gain);
      src.start(now);
      lfo.start(now);
    } else if (kind === "hearth") {
      const src = addPink();
      const lp = context.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(260, now);
      lp.Q.setValueAtTime(0.8, now);
      const level = context.createGain();
      level.gain.setValueAtTime(0.85, now);
      nodes.push(lp, level);
      src.connect(lp).connect(level).connect(gain);
      src.start(now);
      scheduleAccent(bed, 1200, () => playHearthCrackle(gain));
    } else if (kind === "forest") {
      const src = addPink();
      const bp = context.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(1100, now);
      bp.Q.setValueAtTime(0.9, now);
      const level = context.createGain();
      level.gain.setValueAtTime(0.5, now);
      const low = context.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.setValueAtTime(320, now);
      const lowLevel = context.createGain();
      lowLevel.gain.setValueAtTime(0.35, now);
      nodes.push(bp, level, low, lowLevel);
      src.connect(bp).connect(level).connect(gain);
      src.connect(low).connect(lowLevel).connect(gain);
      src.start(now);
    } else if (kind === "enchanted-shimmer") {
      const src = addPink();
      const bp = context.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(1300, now);
      bp.Q.setValueAtTime(1, now);
      const level = context.createGain();
      level.gain.setValueAtTime(0.38, now);
      nodes.push(bp, level);
      src.connect(bp).connect(level).connect(gain);
      src.start(now);
      scheduleAccent(bed, 3000, () => playEnchantedChime(gain));
    } else {
      // "arcade-hum": soft warm indoor room tone
      const src = addPink();
      const lp = context.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(300, now);
      const level = context.createGain();
      level.gain.setValueAtTime(0.45, now);
      const hum = context.createOscillator();
      hum.type = "sine";
      hum.frequency.setValueAtTime(120, now);
      const humGain = context.createGain();
      humGain.gain.setValueAtTime(0.06, now);
      sources.push(hum);
      nodes.push(lp, level, humGain);
      src.connect(lp).connect(level).connect(gain);
      hum.connect(humGain).connect(gain);
      src.start(now);
      hum.start(now);
    }
    return bed;
  };

  const sync = (): void => {
    const now = context.currentTime;
    const targetGain = canRun() ? mixGain : 0;
    if (targetGain !== lastMasterTarget) {
      lastMasterTarget = targetGain;
      rampParam(masterGain.gain, targetGain, now, 0.2);
    }
    if (!canRun()) {
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
    setMix: (next) => {
      mixActive = next.active;
      mixGain = next.gain;
      sync();
    },
    sync,
  };
}
