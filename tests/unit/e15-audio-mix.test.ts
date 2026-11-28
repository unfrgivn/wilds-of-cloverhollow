import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createState, jukeboxTracks, type Battle, type State } from "../../src/core";
import {
  effectRecipe as audioEffectRecipe,
  soundCueRecipe as audioSoundCueRecipe,
} from "../../src/platform/audio";
import {
  effectRecipe as effectsEffectRecipe,
  effectRecipes as effectsEffectRecipes,
  type CompanionAudioEffect,
} from "../../src/platform/audio-effects";
import {
  effectRecipe as recipesEffectRecipe,
  effectRecipes as recipesEffectRecipes,
} from "../../src/platform/audio-recipes";
import {
  AMBIENCE_JOURNAL_FILTER_HZ,
  AMBIENCE_JOURNAL_GAIN_SCALE,
  AMBIENCE_OPEN_FILTER_HZ,
  DUCK_FILTER_HZ,
  JOURNAL_DUCK_GAIN,
  JOURNAL_FILTER_HZ,
  LANTERN_SHIMMER_GAIN,
  NORMAL_DUCK_GAIN,
  OPEN_FILTER_HZ,
  TENSION_PERCUSSION_BOOST,
  battleTensionNotes,
  hzToMidi,
  lanternShimmerNote,
  nextBarAdaptiveState,
  projectMusicMix,
  trackScaleMidi,
} from "../../src/platform/music-mix";
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

describe("E15 Adaptive Music Mix: Journal Warm Filter", () => {
  it("applies warm low-pass filter and ambience mellowing when journal is open in gameplay", () => {
    const state: State = { ...baseState, area: "plaza", journalOpen: true };
    const mix = projectMusicMix(content.world, state, {
      titleOpen: false,
      jukeboxActive: false,
      track: "home",
      duck: true,
    });
    expect(mix).toEqual({
      journalWarm: true,
      lanternLayer: false,
      tensionLayer: false,
      filterCutoffHz: JOURNAL_FILTER_HZ,
      duckGain: JOURNAL_DUCK_GAIN,
      ambienceFilterHz: AMBIENCE_JOURNAL_FILTER_HZ,
      ambienceGainScale: AMBIENCE_JOURNAL_GAIN_SCALE,
    });
    expect(mix.filterCutoffHz).toBe(1400);
    expect(mix.duckGain).toBe(0.46);
    expect(mix.ambienceFilterHz).toBe(1400);
    expect(mix.ambienceGainScale).toBe(0.62);
  });

  it(
    "distinguishes closed open mix, normal dialogue duck, and title/jukebox/silent bypasses",
    () => {
    const closed: State = { ...baseState, area: "plaza", journalOpen: false };
    expect(
      projectMusicMix(content.world, closed, {
        titleOpen: false,
        jukeboxActive: false,
        track: "home",
        duck: false,
      }),
    ).toEqual({
      journalWarm: false,
      lanternLayer: false,
      tensionLayer: false,
      filterCutoffHz: OPEN_FILTER_HZ,
      duckGain: 1,
      ambienceFilterHz: AMBIENCE_OPEN_FILTER_HZ,
      ambienceGainScale: 1,
    });

    expect(
      projectMusicMix(content.world, closed, {
        titleOpen: false,
        jukeboxActive: false,
        track: "home",
        duck: true,
      }),
    ).toEqual({
      journalWarm: false,
      lanternLayer: false,
      tensionLayer: false,
      filterCutoffHz: DUCK_FILTER_HZ,
      duckGain: NORMAL_DUCK_GAIN,
      ambienceFilterHz: AMBIENCE_OPEN_FILTER_HZ,
      ambienceGainScale: 1,
    });

    const journalOpenState: State = { ...baseState, area: "plaza", journalOpen: true };
    const jukeboxBypass = projectMusicMix(content.world, journalOpenState, {
      titleOpen: false,
      jukeboxActive: true,
      track: "cafe",
      duck: false,
    });
    expect(jukeboxBypass.journalWarm).toBe(false);
    expect(jukeboxBypass.filterCutoffHz).toBe(OPEN_FILTER_HZ);
    expect(jukeboxBypass.duckGain).toBe(1);
    expect(jukeboxBypass.ambienceFilterHz).toBe(AMBIENCE_OPEN_FILTER_HZ);
    expect(jukeboxBypass.ambienceGainScale).toBe(1);

    const titleBypass = projectMusicMix(content.world, journalOpenState, {
      titleOpen: true,
      jukeboxActive: false,
      track: "title",
      duck: false,
    });
    expect(titleBypass.journalWarm).toBe(false);
    expect(titleBypass.filterCutoffHz).toBe(OPEN_FILTER_HZ);

    const silentBypass = projectMusicMix(content.world, journalOpenState, {
      titleOpen: false,
      jukeboxActive: false,
      track: "silent",
      duck: false,
    });
    expect(silentBypass.journalWarm).toBe(false);
    expect(silentBypass.filterCutoffHz).toBe(OPEN_FILTER_HZ);
  });
});

describe("E15 Adaptive Music Mix: Blacklight Lantern Mystery Layer", () => {
  it("enables lantern layer in overworld exploration and suppresses it in special modes", () => {
    const lanternOn: State = { ...baseState, area: "woods", lantern: true };
    expect(
      projectMusicMix(content.world, lanternOn, {
        titleOpen: false,
        jukeboxActive: false,
        track: "woods",
        duck: false,
      }).lanternLayer,
    ).toBe(true);

    const lanternOff: State = { ...baseState, area: "woods", lantern: false };
    expect(
      projectMusicMix(content.world, lanternOff, {
        titleOpen: false,
        jukeboxActive: false,
        track: "woods",
        duck: false,
      }).lanternLayer,
    ).toBe(false);

    // Suppressed in battle
    expect(
      projectMusicMix(
        content.world,
        { ...lanternOn, battle: makeBattle("fountain-frog") },
        { titleOpen: false, jukeboxActive: false, track: "battle", duck: false },
      ).lanternLayer,
    ).toBe(false);

    // Suppressed in arcade
    expect(
      projectMusicMix(
        content.world,
        {
          ...lanternOn,
          arcade: {
            game: "cook",
            dish: "nuggets",
            phase: "ready",
            phaseTicks: 0,
            cooked: 0,
            message: "",
            revealed: 0,
          },
        },
        { titleOpen: false, jukeboxActive: false, track: "clubhouse", duck: true },
      ).lanternLayer,
    ).toBe(false);

    // Suppressed in finale (morning and credits)
    expect(
      projectMusicMix(
        content.world,
        { ...lanternOn, finale: "morning" },
        { titleOpen: false, jukeboxActive: false, track: "morning", duck: false },
      ).lanternLayer,
    ).toBe(false);
    expect(
      projectMusicMix(
        content.world,
        { ...lanternOn, finale: "credits" },
        { titleOpen: false, jukeboxActive: false, track: "morning", duck: false },
      ).lanternLayer,
    ).toBe(false);

    // Suppressed on title, jukebox, harness, and silent track
    expect(
      projectMusicMix(content.world, lanternOn, {
        titleOpen: true,
        jukeboxActive: false,
        track: "title",
        duck: false,
      }).lanternLayer,
    ).toBe(false);
    expect(
      projectMusicMix(content.world, lanternOn, {
        titleOpen: false,
        jukeboxActive: true,
        track: "woods",
        duck: false,
      }).lanternLayer,
    ).toBe(false);
    expect(
      projectMusicMix(
        content.world,
        { ...lanternOn, area: "harness" },
        { titleOpen: false, jukeboxActive: false, track: "home", duck: false },
      ).lanternLayer,
    ).toBe(false);
    expect(
      projectMusicMix(content.world, lanternOn, {
        titleOpen: false,
        jukeboxActive: false,
        track: "silent",
        duck: false,
      }).lanternLayer,
    ).toBe(false);
  });
});

describe("E15 Adaptive Music Mix: Battle Tension / Phase-2 Lift", () => {
  it(
    "activates on wind-up for regular critters and at >= 50% calm for mini-bosses and finale boss",
    () => {
    const frog = content.world.critters["fountain-frog"];
    const gull = content.world.critters.gull;
    const hooded = content.world.critters["hooded-kid"];
    expect(frog).toBeDefined();
    expect(gull).toBeDefined();
    expect(hooded).toBeDefined();
    if (frog === undefined || gull === undefined || hooded === undefined) return;

    // Regular critter: off without wind-up even past 50% calm; on with wind-up
    expect(
      projectMusicMix(
        content.world,
        {
          ...baseState,
          battle: makeBattle("fountain-frog", { calm: Math.ceil(frog.calmMax * 0.75) }),
        },
        { titleOpen: false, jukeboxActive: false, track: "battle", duck: false },
      ).tensionLayer,
    ).toBe(false);
    expect(
      projectMusicMix(
        content.world,
        {
          ...baseState,
          battle: makeBattle("fountain-frog", {
            calm: 0,
            windUp: { feelings: ["zoomy"], popped: [false], left: 2 },
          }),
        },
        { titleOpen: false, jukeboxActive: false, track: "battle", duck: false },
      ).tensionLayer,
    ).toBe(true);

    // Mini-boss (gull): off below 50% calm, on at >= 50% calm
    const gullHalf = Math.ceil(gull.calmMax / 2);
    expect(
      projectMusicMix(
        content.world,
        { ...baseState, battle: makeBattle("gull", { calm: gullHalf - 1 }) },
        { titleOpen: false, jukeboxActive: false, track: "boss", duck: false },
      ).tensionLayer,
    ).toBe(false);
    expect(
      projectMusicMix(
        content.world,
        { ...baseState, battle: makeBattle("gull", { calm: gullHalf }) },
        { titleOpen: false, jukeboxActive: false, track: "boss", duck: false },
      ).tensionLayer,
    ).toBe(true);

    // Finale boss (hooded-kid): off below 50%, on >= 50% on boss track, off on talk track
    const hoodedHalf = Math.ceil(hooded.calmMax / 2);
    expect(
      projectMusicMix(
        content.world,
        { ...baseState, battle: makeBattle("hooded-kid", { calm: hoodedHalf - 1 }) },
        { titleOpen: false, jukeboxActive: false, track: "boss", duck: false },
      ).tensionLayer,
    ).toBe(false);
    expect(
      projectMusicMix(
        content.world,
        { ...baseState, battle: makeBattle("hooded-kid", { calm: hoodedHalf }) },
        { titleOpen: false, jukeboxActive: false, track: "boss", duck: false },
      ).tensionLayer,
    ).toBe(true);
    expect(
      projectMusicMix(
        content.world,
        {
          ...baseState,
          battle: makeBattle("hooded-kid", {
            calm: hoodedHalf,
            windUp: { feelings: ["zoomy"], popped: [false], left: 2 },
          }),
        },
        { titleOpen: false, jukeboxActive: false, track: "talk", duck: false },
      ).tensionLayer,
    ).toBe(false);

    // Suppressed in reward, rest, soothed, and run phases
    for (const phase of ["reward", "rest", "soothed", "run"] as const) {
      expect(
        projectMusicMix(
          content.world,
          {
            ...baseState,
            battle: makeBattle("gull", {
              phase,
              calm: gullHalf,
              windUp: { feelings: ["zoomy"], popped: [false], left: 1 },
            }),
          },
          { titleOpen: false, jukeboxActive: false, track: "boss", duck: false },
        ).tensionLayer,
        `suppressed in ${phase}`,
      ).toBe(false);
    }

    expect(TENSION_PERCUSSION_BOOST).toBe(1.18);
  });
});

describe("E15 Adaptive Music Mix: Bar Quantization & Vertical Note Generators", () => {
  it("latches adaptive layer changes on bar boundaries with optional immediate release", () => {
    // Wait for step 0 to latch on or off when immediateRelease is false
    expect(nextBarAdaptiveState(false, true, 5)).toBe(false);
    expect(nextBarAdaptiveState(false, true, 0)).toBe(true);
    expect(nextBarAdaptiveState(true, false, 7)).toBe(true);
    expect(nextBarAdaptiveState(true, false, 0)).toBe(false);

    // With immediateRelease = true, off releases immediately mid-bar while on waits for bar 0
    expect(nextBarAdaptiveState(true, false, 7, true)).toBe(false);
    expect(nextBarAdaptiveState(false, true, 7, true)).toBe(false);
    expect(nextBarAdaptiveState(false, true, 0, true)).toBe(true);
  });

  it(
    "maps every playable track scale into celesta register and emits matching lantern shimmer",
    () => {
    expect(hzToMidi(440)).toBe(69);
    expect(hzToMidi(523.25)).toBe(72);
    expect(hzToMidi(880)).toBe(81);

    expect(jukeboxTracks).toHaveLength(31);
    for (const track of jukeboxTracks) {
      const hzScale = trackScaleNotes(track);
      const midiScale = trackScaleMidi(track);
      expect(midiScale).toHaveLength(hzScale.length);
      for (let i = 0; i < midiScale.length; i += 1) {
        const midi = midiScale[i] ?? 0;
        const rawMidi = hzToMidi(hzScale[i] ?? 440);
        expect(midi, `${track}[${i}] >= 79`).toBeGreaterThanOrEqual(79);
        expect(midi, `${track}[${i}] <= 93`).toBeLessThanOrEqual(93);
        expect(midi % 12, `${track}[${i}] pitch class`).toBe(rawMidi % 12);
      }

      const stepsPerBar = scores[track].stepsPerBar;
      const expectedSlots = stepsPerBar === 12 ? [0, 4, 8] : [0, 6, 10, 14];
      const scaleSet = new Set(midiScale);
      const pitches = new Set<number>();
      for (let bar = 0; bar < 4; bar += 1) {
        for (let step = 0; step < stepsPerBar; step += 1) {
          const note = lanternShimmerNote(track, step, stepsPerBar, bar);
          if (expectedSlots.includes(step)) {
            expect(note, `${track} bar ${bar} step ${step}`).not.toBeNull();
            if (note === null) continue;
            expect(note).toEqual(lanternShimmerNote(track, step, stepsPerBar, bar));
            expect(note.voice).toBe("celesta");
            expect(note.gain).toBe(LANTERN_SHIMMER_GAIN);
            expect(note.durationSteps).toBe(2);
            expect(note.velocity).toBeGreaterThanOrEqual(0.22);
            expect(note.velocity).toBeLessThanOrEqual(0.28);
            expect(scaleSet.has(note.midi), `${track} midi ${note.midi} in scale`).toBe(true);
            expect(note.midi).toBeGreaterThanOrEqual(79);
            expect(note.midi).toBeLessThanOrEqual(93);
            pitches.add(note.midi);
          } else {
            expect(note, `${track} rest step ${step}`).toBeNull();
          }
        }
      }
      expect(pitches.size, `${track} contour moves across scale`).toBeGreaterThanOrEqual(3);
    }
  });

  it(
    "emits rhythmic tension notes strictly on battle/boss tracks with boss tonic bass pulse",
    () => {
    const nonBattle: readonly PlayableTrack[] = ["home", "woods", "talk", "enchanted", "market"];
    for (const track of nonBattle) {
      for (let step = 0; step < 16; step += 1) {
        expect(battleTensionNotes(track, step, 16, 1)).toEqual([]);
      }
    }

    // Battle 4/4 even bar vs odd bar
    const battleEvenShakers: number[] = [];
    const battleEvenWood: number[] = [];
    const battleOddWood: number[] = [];
    for (let step = 0; step < 16; step += 1) {
      for (const note of battleTensionNotes("battle", step, 16, 0)) {
        if (note.voice === "shaker") {
          battleEvenShakers.push(step);
          expect(note.gain).toBe(0.24);
          expect(note.velocity).toBeGreaterThanOrEqual(0.28);
          expect(note.velocity).toBeLessThanOrEqual(0.34);
        } else if (note.voice === "woodblock") {
          battleEvenWood.push(step);
          expect(note.gain).toBe(0.22);
          expect(note.velocity).toBeGreaterThanOrEqual(0.24);
          expect(note.velocity).toBeLessThanOrEqual(0.3);
        } else {
          expect.unreachable(`Unexpected voice ${note.voice} on battle track`);
        }
      }
      for (const note of battleTensionNotes("battle", step, 16, 1)) {
        if (note.voice === "woodblock") battleOddWood.push(step);
      }
    }
    expect(battleEvenShakers).toEqual([2, 6, 10, 14]);
    expect(battleEvenWood).toEqual([4, 12]);
    expect(battleOddWood).toEqual([4, 12, 14]);

    // Boss 4/4 adds tonic bass pulse on steps 0 and 8
    const expectedBossBass = (trackScaleMidi("boss")[0] ?? 86) - 36;
    const bossBassSteps: number[] = [];
    for (let step = 0; step < 16; step += 1) {
      for (const note of battleTensionNotes("boss", step, 16, 0)) {
        if (note.voice === "bass") {
          bossBassSteps.push(step);
          expect(note.midi).toBe(expectedBossBass);
          expect(note.midi).toBeGreaterThanOrEqual(43);
          expect(note.midi).toBeLessThanOrEqual(55);
          expect(note.gain).toBe(0.22);
          expect(note.velocity).toBe(0.26);
        }
      }
    }
    expect(bossBassSteps).toEqual([0, 8]);

    // 3/4 support
    const waltzShaker: number[] = [];
    const waltzWood: number[] = [];
    for (let step = 0; step < 12; step += 1) {
      for (const note of battleTensionNotes("battle", step, 12, 0)) {
        if (note.voice === "shaker") waltzShaker.push(step);
        if (note.voice === "woodblock") waltzWood.push(step);
      }
    }
    expect(waltzShaker).toEqual([2, 6, 10]);
    expect(waltzWood).toEqual([4, 10]);
  });
});

describe("E15 Organic UI Foley Recipes", () => {
  const organicEffects: readonly CompanionAudioEffect[] = [
    "paper-flip",
    "sticker-peel",
    "atlas-pin",
  ];

  it(
    "synthesizes paper-flip, sticker-peel, and atlas-pin with noise, resonance, and smooth attacks",
    () => {
    for (const effect of organicEffects) {
      const recipe = effectsEffectRecipe(effect);
      expect(recipe).toBe(effectsEffectRecipes[effect]);
      expect(recipe).toBe(recipesEffectRecipe(effect));
      expect(recipe).toBe(recipesEffectRecipes[effect]);
      expect(recipe).toBe(audioEffectRecipe(effect));

      expect(recipe.length, `${effect} multi-layer recipe`).toBeGreaterThanOrEqual(3);
      const noiseSegments = recipe.filter((segment) => segment.wave === "noise");
      const tonalSegments = recipe.filter((segment) => segment.wave !== "noise");
      expect(noiseSegments.length, `${effect} filtered noise layer`).toBeGreaterThanOrEqual(1);
      expect(tonalSegments.length, `${effect} wooden/resonance tonal layer`).toBeGreaterThanOrEqual(
        2,
      );

      for (const segment of recipe) {
        expect(segment.offset, `${effect} offset >= 0`).toBeGreaterThanOrEqual(0);
        expect(segment.duration, `${effect} duration > 0`).toBeGreaterThan(0);
        expect(segment.gain, `${effect} gain > 0`).toBeGreaterThan(0);
        expect(segment.gain, `${effect} gentle gain <= 0.06`).toBeLessThanOrEqual(0.06);
        expect(segment.attack ?? 0, `${effect} smooth attack >= 0.003`).toBeGreaterThanOrEqual(
          0.003,
        );
        expect(segment.wave, `${effect} avoids square wave`).not.toBe("square");
        if (segment.wave === "noise") {
          expect(segment.lowpass, `${effect} warm lowpass`).toBeGreaterThanOrEqual(1000);
          expect(segment.lowpass, `${effect} warm lowpass`).toBeLessThanOrEqual(2600);
        }
      }
    }

    // Journal open/close noise segments have explicit smooth attacks (0.006s)
    for (const cue of ["journal-open", "journal-close"] as const) {
      const recipe = audioSoundCueRecipe(cue);
      const noise = recipe.find((segment) => segment.wave === "noise");
      expect(noise?.attack, `${cue} smooth noise attack`).toBe(0.006);
    }
  });
});
