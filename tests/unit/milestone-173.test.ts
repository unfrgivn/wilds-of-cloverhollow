import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  jukeboxTracks,
  soundCues,
  soundtrackFor,
  startBattle,
  trackTitles,
  type Battle,
  type BattleView,
  type SoundCue,
  type State,
} from "../../src/core";
import * as audio from "../../src/platform/audio";
import * as audioRecipes from "../../src/platform/audio-recipes";
import { FRESH_START_TRACKS, resumeBarStep } from "../../src/platform/music";
import { scores } from "../../src/platform/scores";
import { expansionScores } from "../../src/platform/scores-expansion";
import { trackScaleNotes } from "../../src/platform/voices";
import { computeBattleChoreography } from "../../src/render/battle-choreography";
import { hapticForTick } from "../../src/shell/feedback";

const { world, fixtures } = loadContent();
const rawPlaza = fixtures["plaza-party"] ?? fixtures.plaza ?? fixtures["new-game"];
if (rawPlaza === undefined) throw new Error("Missing plaza fixture");
const plazaFixture = rawPlaza;

const partyIds = ["maddie", "sue", "jordan"] as const;
const partyCommands: Readonly<Record<string, string | null>> = {
  maddie: "play",
  sue: "cast",
  jordan: "juggle",
};

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    critterId: "frog",
    den: null,
    entry: { x: 500, y: 500 },
    phase: "command",
    message: "What will Fae do?",
    revealed: 17,
    selected: 0,
    command: null,
    energy: 4,
    calm: 15,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: ["zoomy", "curious"],
    answered: false,
    lanternPeek: false,
    turn: 2,
    windUp: null,
    talkMode: false,
    talk: null,
    talkTurns: 0,
    rewardSticker: null,
    phaseTicks: 0,
    ...overrides,
  };
}

function makeView(activeId: string, activeName: string): BattleView {
  return {
    critterId: "frog",
    critterName: "Fountain Frog",
    battleHeight: 145,
    auraCentre: { x: 256, y: 256 },
    bodyCentre: { x: 256, y: 256 },
    phase: "result",
    activeActor: { id: activeId, name: activeName },
    message: `${activeName} takes a deep breath. +1 energy!`,
    revealed: 36,
    commands: [],
    selected: 0,
    energy: 5,
    energyMax: 6,
    calm: 15,
    calmMax: 50,
    check: null,
    hint: null,
    feelings: null,
    windUp: null,
    puff: 0,
    lastGrade: null,
    rewardSticker: null,
    talk: null,
    sparkle: null,
    fluteAssist: null,
    burstSoften: 0,
    lassoAssist: null,
    lassoSteady: false,
    treatTray: null,
  };
}

function makeState(area: string): State {
  const areaData = world.areas[area];
  const spawn = areaData !== undefined ? Object.keys(areaData.spawns)[0] ?? "" : "";
  return createState(world, { area, spawn, seed: 1 });
}

function recipeDuration(recipe: audioRecipes.AudioRecipe): number {
  let maxEnd = 0;
  for (const segment of recipe) {
    maxEnd = Math.max(maxEnd, segment.offset + segment.duration);
  }
  return maxEnd;
}

describe("Milestone 173: Recover Stale-Grade Hit-Stop Guard", () => {
  it("never triggers hitStop, stageShake, critter recoil, or critter hearts on Recover", () => {
    const staleGreatRecover = makeBattle({
      phase: "result",
      command: "recover",
      lastGrade: "great",
      answered: true,
      phaseTicks: 1,
    });
    const calmCommand = makeBattle({
      phase: "command",
      command: null,
      lastGrade: null,
      answered: false,
      phaseTicks: 0,
    });

    const tick = 42;
    const recoverChoreo = computeBattleChoreography(
      staleGreatRecover,
      makeView("fae", "Fae"),
      tick,
      partyIds,
      partyCommands,
    );
    const baselineChoreo = computeBattleChoreography(
      calmCommand,
      null,
      tick,
      partyIds,
      partyCommands,
    );

    expect(recoverChoreo.hitStop).toBe(false);
    expect(recoverChoreo.stageShake).toEqual({ x: 0, y: 0 });
    expect(recoverChoreo.critter).toEqual(baselineChoreo.critter);
    expect(recoverChoreo.vfx.some((p) => p.anchor === "critter")).toBe(false);
    expect(recoverChoreo.vfx.some((p) => p.texture === "heart")).toBe(false);
    expect(recoverChoreo.vfx.length).toBeGreaterThan(0);
  });

  it("never triggers hitStop or critter recoil when a companion recovers after a prior hit", () => {
    const sueRecover = makeBattle({
      phase: "result",
      command: "recover",
      lastGrade: "good",
      answered: true,
      phaseTicks: 2,
    });
    const tick = 30;
    const choreo = computeBattleChoreography(
      sueRecover,
      makeView("sue", "Sue"),
      tick,
      partyIds,
      partyCommands,
    );
    const baseline = computeBattleChoreography(
      makeBattle({ phase: "command" }),
      null,
      tick,
      partyIds,
      partyCommands,
    );

    expect(choreo.hitStop).toBe(false);
    expect(choreo.stageShake).toEqual({ x: 0, y: 0 });
    expect(choreo.critter).toEqual(baseline.critter);
    expect(choreo.vfx.some((p) => p.anchor === "critter")).toBe(false);
    expect(choreo.vfx.length).toBeGreaterThan(0);
  });
});

describe("Milestone 172: Bespoke battle-recover Sound Cue, Recipe & Haptic", () => {
  it("emits battle-recover (and never battle-hit) when entering Recover result phase", () => {
    const base = makeState("plaza");
    const critter = world.critters["fountain-frog"];
    if (critter === undefined) throw new Error("missing fountain-frog critter");
    const started = startBattle(world, base, critter);

    const commandState: State = {
      ...base,
      battle: { ...started, phase: "command", command: "soothe", lastGrade: "great" },
    };
    const recoverResult: State = {
      ...base,
      battle: {
        ...started,
        phase: "result",
        command: "recover",
        lastGrade: "great",
        answered: false,
        energy: Math.min(critter.energyMax, started.energy + 1),
      },
    };
    const recoverCues = soundCues(commandState, recoverResult, world);
    expect(recoverCues).toContain("battle-recover");
    expect(recoverCues).not.toContain("battle-hit");

    // Non-recover result and burstResult transitions continue emitting battle-hit.
    const sootheResult: State = {
      ...base,
      battle: { ...started, phase: "result", command: "soothe", lastGrade: "great" },
    };
    expect(soundCues(commandState, sootheResult, world)).toContain("battle-hit");
    expect(soundCues(commandState, sootheResult, world)).not.toContain("battle-recover");

    const burstResult: State = {
      ...base,
      battle: { ...started, phase: "burstResult", command: "recover", lastGrade: "good" },
    };
    expect(soundCues(commandState, burstResult, world)).toContain("battle-hit");
    expect(soundCues(commandState, burstResult, world)).not.toContain("battle-recover");
  });

  it("defines a warm ascending leaf-breath triad recipe for battle-recover", () => {
    const recipe = audio.soundCueRecipe("battle-recover");
    expect(recipe).toBe(audioRecipes.soundCueRecipes["battle-recover"]);
    expect(recipeDuration(recipe)).toBeCloseTo(0.36, 2);

    const toneSegments = recipe.filter(
      (seg): seg is Exclude<audioRecipes.AudioSegment, { wave: "noise" }> => seg.wave !== "noise",
    );
    const freqs = toneSegments.map((seg) => seg.frequency);
    expect(freqs.slice(0, 4)).toEqual([523.25, 659.25, 783.99, 1046.5]);
    expect(toneSegments.some((seg) => seg.wave === "sine")).toBe(true);
    expect(toneSegments.some((seg) => seg.wave === "triangle")).toBe(true);
    for (const seg of recipe) {
      expect(seg.gain).toBeGreaterThan(0);
      expect(seg.gain).toBeLessThanOrEqual(0.08);
    }
  });

  it("maps battle-recover to a light haptic even with stale great lastGrade", () => {
    const commandBattle = makeBattle({ phase: "command", lastGrade: "great" });
    const recoverBattle = makeBattle({ phase: "result", command: "recover", lastGrade: "great" });
    expect(
      hapticForTick({ battle: commandBattle }, { battle: recoverBattle }, ["battle-recover"]),
    ).toBe("light");

    // Higher-priority cues still outrank battle-recover cleanly.
    const cues: readonly SoundCue[] = ["battle-recover", "level-up"];
    expect(hapticForTick({ battle: commandBattle }, { battle: recoverBattle }, cues)).toBe(
      "celebrate",
    );
  });
});

describe("Milestone 172: 31st OST Theme — Sunberry Road (road)", () => {
  it("lists 33 unique jukebox tracks with road right after hills", () => {
    expect(jukeboxTracks).toHaveLength(33);
    expect(new Set(jukeboxTracks).size).toBe(33);
    expect(jukeboxTracks.indexOf("road")).toBe(jukeboxTracks.indexOf("hills") + 1);
    expect(trackTitles.road).toBe("Sunberry Road");
    expect(scores.road).toBe(expansionScores.road);
  });

  it("composes road as a 104 BPM 16-bar 5-voice sunny F major country road stroll", () => {
    const score = scores.road;
    expect(score.bpm).toBe(104);
    expect(score.stepsPerBar).toBe(16);
    expect(score.bars).toBe(16);
    expect(score.tracks.map((track) => track.voice)).toEqual([
      "harp",
      "marimba",
      "flute",
      "bass",
      "shaker",
    ]);

    const totalSteps = score.stepsPerBar * score.bars;
    const uniquePitches = new Set<number>();
    for (const track of score.tracks) {
      expect(track.gain, `${track.voice} gain`).toBeGreaterThan(0);
      expect(track.gain, `${track.voice} gain`).toBeLessThanOrEqual(1);
      expect(track.notes.length, `${track.voice} notes`).toBeGreaterThan(0);
      for (const [step, midi, durationSteps, velocity] of track.notes) {
        expect(step, `${track.voice} step>=0`).toBeGreaterThanOrEqual(0);
        expect(step, `${track.voice} step<total`).toBeLessThan(totalSteps);
        expect(midi, `${track.voice} midi`).toBeGreaterThanOrEqual(24);
        expect(midi, `${track.voice} midi`).toBeLessThanOrEqual(108);
        expect(durationSteps, `${track.voice} dur>0`).toBeGreaterThan(0);
        expect(velocity, `${track.voice} vel>0`).toBeGreaterThan(0);
        expect(velocity, `${track.voice} vel<=1`).toBeLessThanOrEqual(1);
        uniquePitches.add(midi);
      }
    }
    expect(uniquePitches.size).toBeGreaterThanOrEqual(20);
  });

  it("wires F_MAJOR harmonic scale, East Road soundtrack routing, and bar-quantized resume", () => {
    expect(trackScaleNotes("road")).toEqual([349.23, 392.0, 440.0, 523.25, 587.33, 698.46]);
    expect(FRESH_START_TRACKS.has("road")).toBe(false);
    expect(resumeBarStep("road", 73, 256, 16)).toBe(64);
    expect(resumeBarStep("road", 140, 256, 16)).toBe(128);

    const laneState = makeState("lane");
    expect(soundtrackFor(world, laneState, { titleOpen: false })).toEqual({
      track: "road",
      ambience: "town-breeze",
      duck: false,
      title: "Sunberry Road",
    });

    const crossingState = makeState("crossing");
    expect(soundtrackFor(world, crossingState, { titleOpen: false })).toEqual({
      track: "road",
      ambience: "forest",
      duck: false,
      title: "Sunberry Road",
    });

    const boardwalkState = makeState("boardwalk");
    expect(soundtrackFor(world, boardwalkState, { titleOpen: false })).toEqual({
      track: "bay",
      ambience: "ocean",
      duck: false,
      title: "Bubblegum Breeze",
    });
  });

  it("keeps modified implementation modules well within strict file-length budgets", () => {
    const vfxStageLines = readFileSync("src/render/battle-vfx-stage.ts", "utf8").split("\n").length;
    const expansionLines = readFileSync("src/platform/scores-expansion.ts", "utf8").split("\n")
      .length;
    expect(vfxStageLines).toBeLessThan(900);
    expect(expansionLines).toBeLessThan(970);
    expect(plazaFixture.area).toBe("plaza");
  });
});
