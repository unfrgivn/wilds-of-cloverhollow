import { describe, expect, it } from "vitest";
import {
  blankInput,
  createCheck,
  createState,
  journalNotes,
  propState,
  propStateName,
  step,
  type ActionFrame,
  type Area,
  type Point,
  type State,
  type World,
} from "../../src/core";
import { createInkState, inkVariable, runInk, type InkFacts } from "../../src/core/ink";
import { areaConnectionErrors, hiddenPositions } from "../../src/content/area-checks";
import { loadContent, storyTagErrors } from "../../src/content/load";

// Contract for Milestone 43, the clubhouse fix-up. Sue fixes the clubhouse's
// old fridge; Jordan plants strawberries on the deck. The garden grows
// as Fae calms critters anywhere (the story's `on_calm` hook, run by the core
// after every calm): one calm sprouts it, three ripen it. Ripe strawberries go
// into the fridge a basket at a time, and each basket is three snacks
// (`gift: snack 3`).

const content = loadContent();
const world = content.world;
const story = world.story;
const quiet: InkFacts = { calmed: {}, coins: 0, snacks: 0, prizes: [], plushesLeft: 0, tickets: 0 };
// The clubhouse is claimed once the woods' owl is calm (Milestone 26).
const owlCalm: InkFacts =
  { calmed: { owl: true }, coins: 0, snacks: 0, prizes: [], plushesLeft: 0, tickets: 0 };
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

type Played = { lines: string[]; tags: string[][]; ink: string };
function play(ink: string, knot: string, choices: number[] = [], facts = quiet): Played {
  const lines: string[] = [];
  const tags: string[][] = [];
  let result = runInk(story, ink, { type: "start", knot }, facts);
  let choice = 0;
  for (let count = 0; count < 60; count += 1) {
    if (result.line !== null) {
      lines.push(result.line.text);
      tags.push(result.line.tags);
    }
    if (result.ended) break;
    result = result.choices.length > 0
      ? runInk(story, result.ink, { type: "choose", index: choices[choice++] ?? 0 }, facts)
      : runInk(story, result.ink, { type: "next" }, facts);
  }
  return { lines, tags, ink: result.ink };
}
const variable = (ink: string, name: string): unknown => inkVariable(story, ink, name);
// The calm hook, as the core runs it: no lines, only its variables.
const calm = (ink: string): string => {
  const ran = play(ink, "on_calm");
  expect(ran.lines).toEqual([]);
  return ran.ink;
};

const fresh = createInkState(story, 1);
const claimed = play(fresh, "clubhouse", [], owlCalm).ink;
const fixed = play(claimed, "club_fridge").ink;
const planted = play(fixed, "club_garden").ink;

describe("Sue's fridge", () => {
  it("is fixed with a bump of Sue's hip", () => {
    const fix = play(claimed, "club_fridge");
    expect(fix.lines).toEqual([
      "An old fridge with its door hanging open. Inside, it's as warm as toast.",
      "Leave it to me! I keep the cooler on my dad's boat running.",
      "Sue wiggles the plug, gives the door a bump with her hip, and...",
      "Hummmm! The door clicks shut, the old fridge shivers, and a cool glow comes on.",
      "Ta-da! Cold and humming. Now the club needs something to keep in it.",
      "Jordan, didn't you bring seeds?",
    ]);
    expect(variable(fix.ink, "fridge_fixed")).toBe(true);
    // Once the garden's planted, Sue doesn't ask Jordan for seeds.
    const later = play(play(claimed, "club_garden").ink, "club_fridge");
    expect(later.lines.at(-1)).toBe(
      "Ta-da! Cold and humming. Now the club needs something to keep in it.");
  });

  it("hums empty until the garden fills it", () => {
    expect(play(fixed, "club_fridge").lines).toEqual([
      "The fridge hums away, nice and cold. It's empty.",
    ]);
    expect(play(planted, "club_fridge").lines).toEqual([
      "The fridge hums away, nice and cold. Strawberries from the deck will keep in here.",
    ]);
  });
});

describe("Jordan's garden", () => {
  it("is planted in the empty planter boxes", () => {
    const plant = play(fixed, "club_garden");
    expect(plant.lines).toEqual([
      "Long wooden planter boxes, full of soil, with nothing growing.",
      "Perfect! I saved strawberry seeds all the way from the pass.",
      "Jordan pokes the seeds into the soil, one by one, and marks each row with a stick.",
      "My grandma says a garden grows best when everything around it is calm.",
      "Then let's calm some critters! Every one we calm, the garden will grow a little.",
    ]);
    expect(variable(plant.ink, "garden_planted")).toBe(true);
    expect(play(plant.ink, "club_garden").lines)
      .toEqual(["The seeds are tucked in. Calm a critter, and they'll sprout!"]);
  });

  it("counts calms only once it's planted: one sprouts it, three ripen it", () => {
    // Calms before planting change nothing.
    expect(variable(calm(calm(fixed)), "garden_calms")).toBe("0");
    const one = calm(planted);
    expect({ calms: variable(one, "garden_calms"), sprouted: variable(one, "garden_sprouted"),
      ripe: variable(one, "garden_ripe") }).toEqual({ calms: "1", sprouted: true, ripe: false });
    expect(play(one, "club_garden").lines).toEqual([
      "Little green leaves, and tiny white flowers!",
      "Two more calm critters, and there'll be strawberries.",
    ]);
    const two = calm(one);
    expect(play(two, "club_garden").lines.at(-1))
      .toBe("One more calm critter, and there'll be strawberries!");
    const three = calm(two);
    expect(variable(three, "garden_ripe")).toBe(true);
    // Ripe, it waits to be picked: more calms don't count.
    expect(variable(calm(three), "garden_calms")).toBe("3");
  });

  it("is picked into the fridge, and grows back after two more calms", () => {
    const ripe = calm(calm(calm(planted)));
    const pick = play(ripe, "club_garden");
    expect(pick.lines).toEqual([
      "Ripe strawberries, red and juicy!",
      "Fae and Jordan fill a whole basket, and tuck it into the fridge.",
      "The plants are still growing. Two more calm critters, and there'll be more!",
    ]);
    expect({ baskets: variable(pick.ink, "fridge_baskets"),
      ripe: variable(pick.ink, "garden_ripe"), calms: variable(pick.ink, "garden_calms") })
      .toEqual({ baskets: "1", ripe: false, calms: "1" });
    expect(variable(calm(calm(pick.ink)), "garden_ripe")).toBe(true);
  });

  it("waits for Sue's fridge before it's picked", () => {
    const unfixed = calm(calm(calm(play(claimed, "club_garden").ink)));
    const wait = play(unfixed, "club_garden");
    expect(wait.lines).toEqual([
      "Ripe strawberries, red and juicy!",
      "The fridge isn't working yet. Let's ask Sue to fix it, so they stay fresh!",
    ]);
    expect(variable(wait.ink, "fridge_baskets")).toBe("0");
  });
});

describe("the fridge's snacks", () => {
  const picked = (times: number): string => {
    let ink = planted;
    for (let count = 0; count < times; count += 1)
      ink = play(calm(calm(calm(ink))), "club_garden").ink;
    return ink;
  };

  it("gives three snacks a basket, every basket at once", () => {
    const two = picked(2);
    expect(variable(two, "fridge_baskets")).toBe("2");
    const take = play(two, "club_fridge", [0]);
    expect(take.lines).toEqual([
      "The fridge is full of cold strawberries from the deck!",
      "Fae packs three strawberry snacks into her backpack.",
      "Fae packs three strawberry snacks into her backpack.",
      "Snacks for the road! Critters love strawberries.",
    ]);
    expect(take.tags.filter((tags) => tags.includes("gift: snack 3"))).toHaveLength(2);
    expect(variable(take.ink, "fridge_baskets")).toBe("0");
    const leave = play(two, "club_fridge", [1]);
    expect(leave.lines.at(-1)).toBe("They'll keep.");
    expect(variable(leave.ink, "fridge_baskets")).toBe("2");
  });

  it("are given by the core as each line is shown, the opening line too", () => {
    // A room with the fridge's take as a look point: its opening line gives
    // three snacks, through the core's own dialogue.
    const harness = world.areas.harness;
    const spawn = harness?.spawns.start;
    if (harness === undefined || spawn === undefined) throw new Error("no harness");
    const point: Point = { x: spawn.x, y: spawn.y - 45 };
    const room: Area = { ...harness, interactables: [
      { id: "fridge", knot: "club_fridge.take", point, prompt: "Look" },
    ] };
    const testWorld: World = { ...world, areas: { ...world.areas, harness: room } };
    const start: State = { ...createState(testWorld, { area: "harness", spawn: "start",
      seed: 1 }), facing: "up", ink: picked(1) };
    const before = start.snacks;
    const open = step(testWorld, start, press({ confirm: true })).state;
    expect(open.dialogue?.text).toBe("Fae packs three strawberry snacks into her backpack.");
    expect(open.snacks).toBe(before + 3);
    // And through the fridge's own choice, a basket a line.
    const fridge: Area = { ...harness, interactables: [
      { id: "fridge", knot: "club_fridge", point, prompt: "Look" },
    ] };
    const fridgeWorld: World = { ...world, areas: { ...world.areas, harness: fridge } };
    let state: State = { ...start, ink: picked(2) };
    state = step(fridgeWorld, state, press({ confirm: true })).state;
    for (let count = 0; count < 600 && state.dialogue !== null; count += 1)
      state = step(fridgeWorld, state, press({ confirm: count % 2 === 1 })).state;
    expect(state.snacks).toBe(before + 6);
    expect(variable(state.ink, "fridge_baskets")).toBe("0");
  });

  it("only takes a gift of a whole number of snacks", () => {
    expect(storyTagErrors(["gift: snack 3"], {})).toEqual([]);
    expect(storyTagErrors(["gift: snack 0", "gift: cookie 2", "gift: snack"], {})).toEqual([
      'invalid gift tag "gift: snack 0"',
      'invalid gift tag "gift: cookie 2"',
      'invalid gift tag "gift: snack"',
    ]);
  });
});

describe("the calm hook", () => {
  // Wins a battle with a clone of the fountain frog in the plaza, the way the
  // core ends one: a Soothe one good press short of calm, then the reward.
  function winBattle(ink: string): State {
    const loaded = loadContent();
    const frog = loaded.world.critters["fountain-frog"];
    const plaza = loaded.world.areas.plaza;
    const fixture = loaded.fixtures.plaza;
    if (frog === undefined || plaza === undefined || fixture === undefined)
      throw new Error("content missing");
    const clone = { ...frog, id: "hook-critter", species: "hook",
      sticker: { ...frog.sticker, id: "hook-sticker" } };
    const testWorld: World = { ...loaded.world,
      critters: { ...loaded.world.critters, "hook-critter": clone },
      areas: { ...loaded.world.areas, plaza: { ...plaza,
        critters: [...plaza.critters, { id: "hook-critter", point: { x: 500, y: 850 } }] } } };
    const none = press({});
    let state: State = { ...createState(testWorld, fixture), ink, player: { x: 574, y: 850 } };
    state = step(testWorld, state, press({ move: { x: -1, y: 0 } })).state;
    const battle = state.battle;
    if (battle === null) throw new Error("no battle");
    state = { ...state, battle: { ...battle, phase: "check", message: "", revealed: 0,
      command: "soothe", calm: clone.calmMax - 1,
      check: { ...createCheck(testWorld.battle.commands.soothe.check, "critter"), tick: 38 } } };
    state = step(testWorld, state, none).state;
    state = step(testWorld, state, press({ confirm: true })).state;
    for (let count = 0; count < 800 && state.battle !== null; count += 1) {
      state = step(testWorld, state, none).state;
      state = step(testWorld, state, press({ confirm: true })).state;
    }
    expect(state.battle).toBeNull();
    expect(state.critters["hook-critter"]).toBe("calm");
    return state;
  }

  it("runs after every calm: the garden grows from a won battle", () => {
    const won = winBattle(planted);
    expect({ calms: variable(won.ink, "garden_calms"),
      sprouted: variable(won.ink, "garden_sprouted") }).toEqual({ calms: "1", sprouted: true });
    // Before the garden's planted, the hook counts nothing.
    expect(variable(winBattle(fixed).ink, "garden_calms")).toBe("0");
  });
});

describe("the journal", () => {
  const notes = (ink: string): string[] => {
    const state = createState(world, { area: "woods", spawn: "pass", seed: 1 });
    return journalNotes(world, { ...state, ink });
  };

  it("puts the ripe garden and the full fridge on top, and the fix-up with the woods", () => {
    expect(notes(claimed)).toContain("The Whispering Woods clubhouse is ours. Sue will fix a " +
      "fridge, and Jordan will grow a garden.");
    const growing = calm(planted);
    expect(notes(growing)).toEqual(expect.arrayContaining([
      "Jordan planted strawberries on the clubhouse deck. Every critter I calm helps them grow.",
      "Sue fixed the clubhouse's old fridge. It's cold and humming!",
    ]));
    expect(notes(growing).join(" ")).not.toContain("Sue will fix a fridge");
    const ripe = calm(calm(growing));
    expect(notes(ripe)[0]).toBe("The strawberries on the clubhouse deck are ripe!");
    const stocked = play(ripe, "club_garden").ink;
    expect(notes(stocked)[0])
      .toBe("There are cold strawberries in the clubhouse fridge: snacks for the road!");
    expect(notes(play(stocked, "club_fridge", [0]).ink).join(" "))
      .not.toContain("cold strawberries in the clubhouse fridge");
  });

  it("names the clubhouse's progress at the woods' look point", () => {
    expect(play(claimed, "clubhouse").lines).toEqual([
      "The clubhouse is ours now. Sue is planning a fridge, and Jordan is planning a garden. " +
      "Up the ladder!",
    ]);
    expect(play(planted, "clubhouse").lines)
      .toEqual(["Our clubhouse! The fridge hums, and strawberries grow on the deck."]);
  });
});

describe("the clubhouse room", () => {
  const club = world.areas.clubhouse;
  const woods = world.areas.woods;
  if (club === undefined || woods === undefined) throw new Error("no clubhouse or woods");

  // Fae at a spawn with the story at `ink`, walking `move` until a talk or a door.
  function walk(area: string, spawn: string, ink: string, move: Point, ticks: number): State {
    let state: State = { ...createState(world, { area, spawn, seed: 1 }), ink };
    for (let tick = 0; tick < ticks && state.dialogue === null && state.transition === null;
      tick += 1)
      state = step(world, state, press({ move })).state;
    return state;
  }

  it("is up the ladder in the woods, once the club is ours", () => {
    const ladder = woods.triggers.find((trigger) => trigger.id === "clubhouse");
    expect(ladder?.target).toEqual({ area: "clubhouse", spawn: "ladder" });
    expect(ladder?.requires).toEqual({ variable: "clubhouse_claimed", knot: "club_ladder" });
    // From the spawn in front of it, walking up into it: shut, then open.
    const shut = walk("woods", "clubhouse", fresh, { x: 0, y: -1 }, 120);
    expect(shut.dialogue?.knot).toBe("club_ladder");
    expect(play(fresh, "club_ladder").lines).toEqual([
      "A ladder up to somebody's secret clubhouse. It smells like purple fizzy soda up there.",
      "It isn't ours to climb into... yet.",
    ]);
    // Bumping it never claims the club, even with the owl calm.
    expect(variable(play(fresh, "club_ladder", [], owlCalm).ink, "clubhouse_claimed"))
      .toBe(false);
    const open = walk("woods", "clubhouse", claimed, { x: 0, y: -1 }, 120);
    expect(open.dialogue).toBeNull();
    expect(open.transition?.target).toEqual({ area: "clubhouse", spawn: "ladder" });
    // And back down the ladder from inside.
    const down = club.triggers.find((trigger) => trigger.id === "ladder");
    expect(down?.target).toEqual({ area: "woods", spawn: "clubhouse" });
    expect(down?.requires).toBeUndefined();
    const out = walk("clubhouse", "ladder", claimed, { x: 0, y: 1 }, 120);
    expect(out.transition?.target).toEqual({ area: "woods", spawn: "clubhouse" });
    expect({ name: club.name, land: club.land, size: [club.width, club.height] })
      .toEqual({ name: "Clubhouse", land: "forest", size: [1200, 800] });
  });

  it("shows the fridge and the garden as the story goes", () => {
    const shown = (ink: string): Record<string, string> => Object.fromEntries(
      club.props.filter((prop) => prop.id === "fridge" || prop.id === "garden")
        .map((prop) => [prop.id, propStateName(world, ink, prop)]));
    expect(shown(claimed)).toEqual({ fridge: "default", garden: "default" });
    expect(shown(fixed)).toEqual({ fridge: "fixed", garden: "default" });
    expect(shown(planted)).toEqual({ fridge: "fixed", garden: "planted" });
    const growing = calm(planted);
    expect(shown(growing)).toEqual({ fridge: "fixed", garden: "growing" });
    const ripe = calm(calm(growing));
    expect(shown(ripe)).toEqual({ fridge: "fixed", garden: "ripe" });
    // Picked, it's growing again.
    expect(shown(play(ripe, "club_garden").ink)).toEqual({ fridge: "fixed", garden: "growing" });
    // Every state stands on the same footprint.
    const garden = club.props.find((prop) => prop.id === "garden");
    if (garden === undefined) throw new Error("no garden");
    const feet = Object.values(garden.states).map((state) => JSON.stringify(state.footprint));
    expect(new Set(feet).size).toBe(1);
    expect(propState(world, ripe, garden).flat).toBe(false);
  });

  it("passes the area checks: the floor, the look points, nobody hidden", () => {
    expect(club.interactables.map((item) => [item.id, item.knot])).toEqual([
      ["club-fridge", "club_fridge"], ["club-garden", "club_garden"], ["comics", "club_comics"],
      ["bottles", "club_bottles"],
    ]);
    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party)
      .filter((error) => /^(clubhouse|woods):/.test(error))).toEqual([]);
    expect(hiddenPositions(club, world.tunables.playerRadius)).toEqual([]);
  }, 30_000);

  it("has the comics and the kid's bottles to look at", () => {
    expect(play(fresh, "club_comics").lines).toEqual([
      "A stack of comics about a superhero cat. Somebody read them over and over: the " +
      "corners are all soft.",
    ]);
    expect(play(claimed, "club_bottles").lines).toEqual([
      "Empty bottles of fizzy purple soda, left behind by the kid in the purple hood.",
      "Let's keep our clubhouse soda-free!",
    ]);
    expect(play(planted, "club_bottles").lines).toEqual([
      "Empty bottles of fizzy purple soda, left behind by the kid in the purple hood.",
    ]);
  });
});
