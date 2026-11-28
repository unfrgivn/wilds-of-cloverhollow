import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  HEART_TO_HEARTS,
  heartToHeartMeta,
  jukeboxTracks,
  setInkVariables,
  soundtrackFor,
  trackTitles,
  type AmbienceBed,
  type HeartToHeartId,
  type State,
} from "../../src/core";
import { FRESH_START_TRACKS, resumeBarStep } from "../../src/platform/music";
import { scores } from "../../src/platform/scores";
import { interiorScores } from "../../src/platform/scores-interiors";
import { trackScaleNotes } from "../../src/platform/voices";
import { buildJournalView } from "../../src/shell/view-models";
import { heartEmblemMarkup, type HeartEmblemState } from "../../src/ui/journal-hearts";
import { stripComments } from "../../tools/purity";

const { world, fixtures } = loadContent();
const newGame = fixtures["new-game"];
if (newGame === undefined) throw new Error("Missing new-game fixture");
const baseState = createState(world, newGame);

function withDialogue(area: string, knot: string, vars?: Record<string, boolean>): State {
  const ink = vars === undefined ? baseState.ink : setInkVariables(baseState.ink, vars);
  return {
    ...baseState,
    area,
    ink,
    dialogue: {
      knot,
      speaker: "Fae",
      text: "Heart-to-Heart moment.",
      revealed: 22,
      choices: [],
      selected: 0,
      ended: false,
    },
  };
}

describe("Milestone 191: 32nd OST Theme Warm Hearth Hearts (hearts)", () => {
  it("lists 32 unique jukebox tracks with hearts right after talk", () => {
    expect(jukeboxTracks).toHaveLength(32);
    expect(new Set(jukeboxTracks).size).toBe(32);
    expect(jukeboxTracks.indexOf("hearts")).toBe(jukeboxTracks.indexOf("talk") + 1);
    expect(trackTitles.hearts).toBe("Warm Hearth Hearts");
    expect(scores.hearts).toBe(interiorScores.hearts);
  });

  it("composes hearts as an 84 BPM 3/4 16-bar 5-voice Eb major chamber waltz", () => {
    const score = scores.hearts;
    expect(score.bpm).toBe(84);
    expect(score.stepsPerBar).toBe(12);
    expect(score.bars).toBe(16);
    expect(score.tracks.map((track) => track.voice)).toEqual([
      "harp",
      "piano",
      "flute",
      "celesta",
      "pad",
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

  it("aligns hearts to EB_MAJOR_WARM scale and FRESH_START_TRACKS bar-1 starts", () => {
    expect(trackScaleNotes("hearts")).toEqual([311.13, 349.23, 392.0, 466.16, 523.25, 622.25]);
    expect(FRESH_START_TRACKS.has("hearts")).toBe(true);
    expect(resumeBarStep("hearts", 0, 192, 12)).toBe(0);
    expect(resumeBarStep("hearts", 48, 192, 12)).toBe(0);
    expect(resumeBarStep("hearts", 175, 192, 12)).toBe(0);
  });

  it("routes all 6 h2h_* knots to ducked hearts while preserving area ambience", () => {
    const cases: readonly (readonly [string, string, AmbienceBed])[] = [
      ["bedroom", "h2h_fae_maddie", "none"],
      ["park", "h2h_fae_maddie", "town-breeze"],
      ["bay", "h2h_fae_sue", "ocean"],
      ["pass", "h2h_fae_jordan", "mountain-wind"],
      ["cafe", "h2h_sue_jordan", "cafe-murmur"],
      ["clubhouse", "h2h_clubhouse_trio", "none"],
      ["sanctuary", "h2h_sanctuary_encore", "forest"],
    ];

    for (const [area, knot, expectedAmbience] of cases) {
      expect(
        soundtrackFor(world, withDialogue(area, knot), { titleOpen: false }),
        `${area}:${knot}`,
      ).toEqual({
        track: "hearts",
        ambience: expectedAmbience,
        duck: true,
        title: "Warm Hearth Hearts",
      });
    }

    // Non-h2h dialogue keeps the normal area theme cleanly.
    expect(
      soundtrackFor(world, withDialogue("cafe", "chef_bea"), { titleOpen: false }),
    ).toEqual({
      track: "cafe",
      ambience: "cafe-murmur",
      duck: true,
      title: "Cinnamon Waltz",
    });
    expect(
      soundtrackFor(
        world,
        withDialogue("sanctuary", "fern", { milo_revealed: true }),
        { titleOpen: false },
      ),
    ).toEqual({
      track: "festival",
      ambience: "forest",
      duck: true,
      title: "Cloverhollow Jubilee",
    });
  });
});

describe("Milestone 191: Heart-to-Heart Scrapbook Metadata, View Model & SVG Hygiene", () => {
  it("provides complete metadata for all 6 Heart-to-Hearts with §1.2 Milo secrecy", () => {
    const ids: readonly HeartToHeartId[] = HEART_TO_HEARTS.map((spec) => spec.id);
    expect(ids).toHaveLength(6);

    for (const id of ids) {
      const meta = heartToHeartMeta(id);
      expect(meta.participantsLabel.trim().length, `${id} participants`).toBeGreaterThan(0);
      expect(meta.locationLabel.trim().length, `${id} location`).toBeGreaterThan(0);
      expect(meta.accent, `${id} accent`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(meta.unlockHint.trim().length, `${id} unlockHint`).toBeGreaterThan(0);
      expect(meta.memoryNote.trim().length, `${id} memoryNote`).toBeGreaterThan(0);
      expect(meta.pinLabel.trim().length, `${id} pinLabel`).toBeGreaterThan(0);
      expect(meta.unlockHint, `${id} locked hint no Milo`).not.toMatch(/milo/i);
      expect(meta.participantsLabel, `${id} default participants no Milo`).not.toMatch(/milo/i);
    }

    const lockedEncore = heartToHeartMeta("sanctuary-encore");
    expect(lockedEncore.participantsLabel).toBe("Whole Crew");
    expect(lockedEncore.unlockHint).toBe(
      "Calm the Enchanted Forest to gather everyone at the Wildlife Sanctuary.",
    );
    expect(lockedEncore.memoryNote).not.toMatch(/milo/i);
    expect(lockedEncore.pinLabel).not.toMatch(/milo/i);

    const revealedEncore = heartToHeartMeta("sanctuary-encore", true);
    expect(revealedEncore.participantsLabel).toContain("Milo");
    expect(revealedEncore.unlockHint).not.toMatch(/milo/i);
  });

  it("populates heartToHearts in buildJournalView only when the Journal is open", () => {
    const sharedParams = {
      world,
      mapCentres: {},
      art: {
        stickerArt: () => null,
        prizeArt: () => null,
        fishArt: () => null,
      },
      notes: [],
      muted: false,
      level: 0.75 as const,
      musicMuted: false,
      musicLevel: 0.75 as const,
      ambienceMuted: false,
      nowPlaying: "Cloverhollow Town",
      gentleTiming: false,
      keyHints: false,
      textSpeed: "cozy" as const,
      reducedMotion: false,
      hasLantern: false,
      hasFlute: false,
      hasLasso: false,
    };

    const closed = buildJournalView({
      ...sharedParams,
      state: { ...baseState, journalOpen: false },
    });
    expect(closed.heartToHearts).toBeUndefined();

    const midInk = setInkVariables(baseState.ink, {
      ate_breakfast: true,
      h2h_fae_maddie_done: true,
      sue_joined: true,
      bluebird_calmed: true,
    });
    const open = buildJournalView({
      ...sharedParams,
      state: { ...baseState, ink: midInk, journalOpen: true },
    });
    expect(open.heartToHearts).toBeDefined();
    expect(open.heartToHearts?.total).toBe(6);
    expect(open.heartToHearts?.completed).toBe(1);
    expect(open.heartToHearts?.entries.find((e) => e.id === "fae-maddie")?.completed).toBe(true);
    expect(open.heartToHearts?.entries.find((e) => e.id === "fae-sue")?.unlocked).toBe(true);
    expect(open.heartToHearts?.entries.find((e) => e.id === "sanctuary-encore")?.unlocked).toBe(
      false,
    );
  });

  it("emits zero SVG <text> nodes and honors modular file line budgets", () => {
    const states: readonly HeartEmblemState[] = ["done", "ready", "locked"];
    for (const state of states) {
      const markup = heartEmblemMarkup(state, "#e58963");
      expect(markup).toContain("<path");
      expect(markup).not.toMatch(/<text\b/i);
    }

    const heartsSource = stripComments(readFileSync("src/ui/journal-hearts.ts", "utf8"));
    expect(heartsSource).not.toMatch(/<text\b/i);

    const lineCount = (file: string): number =>
      readFileSync(file, "utf8").trimEnd().split("\n").length;
    expect(lineCount("src/ui/journal-hearts.ts")).toBeLessThan(260);
    expect(lineCount("src/core/heart-to-hearts.ts")).toBeLessThan(380);
    expect(lineCount("src/platform/scores-interiors.ts")).toBeLessThan(720);
    expect(lineCount("src/ui/journal-field-note.ts")).toBeLessThan(650);
  });
});
