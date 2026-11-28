export type AmbienceAccentSynth = {
  playBirdChirp: (target: GainNode, pan: number, peakGain?: number) => void;
  playWaveShimmer: (target: GainNode, pan: number) => void;
  playHearthCrackle: (target: GainNode, pan: number) => void;
  playEnchantedChime: (target: GainNode, pan: number) => void;
  playCaveDrop: (target: GainNode, pan: number) => void;
  playCafeClink: (target: GainNode, pan: number) => void;
  playMountainGust: (target: GainNode, pan: number) => void;
  playArcadeChime: (target: GainNode, pan: number) => void;
};

/**
 * Periodic stereo-panned acoustic accent synthesizers layered softly over each
 * area's continuous Web Audio ambience bed.
 */
export function createAmbienceAccents(
  context: AudioContext,
  getPink: () => AudioBuffer,
): AmbienceAccentSynth {
  const createAccentOutput = (
    target: GainNode,
    pan: number,
    atTime: number,
  ): { input: AudioNode; cleanup: () => void } => {
    if (pan === 0 || typeof context.createStereoPanner !== "function") {
      return { input: target, cleanup: () => {} };
    }
    const panner = context.createStereoPanner();
    panner.pan.setValueAtTime(pan, atTime);
    panner.connect(target);
    return {
      input: panner,
      cleanup: () => {
        panner.disconnect();
      },
    };
  };

  const playBirdChirp = (target: GainNode, pan: number, peakGain = 0.11): void => {
    const pentatonic = [1046.5, 1174.66, 1318.51, 1567.98, 1760];
    const base = pentatonic[Math.floor(Math.random() * pentatonic.length)] ?? 1318.51;
    const now = context.currentTime + 0.02;
    const output = createAccentOutput(target, pan, now);
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
      env.gain.linearRampToValueAtTime(peakGain, start + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      osc.connect(env).connect(output.input);
      const isLast = note === 1;
      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
        if (isLast) output.cleanup();
      };
      osc.start(start);
      osc.stop(start + 0.14);
    }
  };

  const playWaveShimmer = (target: GainNode, pan: number): void => {
    const now = context.currentTime + 0.02;
    const output = createAccentOutput(target, pan, now);
    const src = context.createBufferSource();
    src.buffer = getPink();
    const bp = context.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1250 + Math.random() * 550, now);
    bp.Q.setValueAtTime(1.6, now);
    const env = context.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.055, now + 0.28);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    src.connect(bp).connect(env).connect(output.input);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      env.disconnect();
      output.cleanup();
    };
    src.start(now, Math.random() * 1.5, 0.9);
  };

  const playHearthCrackle = (target: GainNode, pan: number): void => {
    const now = context.currentTime + 0.01;
    const output = createAccentOutput(target, pan, now);
    const src = context.createBufferSource();
    src.buffer = getPink();
    const hp = context.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(2400 + Math.random() * 1400, now);
    const env = context.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.16, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
    src.connect(hp).connect(env).connect(output.input);
    src.onended = () => {
      src.disconnect();
      hp.disconnect();
      env.disconnect();
      output.cleanup();
    };
    src.start(now, Math.random() * 2, 0.04);
  };

  const playEnchantedChime = (target: GainNode, pan: number): void => {
    // F Lydian high twinkles (C6, D6, E6, F6, G6, A6, B6)
    const freqs = [1046.5, 1174.66, 1318.51, 1396.91, 1567.98, 1760, 1975.53];
    const freq = freqs[Math.floor(Math.random() * freqs.length)] ?? 1396.91;
    const now = context.currentTime + 0.02;
    const output = createAccentOutput(target, pan, now);
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
    env.connect(output.input);
    osc.onended = () => {
      osc.disconnect();
      over.disconnect();
      overGain.disconnect();
      env.disconnect();
      output.cleanup();
    };
    osc.start(now);
    over.start(now);
    osc.stop(now + 0.95);
    over.stop(now + 0.3);
  };

  const playCaveDrop = (target: GainNode, pan: number): void => {
    const scale = 0.94 + Math.random() * 0.14;
    const baseHz = 880 * scale;
    const peakHz = 1480 * scale;
    const now = context.currentTime + 0.02;
    const output = createAccentOutput(target, pan, now);
    const drops: readonly (readonly [number, number])[] = [
      [0, 0.075],
      [0.19, 0.03],
    ];
    drops.forEach(([delay, peak], index) => {
      const start = now + delay;
      const osc = context.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseHz, start);
      osc.frequency.exponentialRampToValueAtTime(peakHz, start + 0.045);
      const env = context.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(peak, start + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 0.06);
      osc.connect(env).connect(output.input);
      const isLast = index === drops.length - 1;
      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
        if (isLast) output.cleanup();
      };
      osc.start(start);
      osc.stop(start + 0.07);
    });
  };

  const playCafeClink = (target: GainNode, pan: number): void => {
    const scale = 0.96 + Math.random() * 0.08;
    const now = context.currentTime + 0.02;
    const output = createAccentOutput(target, pan, now);
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2600 * scale, now);
    const over = context.createOscillator();
    over.type = "sine";
    over.frequency.setValueAtTime(3900 * scale, now);
    const overGain = context.createGain();
    overGain.gain.setValueAtTime(0.35, now);
    overGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    const env = context.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.045, now + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    osc.connect(env);
    over.connect(overGain).connect(env);
    env.connect(output.input);
    osc.onended = () => {
      osc.disconnect();
      over.disconnect();
      overGain.disconnect();
      env.disconnect();
      output.cleanup();
    };
    osc.start(now);
    over.start(now);
    osc.stop(now + 0.065);
    over.stop(now + 0.05);
  };

  const playMountainGust = (target: GainNode, pan: number): void => {
    const now = context.currentTime + 0.02;
    const output = createAccentOutput(target, pan, now);
    let active = 2;
    const finish = (): void => {
      active -= 1;
      if (active === 0) output.cleanup();
    };
    const src = context.createBufferSource();
    src.buffer = getPink();
    const bp = context.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(620, now);
    bp.frequency.exponentialRampToValueAtTime(1120, now + 0.42);
    bp.frequency.exponentialRampToValueAtTime(560, now + 0.95);
    bp.Q.setValueAtTime(2.2, now);
    const gustEnv = context.createGain();
    gustEnv.gain.setValueAtTime(0.0001, now);
    gustEnv.gain.linearRampToValueAtTime(0.048, now + 0.34);
    gustEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
    src.connect(bp).connect(gustEnv).connect(output.input);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      gustEnv.disconnect();
      finish();
    };
    src.start(now, Math.random() * 1.5, 1.0);

    // Whisper-soft alpine frost-bell harmonic (D6 or F6, matching Pinecone Pass).
    const bellStart = now + 0.14;
    const bell = context.createOscillator();
    bell.type = "sine";
    bell.frequency.setValueAtTime(Math.random() < 0.5 ? 1174.66 : 1396.91, bellStart);
    const bellEnv = context.createGain();
    bellEnv.gain.setValueAtTime(0.0001, bellStart);
    bellEnv.gain.linearRampToValueAtTime(0.024, bellStart + 0.03);
    bellEnv.gain.exponentialRampToValueAtTime(0.0001, bellStart + 0.65);
    bell.connect(bellEnv).connect(output.input);
    bell.onended = () => {
      bell.disconnect();
      bellEnv.disconnect();
      finish();
    };
    bell.start(bellStart);
    bell.stop(bellStart + 0.68);
  };

  const playArcadeChime = (target: GainNode, pan: number): void => {
    const pair: readonly [number, number] =
      Math.random() < 0.5 ? [880, 1318.51] : [1046.5, 1567.98];
    const now = context.currentTime + 0.02;
    const output = createAccentOutput(target, pan, now);
    pair.forEach((freq, index) => {
      const start = now + index * 0.065;
      const osc = context.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);
      const env = context.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(0.022, start + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 0.055);
      osc.connect(env).connect(output.input);
      const isLast = index === pair.length - 1;
      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
        if (isLast) output.cleanup();
      };
      osc.start(start);
      osc.stop(start + 0.062);
    });
  };

  return {
    playBirdChirp,
    playWaveShimmer,
    playHearthCrackle,
    playEnchantedChime,
    playCaveDrop,
    playCafeClink,
    playMountainGust,
    playArcadeChime,
  };
}
