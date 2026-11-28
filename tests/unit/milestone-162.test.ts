import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  jukeboxTracks,
  openArcade,
  soundtrackFor,
  trackTitles,
  type State,
} from "../../src/core";
import { FRESH_START_TRACKS, resumeBarStep } from "../../src/platform/music";
import { scores } from "../../src/platform/scores";
import { expansionScores } from "../../src/platform/scores-expansion";
import { trackScaleNotes } from "../../src/platform/voices";
import { chunkGroups } from "../../vite.config";

const content = loadContent();
const newGame = content.fixtures["new-game"];
if (newGame === undefined) throw new Error("Missing new-game fixture");
const baseState = createState(content.world, newGame);

function routeModule(modulePath: string): string | null {
  const ordered = [...chunkGroups].sort((a, b) => b.priority - a.priority);
  const match = ordered.find((group) => group.test.test(modulePath));
  return match?.name ?? null;
}

describe("Milestone 160: Complete 30-Track Expansion World Soundtrack", () => {
  it("lists all 30 unique jukebox tracks in album order with titles, scores, and scales", () => {
    expect(jukeboxTracks).toHaveLength(30);
    expect(new Set(jukeboxTracks).size).toBe(30);

    expect(jukeboxTracks.indexOf("loft")).toBe(jukeboxTracks.indexOf("parlor") + 1);
    expect(jukeboxTracks.indexOf("bloom")).toBe(jukeboxTracks.indexOf("loft") + 1);
    expect(jukeboxTracks.indexOf("island")).toBe(jukeboxTracks.indexOf("cottage") + 1);
    expect(jukeboxTracks.indexOf("summit")).toBe(jukeboxTracks.indexOf("cabin") + 1);
    expect(jukeboxTracks.indexOf("taco")).toBe(jukeboxTracks.indexOf("arcade") + 1);

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

      const scale = trackScaleNotes(id);
      expect(scale.length, `${id} scale length`).toBeGreaterThanOrEqual(5);
      for (let i = 1; i < scale.length; i += 1) {
        expect(scale[i] ?? 0, `${id} ascending scale`).toBeGreaterThan(scale[i - 1] ?? 0);
      }
    }
    expect(seenTitles.size).toBe(30);
  });

  it("gives loft, bloom, island, summit, and taco bespoke 16-bar chamber scores", () => {
    expect(Object.keys(expansionScores).sort()).toEqual([
      "bloom",
      "festival",
      "island",
      "loft",
      "summit",
      "taco",
    ]);

    const expected = [
      { id: "loft", bpm: 96, stepsPerBar: 16, bars: 16, minVoices: 5 },
      { id: "bloom", bpm: 94, stepsPerBar: 12, bars: 16, minVoices: 5 },
      { id: "island", bpm: 86, stepsPerBar: 16, bars: 16, minVoices: 5 },
      { id: "summit", bpm: 90, stepsPerBar: 12, bars: 16, minVoices: 5 },
      { id: "taco", bpm: 120, stepsPerBar: 16, bars: 16, minVoices: 5 },
    ] as const;

    for (const spec of expected) {
      const score = scores[spec.id];
      expect(score, `${spec.id} wired from expansionScores`).toBe(expansionScores[spec.id]);
      expect(score.bpm, `${spec.id} bpm`).toBe(spec.bpm);
      expect(score.stepsPerBar, `${spec.id} stepsPerBar`).toBe(spec.stepsPerBar);
      expect(score.bars, `${spec.id} bars`).toBe(spec.bars);
      expect(score.tracks.length, `${spec.id} voices`).toBeGreaterThanOrEqual(spec.minVoices);

      const uniquePitches = new Set(
        score.tracks.flatMap((track) => track.notes.map(([, midi]) => midi)),
      );
      expect(uniquePitches.size, `${spec.id} rich pitch variety`).toBeGreaterThanOrEqual(16);

      const totalSteps = score.stepsPerBar * score.bars;
      for (const track of score.tracks) {
        expect(track.gain, `${spec.id}/${track.voice} gain`).toBeGreaterThan(0);
        expect(track.gain, `${spec.id}/${track.voice} gain`).toBeLessThanOrEqual(1);
        expect(track.notes.length, `${spec.id}/${track.voice} notes`).toBeGreaterThan(0);
        for (const [step, midi, durationSteps, velocity] of track.notes) {
          expect(step, `${spec.id}/${track.voice} step>=0`).toBeGreaterThanOrEqual(0);
          expect(step, `${spec.id}/${track.voice} step<total`).toBeLessThan(totalSteps);
          expect(midi, `${spec.id}/${track.voice} midi`).toBeGreaterThanOrEqual(24);
          expect(midi, `${spec.id}/${track.voice} midi`).toBeLessThanOrEqual(108);
          expect(durationSteps, `${spec.id}/${track.voice} dur>0`).toBeGreaterThan(0);
          expect(velocity, `${spec.id}/${track.voice} vel>0`).toBeGreaterThan(0);
          expect(velocity, `${spec.id}/${track.voice} vel<=1`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("routes milo-house, rosie-cottage, island, summit, and taco minigame cleanly", () => {
    const areaCases: readonly (readonly [string, string, string, string])[] = [
      ["milo-house", "loft", "Paper Plane Sketchbook", "none"],
      ["rosie-cottage", "bloom", "Rosie's Flower Window", "none"],
      ["island", "island", "Starlight Beacon", "ocean"],
      ["summit", "summit", "Above the Pines", "mountain-wind"],
    ];
    for (const [area, track, title, ambience] of areaCases) {
      const state: State = { ...baseState, area };
      expect(soundtrackFor(content.world, state, { titleOpen: false }), area).toEqual({
        track,
        ambience,
        duck: false,
        title,
      });
    }

    const tacoState = openArcade(content.world, { ...baseState, area: "hills" }, "taco", 0);
    expect(tacoState.arcade?.game).toBe("taco");
    expect(soundtrackFor(content.world, tacoState, { titleOpen: false })).toEqual({
      track: "taco",
      ambience: "town-breeze",
      duck: false,
      title: "Mateo's Fiesta Truck",
    });

    const tacoWithDialogue: State = {
      ...tacoState,
      dialogue: {
        knot: "taco_chef_calm",
        speaker: "Chef Mateo",
        text: "Order up!",
        revealed: 9,
        choices: [],
        selected: 0,
        ended: false,
      },
    };
    expect(soundtrackFor(content.world, tacoWithDialogue, { titleOpen: false })).toEqual({
      track: "taco",
      ambience: "town-breeze",
      duck: true,
      title: "Mateo's Fiesta Truck",
    });
  });

  it("aligns voice scales for all 5 expansion tracks and fresh-starts taco on bar 1", () => {
    expect(trackScaleNotes("loft")).toEqual([523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]);
    expect(trackScaleNotes("bloom")).toEqual([349.23, 392.0, 440.0, 523.25, 587.33, 698.46]);
    expect(trackScaleNotes("island")).toEqual([587.33, 659.25, 739.99, 880.0, 987.77, 1174.66]);
    expect(trackScaleNotes("summit")).toEqual([392.0, 440.0, 493.88, 587.33, 659.25, 783.99]);
    expect(trackScaleNotes("taco")).toEqual([440.0, 493.88, 554.37, 659.25, 739.99, 880.0]);

    expect(FRESH_START_TRACKS.has("taco")).toBe(true);
    expect(resumeBarStep("taco", 73, 256, 16)).toBe(0);
    expect(FRESH_START_TRACKS.has("loft")).toBe(false);
    expect(FRESH_START_TRACKS.has("bloom")).toBe(false);
    expect(FRESH_START_TRACKS.has("island")).toBe(false);
    expect(FRESH_START_TRACKS.has("summit")).toBe(false);

    expect(resumeBarStep("loft", 39, 256, 16)).toBe(32);
    expect(resumeBarStep("island", 145, 256, 16)).toBe(144);
    expect(resumeBarStep("bloom", 29, 192, 12)).toBe(24);
    expect(resumeBarStep("summit", 191, 192, 12)).toBe(180);
  });

  it("keeps src/platform/scores-expansion.ts under 900 lines and routed into audio-scores", () => {
    const filePath = resolve(process.cwd(), "src/platform/scores-expansion.ts");
    const lines = readFileSync(filePath, "utf8").split("\n").length;
    expect(lines).toBeGreaterThan(100);
    expect(lines).toBeLessThan(900);

    expect(routeModule("/repo/src/platform/scores-expansion.ts")).toBe("audio-scores");
  });
});
