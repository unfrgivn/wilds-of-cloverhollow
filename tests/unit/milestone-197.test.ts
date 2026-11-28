import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  jukeboxTracks,
  setInkVariables,
  soundtrackFor,
  startBattle,
  startEncoreBattle,
  trackTitles,
  type AreaPuzzleState,
  type State,
} from "../../src/core";
import { FRESH_START_TRACKS, resumeBarStep } from "../../src/platform/music";
import { battleTensionNotes, projectMusicMix, trackScaleMidi } from "../../src/platform/music-mix";
import { scores } from "../../src/platform/scores";
import { interiorScores } from "../../src/platform/scores-interiors";
import { trackScaleNotes } from "../../src/platform/voices";
import { hapticForTick } from "../../src/shell/feedback";
import { chunkGroups } from "../../vite.config";

const { world, fixtures } = loadContent();
const newGame = fixtures["new-game"];
if (newGame === undefined) throw new Error("Missing new-game fixture");
const baseState = createState(world, newGame);
const unlockedEncoreState: State = {
  ...baseState,
  ink: setInkVariables(baseState.ink, { milo_revealed: true }),
};

function routeModule(modulePath: string): string | null {
  const ordered = [...chunkGroups].sort((a, b) => b.priority - a.priority);
  const match = ordered.find((group) => group.test.test(modulePath));
  return match?.name ?? null;
}

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

describe("Milestone 195: 33rd OST Theme Starlight Encore! (encore)", () => {
  it("lists 33 unique jukebox tracks with encore right after boss", () => {
    expect(jukeboxTracks).toHaveLength(33);
    expect(new Set(jukeboxTracks).size).toBe(33);
    expect(jukeboxTracks.indexOf("encore")).toBe(jukeboxTracks.indexOf("boss") + 1);
    expect(trackTitles.encore).toBe("Starlight Encore!");
    expect(scores.encore).toBe(interiorScores.encore);
  });

  it("composes encore as a 132 BPM 4/4 16-bar 6-voice E minor / G major chamber remix", () => {
    const score = scores.encore;
    expect(score.bpm).toBe(132);
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
    expect(uniquePitches.size).toBeGreaterThanOrEqual(24);
  });

  it("aligns encore to G_MAJOR scale, FRESH_START_TRACKS, and vertical boss tension layers", () => {
    expect(trackScaleNotes("encore")).toEqual([392.0, 440.0, 493.88, 587.33, 659.25, 783.99]);
    expect(FRESH_START_TRACKS.has("encore")).toBe(true);
    expect(resumeBarStep("encore", 0, 256, 16)).toBe(0);
    expect(resumeBarStep("encore", 48, 256, 16)).toBe(0);
    expect(resumeBarStep("encore", 240, 256, 16)).toBe(0);

    const gullEncore = startEncoreBattle(world, unlockedEncoreState, "gull", ["windup-surge"]);
    expect(gullEncore.battle).not.toBeNull();
    if (gullEncore.battle === null) throw new Error("Expected encore battle");
    const gull = world.critters.gull;
    if (gull === undefined) throw new Error("Missing gull critter");

    const phase2State: State = {
      ...gullEncore,
      battle: {
        ...gullEncore.battle,
        phase: "command",
        calm: Math.ceil(gull.calmMax / 2),
      },
    };
    const mix = projectMusicMix(world, phase2State, {
      titleOpen: false,
      jukeboxActive: false,
      track: "encore",
      duck: false,
    });
    expect(mix.tensionLayer).toBe(true);

    const expectedEncoreBass = (trackScaleMidi("encore")[0] ?? 79) - 36;
    const bassSteps: number[] = [];
    for (let step = 0; step < 16; step += 1) {
      for (const note of battleTensionNotes("encore", step, 16, 0)) {
        if (note.voice === "bass") {
          bassSteps.push(step);
          expect(note.midi).toBe(expectedEncoreBass);
        }
      }
    }
    expect(bassSteps).toEqual([0, 8]);
  });

  it("routes Boss Encore battles to encore while preserving talk climax and regular boss", () => {
    const encoreState = startEncoreBattle(world, unlockedEncoreState, "gull", ["brisk-breeze"]);
    expect(soundtrackFor(world, encoreState, { titleOpen: false })).toEqual({
      track: "encore",
      ambience: "none",
      duck: false,
      title: "Starlight Encore!",
    });

    if (encoreState.battle === null) throw new Error("Expected encore battle");
    expect(
      soundtrackFor(
        world,
        { ...encoreState, battle: { ...encoreState.battle, phase: "reward" } },
        { titleOpen: false },
      ),
    ).toEqual({
      track: "encore",
      ambience: "none",
      duck: true,
      title: "Starlight Encore!",
    });
    expect(
      soundtrackFor(
        world,
        { ...encoreState, battle: { ...encoreState.battle, phase: "rest" } },
        { titleOpen: false },
      ),
    ).toEqual({
      track: "encore",
      ambience: "none",
      duck: true,
      title: "Starlight Encore!",
    });

    // Purple Hood Encore plays Starlight Encore! before Talk, then yields to Listening Heart!
    const hoodedEncore = startEncoreBattle(world, unlockedEncoreState, "hooded-kid", []);
    expect(soundtrackFor(world, hoodedEncore, { titleOpen: false }).track).toBe("encore");
    const hooded = world.critters["hooded-kid"];
    if (hooded?.talk === null || hooded?.talk === undefined || hoodedEncore.battle === null) {
      throw new Error("Missing hooded-kid talk config");
    }
    const talkClimax: State = {
      ...hoodedEncore,
      battle: { ...hoodedEncore.battle, calm: hooded.talk.talkAt },
    };
    expect(soundtrackFor(world, talkClimax, { titleOpen: false })).toEqual({
      track: "talk",
      ambience: "none",
      duck: false,
      title: "Listening Heart",
    });

    // Regular non-encore boss keeps "boss"; regular critter keeps "battle".
    const gull = world.critters.gull;
    const frog = world.critters["fountain-frog"];
    if (gull === undefined || frog === undefined) throw new Error("Missing gull/frog critters");
    const regularBoss: State = { ...baseState, battle: startBattle(world, baseState, gull) };
    expect(soundtrackFor(world, regularBoss, { titleOpen: false }).track).toBe("boss");

    const regularCritter: State = { ...baseState, battle: startBattle(world, baseState, frog) };
    expect(soundtrackFor(world, regularCritter, { titleOpen: false }).track).toBe("battle");
  });
});

describe("Milestone 195: Spatial Puzzle & Boss Encore Tactile Haptics", () => {
  const idle: { area: string; battle: null; puzzleArea?: AreaPuzzleState } = {
    area: "cavern",
    battle: null,
  };

  it("triggers celebrate haptic on spatial puzzle solve and new Boss Encore Star Trophy", () => {
    const solved: typeof idle = {
      ...idle,
      puzzleArea: { lastSolved: { id: "cavern-prism", tick: 42 } },
    };
    expect(hapticForTick(idle, solved, [])).toBe("celebrate");
    expect(hapticForTick(solved, solved, [])).toBeNull();

    // Simultaneous mirror rotation + puzzle solve prioritizes celebrate.
    const rotatedAndSolved: typeof idle = {
      ...idle,
      puzzleArea: {
        mirrors: { m1: "se" },
        lastSolved: { id: "cavern-prism", tick: 43 },
      },
    };
    expect(hapticForTick(idle, rotatedAndSolved, [])).toBe("celebrate");

    // Boss Encore Star Trophy earned triggers celebrate once.
    const beforeTrophy = {
      area: "enchanted",
      battle: null,
      encore: { bosses: {}, trophies: ["trophy-gull"] },
    };
    const afterTrophy = {
      area: "enchanted",
      battle: null,
      encore: { bosses: {}, trophies: ["trophy-gull", "trophy-owl"] },
    };
    expect(hapticForTick(beforeTrophy, afterTrophy, [])).toBe("celebrate");
    expect(hapticForTick(afterTrophy, afterTrophy, [])).toBeNull();
  });

  it("triggers light haptic on mirrors, plates, lasso grapple, and flute chime", () => {
    const rotated: typeof idle = { ...idle, puzzleArea: { mirrors: { m1: "se" } } };
    const rotatedAgain: typeof idle = { ...idle, puzzleArea: { mirrors: { m1: "sw" } } };
    expect(hapticForTick(idle, rotated, [])).toBe("light");
    expect(hapticForTick(rotated, rotated, [])).toBeNull();
    expect(hapticForTick(rotated, rotatedAgain, [])).toBe("light");

    const plateHeld: typeof idle = { ...idle, puzzleArea: { heldPlates: { p1: "maddie" } } };
    expect(hapticForTick(idle, plateHeld, [])).toBe("light");
    expect(hapticForTick(plateHeld, plateHeld, [])).toBeNull();
    expect(hapticForTick(plateHeld, idle, [])).toBe("light");

    const lassoArc: NonNullable<AreaPuzzleState["lasso"]> = {
      from: { x: 100, y: 100 },
      to: { x: 220, y: 100 },
      tick: 0,
      duration: 12,
      kind: "pull",
      targetId: "lever-1",
    };
    const lassoStart: typeof idle = {
      ...idle,
      puzzleArea: { lasso: lassoArc },
    };
    const lassoMid: typeof idle = {
      ...idle,
      puzzleArea: { lasso: { ...lassoArc, tick: 1 } },
    };
    expect(hapticForTick(idle, lassoStart, [])).toBe("light");
    expect(hapticForTick(lassoStart, lassoStart, [])).toBeNull();
    expect(hapticForTick(lassoStart, lassoMid, [])).toBeNull();

    const chime1: typeof idle = {
      ...idle,
      puzzleArea: { recentChime: { note: "up", tick: 15 } },
    };
    const chime2: typeof idle = {
      ...idle,
      puzzleArea: { recentChime: { note: "right", tick: 19 } },
    };
    expect(hapticForTick(idle, chime1, [])).toBe("light");
    expect(hapticForTick(chime1, chime1, [])).toBeNull();
    expect(hapticForTick(chime1, chime2, [])).toBe("light");

    // Area transition clearing puzzleArea never triggers a spurious haptic.
    expect(hapticForTick(plateHeld, { area: "pass", battle: null }, [])).toBeNull();
  });
});

describe("Milestone 195: Safari/iOS Tap Hygiene, Chunk Relief & File Budgets", () => {
  it("declares -webkit-touch-callout: none in encore-shrine.css and flute-wheel.css", () => {
    const encoreCss = readFileSync("src/ui/encore-shrine.css", "utf8");
    const fluteCss = readFileSync("src/ui/flute-wheel.css", "utf8");

    expect(encoreCss).toContain("-webkit-touch-callout: none;");
    expect(encoreCss.match(/-webkit-touch-callout:\s*none;/g)?.length ?? 0).toBeGreaterThanOrEqual(
      5,
    );
    expect(fluteCss).toContain("-webkit-touch-callout: none;");
    expect(fluteCss.match(/-webkit-touch-callout:\s*none;/g)?.length ?? 0).toBeGreaterThanOrEqual(
      3,
    );
  });

  it("routes critters/fixtures to critter-content and src/ui to ui-overlays", () => {
    const critterGroup = chunkGroups.find((item) => item.name === "critter-content");
    const uiGroup = chunkGroups.find((item) => item.name === "ui-overlays");
    const worldGroup = chunkGroups.find((item) => item.name === "world-content");

    expect(critterGroup?.priority).toBe(19);
    expect(uiGroup?.priority).toBe(17);
    expect(uiGroup?.includeDependenciesRecursively).toBe(false);
    expect(worldGroup?.includeDependenciesRecursively).toBe(false);

    expect(routeModule("/repo/content/critters/gull.json")).toBe("critter-content");
    expect(routeModule("/repo/content/fixtures/new-game.json")).toBe("critter-content");
    expect(routeModule("/repo/src/ui/encore-shrine.ts")).toBe("ui-overlays");
    expect(routeModule("/repo/src/ui/flute-wheel.ts")).toBe("ui-overlays");
    expect(routeModule("/repo/src/core/music.ts")).toBeNull();
    expect(routeModule("/repo/src/main.ts")).toBeNull();
  });

  it("keeps all modified implementation files strictly under 1,000 lines", () => {
    expect(lineCount("src/core/music.ts")).toBeLessThan(1000);
    expect(lineCount("src/platform/scores-interiors.ts")).toBeLessThan(1000);
    expect(lineCount("src/platform/scores.ts")).toBeLessThan(1000);
    expect(lineCount("src/platform/voices.ts")).toBeLessThan(1000);
    expect(lineCount("src/platform/music.ts")).toBeLessThan(1000);
    expect(lineCount("src/platform/music-mix.ts")).toBeLessThan(1000);
    expect(lineCount("src/shell/feedback.ts")).toBeLessThan(1000);
  });
});
