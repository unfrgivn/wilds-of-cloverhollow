import { Preferences } from "@capacitor/preferences";
import type { SoundCue } from "../core";

export type SoundLogEntry = { tick: number; cue: SoundCue; played: boolean };
export type AudioController = {
  play: (cue: SoundCue, tick: number) => void;
  toggle: () => void;
  muted: () => boolean;
  log: () => SoundLogEntry[];
};

type Timing = { offset: number; duration: number; gain: number };
type Segment =
  | (Timing & { wave: "noise"; lowpass: number })
  | (Timing & { wave: "sine" | "square" | "triangle"; frequency: number; endFrequency?: number });
type Recipe = readonly Segment[];

const preferenceKey = "cloverhollow-audio";
const recipes: Record<SoundCue, Recipe> = {
  "dialogue-open": [{ wave: "triangle", frequency: 392, offset: 0, duration: .12, gain: .12 }],
  "dialogue-advance": [{ wave: "triangle", frequency: 523, offset: 0, duration: .1, gain: .1 }],
  "dialogue-blip": [{ wave: "square", frequency: 660, offset: 0, duration: .035, gain: .045 }],
  "dialogue-close": [{ wave: "triangle", frequency: 330, offset: 0, duration: .12, gain: .1 }],
  "choice-move": [{ wave: "triangle", frequency: 440, offset: 0, duration: .08, gain: .08 }],
  "choice-select": [{ wave: "triangle", frequency: 587, offset: 0, duration: .12, gain: .12 }],
  "journal-open": [
    { wave: "triangle", frequency: 392, offset: 0, duration: .1, gain: .1 },
    { wave: "triangle", frequency: 523, offset: .08, duration: .14, gain: .1 },
  ],
  "journal-close": [
    { wave: "triangle", frequency: 523, offset: 0, duration: .1, gain: .08 },
    { wave: "triangle", frequency: 330, offset: .08, duration: .14, gain: .08 },
  ],
  footstep: [{ wave: "noise", offset: 0, duration: .045, gain: .025, lowpass: 900 }],
  door: [{
    wave: "triangle", frequency: 440, endFrequency: 220,
    offset: 0, duration: .22, gain: .1,
  }],
  "area-arrive": [
    { wave: "triangle", frequency: 523, offset: 0, duration: .12, gain: .09 },
    { wave: "triangle", frequency: 659, offset: .1, duration: .16, gain: .1 },
  ],
  coin: [
    { wave: "square", frequency: 988, offset: 0, duration: .07, gain: .07 },
    { wave: "triangle", frequency: 1319, offset: .07, duration: .11, gain: .08 },
  ],
  item: [
    { wave: "triangle", frequency: 622, offset: 0, duration: .1, gain: .08 },
    { wave: "triangle", frequency: 784, offset: .08, duration: .13, gain: .09 },
  ],
  sticker: [
    { wave: "triangle", frequency: 523, offset: 0, duration: .12, gain: .1 },
    { wave: "triangle", frequency: 659, offset: .09, duration: .12, gain: .1 },
    { wave: "triangle", frequency: 784, offset: .18, duration: .15, gain: .11 },
  ],
  "lantern-on": [
    { wave: "triangle", frequency: 392, offset: 0, duration: .1, gain: .07 },
    { wave: "triangle", frequency: 784, offset: .1, duration: .18, gain: .08 },
  ],
  "lantern-off": [
    { wave: "triangle", frequency: 784, offset: 0, duration: .1, gain: .07 },
    { wave: "triangle", frequency: 392, offset: .1, duration: .18, gain: .07 },
  ],
  "battle-start": [
    { wave: "triangle", frequency: 220, endFrequency: 440, offset: 0, duration: .24, gain: .1 },
    { wave: "sine", frequency: 660, offset: .2, duration: .12, gain: .06 },
  ],
  "battle-command": [{ wave: "triangle", frequency: 494, offset: 0, duration: .1, gain: .09 }],
  "battle-hit": [
    { wave: "noise", offset: 0, duration: .06, gain: .025, lowpass: 1200 },
    { wave: "triangle", frequency: 247, offset: .02, duration: .12, gain: .07 },
  ],
  "battle-win": [
    { wave: "triangle", frequency: 523, offset: 0, duration: .12, gain: .09 },
    { wave: "triangle", frequency: 659, offset: .1, duration: .12, gain: .09 },
    { wave: "triangle", frequency: 784, offset: .2, duration: .12, gain: .1 },
    { wave: "triangle", frequency: 1047, offset: .3, duration: .2, gain: .1 },
  ],
  "battle-run": [{
    wave: "triangle", frequency: 330, endFrequency: 220,
    offset: 0, duration: .16, gain: .07,
  }],
  "battle-rest": [{ wave: "triangle", frequency: 262, offset: 0, duration: .16, gain: .07 }],
};

export function createAudio(): AudioController {
  let muted = false;
  let preferenceLoaded = false;
  let locallyToggled = false;
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
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
  const persist = (): void => {
    void Preferences.set({ key: preferenceKey, value: JSON.stringify(muted) });
  };
  const toggle = (): void => {
    muted = !muted;
    locallyToggled = true;
    if (preferenceLoaded) persist();
  };
  const ensureContext = (): AudioContext | null => {
    if (context !== null) return context;
    const Constructor = globalThis.AudioContext;
    if (Constructor === undefined) return null;
    context = new Constructor();
    master = context.createGain();
    master.gain.value = .18;
    master.connect(context.destination);
    return context;
  };
  const unlock = (): void => {
    const audio = ensureContext();
    if (audio !== null && audio.state === "suspended") void audio.resume();
  };
  const playSegment = (audio: AudioContext, segment: Segment, start: number): void => {
    if (master === null) return;
    const gain = audio.createGain();
    const end = start + segment.duration;
    gain.gain.setValueAtTime(.001, start);
    gain.gain.exponentialRampToValueAtTime(segment.gain, start + .006);
    gain.gain.exponentialRampToValueAtTime(.001, end);
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
    const jitter = segment.wave === "square" ? (Math.random() - .5) * 18 : 0;
    oscillator.frequency.setValueAtTime(segment.frequency + jitter, start);
    if (segment.endFrequency !== undefined)
      oscillator.frequency.linearRampToValueAtTime(segment.endFrequency, end);
    oscillator.connect(gain).connect(master);
    oscillator.start(start);
    oscillator.stop(end);
  };
  const playRecipe = (cue: SoundCue): boolean => {
    if (muted) return false;
    const audio = ensureContext();
    if (audio === null || master === null || audio.state === "suspended") return false;
    const recipe = recipes[cue];
    const now = audio.currentTime;
    recipe.forEach((segment) => playSegment(audio, segment, now + segment.offset));
    return true;
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", (event) => {
    unlock();
    if (event.code === "KeyM") toggle();
  });
  void Preferences.get({ key: preferenceKey }).then(({ value }) => {
    preferenceLoaded = true;
    if (locallyToggled) persist();
    else if (value !== null) muted = value === "true";
  });
  return {
    play: (cue, tick) => {
      const played = playRecipe(cue);
      entries.push({ tick, cue, played });
      if (entries.length > 120) entries.shift();
    },
    toggle,
    muted: () => muted,
    log: () => entries.slice(),
  };
}
