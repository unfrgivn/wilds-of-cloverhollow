import type { State } from "../core";
import { weatherForArea, type CozyWeatherKind, type CozyWeatherMode } from "../core/weather";

export type ActiveWeatherKind = CozyWeatherKind;

export type WeatherAmbienceSpec = {
  bedFilterHz: number;
  bedQ: number;
  bedGain: number;
  accentCadenceMs: number;
  accentGain: number;
  panWidth: number;
  notesHz: readonly number[];
  waveform: "sine" | "triangle";
};

export const WEATHER_AMBIENCE_SPECS: Readonly<
  Record<Exclude<ActiveWeatherKind, "clear">, WeatherAmbienceSpec>
> = {
  sunshower: {
    bedFilterHz: 2100, bedQ: 0.55, bedGain: 0.042, accentCadenceMs: 1100, accentGain: 0.018,
    panWidth: 0.52, notesHz: [987.77, 1174.66, 1318.51, 1479.98], waveform: "sine",
  },
  "breeze-petals": {
    bedFilterHz: 980, bedQ: 0.75, bedGain: 0.034, accentCadenceMs: 3100, accentGain: 0.016,
    panWidth: 0.48, notesHz: [659.25, 783.99, 987.77, 1174.66], waveform: "triangle",
  },
  "snow-flurry": {
    bedFilterHz: 1550, bedQ: 0.8, bedGain: 0.03, accentCadenceMs: 2800, accentGain: 0.015,
    panWidth: 0.44, notesHz: [1318.51, 1567.98, 1760.0, 1975.53], waveform: "sine",
  },
  "twilight-fireflies": {
    bedFilterHz: 620, bedQ: 0.65, bedGain: 0.026, accentCadenceMs: 2400, accentGain: 0.014,
    panWidth: 0.5, notesHz: [1760.0, 1975.53, 2093.0], waveform: "sine",
  },
};

export type WeatherAmbienceLayer = {
  setWeather: (kind: ActiveWeatherKind) => void;
  sync: (active: boolean) => void;
};

type ActiveWeatherNode = {
  kind: Exclude<ActiveWeatherKind, "clear">;
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  timer: ReturnType<typeof setTimeout> | null;
  accentSeed: number;
  stopped: boolean;
};

const FADE_SEC = 0.7;
const GOLDEN_ANGLE = 2.399963229728653;
const WEATHER_BED_BUS_SCALE = 6;
const WEATHER_ACCENT_BUS_SCALE = 4;

const WEATHER_PAN_PHASE: Readonly<Record<Exclude<ActiveWeatherKind, "clear">, number>> = {
  sunshower: 0.6,
  "breeze-petals": 1.3,
  "snow-flurry": 2.0,
  "twilight-fireflies": 2.7,
};

/** Returns the cozy weather acoustic profile, or `null` for clear/sheltered skies. */
export function weatherAmbienceSpec(kind: ActiveWeatherKind): WeatherAmbienceSpec | null {
  return kind === "clear" ? null : WEATHER_AMBIENCE_SPECS[kind];
}

/** Deterministic stereo pan in `[-panWidth, panWidth]` for weather acoustic accents. */
export function weatherAmbiencePan(kind: ActiveWeatherKind, seed: number): number {
  if (kind === "clear") return 0;
  const spec = WEATHER_AMBIENCE_SPECS[kind];
  const safeSeed = Number.isFinite(seed) ? seed : 0;
  return Math.sin(safeSeed * GOLDEN_ANGLE + WEATHER_PAN_PHASE[kind]) * spec.panWidth;
}

/** Resolves the live weather soundscape; hushes to `"clear"` on title, battle, finale & indoors. */
export function resolveSoundtrackWeather(
  state: Pick<State, "area" | "tick" | "battle" | "finale">,
  mode: CozyWeatherMode,
  titleOpen: boolean,
): ActiveWeatherKind {
  if (titleOpen || state.battle !== null || state.finale !== null) return "clear";
  return weatherForArea(state.area, state.tick, mode).kind;
}

function rampParam(param: AudioParam, target: number, now: number, seconds: number): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(target, now + seconds);
}

/**
 * Procedural cozy weather soundscape routed directly into `target` (`masterGain`
 * inside `createAmbiencePlayer`), automatically sharing mute, volume, ducking,
 * and the warm `1400 Hz` Journal low-pass filter with zero nodes when `"clear"`.
 */
export function createWeatherAmbienceLayer(
  context: AudioContext,
  target: AudioNode,
  getPink: () => AudioBuffer,
): WeatherAmbienceLayer {
  let desiredKind: ActiveWeatherKind = "clear";
  let layerActive = false;
  let activeNode: ActiveWeatherNode | null = null;

  const canRun = (): boolean =>
    context.state === "running" && layerActive && desiredKind !== "clear";

  const createAccentOutput = (
    bus: GainNode, pan: number, atTime: number,
  ): { input: AudioNode; cleanup: () => void } => {
    if (pan === 0 || typeof context.createStereoPanner !== "function") {
      return { input: bus, cleanup: () => {} };
    }
    const panner = context.createStereoPanner();
    panner.pan.setValueAtTime(pan, atTime);
    panner.connect(bus);
    return { input: panner, cleanup: () => panner.disconnect() };
  };

  const playWeatherAccent = (
    kind: Exclude<ActiveWeatherKind, "clear">, bus: GainNode, pan: number,
  ): void => {
    const spec = WEATHER_AMBIENCE_SPECS[kind];
    const freq = spec.notesHz[Math.floor(Math.random() * spec.notesHz.length)] ?? spec.notesHz[0];
    if (freq === undefined) return;
    const now = context.currentTime + 0.02;
    const output = createAccentOutput(bus, pan, now);
    const peak = spec.accentGain * WEATHER_ACCENT_BUS_SCALE;

    if (kind === "twilight-fireflies") {
      for (let pulse = 0; pulse < 2; pulse += 1) {
        const start = now + pulse * 0.11;
        const osc = context.createOscillator();
        osc.type = spec.waveform;
        osc.frequency.setValueAtTime(pulse === 0 ? freq : freq * 1.06, start);
        const env = context.createGain();
        env.gain.setValueAtTime(0.0001, start);
        env.gain.linearRampToValueAtTime(peak * (pulse === 0 ? 1 : 0.72), start + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, start + 0.085);
        osc.connect(env).connect(output.input);
        const isLast = pulse === 1;
        osc.onended = () => {
          osc.disconnect();
          env.disconnect();
          if (isLast) output.cleanup();
        };
        osc.start(start);
        osc.stop(start + 0.095);
      }
      return;
    }

    const osc = context.createOscillator();
    osc.type = spec.waveform;
    const env = context.createGain();
    const isDrop = kind === "sunshower";
    const dur = isDrop ? 0.11 : kind === "breeze-petals" ? 0.45 : 0.55;
    osc.frequency.setValueAtTime(isDrop ? freq * 0.96 : freq, now);
    if (isDrop) osc.frequency.exponentialRampToValueAtTime(freq * 1.04, now + 0.055);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peak, now + (isDrop ? 0.008 : 0.014));
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(env).connect(output.input);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
      output.cleanup();
    };
    osc.start(now);
    osc.stop(now + dur + 0.02);
  };

  const scheduleAccent = (node: ActiveWeatherNode, cadenceMs: number): void => {
    node.timer = setTimeout(() => {
      if (node.stopped || context.state !== "running") return;
      const pan = weatherAmbiencePan(node.kind, node.accentSeed);
      node.accentSeed += 1;
      playWeatherAccent(node.kind, node.gain, pan);
      scheduleAccent(node, cadenceMs * (0.7 + Math.random() * 0.7));
    }, cadenceMs);
  };

  const stopNode = (node: ActiveWeatherNode | null): void => {
    if (node === null || node.stopped) return;
    node.stopped = true;
    if (node.timer !== null) {
      clearTimeout(node.timer);
      node.timer = null;
    }
    rampParam(node.gain.gain, 0, context.currentTime, FADE_SEC);
    setTimeout(() => {
      for (const source of node.sources) {
        try { source.stop(); } catch { /* Already stopped. */ }
        source.disconnect();
      }
      for (const extra of node.nodes) extra.disconnect();
      node.gain.disconnect();
    }, Math.ceil((FADE_SEC + 0.12) * 1000));
  };

  const startNode = (kind: Exclude<ActiveWeatherKind, "clear">): ActiveWeatherNode => {
    const spec = WEATHER_AMBIENCE_SPECS[kind];
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE_SEC);
    gain.connect(target);
    const src = context.createBufferSource();
    src.buffer = getPink();
    src.loop = true;
    const level = context.createGain();
    level.gain.setValueAtTime(spec.bedGain * WEATHER_BED_BUS_SCALE, now);
    const nodes: AudioNode[] = [level];
    if (typeof context.createBiquadFilter === "function") {
      const bp = context.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(spec.bedFilterHz, now);
      bp.Q.setValueAtTime(spec.bedQ, now);
      nodes.push(bp);
      src.connect(bp).connect(level).connect(gain);
    } else {
      src.connect(level).connect(gain);
    }
    src.start(now);
    const node: ActiveWeatherNode = {
      kind, gain, sources: [src], nodes, timer: null, accentSeed: 0, stopped: false,
    };
    scheduleAccent(node, spec.accentCadenceMs);
    return node;
  };

  const reconcile = (): void => {
    if (!canRun()) {
      stopNode(activeNode);
      activeNode = null;
      return;
    }
    if (desiredKind === "clear" || (activeNode !== null && activeNode.kind === desiredKind)) return;
    stopNode(activeNode);
    activeNode = startNode(desiredKind);
  };

  return {
    setWeather: (kind) => { desiredKind = kind; reconcile(); },
    sync: (active) => { layerActive = active; reconcile(); },
  };
}
