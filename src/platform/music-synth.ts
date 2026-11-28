import type { InstrumentVoice } from "./scores";

export type ScheduledNote = {
  voice: InstrumentVoice;
  gain: number;
  midi: number;
  durationSteps: number;
  velocity: number;
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

const PHRASE_SPAN_STEPS = 16;
const SPARKLE_MAX_MIDI = 76;

export function hasMicroTiming(voice: InstrumentVoice): boolean {
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

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function rampParam(param: AudioParam, target: number, now: number, seconds: number): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(target, now + seconds);
}

export function scheduleInstrumentNote(
  context: AudioContext,
  target: AudioNode,
  note: ScheduledNote,
  start: number,
  duration: number,
  getNoise: () => AudioBuffer,
): void {
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
}
