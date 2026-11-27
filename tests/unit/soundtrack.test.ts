import { describe, expect, test } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  jukeboxTracks,
  soundtrackFor,
  trackTitles,
  type AmbienceBed,
  type Battle,
  type MusicTrack,
  type State,
} from "../../src/core";
import {
  DEFAULT_AUDIO_LEVEL,
  DEFAULT_MUSIC_LEVEL,
  gainForAmbienceLevel,
  gainForMusicLevel,
  readAudioPreferences,
  writeAudioPreferences,
} from "../../src/platform/audio-settings";
import { scores, type PlayableTrack } from "../../src/platform/scores";
import { trackScaleNotes } from "../../src/platform/voices";

const content = loadContent();
const newGame = content.fixtures["new-game"];
if (newGame === undefined) throw new Error("Missing new-game fixture");
const baseState = createState(content.world, newGame);

function makeBattle(critterId: string, overrides: Partial<Battle> = {}): Battle {
  return {
    critterId,
    den: null,
    entry: { x: 100, y: 100 },
    phase: "command",
    message: "",
    revealed: 0,
    selected: 0,
    command: null,
    energy: 5,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    rewardSticker: null,
    phaseTicks: 0,
    ...overrides,
  };
}

describe("soundtrackFor", () => {
  test("selects title theme when title screen is open", () => {
    const result = soundtrackFor(content.world, baseState, { titleOpen: true });
    expect(result).toEqual({
      track: "title",
      ambience: "none",
      duck: false,
      title: "Watercolor Morning",
    });
  });

  test("maps every area to its cozy theme and ambience bed", () => {
    const expected: Record<string, readonly [MusicTrack, AmbienceBed]> = {
      bedroom: ["home", "none"],
      kitchen: ["home", "none"],
      plaza: ["home", "town-breeze"],
      cafe: ["cafe", "cafe-murmur"],
      market: ["home", "cafe-murmur"],
      parlor: ["cafe", "cafe-murmur"],
      park: ["home", "town-breeze"],
      hills: ["hills", "town-breeze"],
      sanctuary: ["sanctuary", "forest"],
      school: ["school", "none"],
      "east-hall": ["school", "none"],
      classroom: ["school", "none"],
      gym: ["school", "none"],
      music: ["school", "none"],
      "art-room": ["school", "none"],
      field: ["school", "town-breeze"],
      bay: ["bay", "ocean"],
      "sue-cottage": ["bay", "ocean"],
      trail: ["bay", "ocean"],
      pass: ["pass", "mountain-wind"],
      lodge: ["lodge", "hearth"],
      "jordan-cabin": ["pass", "hearth"],
      cavern: ["cavern", "cavern-drips"],
      woods: ["woods", "forest"],
      clubhouse: ["clubhouse", "none"],
      arcade: ["arcade", "arcade-hum"],
      mist: ["enchanted", "enchanted-shimmer"],
      harness: ["silent", "none"],
    };
    for (const [area, [track, ambience]] of Object.entries(expected)) {
      const state: State = { ...baseState, area };
      const result = soundtrackFor(content.world, state, { titleOpen: false });
      expect(result, area).toEqual({
        track,
        ambience,
        duck: false,
        title: trackTitles[track],
      });
    }
  });

  test("switches enchanted forest theme when forest_fizzy clears", () => {
    const fizzyWorld = {
      ...content.world,
      storyVariable: (_ink: string, name: string) => (name === "forest_fizzy" ? true : undefined),
    };
    const calmWorld = {
      ...content.world,
      storyVariable: (_ink: string, name: string) => (name === "forest_fizzy" ? false : undefined),
    };
    const state: State = { ...baseState, area: "enchanted" };
    expect(soundtrackFor(fizzyWorld, state, { titleOpen: false })).toEqual({
      track: "enchanted",
      ambience: "enchanted-shimmer",
      duck: false,
      title: "Misty Dream",
    });
    expect(soundtrackFor(calmWorld, state, { titleOpen: false })).toEqual({
      track: "enchanted-calm",
      ambience: "enchanted-shimmer",
      duck: false,
      title: "Ancient Tree's Song",
    });
  });

  test("falls back to area land when area id is not in the explicit table", () => {
    const customAreas = {
      ...content.world.areas,
      "custom-bay": { ...content.world.areas.bay!, id: "custom-bay", land: "bay" },
      "custom-pass": { ...content.world.areas.pass!, id: "custom-pass", land: "pass" },
      "custom-hills": { ...content.world.areas.hills!, id: "custom-hills", land: "hills" },
      "custom-forest": { ...content.world.areas.woods!, id: "custom-forest", land: "forest" },
      "custom-unknown": { ...content.world.areas.plaza!, id: "custom-unknown", land: undefined },
    };
    const world = { ...content.world, areas: customAreas };
    expect(soundtrackFor(world, { ...baseState, area: "custom-bay" }, { titleOpen: false }).track)
      .toBe("bay");
    expect(soundtrackFor(world, { ...baseState, area: "custom-pass" }, { titleOpen: false }).track)
      .toBe("pass");
    expect(soundtrackFor(world, { ...baseState, area: "custom-hills" }, { titleOpen: false }).track)
      .toBe("hills");
    expect(soundtrackFor(world, { ...baseState, area: "custom-forest" }, { titleOpen: false })
      .track).toBe("woods");
    expect(soundtrackFor(world, { ...baseState, area: "custom-unknown" }, { titleOpen: false })
      .track).toBe("home");
  });

  test("selects battle, boss, and talk tracks and ducks on reward", () => {
    const ordinary: State = {
      ...baseState,
      area: "plaza",
      battle: makeBattle("fountain-frog"),
    };
    expect(soundtrackFor(content.world, ordinary, { titleOpen: false })).toEqual({
      track: "battle",
      ambience: "none",
      duck: false,
      title: "Fizzy Calm-Down!",
    });
    const reward: State = {
      ...ordinary,
      battle: makeBattle("fountain-frog", { phase: "reward" }),
    };
    expect(soundtrackFor(content.world, reward, { titleOpen: false }).duck).toBe(true);

    const miniBoss: State = {
      ...baseState,
      area: "trail",
      battle: makeBattle("gull"),
    };
    expect(soundtrackFor(content.world, miniBoss, { titleOpen: false })).toEqual({
      track: "boss",
      ambience: "none",
      duck: false,
      title: "The Purple Hood",
    });

    const hoodedPreTalk: State = {
      ...baseState,
      area: "enchanted",
      battle: makeBattle("hooded-kid", { calm: 50, talk: null }),
    };
    expect(soundtrackFor(content.world, hoodedPreTalk, { titleOpen: false }).track).toBe("boss");

    const hoodedAtTalk: State = {
      ...baseState,
      area: "enchanted",
      battle: makeBattle("hooded-kid", { calm: 100, talk: null }),
    };
    expect(soundtrackFor(content.world, hoodedAtTalk, { titleOpen: false })).toEqual({
      track: "talk",
      ambience: "none",
      duck: false,
      title: "Listening Heart",
    });

    const hoodedTalkOpen: State = {
      ...baseState,
      area: "enchanted",
      battle: makeBattle("hooded-kid", {
        calm: 20,
        talk: {
          knot: "kid_talk_1",
          turn: 0,
          speaker: "Hooded Kid",
          text: "...",
          revealed: 3,
          choices: [],
          selected: 0,
          ended: false,
          grade: null,
        },
      }),
    };
    expect(soundtrackFor(content.world, hoodedTalkOpen, { titleOpen: false }).track).toBe("talk");
  });

  test("handles morning finale, credits, and overworld ducking", () => {
    const morningBedroom: State = { ...baseState, area: "bedroom", finale: "morning" };
    expect(soundtrackFor(content.world, morningBedroom, { titleOpen: false })).toEqual({
      track: "morning",
      ambience: "town-breeze",
      duck: false,
      title: "Waking Up",
    });
    const morningKitchen: State = {
      ...baseState,
      area: "kitchen",
      finale: "morning",
      dialogue: {
        knot: "mom",
        speaker: "Mom",
        text: "Good morning!",
        revealed: 13,
        choices: [],
        selected: 0,
        ended: false,
      },
    };
    expect(soundtrackFor(content.world, morningKitchen, { titleOpen: false })).toEqual({
      track: "morning",
      ambience: "none",
      duck: true,
      title: "Waking Up",
    });
    const credits: State = { ...baseState, area: "kitchen", finale: "credits" };
    expect(soundtrackFor(content.world, credits, { titleOpen: false })).toEqual({
      track: "morning",
      ambience: "none",
      duck: false,
      title: "Waking Up",
    });

    const plaza: State = { ...baseState, area: "plaza" };
    expect(soundtrackFor(content.world, { ...plaza, journalOpen: true }, { titleOpen: false }).duck)
      .toBe(true);
    expect(soundtrackFor(content.world, {
      ...plaza,
      dialogue: morningKitchen.dialogue,
    }, { titleOpen: false }).duck).toBe(true);
    expect(soundtrackFor(content.world, {
      ...plaza,
      area: "arcade",
      arcade: {
        game: "cook",
        dish: "nuggets",
        phase: "ready",
        phaseTicks: 0,
        cooked: 0,
        message: "",
        revealed: 0,
      },
    }, { titleOpen: false }).duck).toBe(true);
  });
});

describe("audio preferences backwards compatibility", () => {
  test("reads null, boolean, legacy object, malformed JSON, and full preferences", () => {
    expect(readAudioPreferences(null)).toEqual({
      muted: false,
      level: DEFAULT_AUDIO_LEVEL,
      musicMuted: false,
      musicLevel: DEFAULT_MUSIC_LEVEL,
      ambienceMuted: false,
    });
    expect(readAudioPreferences("true").muted).toBe(true);
    expect(readAudioPreferences("not json").level).toBe(DEFAULT_AUDIO_LEVEL);
    expect(readAudioPreferences('{"muted":false,"level":0.5}')).toEqual({
      muted: false,
      level: 0.5,
      musicMuted: false,
      musicLevel: DEFAULT_MUSIC_LEVEL,
      ambienceMuted: false,
    });
    const full = {
      muted: false,
      level: 0.75 as const,
      musicMuted: true,
      musicLevel: 0.5 as const,
      ambienceMuted: true,
    };
    expect(readAudioPreferences(writeAudioPreferences(full))).toEqual(full);
    expect(gainForMusicLevel(0.5)).toBeCloseTo(0.1, 6);
    expect(gainForAmbienceLevel(0.25)).toBeCloseTo(0.01625, 6);
  });
});

describe("complete 20-track world audio identity", () => {
  test("routes sanctuary, lodge, clubhouse, and fishing to their bespoke themes and beds", () => {
    const sanctuaryState: State = { ...baseState, area: "sanctuary" };
    expect(soundtrackFor(content.world, sanctuaryState, { titleOpen: false })).toEqual({
      track: "sanctuary",
      ambience: "forest",
      duck: false,
      title: "Meadow of Friends",
    });

    const lodgeState: State = { ...baseState, area: "lodge" };
    expect(soundtrackFor(content.world, lodgeState, { titleOpen: false })).toEqual({
      track: "lodge",
      ambience: "hearth",
      duck: false,
      title: "Hearth & Cocoa",
    });

    const clubhouseState: State = { ...baseState, area: "clubhouse" };
    expect(soundtrackFor(content.world, clubhouseState, { titleOpen: false })).toEqual({
      track: "clubhouse",
      ambience: "none",
      duck: false,
      title: "Our Secret Treehouse",
    });

    // Microwave cooking in the clubhouse keeps the clubhouse theme and ducks it.
    const cookingState: State = {
      ...clubhouseState,
      arcade: {
        game: "cook",
        dish: "nuggets",
        phase: "ready",
        phaseTicks: 0,
        cooked: 0,
        message: "",
        revealed: 0,
      },
    };
    expect(soundtrackFor(content.world, cookingState, { titleOpen: false })).toEqual({
      track: "clubhouse",
      ambience: "none",
      duck: true,
      title: "Our Secret Treehouse",
    });

    // Bubblegum Bay dock fishing plays Docked by the Tide unducked over ocean ambience.
    const fishingState: State = {
      ...baseState,
      area: "bay",
      arcade: {
        game: "fish",
        phase: "waiting",
        phaseTicks: 0,
        power: 0.6,
        castX: 0.6,
        castY: 0.5,
        nibblesLeft: 1,
        nextEventTick: 90,
        nibblePulse: 0,
        fishId: "sunny-perch",
        fishSeed: 1,
        reelProgress: 0,
        hookPos: 0.5,
        hookVel: 0,
        fishPos: 0.5,
        caught: null,
        isNew: false,
        message: "",
        revealed: 0,
      },
    };
    expect(soundtrackFor(content.world, fishingState, { titleOpen: false })).toEqual({
      track: "fishing",
      ambience: "ocean",
      duck: false,
      title: "Docked by the Tide",
    });
    expect(
      soundtrackFor(
        content.world,
        {
          ...fishingState,
          dialogue: {
            knot: "dock",
            speaker: "Sue",
            text: "Nice cast!",
            revealed: 10,
            choices: [],
            selected: 0,
            ended: false,
          },
        },
        { titleOpen: false },
      ).duck,
    ).toBe(true);
  });

  test("covers all 20 jukebox tracks with titles, multi-voice scores, and harmonic scales", () => {
    expect(jukeboxTracks).toHaveLength(20);
    expect(new Set(jukeboxTracks).size).toBe(20);
    for (const id of jukeboxTracks) {
      expect(trackTitles[id].trim().length, `${id} title`).toBeGreaterThan(0);
      const score = scores[id];
      expect(score.tracks.length, `${id} voices`).toBeGreaterThanOrEqual(2);
      const uniquePitches = new Set(
        score.tracks.flatMap((track) => track.notes.map(([, midi]) => midi)),
      );
      expect(uniquePitches.size, `${id} pitch variety`).toBeGreaterThanOrEqual(8);
      const scale = trackScaleNotes(id);
      expect(scale.length, `${id} scale length`).toBeGreaterThanOrEqual(5);
    }
    for (const id of ["sanctuary", "lodge", "clubhouse", "fishing"] as const) {
      expect(scores[id].bars, `${id} bars`).toBeGreaterThanOrEqual(16);
      expect(scores[id].tracks.length, `${id} voices`).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("composed scores integrity", () => {
  const playableTracks: readonly PlayableTrack[] = [
    "title",
    "home",
    "cafe",
    "hills",
    "sanctuary",
    "school",
    "bay",
    "fishing",
    "pass",
    "lodge",
    "cavern",
    "woods",
    "clubhouse",
    "arcade",
    "enchanted",
    "enchanted-calm",
    "battle",
    "boss",
    "talk",
    "morning",
  ];

  test("defines every playable track with valid timing, pitches, and dynamics", () => {
    expect(Object.keys(scores).sort()).toEqual([...playableTracks].sort());
    for (const id of playableTracks) {
      const score = scores[id];
      expect(score.bpm, `${id} bpm`).toBeGreaterThanOrEqual(60);
      expect(score.bpm, `${id} bpm`).toBeLessThanOrEqual(160);
      expect(score.stepsPerBar, `${id} stepsPerBar`).toBeGreaterThanOrEqual(12);
      expect(score.bars, `${id} bars`).toBeGreaterThanOrEqual(8);
      expect(score.tracks.length, `${id} tracks`).toBeGreaterThanOrEqual(2);
      const totalSteps = score.stepsPerBar * score.bars;
      for (const track of score.tracks) {
        expect(track.gain, `${id}:${track.voice} gain`).toBeGreaterThan(0);
        expect(track.gain, `${id}:${track.voice} gain`).toBeLessThanOrEqual(1);
        expect(track.notes.length, `${id}:${track.voice} notes`).toBeGreaterThan(0);
        for (const [step, midi, durationSteps, velocity] of track.notes) {
          expect(step, `${id}:${track.voice} step>=0`).toBeGreaterThanOrEqual(0);
          expect(step, `${id}:${track.voice} step<total`).toBeLessThan(totalSteps);
          expect(durationSteps, `${id}:${track.voice} dur>0`).toBeGreaterThan(0);
          expect(midi, `${id}:${track.voice} midi`).toBeGreaterThanOrEqual(24);
          expect(midi, `${id}:${track.voice} midi`).toBeLessThanOrEqual(108);
          expect(velocity, `${id}:${track.voice} vel>0`).toBeGreaterThan(0);
          expect(velocity, `${id}:${track.voice} vel<=1`).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
