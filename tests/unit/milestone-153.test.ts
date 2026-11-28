import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  jukeboxTracks,
  soundtrackFor,
  trackTitles,
  type AmbienceBed,
  type State,
} from "../../src/core";
import { AMBIENCE_ACCENT_CADENCE_MS, ambiencePan } from "../../src/platform/ambience";
import * as audio from "../../src/platform/audio";
import * as audioRecipes from "../../src/platform/audio-recipes";
import type { AudioSegment } from "../../src/platform/audio-recipes";
import {
  DUCK_FILTER_DUCKED_HZ,
  DUCK_FILTER_OPEN_HZ,
  FRESH_START_TRACKS,
  duckFilterCutoff,
  resumeBarStep,
} from "../../src/platform/music";
import { scores, type PlayableTrack } from "../../src/platform/scores";
import { interiorScores } from "../../src/platform/scores-interiors";
import {
  NEUTRAL_PROSODY,
  blipFrequency,
  dialogueProsody,
  trackScaleNotes,
  voiceForSpeaker,
  type VoiceProsody,
} from "../../src/platform/voices";

const content = loadContent();
const newGame = content.fixtures["new-game"];
if (newGame === undefined) throw new Error("Missing new-game fixture");
const baseState = createState(content.world, newGame);

const ACTIVE_BEDS: readonly Exclude<AmbienceBed, "none">[] = [
  "town-breeze",
  "ocean",
  "mountain-wind",
  "hearth",
  "forest",
  "enchanted-shimmer",
  "cavern-drips",
  "cafe-murmur",
  "arcade-hum",
];

const ALL_PLAYABLE_TRACKS: readonly PlayableTrack[] = [
  "title",
  "home",
  "cafe",
  "market",
  "parlor",
  "loft",
  "bloom",
  "hills",
  "sanctuary",
  "festival",
  "school",
  "bay",
  "fishing",
  "cottage",
  "island",
  "pass",
  "lodge",
  "cabin",
  "summit",
  "cavern",
  "woods",
  "clubhouse",
  "arcade",
  "taco",
  "enchanted",
  "enchanted-calm",
  "battle",
  "boss",
  "talk",
  "morning",
];

const EXPECTED_FRESH_TRACKS: readonly PlayableTrack[] = [
  "title",
  "taco",
  "battle",
  "boss",
  "talk",
  "morning",
];

function recipeDuration(segments: readonly AudioSegment[]): number {
  return Math.max(...segments.map((segment) => segment.offset + segment.duration));
}

function tonalFrequencies(segments: readonly AudioSegment[]): number[] {
  return segments
    .filter((segment): segment is Exclude<AudioSegment, { wave: "noise" }> =>
      segment.wave !== "noise",
    )
    .map((segment) => segment.frequency);
}

describe("Milestone 152: Complete 24-Track World Soundtrack", () => {
  it("lists 30 unique jukebox tracks in album order with titles, scores, and scales", () => {
    expect(jukeboxTracks).toHaveLength(30);
    expect(new Set(jukeboxTracks).size).toBe(30);

    expect(jukeboxTracks.indexOf("market")).toBe(jukeboxTracks.indexOf("cafe") + 1);
    expect(jukeboxTracks.indexOf("parlor")).toBe(jukeboxTracks.indexOf("market") + 1);
    expect(jukeboxTracks.indexOf("cottage")).toBe(jukeboxTracks.indexOf("fishing") + 1);
    expect(jukeboxTracks.indexOf("cabin")).toBe(jukeboxTracks.indexOf("lodge") + 1);

    const seenTitles = new Set<string>();
    for (const id of jukeboxTracks) {
      const title = trackTitles[id].trim();
      expect(title.length, `${id} non-empty title`).toBeGreaterThan(0);
      seenTitles.add(title);

      const score = scores[id];
      expect(score.bpm, `${id} bpm`).toBeGreaterThanOrEqual(60);
      expect(score.bpm, `${id} bpm`).toBeLessThanOrEqual(160);
      expect(score.tracks.length, `${id} tracks`).toBeGreaterThanOrEqual(2);

      const scale = trackScaleNotes(id);
      expect(scale.length, `${id} scale notes`).toBeGreaterThanOrEqual(5);
      for (let i = 1; i < scale.length; i += 1) {
        expect(scale[i] ?? 0, `${id} ascending scale`).toBeGreaterThan(scale[i - 1] ?? 0);
      }
    }
    expect(seenTitles.size).toBe(30);
  });

  it("gives market, parlor, cottage, and cabin bespoke 16-bar multi-voice chamber scores", () => {
    expect(Object.keys(interiorScores).sort()).toEqual(["cabin", "cottage", "market", "parlor"]);

    const expected = [
      { id: "market", bpm: 102, stepsPerBar: 12, bars: 16 },
      { id: "parlor", bpm: 112, stepsPerBar: 16, bars: 16 },
      { id: "cottage", bpm: 88, stepsPerBar: 16, bars: 16 },
      { id: "cabin", bpm: 92, stepsPerBar: 12, bars: 16 },
    ] as const;

    for (const spec of expected) {
      const score = scores[spec.id];
      expect(score, `${spec.id} wired from interiorScores`).toBe(interiorScores[spec.id]);
      expect(score.bpm, `${spec.id} bpm`).toBe(spec.bpm);
      expect(score.stepsPerBar, `${spec.id} stepsPerBar`).toBe(spec.stepsPerBar);
      expect(score.bars, `${spec.id} bars`).toBe(spec.bars);
      expect(score.tracks.length, `${spec.id} >= 4 voices`).toBeGreaterThanOrEqual(4);

      const uniquePitches = new Set(
        score.tracks.flatMap((track) => track.notes.map(([, midi]) => midi)),
      );
      expect(uniquePitches.size, `${spec.id} rich pitch variety`).toBeGreaterThanOrEqual(16);

      const totalSteps = score.stepsPerBar * score.bars;
      for (const track of score.tracks) {
        expect(track.notes.length, `${spec.id}/${track.voice} notes`).toBeGreaterThan(0);
        for (const [step, midi, durationSteps, velocity] of track.notes) {
          expect(step, `${spec.id}/${track.voice} step>=0`).toBeGreaterThanOrEqual(0);
          expect(step, `${spec.id}/${track.voice} step<total`).toBeLessThan(totalSteps);
          expect(midi, `${spec.id}/${track.voice} midi`).toBeGreaterThanOrEqual(24);
          expect(midi, `${spec.id}/${track.voice} midi`).toBeLessThanOrEqual(108);
          expect(durationSteps, `${spec.id}/${track.voice} dur>0`).toBeGreaterThan(0);
          expect(velocity, `${spec.id}/${track.voice} vel`).toBeGreaterThan(0);
          expect(velocity, `${spec.id}/${track.voice} vel<=1`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("routes interior shops/homes and expansion areas to bespoke themes", () => {
    const cases: readonly (readonly [string, string, string, string])[] = [
      ["market", "market", "Pippin's Basket Waltz", "cafe-murmur"],
      ["parlor", "parlor", "Sweet Scoop Rag", "cafe-murmur"],
      ["sue-cottage", "cottage", "Sea-Glass Sunroom", "ocean"],
      ["jordan-cabin", "cabin", "Timber & Tea", "hearth"],
      ["milo-house", "loft", "Paper Plane Sketchbook", "none"],
      ["rosie-cottage", "bloom", "Rosie's Flower Window", "none"],
      ["island", "island", "Starlight Beacon", "ocean"],
      ["summit", "summit", "Above the Pines", "mountain-wind"],
    ];
    for (const [area, track, title, ambience] of cases) {
      const state: State = { ...baseState, area };
      expect(soundtrackFor(content.world, state, { titleOpen: false }), area).toEqual({
        track,
        ambience,
        duck: false,
        title,
      });
    }
  });

  it("aligns voice scales for the 4 new interior tracks to their musical keys", () => {
    expect(trackScaleNotes("market")).toEqual([392.0, 440.0, 493.88, 587.33, 659.25, 783.99]);
    expect(trackScaleNotes("parlor")).toEqual([466.16, 523.25, 587.33, 698.46, 783.99, 932.33]);
    expect(trackScaleNotes("cottage")).toEqual([311.13, 349.23, 392.0, 466.16, 523.25, 622.25]);
    expect(trackScaleNotes("cabin")).toEqual([440.0, 493.88, 554.37, 659.25, 739.99, 880.0]);
  });

  it("keeps src/platform/scores-interiors.ts cleanly under 1,000 lines", () => {
    const filePath = resolve(process.cwd(), "src/platform/scores-interiors.ts");
    const lines = readFileSync(filePath, "utf8").split("\n").length;
    expect(lines).toBeGreaterThan(100);
    expect(lines).toBeLessThan(1000);
  });
});

describe("Milestone 152: Celebratory Minigame Audio Flourishes", () => {
  it("re-exports soundCueRecipe identically from src/platform/audio.ts", () => {
    expect(audio.soundCueRecipe).toBe(audioRecipes.soundCueRecipe);
    expect(audio.effectRecipe).toBe(audioRecipes.effectRecipe);
  });

  it("upgrades skee-hundred, cook-ding, and tickets-won into warm multi-step flourishes", () => {
    const skee = audio.soundCueRecipe("skee-hundred");
    const cook = audio.soundCueRecipe("cook-ding");
    const tickets = audio.soundCueRecipe("tickets-won");

    expect(skee).toHaveLength(6);
    expect(cook).toHaveLength(5);
    expect(tickets).toHaveLength(6);

    expect(tonalFrequencies(skee)).toEqual([523.25, 659.25, 783.99, 1046.5, 1318.51, 2637]);
    expect(tonalFrequencies(cook)).toEqual([1319, 2637, 3951, 1047, 1568]);
    expect(tonalFrequencies(tickets)).toEqual([784, 880, 1047, 1175, 1568, 3136]);

    expect(recipeDuration(skee)).toBeCloseTo(0.46, 5);
    expect(recipeDuration(cook)).toBeCloseTo(0.42, 5);
    expect(recipeDuration(tickets)).toBeCloseTo(0.4, 5);

    const profiles = new Set<string>();
    for (const [name, recipe] of [
      ["skee-hundred", skee],
      ["cook-ding", cook],
      ["tickets-won", tickets],
    ] as const) {
      expect(recipe.length, `${name} >= 5 steps`).toBeGreaterThanOrEqual(5);
      expect(recipeDuration(recipe), `${name} duration <= 0.52s`).toBeLessThanOrEqual(0.52);
      for (const segment of recipe) {
        expect(segment.offset, `${name} offset >= 0`).toBeGreaterThanOrEqual(0);
        expect(segment.duration, `${name} duration > 0`).toBeGreaterThan(0);
        expect(segment.gain, `${name} gain > 0`).toBeGreaterThan(0);
        expect(segment.gain, `${name} gain <= 0.11`).toBeLessThanOrEqual(0.11);
        expect(segment.wave, `${name} warm waveform`).not.toBe("square");
      }
      profiles.add(tonalFrequencies(recipe).join(","));
    }
    expect(profiles.size).toBe(3);
  });

  it("preserves all existing UI foley effects untouched", () => {
    const uiEffects: readonly audioRecipes.CompanionAudioEffect[] = [
      "title-move",
      "title-start",
      "page-turn",
      "card-open",
      "card-close",
      "toggle-on",
      "toggle-off",
    ];
    for (const effect of uiEffects) {
      expect(audio.effectRecipe(effect)).toBe(audioRecipes.effectRecipe(effect));
      expect(audio.effectRecipe(effect).length).toBeGreaterThan(0);
    }
  });
});

describe("Milestone 152: Complete 9-of-9 Spatialized Biome Ambience Accents", () => {
  it("covers all 9 active beds in AMBIENCE_ACCENT_CADENCE_MS with tasteful intervals", () => {
    expect(Object.keys(AMBIENCE_ACCENT_CADENCE_MS).sort()).toEqual([...ACTIVE_BEDS].sort());
    expect(ACTIVE_BEDS).toHaveLength(9);

    for (const bed of ACTIVE_BEDS) {
      const cadence = AMBIENCE_ACCENT_CADENCE_MS[bed];
      expect(Number.isFinite(cadence), `${bed} cadence is finite`).toBe(true);
      expect(cadence, `${bed} cadence >= 1000 ms`).toBeGreaterThanOrEqual(1000);
      expect(cadence, `${bed} cadence <= 8000 ms`).toBeLessThanOrEqual(8000);
    }

    expect(AMBIENCE_ACCENT_CADENCE_MS["mountain-wind"]).toBe(5400);
    expect(AMBIENCE_ACCENT_CADENCE_MS["arcade-hum"]).toBe(4800);
  });

  it("spatializes mountain-wind and arcade-hum deterministically via ambiencePan", () => {
    for (const seed of [-5, 0, 1, 9, 42, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(ambiencePan("none", seed)).toBe(0);
    }

    for (const bed of ["mountain-wind", "arcade-hum"] as const) {
      const pans = Array.from({ length: 16 }, (_, seed) => {
        const pan = ambiencePan(bed, seed);
        expect(pan, `${bed}:${seed} deterministic`).toBe(ambiencePan(bed, seed));
        expect(Number.isFinite(pan), `${bed}:${seed} finite`).toBe(true);
        expect(pan, `${bed}:${seed} > -0.55`).toBeGreaterThan(-0.55);
        expect(pan, `${bed}:${seed} < 0.55`).toBeLessThan(0.55);
        return pan;
      });
      expect(pans.some((pan) => pan < 0), `${bed} reaches left field`).toBe(true);
      expect(pans.some((pan) => pan > 0), `${bed} reaches right field`).toBe(true);
      expect(new Set(pans).size, `${bed} varies across seeds`).toBeGreaterThanOrEqual(8);
    }
  });

  it("keeps src/platform/ambience.ts cleanly under 1,000 lines with 9/9 accent wiring", () => {
    const source = readFileSync("src/platform/ambience.ts", "utf8");
    expect(source.split("\n").length).toBeLessThan(1000);

    const cadenceCalls = source.match(/scheduleAccent\(bed, AMBIENCE_ACCENT_CADENCE_MS\[/g) ?? [];
    expect(cadenceCalls).toHaveLength(9);
  });
});

describe("Milestone 152: Expressive Sentence-Aware Dialogue Voice Prosody", () => {
  it("returns NEUTRAL_PROSODY for neutral statements and empty/invalid bounds", () => {
    expect(dialogueProsody(undefined, 5)).toEqual(NEUTRAL_PROSODY);
    expect(dialogueProsody("Hello!", undefined)).toEqual(NEUTRAL_PROSODY);
    expect(dialogueProsody("", 1)).toEqual(NEUTRAL_PROSODY);
    expect(dialogueProsody("Hello!", 0)).toEqual(NEUTRAL_PROSODY);
    expect(dialogueProsody("Hello!", -4)).toEqual(NEUTRAL_PROSODY);
    expect(dialogueProsody("Hello!", Number.NaN)).toEqual(NEUTRAL_PROSODY);

    const line = "It is a lovely morning in Cloverhollow.";
    expect(dialogueProsody(line, 4)).toEqual(NEUTRAL_PROSODY);
    expect(dialogueProsody(line, 20)).toEqual(NEUTRAL_PROSODY);
    expect(dialogueProsody(line, line.length)).toEqual(NEUTRAL_PROSODY);
  });

  it("raises pitch and adds upward glide over the second half of questions", () => {
    const line = "Who is in the purple hood?";
    const early = dialogueProsody(line, 4);
    const mid = dialogueProsody(line, 13);
    const late = dialogueProsody(line, 21);
    const end = dialogueProsody(line, 25);

    expect(early.mood).toBe("question");
    expect(early.pitchScale).toBe(1);
    expect(early.gainScale).toBe(1);
    expect(early.glideScale).toBe(1);

    expect(mid.mood).toBe("question");
    expect(mid.pitchScale).toBe(1);
    expect(mid.glideScale).toBe(1);

    expect(late.mood).toBe("question");
    expect(late.pitchScale).toBeGreaterThan(1.03);
    expect(late.glideScale).toBeGreaterThan(1.02);

    expect(end.mood).toBe("question");
    expect(end.pitchScale).toBeGreaterThan(late.pitchScale);
    expect(end.glideScale).toBeGreaterThan(late.glideScale);
    expect(end.gainScale).toBe(1);
  });

  it("lifts pitch, gain, and glide for enthusiastic exclamations", () => {
    const prosody = dialogueProsody("You're a star, Fae!", 11);
    expect(prosody).toEqual({
      mood: "exclaim",
      pitchScale: 1.07,
      gainScale: 1.1,
      glideScale: 1.04,
    });
  });

  it("softens leading and trailing ellipses into whisper prosody", () => {
    const expectedWhisper: VoiceProsody = {
      mood: "whisper",
      pitchScale: 0.94,
      gainScale: 0.74,
      glideScale: 0.97,
    };

    const wakeLine = "...Mom? It was all a dream?";
    expect(dialogueProsody(wakeLine, 5)).toEqual(expectedWhisper);
    const secondClause = dialogueProsody(wakeLine, wakeLine.length - 1);
    expect(secondClause.mood).toBe("question");
    expect(secondClause.pitchScale).toBeGreaterThan(1.08);
    expect(secondClause.glideScale).toBeGreaterThan(1.05);

    const unicodeWake = "\u2026Mom? It was all a dream?";
    expect(dialogueProsody(unicodeWake, 3)).toEqual(expectedWhisper);
    expect(dialogueProsody(unicodeWake, unicodeWake.length - 1).mood).toBe("question");

    const trailingAscii = "I only wanted to be noticed...";
    expect(dialogueProsody(trailingAscii, 8)).toEqual(expectedWhisper);
    expect(dialogueProsody(trailingAscii, 26)).toEqual(expectedWhisper);

    const trailingUnicode = "I only wanted to be noticed\u2026";
    expect(dialogueProsody(trailingUnicode, 12)).toEqual(expectedWhisper);

    const longLeading = "...and then I simply can't remember!";
    expect(dialogueProsody(longLeading, 6)).toEqual(expectedWhisper);
    expect(dialogueProsody(longLeading, 30).mood).toBe("exclaim");
  });

  it("assigns independent prosody per sentence in multi-sentence lines", () => {
    const multi = "\"Watch out!\" Wait... Who is in the purple hood? It is calm now.";
    const exclaimIdx = multi.indexOf("Watch") + 2;
    const whisperIdx = multi.indexOf("Wait") + 2;
    const questionIdx = multi.indexOf("hood") + 3;
    const neutralIdx = multi.indexOf("calm") + 2;

    expect(dialogueProsody(multi, exclaimIdx).mood).toBe("exclaim");
    expect(dialogueProsody(multi, whisperIdx).mood).toBe("whisper");
    const question = dialogueProsody(multi, questionIdx);
    expect(question.mood).toBe("question");
    expect(question.pitchScale).toBeGreaterThan(1.05);
    expect(dialogueProsody(multi, neutralIdx)).toEqual(NEUTRAL_PROSODY);

    const midEllipsis = "But the forest... and Milo... it was all a dream?";
    const midQuestion = dialogueProsody(midEllipsis, midEllipsis.indexOf("dream") + 3);
    expect(midQuestion.mood).toBe("question");
    expect(midQuestion.pitchScale).toBeGreaterThan(1.08);
  });

  it("emphasizes all-caps words cleanly without boosting whispers or single letters", () => {
    const excitedCaps = "They're SO fast!";
    const calmLower = "They're so fast.";
    const soIdx = excitedCaps.indexOf("SO") + 1;
    const fastIdx = excitedCaps.indexOf("fast") + 2;

    const emphasizedExclaim = dialogueProsody(excitedCaps, soIdx);
    const plainExclaim = dialogueProsody(excitedCaps, fastIdx);
    const plainNeutral = dialogueProsody(calmLower, calmLower.indexOf("so") + 1);

    expect(emphasizedExclaim.mood).toBe("exclaim");
    expect(emphasizedExclaim.pitchScale).toBeGreaterThan(plainExclaim.pitchScale);
    expect(emphasizedExclaim.gainScale).toBeGreaterThan(plainExclaim.gainScale);
    expect(plainNeutral).toEqual(NEUTRAL_PROSODY);

    for (const word of ["REALLY", "THAT'S", "MILO", "AND"]) {
      const sentence = `I think ${word} helps here.`;
      const idx = sentence.indexOf(word) + word.length;
      const prosody = dialogueProsody(sentence, idx);
      expect(prosody.mood, word).toBe("neutral");
      expect(prosody.pitchScale, word).toBe(1.05);
      expect(prosody.gainScale, word).toBe(1.06);
    }

    const singleLetters = "I saw A bird.";
    expect(dialogueProsody(singleLetters, 1)).toEqual(NEUTRAL_PROSODY);
    expect(dialogueProsody(singleLetters, singleLetters.indexOf("A") + 1)).toEqual(NEUTRAL_PROSODY);

    const whisperCaps = "I had the WEIRDEST dream...";
    const whisperProsody = dialogueProsody(whisperCaps, whisperCaps.indexOf("WEIRDEST") + 3);
    expect(whisperProsody).toEqual({
      mood: "whisper",
      pitchScale: 0.94,
      gainScale: 0.74,
      glideScale: 0.97,
    });
  });

  it("applies prosody cleanly in blipFrequency and preserves living NPC voices", () => {
    const speakers = ["Fae", "Oliver", "Maddie", "Hooded kid", "Mrs. Marigold", "Danny", null];
    for (const speaker of speakers) {
      const omitted = blipFrequency(speaker, 7, "a");
      const neutral = blipFrequency(speaker, 7, "a", NEUTRAL_PROSODY);
      expect(neutral, `${speaker ?? "narrator"} neutral matches omitted`).toEqual(omitted);
    }

    // Living NPC speakers and aliases remain intact.
    expect(voiceForSpeaker("Sal")).toEqual(voiceForSpeaker("Captain Sal"));
    expect(voiceForSpeaker("Sage")).toEqual(voiceForSpeaker("Star-Watcher Sage"));
    expect(voiceForSpeaker("Bert")).toEqual(voiceForSpeaker("Custodian Bert"));
    expect(voiceForSpeaker("Marigold")).toEqual(voiceForSpeaker("Mrs. Marigold"));
    expect(voiceForSpeaker("Fizzy Chef Mateo")).toEqual(voiceForSpeaker("Chef Mateo"));

    const base = blipFrequency("Fae", 5, "h");
    expect(base).not.toBeNull();
    if (base === null) return;

    const qProsody = dialogueProsody("Who is in the purple hood?", 25);
    const qBlip = blipFrequency("Fae", 5, "h", qProsody);
    expect(qBlip?.frequency).toBeGreaterThan(base.frequency);
    expect(qBlip?.endFrequency).toBeGreaterThan(qBlip?.frequency ?? 0);

    const exProsody = dialogueProsody("You're a star, Fae!", 10);
    const exBlip = blipFrequency("Fae", 5, "h", exProsody);
    expect(exBlip?.frequency).toBeGreaterThan(base.frequency);
    expect(exBlip?.gain).toBeGreaterThan(base.gain);
    expect(exBlip?.endFrequency).toBeGreaterThan(exBlip?.frequency ?? 0);

    const whProsody = dialogueProsody("I only wanted to be noticed...", 10);
    const whBlip = blipFrequency("Fae", 5, "h", whProsody);
    expect(whBlip?.frequency).toBeLessThan(base.frequency);
    expect(whBlip?.gain).toBeLessThan(base.gain);
    expect(whBlip?.endFrequency).toBeLessThan(whBlip?.frequency ?? 0);

    const oliverBase = blipFrequency("Oliver", 4, "a");
    const oliverExclaim = blipFrequency("Oliver", 4, "a", exProsody);
    expect(oliverExclaim?.frequency).toBeGreaterThan(oliverBase?.frequency ?? 0);
    expect(oliverExclaim?.endFrequency).toBeGreaterThan(oliverBase?.endFrequency ?? 0);

    expect(blipFrequency("Fae", 5, "!", exProsody)).toBeNull();
  });

  it("keeps voices.ts and audio.ts under 1,000 lines with prosody wired", () => {
    const voicesSource = readFileSync("src/platform/voices.ts", "utf8");
    const audioSource = readFileSync("src/platform/audio.ts", "utf8");
    expect(voicesSource.split("\n").length).toBeLessThan(1000);
    expect(audioSource.split("\n").length).toBeLessThan(1000);
    expect(audioSource).toContain("dialogueProsody(text, revealed)");
    expect(audioSource).toContain(
      "blipFrequency(info?.speaker ?? null, revealed ?? tick, char, prosody)",
    );
  });
});

describe("Milestone 152: Warm Low-Pass Music Ducking & Bar-Quantized Track Resume", () => {
  it("maps duck state to warm low-pass cutoff constants", () => {
    expect(DUCK_FILTER_DUCKED_HZ).toBe(2600);
    expect(DUCK_FILTER_OPEN_HZ).toBe(18000);
    expect(duckFilterCutoff(true)).toBe(2600);
    expect(duckFilterCutoff(false)).toBe(18000);
  });

  it("always starts FRESH_START_TRACKS at step 0", () => {
    expect([...FRESH_START_TRACKS].sort()).toEqual([...EXPECTED_FRESH_TRACKS].sort());

    for (const track of EXPECTED_FRESH_TRACKS) {
      const score = scores[track];
      const totalSteps = score.stepsPerBar * score.bars;
      for (const saved of [undefined, 0, 1, 12, 16, 47, totalSteps - 1, totalSteps + 23]) {
        expect(resumeBarStep(track, saved, totalSteps, score.stepsPerBar), `${track}:${saved}`)
          .toBe(0);
      }
    }
  });

  it("quantizes mid-bar steps to exact bar downbeats across all 24 scores (4/4 and 3/4)", () => {
    expect(resumeBarStep("home", 0, 256, 16)).toBe(0);
    expect(resumeBarStep("home", 15, 256, 16)).toBe(0);
    expect(resumeBarStep("home", 16, 256, 16)).toBe(16);
    expect(resumeBarStep("home", 53, 256, 16)).toBe(48);
    expect(resumeBarStep("bay", 143, 256, 16)).toBe(128);
    expect(resumeBarStep("pass", 255, 256, 16)).toBe(240);

    expect(resumeBarStep("market", 0, 192, 12)).toBe(0);
    expect(resumeBarStep("market", 11, 192, 12)).toBe(0);
    expect(resumeBarStep("market", 12, 192, 12)).toBe(12);
    expect(resumeBarStep("market", 29, 192, 12)).toBe(24);
    expect(resumeBarStep("cabin", 191, 192, 12)).toBe(180);

    const explorationTracks = ALL_PLAYABLE_TRACKS.filter((t) => !FRESH_START_TRACKS.has(t));
    expect(explorationTracks).toHaveLength(24);

    let sawFourFour = 0;
    let sawThreeFour = 0;
    for (const track of explorationTracks) {
      const score = scores[track];
      const totalSteps = score.stepsPerBar * score.bars;
      if (score.stepsPerBar === 16) sawFourFour += 1;
      if (score.stepsPerBar === 12) sawThreeFour += 1;

      for (let bar = 0; bar < score.bars; bar += 1) {
        const downbeat = bar * score.stepsPerBar;
        for (const offset of [0, 1, Math.floor(score.stepsPerBar / 2), score.stepsPerBar - 1]) {
          const resumed = resumeBarStep(track, downbeat + offset, totalSteps, score.stepsPerBar);
          expect(resumed, `${track} bar ${bar} +${offset}`).toBe(downbeat);
          expect(resumed % score.stepsPerBar, `${track} aligned`).toBe(0);
          expect(resumed, `${track} in bounds`).toBeGreaterThanOrEqual(0);
          expect(resumed, `${track} < totalSteps`).toBeLessThan(totalSteps);
        }
      }
    }
    expect(sawFourFour).toBeGreaterThan(0);
    expect(sawThreeFour).toBeGreaterThan(0);
  });

  it("handles undefined, negative, fractional, NaN, overflow, and invalid bounds safely", () => {
    expect(resumeBarStep("home", undefined, 256, 16)).toBe(0);
    expect(resumeBarStep("home", Number.NaN, 256, 16)).toBe(0);
    expect(resumeBarStep("home", Number.POSITIVE_INFINITY, 256, 16)).toBe(0);
    expect(resumeBarStep("home", Number.NEGATIVE_INFINITY, 256, 16)).toBe(0);

    expect(resumeBarStep("home", 32, 0, 16)).toBe(0);
    expect(resumeBarStep("home", 32, -256, 16)).toBe(0);
    expect(resumeBarStep("home", 32, Number.NaN, 16)).toBe(0);
    expect(resumeBarStep("home", 32, Number.POSITIVE_INFINITY, 16)).toBe(0);
    expect(resumeBarStep("home", 32, 256, 0)).toBe(0);
    expect(resumeBarStep("home", 32, 256, -16)).toBe(0);
    expect(resumeBarStep("home", 32, 256, Number.NaN)).toBe(0);

    expect(resumeBarStep("home", 256, 256, 16)).toBe(0);
    expect(resumeBarStep("home", 275, 256, 16)).toBe(16);
    expect(resumeBarStep("market", 192 * 3 + 29, 192, 12)).toBe(24);

    expect(resumeBarStep("sanctuary", 31.9, 256, 16)).toBe(16);
    expect(resumeBarStep("cottage", 48.2, 256, 16)).toBe(48);

    expect(resumeBarStep("parlor", -1, 256, 16)).toBe(240);
    expect(resumeBarStep("parlor", -16, 256, 16)).toBe(240);
    expect(resumeBarStep("market", -1, 192, 12)).toBe(180);
    expect(Object.is(resumeBarStep("home", -256, 256, 16), 0)).toBe(true);
    expect(Object.is(resumeBarStep("home", -0, 256, 16), 0)).toBe(true);
  });

  it("keeps music.ts under 1,000 lines with duck filter and bar-quantized resume wired", () => {
    const source = readFileSync("src/platform/music.ts", "utf8");
    expect(source.split("\n").length).toBeLessThan(1000);
    expect(source).toContain("typeof context.createBiquadFilter === \"function\"");
    expect(source).toContain("duckGain.connect(duckFilter).connect(masterGain)");
    expect(source).toContain("duckFilterCutoff(currentDuck)");
    expect(source).toContain("savedSteps.set(currentTrack, currentStep)");
    expect(source).toContain("resumeBarStep(");
  });
});
