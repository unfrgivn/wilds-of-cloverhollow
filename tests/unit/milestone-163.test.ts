import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  jukeboxTracks,
  newTaco,
  soundtrackFor,
  trackTitles,
  type State,
} from "../../src/core";
import {
  defaultMinigameRecords,
  formatArcadeRecordPills,
  readMinigameRecords,
  recordMinigameResult,
  writeMinigameRecords,
  type MinigameKey,
  type MinigameRecords,
} from "../../src/platform/minigame-records";
import { FRESH_START_TRACKS, resumeBarStep } from "../../src/platform/music";
import { scores } from "../../src/platform/scores";
import { expansionScores } from "../../src/platform/scores-expansion";
import { trackScaleNotes } from "../../src/platform/voices";
import { resolveArcadeOutcome, type ArcadeRecordsStore } from "../../src/shell/feedback";

const content = loadContent();
const { world, fixtures } = content;
const newGame = fixtures["new-game"];
const sanctuaryFixture = fixtures.sanctuary;
const festivalFixture = fixtures.festival;
if (newGame === undefined || sanctuaryFixture === undefined || festivalFixture === undefined) {
  throw new Error("Missing expected fixtures (new-game, sanctuary, festival)");
}
const baseState = createState(world, newGame);

function makeMemoryRecords(
  initial: MinigameRecords = defaultMinigameRecords(),
): ArcadeRecordsStore {
  let records = { ...initial };
  return {
    bestOf: (game: MinigameKey) => records[game],
    submit: (game: MinigameKey, score: number) => {
      const result = recordMinigameResult(records, game, score);
      records = result.records;
      return { best: result.best, isNewBest: result.isNewBest };
    },
  };
}

describe("Milestone 163: 30th OST Theme — Cloverhollow Jubilee (festival)", () => {
  it("lists 30 unique jukebox tracks with festival right after sanctuary", () => {
    expect(jukeboxTracks).toHaveLength(30);
    expect(new Set(jukeboxTracks).size).toBe(30);
    expect(jukeboxTracks.indexOf("festival")).toBe(jukeboxTracks.indexOf("sanctuary") + 1);
    expect(trackTitles.festival).toBe("Cloverhollow Jubilee");
    expect(scores.festival).toBe(expansionScores.festival);
  });

  it(
    "composes festival as a 108 BPM 16-bar 6-voice D/G major jubilee with rich pitch variety",
    () => {
    const score = scores.festival;
    expect(score.bpm).toBe(108);
    expect(score.stepsPerBar).toBe(16);
    expect(score.bars).toBe(16);
    expect(score.tracks.map((track) => track.voice)).toEqual([
      "harp",
      "marimba",
      "flute",
      "celesta",
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

    // Keep src/platform/scores-expansion.ts cleanly under 900 lines.
    const expansionPath = resolve(process.cwd(), "src/platform/scores-expansion.ts");
    const lines = readFileSync(expansionPath, "utf8").split("\n").length;
    expect(lines).toBeLessThan(900);
  });

  it("aligns festival to D_MAJOR UI voice scale and bar-quantized resume", () => {
    expect(trackScaleNotes("festival")).toEqual([587.33, 659.25, 739.99, 880.0, 987.77, 1174.66]);
    expect(trackScaleNotes("festival")).toEqual(trackScaleNotes("sanctuary"));

    expect(FRESH_START_TRACKS.has("festival")).toBe(false);
    expect(resumeBarStep("festival", 0, 256, 16)).toBe(0);
    expect(resumeBarStep("festival", 39, 256, 16)).toBe(32);
    expect(resumeBarStep("festival", 175, 256, 16)).toBe(160);
    expect(resumeBarStep("festival", 256 + 19, 256, 16)).toBe(16);
  });

  it("routes pre-reveal sanctuary to sanctuary and post-reveal sanctuary to festival", () => {
    const preReveal = createState(world, sanctuaryFixture);
    expect(world.storyVariable(preReveal.ink, "milo_revealed")).toBe(false);
    expect(soundtrackFor(world, preReveal, { titleOpen: false })).toEqual({
      track: "sanctuary",
      ambience: "forest",
      duck: false,
      title: "Meadow of Friends",
    });

    const postReveal = createState(world, festivalFixture);
    expect(world.storyVariable(postReveal.ink, "milo_revealed")).toBe(true);
    expect(soundtrackFor(world, postReveal, { titleOpen: false })).toEqual({
      track: "festival",
      ambience: "forest",
      duck: false,
      title: "Cloverhollow Jubilee",
    });

    const postRevealDialogue: State = {
      ...postReveal,
      dialogue: {
        knot: "festival_milo",
        speaker: "Milo",
        text: "To Sunny Cloverhollow!",
        revealed: 22,
        choices: [],
        selected: 0,
        ended: false,
      },
    };
    expect(soundtrackFor(world, postRevealDialogue, { titleOpen: false })).toEqual({
      track: "festival",
      ambience: "forest",
      duck: true,
      title: "Cloverhollow Jubilee",
    });
  });
});

describe("Milestone 163: Taco Truck Personal Best & Journal Record Parity", () => {
  it("cleanly upgrades legacy 5-key Preferences JSON and persists taco high scores", () => {
    const legacy5Key = JSON.stringify({ skee: 220, mole: 14, comet: 18, fish: 5, cook: 2 });
    const upgraded = readMinigameRecords(legacy5Key);
    expect(upgraded).toEqual({ skee: 220, mole: 14, comet: 18, fish: 5, cook: 2, taco: 0 });
    expect(formatArcadeRecordPills(upgraded).some((pill) => pill.id === "taco")).toBe(false);

    const first = recordMinigameResult(upgraded, "taco", 195);
    expect(first).toEqual({
      records: { skee: 220, mole: 14, comet: 18, fish: 5, cook: 2, taco: 195 },
      best: 195,
      isNewBest: true,
    });

    const lower = recordMinigameResult(first.records, "taco", 140);
    expect(lower).toEqual({
      records: first.records,
      best: 195,
      isNewBest: false,
    });

    const roundTrip = readMinigameRecords(writeMinigameRecords(first.records));
    expect(roundTrip).toEqual(first.records);
    expect(formatArcadeRecordPills(roundTrip)).toEqual([
      { id: "skee", label: "Skee-Ball", value: "220" },
      { id: "mole", label: "Boop-a-Mole", value: "14 boops" },
      { id: "comet", label: "Comet Cruise", value: "18 stars" },
      { id: "fish", label: "Fishing Streak", value: "5" },
      { id: "cook", label: "Golden Dishes", value: "2" },
      { id: "taco", label: "Taco Truck", value: "195 pts" },
    ]);
  });

  it("submits Taco Truck scores on result transition and handles zero-score shifts cleanly", () => {
    const records = makeMemoryRecords();
    const [tacoBase] = newTaco(world.arcade.taco, baseState);
    const prevServing: State = { ...baseState, arcade: { ...tacoBase, phase: "serving" } };

    // Zero score with no prior best yields null badge and does not record 0.
    const zeroFirst: State = {
      ...baseState,
      arcade: { ...tacoBase, phase: "result", score: 0, served: 0 },
    };
    expect(resolveArcadeOutcome(world, prevServing, zeroFirst, false, records, 0)).toEqual({
      record: null,
      fishStreak: 0,
      goldenCooked: false,
    });
    expect(records.bestOf("taco")).toBe(0);

    // First non-zero shift sets NEW BEST!
    const clear195: State = {
      ...baseState,
      arcade: { ...tacoBase, phase: "result", score: 195, served: 3 },
    };
    const firstOut = resolveArcadeOutcome(world, prevServing, clear195, false, records, 0);
    expect(firstOut).toEqual({
      record: { best: 195, isNewBest: true },
      fishStreak: 0,
      goldenCooked: false,
    });
    expect(records.bestOf("taco")).toBe(195);

    // Staying in result phase keeps the active badge without re-submitting.
    expect(
      resolveArcadeOutcome(world, clear195, clear195, false, records, 0, firstOut.record),
    ).toEqual({
      record: { best: 195, isNewBest: true },
      fishStreak: 0,
      goldenCooked: false,
    });

    // Lower non-zero shift shows existing Best without isNewBest.
    const clear120: State = {
      ...baseState,
      arcade: { ...tacoBase, phase: "result", score: 120, served: 2 },
    };
    expect(resolveArcadeOutcome(world, prevServing, clear120, false, records, 0)).toEqual({
      record: { best: 195, isNewBest: false },
      fishStreak: 0,
      goldenCooked: false,
    });

    // Zero score after an existing best still surfaces non-new Best badge.
    expect(resolveArcadeOutcome(world, prevServing, zeroFirst, false, records, 0)).toEqual({
      record: { best: 195, isNewBest: false },
      fishStreak: 0,
      goldenCooked: false,
    });
  });
});
