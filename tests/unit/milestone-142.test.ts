import { describe, expect, it } from "vitest";
import { loadContent, storyTags } from "../../src/content/load";
import { createState, startBattle, type SoundCue, type State } from "../../src/core";
import { voiceForSpeaker } from "../../src/platform/voices";
import { hapticForTick } from "../../src/shell/feedback";
import { speakerAccent, speakerPortraitSource } from "../../src/ui/portraits";

const { world, fixtures } = loadContent();

const SIGN_SPEAKERS = new Set([
  "Sign",
  "Notice board",
  "Sanctuary Board",
  "Glow Note",
  "Chalkboard",
  "Flyer",
  "Trail Note",
]);

function baseState(): State {
  const fixture = fixtures["new-game"];
  if (fixture === undefined) throw new Error("Missing new-game fixture");
  return createState(world, fixture, 1);
}

describe("Milestone 142: 100% Cast Voice & Portrait Parity", () => {
  it("gives every compiled story speaker and battle critter a real voice and cast accent", () => {
    const storySpeakers = new Set<string>();
    for (const tag of storyTags(world.story)) {
      if (tag.startsWith("speaker:")) {
        storySpeakers.add(tag.slice("speaker:".length).trim());
      }
    }
    const critterNames = Object.values(world.critters).map((critter) => critter.name);
    const allSpeakers = [...new Set([...storySpeakers, ...critterNames])].sort();

    expect(storySpeakers.size).toBeGreaterThanOrEqual(67);
    expect(critterNames.length).toBeGreaterThanOrEqual(29);
    expect(allSpeakers.length).toBeGreaterThanOrEqual(92);

    const fallbackVoice = voiceForSpeaker("__unknown__");
    const narrationVoice = voiceForSpeaker(null);

    for (const speaker of allSpeakers) {
      expect(voiceForSpeaker(speaker), `${speaker} must not use fallback voice`).not.toEqual(
        fallbackVoice,
      );
      if (SIGN_SPEAKERS.has(speaker)) {
        expect(speakerAccent(speaker), `${speaker} sign accent`).toBe("default");
        expect(voiceForSpeaker(speaker), `${speaker} sign narration voice`).toEqual(
          narrationVoice,
        );
      } else {
        expect(speakerAccent(speaker), `${speaker} must have a cast accent`).not.toBe("default");
      }
    }
  });

  it("matches all six mini-bosses to their base voices, accents, and portraits", () => {
    const miniBosses = [
      { fizzy: "Fizzy Mr. Pip", base: "Mr. Pip", accent: "town" },
      { fizzy: "Fizzy Mrs. Flurry", base: "Mrs. Flurry", accent: "town" },
      { fizzy: "Fizzy Ms. Coral", base: "Ms. Coral", accent: "town" },
      { fizzy: "Fizzy Ms. Rowan", base: "Ms. Rowan", accent: "school" },
      { fizzy: "Fizzy Mr. Bell", base: "Mr. Bell", accent: "school" },
      { fizzy: "Fizzy Kid", base: "Hooded kid", accent: "mystery" },
    ] as const;

    for (const entry of miniBosses) {
      expect(voiceForSpeaker(entry.fizzy), `${entry.fizzy} voice`).toEqual(
        voiceForSpeaker(entry.base),
      );
      expect(speakerAccent(entry.fizzy), `${entry.fizzy} accent`).toBe(entry.accent);
      expect(speakerPortraitSource(world, entry.fizzy), `${entry.fizzy} portrait`).not.toBeNull();
    }

    expect(voiceForSpeaker("Kid")).toEqual(voiceForSpeaker("Hooded kid"));
  });

  it("maps Plaza sidewalk Grocer and Scoops windows to Pippin and Penny bust portraits", () => {
    const grocer = speakerPortraitSource(world, "Grocer");
    const pippin = speakerPortraitSource(world, "Grocer Pippin");
    expect(grocer).not.toBeNull();
    expect(grocer).toEqual(pippin);
    expect(grocer?.atlas).toContain("pippin");
    expect(grocer?.cropMode).toBe("adult");

    const scoops = speakerPortraitSource(world, "Scoops");
    const penny = speakerPortraitSource(world, "Scooper Penny");
    expect(scoops).not.toBeNull();
    expect(scoops).toEqual(penny);
    expect(scoops?.atlas).toContain("penny");
    expect(scoops?.cropMode).toBe("adult");
  });
});

describe("Milestone 142: Complete Tactile Haptic Coverage", () => {
  it("maps every celebrate, medium, light, priority, and quiet cue accurately", () => {
    const idle = baseState();
    const firstCritter = Object.values(world.critters)[0];
    if (firstCritter === undefined) throw new Error("Missing critter");
    const battle = startBattle(world, idle, firstCritter);
    const inBattle: State = { ...idle, battle };
    const soothed: State = { ...idle, battle: { ...battle, phase: "soothed" } };
    const greatHit: State = { ...idle, battle: { ...battle, lastGrade: "great" } };
    const goodHit: State = { ...idle, battle: { ...battle, lastGrade: "good" } };

    // Celebrate triggers (state transitions + cues).
    expect(hapticForTick(idle, idle, [], { goldenCooked: true })).toBe("celebrate");
    expect(hapticForTick(inBattle, soothed, [])).toBe("celebrate");
    expect(hapticForTick(soothed, soothed, [])).toBeNull();

    const celebrateCues: readonly SoundCue[] = [
      "battle-together",
      "prize-won",
      "fish-catch",
      "level-up",
      "sticker",
      "skee-hundred",
    ];
    for (const cue of celebrateCues) {
      expect(hapticForTick(idle, idle, [cue]), `${cue} -> celebrate`).toBe("celebrate");
    }

    // Medium triggers (GREAT! battle hit + cues).
    expect(hapticForTick(inBattle, greatHit, ["battle-hit"])).toBe("medium");
    expect(hapticForTick(inBattle, goodHit, ["battle-hit"])).toBeNull();

    const mediumCues: readonly SoundCue[] = ["comet-bump", "lasso-twirl", "cook-ding"];
    for (const cue of mediumCues) {
      expect(hapticForTick(idle, idle, [cue]), `${cue} -> medium`).toBe("medium");
    }

    // Light triggers.
    const lightCues: readonly SoundCue[] = [
      "claw-grab",
      "mole-boop",
      "fish-bite",
      "skee-score",
      "comet-star",
      "flute",
      "lantern-on",
      "coin",
      "item",
    ];
    for (const cue of lightCues) {
      expect(hapticForTick(idle, idle, [cue]), `${cue} -> light`).toBe("light");
    }

    // Priority ordering: celebrate > medium > light.
    expect(hapticForTick(idle, idle, ["coin", "comet-bump", "sticker"])).toBe("celebrate");
    expect(hapticForTick(idle, idle, ["cook-ding", "coin"], { goldenCooked: true })).toBe(
      "celebrate",
    );
    expect(hapticForTick(inBattle, soothed, ["battle-hit", "flute"])).toBe("celebrate");
    expect(hapticForTick(idle, idle, ["coin", "cook-ding"])).toBe("medium");
    expect(hapticForTick(idle, idle, ["lantern-on", "lasso-twirl"])).toBe("medium");
    expect(hapticForTick(inBattle, greatHit, ["battle-hit", "item"])).toBe("medium");
    expect(hapticForTick(inBattle, goodHit, ["battle-hit", "coin"])).toBe("light");

    // Quiet cues stay silent.
    const quietCues: readonly SoundCue[] = [
      "dialogue-blip",
      "footstep-grass",
      "choice-move",
      "dialogue-open",
      "area-arrive",
    ];
    for (const cue of quietCues) {
      expect(hapticForTick(idle, idle, [cue]), `${cue} -> null`).toBeNull();
    }
    expect(hapticForTick(idle, idle, [])).toBeNull();
  });
});
