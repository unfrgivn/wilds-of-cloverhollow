import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  JUKEBOX_ALBUM,
  jukeboxTracks,
  soundtrackFor,
  trackAlbumEntry,
  trackTitles,
  type MusicTrack,
  type State,
} from "../../src/core";
import { FRESH_START_TRACKS, resumeBarStep } from "../../src/platform/music";
import { scores } from "../../src/platform/scores";
import { schoolScores } from "../../src/platform/scores-school";
import { TRACK_SCALES } from "../../src/platform/voice-catalog";
import { trackScaleNotes } from "../../src/platform/voices";
import { chunkGroups } from "../../vite.config";

const content = loadContent();
const newGameFixture = content.fixtures["new-game"];
if (newGameFixture === undefined) throw new Error("Missing new-game fixture");
const baseState = createState(content.world, newGameFixture);

function routeModule(modulePath: string): string | null {
  const sorted = [...chunkGroups].sort((a, b) => b.priority - a.priority);
  for (const group of sorted) {
    if (group.test.test(modulePath)) return group.name;
  }
  return null;
}

describe("Milestone 225: Complete 35-Track OST — Music Room (melody) & Art Room (canvas)", () => {
  it("expands jukeboxTracks & JUKEBOX_ALBUM to 35 unique themes with scores & scales", () => {
    expect(jukeboxTracks).toHaveLength(35);
    expect(new Set(jukeboxTracks).size).toBe(35);
    expect(JUKEBOX_ALBUM).toHaveLength(35);
    expect(JUKEBOX_ALBUM.map((entry) => entry.track)).toEqual([...jukeboxTracks]);

    const schoolIdx = jukeboxTracks.indexOf("school");
    expect(jukeboxTracks.indexOf("melody")).toBe(schoolIdx + 1);
    expect(jukeboxTracks.indexOf("canvas")).toBe(schoolIdx + 2);

    expect(trackAlbumEntry("melody")).toEqual({
      track: "melody",
      number: schoolIdx + 2,
      title: "Ms. Willow's Recital",
      category: "interiors",
      region: "Music Room",
      mood: "Sparkling 3/4 piano, flute & celesta recital",
      accent: "#b596e8",
    });
    expect(trackAlbumEntry("canvas")).toEqual({
      track: "canvas",
      number: schoolIdx + 3,
      title: "Skylight Watercolor",
      category: "interiors",
      region: "Art Room",
      mood: "Dreamy sunlit harp & pastel studio wash",
      accent: "#f0a4bc",
    });

    const seenTitles = new Set<string>();
    for (const id of jukeboxTracks) {
      const title = trackTitles[id].trim();
      expect(title.length, `${id} title`).toBeGreaterThan(0);
      seenTitles.add(title);

      const score = scores[id];
      expect(score.bpm, `${id} bpm`).toBeGreaterThanOrEqual(60);
      expect(score.bpm, `${id} bpm`).toBeLessThanOrEqual(160);
      expect(score.tracks.length, `${id} voices`).toBeGreaterThanOrEqual(2);

      const uniquePitches = new Set(
        score.tracks.flatMap((track) => track.notes.map(([, midi]) => midi)),
      );
      expect(uniquePitches.size, `${id} pitch variety`).toBeGreaterThanOrEqual(8);

      const scale = TRACK_SCALES[id];
      expect(scale.length, `${id} scale length`).toBe(6);
      expect(trackScaleNotes(id)).toBe(scale);
    }
    expect(seenTitles.size).toBe(35);

    // Exhaustive harmonic scale coverage across all 36 MusicTrack values (35 playable + silent).
    const allTracks: readonly MusicTrack[] = [...jukeboxTracks, "silent"];
    expect(Object.keys(TRACK_SCALES).sort()).toEqual([...allTracks].sort());
    expect(trackScaleNotes("melody")).toEqual([523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]);
    expect(trackScaleNotes("canvas")).toEqual([349.23, 392.0, 440.0, 523.25, 587.33, 698.46]);
  });

  it("composes melody (3/4 C major) and canvas (4/4 F major) as 16-bar 5-voice scores", () => {
    expect(scores.melody).toBe(schoolScores.melody);
    expect(scores.canvas).toBe(schoolScores.canvas);
    expect(Object.keys(schoolScores).sort()).toEqual(["canvas", "melody"]);

    expect(schoolScores.melody.bpm).toBe(96);
    expect(schoolScores.melody.stepsPerBar).toBe(12);
    expect(schoolScores.melody.bars).toBe(16);
    expect(schoolScores.melody.tracks.map((track) => track.voice)).toEqual([
      "piano",
      "flute",
      "celesta",
      "harp",
      "bass",
    ]);

    expect(schoolScores.canvas.bpm).toBe(88);
    expect(schoolScores.canvas.stepsPerBar).toBe(16);
    expect(schoolScores.canvas.bars).toBe(16);
    expect(schoolScores.canvas.tracks.map((track) => track.voice)).toEqual([
      "harp",
      "celesta",
      "flute",
      "pad",
      "bass",
    ]);

    for (const [id, score] of [
      ["melody", schoolScores.melody],
      ["canvas", schoolScores.canvas],
    ] as const) {
      const totalSteps = score.stepsPerBar * score.bars;
      const uniquePitches = new Set<number>();
      for (const track of score.tracks) {
        expect(track.gain, `${id}:${track.voice} gain`).toBeGreaterThan(0);
        expect(track.gain, `${id}:${track.voice} gain`).toBeLessThanOrEqual(1);
        expect(track.notes.length, `${id}:${track.voice} notes`).toBeGreaterThanOrEqual(16);
        for (const [step, midi, dur, vel] of track.notes) {
          expect(step, `${id}:${track.voice} step >= 0`).toBeGreaterThanOrEqual(0);
          expect(step, `${id}:${track.voice} step < total`).toBeLessThan(totalSteps);
          expect(dur, `${id}:${track.voice} dur > 0`).toBeGreaterThan(0);
          expect(midi, `${id}:${track.voice} midi`).toBeGreaterThanOrEqual(36);
          expect(midi, `${id}:${track.voice} midi`).toBeLessThanOrEqual(96);
          expect(vel, `${id}:${track.voice} vel`).toBeGreaterThan(0);
          expect(vel, `${id}:${track.voice} vel`).toBeLessThanOrEqual(1);
          uniquePitches.add(midi);
        }
      }
      expect(uniquePitches.size, `${id} rich pitch variety`).toBeGreaterThanOrEqual(18);
    }
  });

  it("routes music -> melody and art-room -> canvas while keeping other school rooms on school",
    () => {
    const expected: Record<string, readonly [MusicTrack, string, string]> = {
      music: ["melody", "Ms. Willow's Recital", "none"],
      "art-room": ["canvas", "Skylight Watercolor", "none"],
      school: ["school", "Bell & Chalk", "none"],
      classroom: ["school", "Bell & Chalk", "none"],
      gym: ["school", "Bell & Chalk", "none"],
      "east-hall": ["school", "Bell & Chalk", "none"],
      field: ["school", "Bell & Chalk", "town-breeze"],
    };

    for (const [area, [track, title, ambience]] of Object.entries(expected)) {
      const state: State = { ...baseState, area };
      expect(soundtrackFor(content.world, state, { titleOpen: false }), area).toEqual({
        track,
        title,
        ambience,
        duck: false,
      });
    }
  });

  it("resumes melody (3/4, 12 steps/bar) and canvas (4/4, 16 steps/bar) on bar downbeats", () => {
    expect(FRESH_START_TRACKS.has("melody")).toBe(false);
    expect(FRESH_START_TRACKS.has("canvas")).toBe(false);

    const melodyTotal = scores.melody.stepsPerBar * scores.melody.bars;
    expect(melodyTotal).toBe(192);
    expect(resumeBarStep("melody", 0, melodyTotal, 12)).toBe(0);
    expect(resumeBarStep("melody", 19, melodyTotal, 12)).toBe(12);
    expect(resumeBarStep("melody", 59, melodyTotal, 12)).toBe(48);
    expect(resumeBarStep("melody", 195, melodyTotal, 12)).toBe(0);

    const canvasTotal = scores.canvas.stepsPerBar * scores.canvas.bars;
    expect(canvasTotal).toBe(256);
    expect(resumeBarStep("canvas", 0, canvasTotal, 16)).toBe(0);
    expect(resumeBarStep("canvas", 27, canvasTotal, 16)).toBe(16);
    expect(resumeBarStep("canvas", 95, canvasTotal, 16)).toBe(80);
    expect(resumeBarStep("canvas", 262, canvasTotal, 16)).toBe(0);
  });

  it("routes src/platform/scores-school.ts into audio-scores and stays under 340 lines", () => {
    expect(routeModule("/repo/src/platform/scores-school.ts")).toBe("audio-scores");
    const lines = readFileSync("src/platform/scores-school.ts", "utf8")
      .trimEnd()
      .split("\n").length;
    expect(lines, `scores-school.ts (${lines} lines) must stay < 340`).toBeLessThan(340);
  });
});
