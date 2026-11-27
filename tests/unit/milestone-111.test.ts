import { describe, expect, it } from "vitest";
import { loadContent, storyTagErrors, storyTags } from "../../src/content/load";
import {
  carriedTreats,
  createState,
  journalNotes,
  soundCues,
  startDialogue,
  step,
  type Battle,
  type Fixture,
  type State,
} from "../../src/core";
import { inkVariable, setInkVariables } from "../../src/core/ink";
import { runConsoleCommand, type ConsoleContext } from "../../src/dev/console";
import { scores, type PlayableTrack } from "../../src/platform/scores";
import { townScores } from "../../src/platform/scores-town";
import { wildsScores } from "../../src/platform/scores-wilds";
import { evaluateSunberryMotes, hasSunberryBloom } from "../../src/render/clubhouse-display";
import { continueDetail } from "../../src/shell/title-flow";

const content = loadContent();
const { world } = content;
const blank = { move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false };

function fixtureOf(name: string): Fixture {
  const fixture = content.fixtures[name];
  if (fixture === undefined) throw new Error(`missing fixture ${name}`);
  return fixture;
}

function press(state: State, key: "confirm" | "cancel" = "confirm"): State {
  const down = step(world, state, { ...blank, [key]: true }).state;
  return step(world, down, blank).state;
}

function runClubGarden(
  start: State,
  choice = 0,
): { state: State; lines: string[]; choices: string[]; cues: string[] } {
  let state = startDialogue(world, start, "club_garden");
  const lines: string[] = [];
  let seenChoices: string[] = [];
  const cues: string[] = [];
  for (let count = 0; count < 60 && state.dialogue !== null; count += 1) {
    const dialogue = state.dialogue;
    if (dialogue.revealed < dialogue.text.length) {
      const next = press(state);
      cues.push(...soundCues(state, next, world));
      state = next;
      continue;
    }
    if (lines.at(-1) !== dialogue.text) lines.push(dialogue.text);
    if (dialogue.choices.length > 0 && seenChoices.length === 0)
      seenChoices = [...dialogue.choices];
    const next = dialogue.choices.length === 0
      ? press(state)
      : step(world, state, { ...blank, choose: choice }).state;
    cues.push(...soundCues(state, next, world));
    state = next;
  }
  expect(state.dialogue).toBeNull();
  return { state, lines, choices: seenChoices, cues };
}

function battleState(
  critterId: string,
  overrides: Partial<State> = {},
  battleOverrides: Partial<Battle> = {},
): State {
  const critter = world.critters[critterId];
  if (critter === undefined) throw new Error(`missing critter ${critterId}`);
  const base = createState(world, fixtureOf("plaza"));
  const battle: Battle = {
    critterId,
    den: null,
    entry: base.player,
    phase: "command",
    message: critter.lines.command,
    revealed: critter.lines.command.length,
    selected: 2,
    command: null,
    energy: 1,
    calm: 0,
    rest: { play: 2 },
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    rewardSticker: null,
    phaseTicks: 0,
    ...battleOverrides,
  };
  return { ...base, ...overrides, battle };
}

describe("Milestone 111: Clubhouse Magical Sunberry Harvest", () => {
  it("loads sunberry-nectar and validates gift: treat tags strictly", () => {
    const sunberry = world.treats.find((item) => item.id === "sunberry-nectar");
    expect(sunberry).toBeDefined();
    expect(sunberry).toMatchObject({
      id: "sunberry-nectar",
      name: "Golden Sunberry",
      price: 15,
      energy: 4,
      calm: 45,
      favouriteCalm: 60,
    });
    expect(sunberry?.favourites).toEqual([
      "squirrel",
      "bunny",
      "hedgehog",
      "lamb",
      "owl",
      "moon-owl",
      "hooded-kid",
    ]);

    const treatPrices = Object.fromEntries(world.treats.map((t) => [t.id, t.price]));
    const counterPrices = Object.fromEntries(
      world.arcade.counter.prizes.map((p) => [p.prize, p.price]),
    );
    expect(storyTagErrors(storyTags(world.story), world.areas, counterPrices, treatPrices))
      .toEqual([]);
    expect(storyTagErrors(
      ["gift: treat sunberry-nectar 1", "gift: snack 3", "gift: coins 10"],
      world.areas,
      counterPrices,
      treatPrices,
    )).toEqual([]);
    expect(storyTagErrors(
      [
        "gift: treat unknown-berry 1",
        "gift: treat sunberry-nectar 0",
        "gift: treat sunberry-nectar",
      ],
      world.areas,
      counterPrices,
      treatPrices,
    )).toHaveLength(3);
  });

  it("keeps first harvest unchanged and offers Golden Sunberry on subsequent ripe harvests", () => {
    const base = createState(world, fixtureOf("clubhouse"));
    const firstRipe: State = {
      ...base,
      ink: setInkVariables(base.ink, {
        fridge_fixed: true,
        garden_planted: true,
        garden_sprouted: true,
        garden_ripe: true,
      }),
    };
    expect(hasSunberryBloom(world, firstRipe)).toBe(false);
    expect(evaluateSunberryMotes(world, firstRipe)).toEqual([]);

    // First harvest yields strawberry basket directly with no prompt (zero replay drift).
    const first = runClubGarden(firstRipe);
    expect(first.choices).toEqual([]);
    expect(inkVariable(world.story, first.state.ink, "fridge_baskets")).toBe("1");
    expect(inkVariable(world.story, first.state.ink, "sunberry_harvests")).toBe("0");
    expect(inkVariable(world.story, first.state.ink, "garden_ripe")).toBe(false);
    expect(first.state.treats).toBeUndefined();

    // Second ripe harvest unlocks Golden Sunberry shimmer & choice.
    const secondRipe: State = {
      ...first.state,
      ink: setInkVariables(first.state.ink, { garden_ripe: true }),
    };
    expect(hasSunberryBloom(world, secondRipe)).toBe(true);
    const motes = evaluateSunberryMotes(world, secondRipe);
    expect(motes).toHaveLength(6);
    for (const mote of motes) {
      expect(mote.tint).toBe(0xffd966);
      expect(mote.x).toBeGreaterThanOrEqual(630);
      expect(mote.x).toBeLessThanOrEqual(980);
    }
    const reduced = evaluateSunberryMotes(world, secondRipe, true);
    expect(reduced).toHaveLength(6);

    const plucked = runClubGarden(secondRipe, 1);
    expect(plucked.choices).toEqual([
      "Pick a strawberry basket",
      "Pluck a magical Golden Sunberry",
    ]);
    expect(plucked.state.treats).toEqual({ "sunberry-nectar": 1 });
    expect(inkVariable(world.story, plucked.state.ink, "sunberry_harvests")).toBe("1");
    expect(inkVariable(world.story, plucked.state.ink, "garden_ripe")).toBe(false);
    expect(plucked.cues).toContain("item");
    expect(plucked.cues).toContain("chime-yellow");
    expect(carriedTreats(world, plucked.state)).toEqual([
      { id: "sunberry-nectar", name: "Golden Sunberry", count: 1 },
    ]);
    expect(journalNotes(world, plucked.state).some((line) => line.includes("Golden Sunberries")))
      .toBe(true);

    // Strawberry basket choice remains available on later ripe harvests too.
    const thirdRipe: State = {
      ...plucked.state,
      ink: setInkVariables(plucked.state.ink, { garden_ripe: true }),
    };
    const basket = runClubGarden(thirdRipe, 0);
    expect(inkVariable(world.story, basket.state.ink, "fridge_baskets")).toBe("2");
    expect(inkVariable(world.story, basket.state.ink, "sunberry_harvests")).toBe("1");
  });

  it("restores +4 energy and adds +45 calm (+60 for woodland favourites) in battle", () => {
    const frogStart = battleState("fountain-frog", {
      snacks: 0,
      treats: { "sunberry-nectar": 1 },
    });
    const frogOpen = press(frogStart);
    const frogAfter = step(world, frogOpen, { ...blank, choose: 0 }).state;
    expect(frogAfter.battle?.energy).toBe(5);
    expect(frogAfter.battle?.calm).toBe(45);
    expect(frogAfter.battle?.message).toContain("glowing Golden Sunberry");
    expect(frogAfter.treats).toBeUndefined();

    const squirrelStart = battleState("squirrel", {
      snacks: 0,
      treats: { "sunberry-nectar": 1 },
      stickers: ["squirrel"],
    });
    const squirrelOpen = press(squirrelStart);
    const squirrelAfter = step(world, squirrelOpen, { ...blank, choose: 0 }).state;
    expect(squirrelAfter.battle?.energy).toBe(5);
    expect(squirrelAfter.battle?.calm).toBe(60);
    expect(squirrelAfter.battle?.message).toContain("woodland favourite");
  });

  it("supports QA console garden ripe command cleanly", () => {
    const context: ConsoleContext = {
      story: world.story,
      stickerIds: world.stickers.catalogue.map((s) => s.id),
      prizeIds: world.arcade.prizes.map((p) => p.id),
      treatIds: world.treats.map((t) => t.id),
      fishIds: world.arcade.fish.catches.map((f) => f.id),
      thresholds: world.levels.thresholds,
    };
    const start = createState(world, fixtureOf("clubhouse"));
    const outcome = runConsoleCommand(context, start, "garden ripe");
    expect(outcome.kind).toBe("applied");
    if (outcome.kind !== "applied") return;
    expect(hasSunberryBloom(world, outcome.state)).toBe(true);
    expect(runConsoleCommand(context, start, "garden bloom").kind).toBe("error");
  });
});

describe("Milestone 111: Enriched Title Continue summary", () => {
  it("preserves base format when highlights are 0 and appends up to 2 highlights", () => {
    const base = createState(world, fixtureOf("plaza"));
    const oneSticker: State = { ...base, stickers: ["fountain-frog"] };
    expect(continueDetail(world, oneSticker)).toBe("Town plaza · 1 sticker");

    const withGems: State = {
      ...oneSticker,
      ink: setInkVariables(oneSticker.ink, { gem_park: true, gem_bay: true }),
    };
    expect(continueDetail(world, withGems)).toBe("Town plaza · 1 sticker · 2/7 gems");

    const withKeepsake: State = {
      ...oneSticker,
      ink: setInkVariables(oneSticker.ink, { spice_returned: true }),
    };
    expect(continueDetail(world, withKeepsake)).toBe("Town plaza · 1 sticker · 1 keepsake");

    const withFish: State = {
      ...oneSticker,
      caughtFish: { minnow: 2, starfish: 1 },
    };
    expect(continueDetail(world, withFish)).toBe("Town plaza · 1 sticker · 2 fish");

    const withAllThree: State = {
      ...oneSticker,
      ink: setInkVariables(oneSticker.ink, {
        gem_park: true,
        spice_returned: true,
        sue_compass: true,
      }),
      caughtFish: { minnow: 1, starfish: 1 },
    };
    expect(continueDetail(world, withAllThree))
      .toBe("Town plaza · 1 sticker · 1/7 gems · 2 keepsakes");

    const keepsakesAndFish: State = {
      ...oneSticker,
      ink: setInkVariables(oneSticker.ink, { spice_returned: true }),
      caughtFish: { minnow: 1 },
    };
    expect(continueDetail(world, keepsakesAndFish))
      .toBe("Town plaza · 1 sticker · 1 keepsake · 1 fish");
  });
});

describe("Milestone 111: Modular scores.ts split", () => {
  it("exposes all 20 tracks across townScores and wildsScores with valid structure", () => {
    const expectedTracks: readonly PlayableTrack[] = [
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
    expect(Object.keys(scores)).toEqual(expectedTracks);
    expect(Object.keys(townScores)).toHaveLength(10);
    expect(Object.keys(wildsScores)).toHaveLength(10);
    for (const trackId of expectedTracks) {
      const score = scores[trackId];
      expect(score.bpm, `${trackId} bpm`).toBeGreaterThan(0);
      expect(score.bars, `${trackId} bars`).toBeGreaterThan(0);
      expect(score.stepsPerBar, `${trackId} stepsPerBar`).toBeGreaterThan(0);
      expect(score.tracks.length, `${trackId} tracks`).toBeGreaterThan(0);
      for (const track of score.tracks) {
        expect(track.notes.length, `${trackId}/${track.voice} notes`).toBeGreaterThan(0);
      }
    }
  });
});
