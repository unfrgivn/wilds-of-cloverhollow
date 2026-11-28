import type { MusicTrack } from "../core";
import {
  battleTensionNotes,
  JOURNAL_DUCK_GAIN,
  JOURNAL_FILTER_HZ,
  lanternShimmerNote,
  nextBarAdaptiveState,
  TENSION_PERCUSSION_BOOST,
} from "./music-mix";
import {
  phraseDynamics,
  rampParam,
  scheduleInstrumentNote,
  VOICE_PAN,
  type PhraseDynamics,
  type ScheduledNote,
} from "./music-synth";
import { scores, type InstrumentVoice, type PlayableTrack, type Score } from "./scores";

export { phraseDynamics, VOICE_PAN, type PhraseDynamics };

export type MusicPlayer = {
  setState: (next: {
    track: MusicTrack;
    duck: boolean;
    journalWarm?: boolean;
    lanternLayer?: boolean;
    tensionLayer?: boolean;
  }) => void;
  setMix: (next: { active: boolean; gain: number }) => void;
  isPlaying: () => boolean;
  sync: () => void;
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
  lanternGain: GainNode;
  lanternTarget: AudioNode;
  tensionGain: GainNode;
  panners: StereoPannerNode[];
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
  "title", "taco", "battle", "boss", "encore", "talk", "hearts", "morning",
]);
const SPARKLE_VELOCITY_SCALE = 0.16;

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
  let currentJournalWarm = false;
  let desiredLantern = false;
  let committedLantern = false;
  let desiredTension = false;
  let committedTension = false;
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

    const lanternGain = context.createGain();
    lanternGain.gain.setValueAtTime(committedLantern ? 1 : 0, now);
    lanternGain.connect(gain);
    let lanternTarget: AudioNode = lanternGain;
    if (supportsPan) {
      const lanternPanner = context.createStereoPanner();
      lanternPanner.pan.setValueAtTime(0.26, now);
      lanternPanner.connect(lanternGain);
      panners.push(lanternPanner);
      lanternTarget = lanternPanner;
    }

    const tensionGain = context.createGain();
    tensionGain.gain.setValueAtTime(committedTension ? 1 : 0, now);
    tensionGain.connect(gain);

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

    return { gain, voiceTargets, lanternGain, lanternTarget, tensionGain, panners };
  };

  const scheduleVoice = (
    target: AudioNode,
    note: ScheduledNote,
    start: number,
    duration: number,
  ): void => {
    scheduleInstrumentNote(context, target, note, start, duration, getNoise);
  };

  const canRun = (): boolean =>
    context.state === "running" && mixActive && isPlayableTrack(currentTrack);

  const fadeOutChannel = (channel: TrackChannel | null): void => {
    if (channel === null) return;
    const now = context.currentTime;
    rampParam(channel.gain.gain, 0, now, CROSSFADE_SEC);
    setTimeout(() => {
      for (const panner of channel.panners) panner.disconnect();
      channel.lanternGain.disconnect();
      channel.tensionGain.disconnect();
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
      const stepsPerBar = activeCompiled.score.stepsPerBar;
      const stepInBar = currentStep % stepsPerBar;
      const barIndex =
        Math.floor(currentStep / stepsPerBar) + loopCount * activeCompiled.score.bars;

      const nextLantern = nextBarAdaptiveState(committedLantern, desiredLantern, stepInBar, true);
      if (nextLantern !== committedLantern) {
        committedLantern = nextLantern;
        rampParam(trackChannel.lanternGain.gain, committedLantern ? 1 : 0, nextStepTime, 0.45);
      }
      const nextTension = nextBarAdaptiveState(committedTension, desiredTension, stepInBar, false);
      if (nextTension !== committedTension) {
        committedTension = nextTension;
        rampParam(trackChannel.tensionGain.gain, committedTension ? 1 : 0, nextStepTime, 0.25);
      }

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
          const tensionScale =
            committedTension && (note.voice === "shaker" || note.voice === "woodblock")
              ? TENSION_PERCUSSION_BOOST
              : 1;
          const shapedVelocity = note.velocity * dynamics.gainScale * tensionScale;
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
      if (isPlayableTrack(currentTrack)) {
        if (committedTension) {
          for (const extra of battleTensionNotes(currentTrack, stepInBar, stepsPerBar, barIndex)) {
            scheduleVoice(
              trackChannel.tensionGain,
              extra,
              nextStepTime,
              extra.durationSteps * activeCompiled.stepSeconds,
            );
          }
        }
        if (committedLantern) {
          const shimmer = lanternShimmerNote(currentTrack, stepInBar, stepsPerBar, barIndex);
          if (shimmer !== null) {
            scheduleVoice(
              trackChannel.lanternTarget,
              shimmer,
              nextStepTime,
              shimmer.durationSteps * activeCompiled.stepSeconds,
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
      committedLantern = desiredLantern;
      committedTension = desiredTension;
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
      const nextJournalWarm = next.journalWarm ?? false;
      if (next.duck !== currentDuck || nextJournalWarm !== currentJournalWarm) {
        currentDuck = next.duck;
        currentJournalWarm = nextJournalWarm;
        const now = context.currentTime;
        const targetDuckGain = currentJournalWarm
          ? JOURNAL_DUCK_GAIN
          : currentDuck
            ? DUCK_GAIN
            : 1;
        rampParam(duckGain.gain, targetDuckGain, now, DUCK_RAMP_SEC);
        if (duckFilter !== null) {
          const targetCutoff = currentJournalWarm
            ? JOURNAL_FILTER_HZ
            : duckFilterCutoff(currentDuck);
          rampParam(duckFilter.frequency, targetCutoff, now, DUCK_RAMP_SEC);
        }
      }
      const nextLantern = next.lanternLayer ?? false;
      if (desiredLantern && !nextLantern) {
        desiredLantern = false;
        committedLantern = false;
        if (trackChannel !== null) {
          rampParam(trackChannel.lanternGain.gain, 0, context.currentTime, 0.4);
        }
      } else {
        desiredLantern = nextLantern;
      }
      desiredTension = next.tensionLayer ?? false;

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
        committedLantern = desiredLantern;
        committedTension = desiredTension;
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
