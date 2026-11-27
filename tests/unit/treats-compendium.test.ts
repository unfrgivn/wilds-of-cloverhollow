import { describe, expect, it } from "vitest";
import { loadContent, parseTreats, storyTagErrors, storyTags } from "../../src/content/load";
import {
  addTreat,
  battleCommands,
  battleView,
  carriedTreats,
  createState,
  critterFieldNote,
  parseSave,
  serializeSave,
  soundCues,
  stableHash,
  step,
  targetInteractable,
  totalTreatCount,
  type Battle,
  type Fixture,
  type State,
} from "../../src/core";

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

function talkShop(start: State, choice: number): {
  state: State;
  lines: string[];
  choices: string[];
  cues: string[];
} {
  let state = press(start);
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
    selected: 0,
    command: null,
    energy: 2,
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

describe("specialty treats catalogue & validation", () => {
  it("loads all 7 treats and covers every critter species across the game", () => {
    expect(world.treats.map((item) => item.id)).toEqual([
      "orchard-apple",
      "fish-cracker",
      "berry-cone",
      "cocoa-sundae",
      "sea-salt-taffy",
      "maple-brittle",
      "sunberry-nectar",
    ]);
    const allSpecies = [...new Set(Object.values(world.critters).map((c) => c.species))].sort();
    expect(allSpecies).toHaveLength(world.stickers.catalogue.length);
    for (const species of allSpecies) {
      const liked = world.treats.filter((treat) => treat.favourites.includes(species));
      expect(liked.length, `${species} must have a favourite treat`).toBeGreaterThanOrEqual(1);
    }
  });

  it("rejects invalid treat definitions and bad buy-treat tags", () => {
    const valid = {
      id: "apple-tart",
      name: "Apple Tart",
      price: 8,
      energy: 2,
      calm: 15,
      favouriteCalm: 45,
      favourites: ["frog"],
      description: "Warm crust.",
      useLine: "Yum!",
      favouriteLine: "Super yum!",
    };
    expect(() => parseTreats({ treats: [] }, "treats.json", world.critters)).toThrow();
    expect(() => parseTreats(
      { treats: [{ ...valid, id: "snack" }] },
      "treats.json",
      world.critters,
    )).toThrow();
    expect(() => parseTreats(
      { treats: [valid, valid] },
      "treats.json",
      world.critters,
    )).toThrow(/duplicate/);
    expect(() => parseTreats(
      { treats: [{ ...valid, favouriteCalm: 10 }] },
      "treats.json",
      world.critters,
    )).toThrow(/favouriteCalm/);
    expect(() => parseTreats(
      { treats: [{ ...valid, favourites: ["unicorn"] }] },
      "treats.json",
      world.critters,
    )).toThrow(/unknown species/);
    expect(() => parseTreats(
      { treats: [{ ...valid, favourites: ["frog", "frog"] }] },
      "treats.json",
      world.critters,
    )).toThrow(/duplicate species/);

    const treatPrices = Object.fromEntries(world.treats.map((t) => [t.id, t.price]));
    const counterPrices = Object.fromEntries(
      world.arcade.counter.prizes.map((p) => [p.prize, p.price]),
    );
    expect(storyTagErrors(storyTags(world.story), world.areas, counterPrices, treatPrices))
      .toEqual([]);
    expect(storyTagErrors(
      ["buy-treat: orchard-apple 9", "buy-treat: mystery 8", "buy-treat: orchard-apple"],
      world.areas,
      counterPrices,
      treatPrices,
    )).toHaveLength(3);
  });
});

describe("Cloverhollow Plaza grocery & ice cream shops", () => {
  it("places reachable grocery and ice-cream interactables in the plaza", () => {
    const plaza = world.areas.plaza;
    if (plaza === undefined) throw new Error("plaza missing");
    expect(plaza.interactables.map((item) => item.id)).toEqual(
      expect.arrayContaining(["grocery", "ice-cream"]),
    );
    const atGrocery: State = {
      ...createState(world, fixtureOf("plaza")),
      player: { x: 655, y: 375 },
      facing: "up",
    };
    const atIceCream: State = {
      ...createState(world, fixtureOf("plaza")),
      player: { x: 895, y: 375 },
      facing: "up",
    };
    expect(targetInteractable(world, atGrocery)?.id).toBe("grocery");
    expect(targetInteractable(world, atIceCream)?.id).toBe("ice-cream");
  });

  it("sells grocery treats for 8 coins, emits item cue, and refuses when short", () => {
    const base = {
      ...createState(world, fixtureOf("plaza")),
      player: { x: 655, y: 375 },
      facing: "up" as const,
    };
    const short = talkShop({ ...base, coins: 7 }, 0);
    expect(short.lines.at(-1)).toContain("8 coins each");
    expect(short.state.coins).toBe(7);
    expect(short.state.treats).toBeUndefined();

    const apple = talkShop({ ...base, coins: 16 }, 0);
    expect(apple.choices).toEqual([
      "Orchard Apple (8 coins)",
      "Fish Cracker (8 coins)",
      "Not now",
    ]);
    expect(apple.state.coins).toBe(8);
    expect(apple.state.treats).toEqual({ "orchard-apple": 1 });
    expect(apple.cues).toContain("item");

    const fish = talkShop(apple.state, 1);
    expect(fish.state.coins).toBe(0);
    expect(fish.state.treats).toEqual({ "orchard-apple": 1, "fish-cracker": 1 });
    expect(fish.cues).toContain("item");
  });

  it("sells ice cream treats for 10 and 12 coins and gates choices by coins", () => {
    const base = {
      ...createState(world, fixtureOf("plaza")),
      player: { x: 895, y: 375 },
      facing: "up" as const,
    };
    const short = talkShop({ ...base, coins: 9 }, 0);
    expect(short.lines.at(-1)).toContain("10 coins");
    expect(short.state.treats).toBeUndefined();

    const ten = talkShop({ ...base, coins: 10 }, 0);
    expect(ten.choices).toEqual(["Berry Swirl Cone (10 coins)", "Not now"]);
    expect(ten.state.coins).toBe(0);
    expect(ten.state.treats).toEqual({ "berry-cone": 1 });
    expect(ten.cues).toContain("item");

    const twelve = talkShop({ ...base, coins: 12 }, 1);
    expect(twelve.choices).toEqual([
      "Berry Swirl Cone (10 coins)",
      "Cozy Cocoa Sundae (12 coins)",
      "Not now",
    ]);
    expect(twelve.state.coins).toBe(0);
    expect(twelve.state.treats).toEqual({ "cocoa-sundae": 1 });
    expect(twelve.cues).toContain("item");
  });
});

describe("save compatibility for optional state.treats", () => {
  it("preserves fresh-game hash without treats, round-trips treats, and rejects bad data", () => {
    const fresh = createState(world, fixtureOf("new-game"), 1);
    expect("treats" in fresh).toBe(false);
    expect(totalTreatCount(fresh.treats)).toBe(0);
    const restoredFresh = parseSave(serializeSave(fresh), fresh);
    expect(restoredFresh).not.toBeNull();
    if (restoredFresh === null) throw new Error("expected fresh save to load");
    expect(stableHash(restoredFresh)).toBe(stableHash(fresh));

    const withTreats = addTreat(addTreat(fresh, "fish-cracker", 2), "berry-cone", 1);
    const restoredTreats = parseSave(serializeSave(withTreats), fresh);
    expect(restoredTreats?.treats).toEqual({ "fish-cracker": 2, "berry-cone": 1 });

    const malformed = [
      { "fish-cracker": 0 },
      { "fish-cracker": -2 },
      { "fish-cracker": 100 },
      { "fish-cracker": 1.5 },
      { "Bad ID": 1 },
      ["fish-cracker"],
      "fish-cracker",
    ];
    for (const bad of malformed) {
      const json = JSON.stringify({ version: 10, state: { ...fresh, treats: bad } });
      expect(parseSave(json, fresh), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("battle Treat Tray and favourite treats", () => {
  it("uses plain snack directly when no specialty treats are carried", () => {
    const start = battleState("fountain-frog", { snacks: 2 }, { selected: 2 });
    const after = press(start);
    expect(after.snacks).toBe(1);
    expect(after.battle?.phase).toBe("result");
    expect(after.battle?.treatMenu).toBeUndefined();
    expect(battleView(world, after)?.treatTray).toBeNull();
  });

  it("opens Treat Tray when specialty treats exist, wraps navigation, and cancels cleanly", () => {
    const start = battleState(
      "fountain-frog",
      {
        snacks: 1,
        treats: { "fish-cracker": 1, "orchard-apple": 1 },
        stickers: ["fountain-frog"],
      },
      { selected: 2, sparkle: 3 },
    );
    const snackCommand = battleCommands(world, start).find((cmd) => cmd.id === "snack");
    expect(snackCommand).toMatchObject({ detail: "×3", disabled: false });

    const opened = press(start);
    expect(opened.battle?.treatMenu).toBe(true);
    const tray = battleView(world, opened)?.treatTray;
    expect(tray?.selected).toBe(0);
    expect(tray?.items.map((item) => [item.id, item.count, item.favourite])).toEqual([
      ["snack", 1, false],
      ["orchard-apple", 1, false],
      ["fish-cracker", 1, true],
      ["back", 0, false],
    ]);

    const up = step(world, opened, { ...blank, move: { x: 0, y: -1 } }).state;
    expect(battleView(world, up)?.treatTray?.selected).toBe(3);

    // Cancel closes tray without spending a turn or firing Together!
    const cancelled = press(up, "cancel");
    expect(cancelled.battle?.phase).toBe("command");
    expect(cancelled.battle?.treatMenu).toBeUndefined();
    expect(cancelled.battle?.sparkle).toBe(3);
    expect(cancelled.snacks).toBe(1);
  });

  it("hides favourite badge until species sticker is owned", () => {
    const unknown = battleState(
      "fountain-frog",
      { snacks: 0, treats: { "fish-cracker": 1 }, stickers: [] },
      { selected: 2 },
    );
    const opened = press(unknown);
    const tray = battleView(world, opened)?.treatTray;
    expect(tray?.items.map((item) => [item.id, item.favourite])).toEqual([
      ["fish-cracker", false],
      ["back", false],
    ]);
  });

  it("applies favourite calm, hungry bonus, wind-up pop, and clears empty treats", () => {
    const start = battleState(
      "gull",
      {
        snacks: 0,
        treats: { "fish-cracker": 1 },
        stickers: ["lookout-gull"],
      },
      {
        selected: 2,
        energy: 1,
        calm: 10,
        rest: { play: 2 },
        windUp: { feelings: ["grumpy", "hungry"], popped: [false, false], left: 2 },
      },
    );
    const opened = press(start);
    expect(battleView(world, opened)?.treatTray?.items[0]).toMatchObject({
      id: "fish-cracker",
      favourite: true,
    });
    const used = step(world, opened, { ...blank, choose: 0 }).state;
    expect(used.treats).toBeUndefined();
    expect("treats" in used).toBe(false);
    expect(used.battle?.phase).toBe("result");
    expect(used.battle?.treatMenu).toBeUndefined();
    expect(used.battle?.message).toContain("Fish Crackers! Their favourite!");
    expect(used.battle?.energy).toBe(3);
    // 10 + 45 (favouriteCalm) + 15 (feelingBonus for hungry wind-up bubble) = 70
    expect(used.battle?.calm).toBe(70);
    expect(used.battle?.answered).toBe(true);
    expect(used.battle?.windUp?.popped).toEqual([false, true]);
    expect(used.battle?.rest).toEqual({ play: 1 });
  });

  it("gives base calm and useLine for a non-favourite specialty treat", () => {
    const start = battleState(
      "fountain-frog",
      { snacks: 0, treats: { "orchard-apple": 2 } },
      { selected: 2, energy: 1, calm: 0 },
    );
    const opened = press(start);
    const used = step(world, opened, { ...blank, choose: 0 }).state;
    expect(used.treats).toEqual({ "orchard-apple": 1 });
    expect(used.battle?.phase).toBe("result");
    expect(used.battle?.calm).toBe(15);
    expect(used.battle?.energy).toBe(3);
    expect(used.battle?.message).toContain("Orchard Apple slices");
  });
});

describe("journal Critter Compendium & carried treats", () => {
  it("returns null for unowned/unknown stickers and field notes for owned ones", () => {
    const fresh = createState(world, fixtureOf("plaza"));
    expect(critterFieldNote(world, fresh, "fountain-frog")).toBeNull();
    expect(critterFieldNote(world, fresh, "does-not-exist")).toBeNull();

    const ownedFrog: State = {
      ...fresh,
      stickers: ["fountain-frog", "arcade-keeper"],
      calms: { frog: 3, "arcade-keeper": 4 },
      treats: { "berry-cone": 1, "orchard-apple": 2 },
    };
    const frogNote = critterFieldNote(world, ownedFrog, "fountain-frog");
    expect(frogNote).toEqual({
      stickerId: "fountain-frog",
      name: "Fountain Frog",
      chaosName: "Fizzy Frog",
      level: 2,
      lands: ["Cloverhollow", "Bubblegum Bay"],
      calms: 3,
      oldFriend: true,
      feelings: [
        { id: "bored", label: "Bored" },
        { id: "curious", label: "Curious" },
        { id: "zoomy", label: "Zoomy" },
      ],
      favouriteTreats: ["Fish Cracker", "Berry Swirl Cone", "Sea-Salt Taffy"],
    });

    const keeperNote = critterFieldNote(world, ownedFrog, "arcade-keeper");
    expect(keeperNote).toMatchObject({
      stickerId: "arcade-keeper",
      name: "Mr. Pip",
      chaosName: "Fizzy Mr. Pip",
      level: 7,
      lands: ["Cloverhollow"],
      calms: 4,
      oldFriend: false,
      favouriteTreats: ["Berry Swirl Cone"],
    });

    expect(carriedTreats(world, ownedFrog)).toEqual([
      { id: "orchard-apple", name: "Orchard Apple", count: 2 },
      { id: "berry-cone", name: "Berry Swirl Cone", count: 1 },
    ]);
  });
});
