import type { MusicTrack, SoundCue } from "../core";
import {
  soundCueRecipes,
  type AudioRecipe,
  type AudioSegment,
} from "./audio-recipes";
import {
  blipFrequency,
  footstepPitchFactor,
  trackScaleNotes,
  type BlipSynth,
} from "./voices";

export type AudioOutputGraph = {
  master: GainNode;
  musicOutput: GainNode;
  ambienceOutput: GainNode;
};

/** Generates a 1-second warm stereo impulse response for the music reverb bus. */
export function createReverbImpulse(audio: AudioContext): AudioBuffer {
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

/** Generates a shared quarter-second mono white-noise buffer for filtered noise cues. */
export function createNoiseBuffer(audio: AudioContext): AudioBuffer {
  const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate / 4), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Builds the shared dynamics compressor, SFX master, dry/wet music bus, and ambience bus. */
export function createAudioOutputGraph(
  audio: AudioContext,
  masterGain: number,
): AudioOutputGraph {
  const compressor = audio.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 18;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.15;
  compressor.connect(audio.destination);

  const master = audio.createGain();
  master.gain.value = masterGain;
  master.connect(compressor);

  const musicOutput = audio.createGain();
  musicOutput.gain.value = 1;
  const musicDry = audio.createGain();
  musicDry.gain.value = 0.85;
  musicOutput.connect(musicDry).connect(compressor);
  if (typeof audio.createConvolver === "function") {
    const convolver = audio.createConvolver();
    convolver.buffer = createReverbImpulse(audio);
    const musicWet = audio.createGain();
    musicWet.gain.value = 0.22;
    musicOutput.connect(convolver).connect(musicWet).connect(compressor);
  }

  const ambienceOutput = audio.createGain();
  ambienceOutput.gain.value = 1;
  ambienceOutput.connect(compressor);

  return { master, musicOutput, ambienceOutput };
}

/** Schedules a single gain-enveloped oscillator or lowpass noise segment onto `destination`. */
export function playSegment(
  audio: AudioContext,
  destination: AudioNode,
  getNoiseBuffer: (context: AudioContext) => AudioBuffer,
  segment: AudioSegment,
  start: number,
): void {
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
    source.buffer = getNoiseBuffer(audio);
    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = segment.lowpass;
    source.connect(filter).connect(gain).connect(destination);
    source.start(start);
    source.stop(end);
    return;
  }

  const oscillator = audio.createOscillator();
  oscillator.type = segment.wave;
  // Square blips get a hair of pitch wobble so text doesn't sound like a dial tone.
  const jitter = segment.wave === "square" ? (Math.random() - 0.5) * 18 : 0;
  oscillator.frequency.setValueAtTime(segment.frequency + jitter, start);
  if (segment.endFrequency !== undefined) {
    oscillator.frequency.linearRampToValueAtTime(segment.endFrequency, end);
  }
  if (segment.vibrato !== undefined) {
    const vibrato = audio.createOscillator();
    const depth = audio.createGain();
    vibrato.frequency.value = segment.vibrato.rate;
    depth.gain.value = segment.vibrato.depth;
    vibrato.connect(depth).connect(oscillator.frequency);
    vibrato.start(start);
    vibrato.stop(end);
  }
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(end);
}

/** Schedules every segment in an audio recipe relative to `now` (default `audio.currentTime`). */
export function scheduleRecipe(
  audio: AudioContext,
  destination: AudioNode,
  getNoiseBuffer: (context: AudioContext) => AudioBuffer,
  recipe: AudioRecipe,
  now = audio.currentTime,
): void {
  recipe.forEach((segment) => {
    playSegment(audio, destination, getNoiseBuffer, segment, now + segment.offset);
  });
}

/** Picks the spoken dialogue character at `revealed`, falling back across punctuation/spaces. */
export function extractBlipChar(
  text: string | undefined,
  revealed: number | undefined,
): string | undefined {
  if (text === undefined || revealed === undefined || revealed <= 0) return undefined;
  const current = text[revealed - 1];
  const previous = revealed >= 2 ? text[revealed - 2] : undefined;
  return current !== undefined && /^[\s.,!?;:\u2014\u2013-]$/.test(current)
    ? previous
    : current;
}

/** Converts a synthesized voice blip into primary plus optional harmonic segments. */
export function voiceBlipSegments(
  blip: BlipSynth,
  duration: number,
  gain: number,
  attack: number,
  harmonicGainScale: number,
): AudioSegment[] {
  const segments: AudioSegment[] = [
    {
      wave: blip.wave,
      frequency: blip.frequency,
      endFrequency: blip.endFrequency,
      offset: 0,
      duration,
      gain,
      attack,
    },
  ];
  if (blip.harmonic !== undefined) {
    segments.push({
      wave: "sine",
      frequency: blip.frequency * blip.harmonic,
      endFrequency:
        blip.endFrequency === undefined ? undefined : blip.endFrequency * blip.harmonic,
      offset: 0,
      duration: duration * 0.85,
      gain: gain * harmonicGainScale,
      attack,
    });
  }
  return segments;
}

/** Builds the quiet two-layer voice chirp used for ambient NPC chatter bubbles. */
export function ambientChatterSegments(speaker: string): AudioSegment[] | null {
  const blip = blipFrequency(speaker, speaker.length, speaker[0]);
  if (blip === null) return null;
  return voiceBlipSegments(blip, 0.038, blip.gain * 0.32, 0.004, 0.25);
}

/** Synthesizes scale-aligned menu cursor, battle-command, and confirm chimes for `track`. */
export function scaleChoiceRecipe(
  track: MusicTrack,
  cue: "choice-move" | "battle-command" | "choice-select",
  tick: number,
  choiceIndex?: number,
): AudioSegment[] {
  const scale = trackScaleNotes(track);
  if (cue === "choice-select") {
    const root = scale[0] ?? 523.25;
    const fifth = scale[3] ?? 783.99;
    return [
      { wave: "triangle", frequency: root, offset: 0, duration: 0.095, gain: 0.1 },
      { wave: "sine", frequency: fifth, offset: 0.045, duration: 0.115, gain: 0.075 },
    ];
  }
  const raw = choiceIndex ?? tick;
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
}

/** Scales every tone frequency and noise lowpass cutoff in `recipe` by `factor`. */
export function scaleRecipePitch(recipe: AudioRecipe, factor: number): AudioSegment[] {
  return recipe.map((segment) =>
    segment.wave === "noise"
      ? { ...segment, lowpass: segment.lowpass * factor }
      : {
          ...segment,
          frequency: segment.frequency * factor,
          endFrequency:
            segment.endFrequency === undefined ? undefined : segment.endFrequency * factor,
        },
  );
}

/** Resolves choice, footstep-surface, and static sound cue recipes for playback. */
export function resolveCueRecipe(
  cue: Exclude<SoundCue, "dialogue-blip">,
  track: MusicTrack,
  tick: number,
  choiceIndex?: number,
): AudioRecipe {
  if (cue === "choice-move" || cue === "battle-command" || cue === "choice-select") {
    return scaleChoiceRecipe(track, cue, tick, choiceIndex);
  }
  if (cue.startsWith("footstep-")) {
    return scaleRecipePitch(soundCueRecipes[cue], footstepPitchFactor(tick));
  }
  return soundCueRecipes[cue];
}
