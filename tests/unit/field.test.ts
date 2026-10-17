import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  distanceToPolygon,
  journalNotes,
  pointInPolygon,
  propCovers,
  propState,
  propStateName,
  sceneryArea,
  step,
  targetInteractable,
  faeBox,
  type ActionFrame,
  type Area,
  type Direction,
  type Mood,
  type Point,
  type State,
} from "../../src/core";
import { createInkState, inkVariable, runInk, type InkFacts } from "../../src/core/ink";
import { hiddenPositions } from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";

// Contract for Milestone 39, recess on the playing field. Ms. Willow's flute
// rings the bell; the gym's back door, shut since PE, opens on the playing
// field behind the school, where the kid in the purple hood ran. A fizzy
// squirrel guards the old oak; calmed, it tells how the kid swung across the
// creek on the oak's branch, so Fae does the same with the lasso (a gap). On
// the far bank: the hooded kid's stash behind the stump, and a lever up on
// the old footbridge's post that the lasso pulls down (a lever), laying the
// bridge across the water (a crossing). Nobody names the kid.

const content = loadContent();
const world = content.world;
const story = world.story;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}
const field = areaFor("field");
const gym = areaFor("gym");

const calm = (...ids: string[]): InkFacts =>
  ({ calmed: Object.fromEntries(ids.map((id) => [id, true])), coins: 0, snacks: 0 });
const before = calm("arcade-keeper", "gym-pup", "music-bird");
const squirrelCalm = calm("arcade-keeper", "gym-pup", "music-bird", "oak-squirrel");

function play(ink: string, knot: string, facts: InkFacts = before, choices: number[] = []): {
  lines: string[];
  tags: string[][];
  ink: string;
} {
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

// The school day up to the flute, played through the knots in order: PE,
// Coach Ash's hunt and his lasso, music, the bird, the song.
const fresh = createInkState(story, 1);
const glimpsed = play(play(play(fresh, "teacher").ink, "rosie").ink, "hood_glimpse").ink;
const peTime = play(glimpsed, "classroom_teacher").ink;
const hunting = play(peTime, "coach").ink;
const lent = play(play(hunting, "hoop").ink, "coach").ink;
const thanked = play(play(lent, "hoop").ink, "coach", before).ink;
const willow = play(play(thanked, "music_teacher", before).ink, "music_bird_calm", before).ink;
const flute = play(willow, "xylophone", before, [0, 1, 3, 0]);
const recess = flute.ink;

function at(area: string, spawn: string, ink: string, feet?: Point, facing?: Direction): State {
  const base = createState(world, { area, spawn, seed: 1 });
  return { ...base, ink, critters: { ...base.critters, "arcade-keeper": "calm" },
    ...(feet === undefined ? {} : { player: feet }),
    ...(facing === undefined ? {} : { facing }) };
}

function walk(state: State, move: Point, ticks: number): State {
  let next = state;
  for (let tick = 0; tick < ticks && next.dialogue === null && next.transition === null &&
    next.battle === null; tick += 1)
    next = step(world, next, press({ move })).state;
  return next;
}

// Where Fae's feet can stand with the story at `ink`: the props in their
// states then, and the crossings shut or open.
function standable(ink: string, point: Point): boolean {
  const area = sceneryArea(world, ink, field);
  const radius = world.tunables.playerRadius;
  const solid = [...area.blockers, ...area.npcs.map((npc) => npc.footprint)];
  return pointInPolygon(point, area.walkable) &&
    distanceToPolygon(point, area.walkable) >= radius &&
    solid.every((polygon) =>
      !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius);
}

function talkable(state: State, point: Point, id: string): boolean {
  const spots: [number, number, Direction][] = [];
  for (const reach of [30, 40, 45, 50, 58])
    spots.push([0, reach, "up"], [-reach, 0, "right"], [reach, 0, "left"], [0, -reach, "down"]);
  return spots.some(([dx, dy, facing]) => {
    const feet = { x: point.x + dx, y: point.y + dy };
    return standable(state.ink, feet) &&
      targetInteractable(world, { ...state, player: feet, facing })?.id === id;
  });
}

describe("recess", () => {
  it("rings when Ms. Willow gives Fae the flute", () => {
    expect(variable(willow, "recess")).toBe(false);
    expect(flute.lines.slice(-3)).toEqual([
      "Fae plays a soft little tune.",
      "Oh! There's the bell. Recess!",
      "Out to the playing field with you. Coach Ash props the gym's back door open at recess.",
    ]);
    expect(variable(recess, "recess")).toBe(true);
    expect(play(recess, "coach", before).lines).toEqual([
      "Recess! I've propped the back door open. Out you go!",
      "Keep that lasso handy, Fae! And watch out for that purple hood.",
    ]);
  });

  it("opens the gym's back door onto the playing field, shut before then", () => {
    const door = gym.triggers.find((trigger) => trigger.id === "back-door");
    expect(door?.target).toEqual({ area: "field", spawn: "gym" });
    expect(door?.requires).toEqual({ variable: "recess", knot: "back_door" });
    const spawn = gym.spawns["back-door"];
    if (spawn === undefined) throw new Error("no back-door spawn");
    const shut = walk(at("gym", "back-door", thanked, spawn, "up"), { x: 0, y: -1 }, 120);
    expect(shut.dialogue?.knot).toBe("back_door");
    expect(shut.transition).toBeNull();
    const open = walk(at("gym", "back-door", recess, spawn, "up"), { x: 0, y: -1 }, 120);
    expect(open.dialogue).toBeNull();
    expect(open.transition?.target).toEqual({ area: "field", spawn: "gym" });
    // And back in from the field.
    const out = field.triggers.find((trigger) => trigger.id === "gym");
    expect(out?.target).toEqual({ area: "gym", spawn: "back-door" });
    expect(out?.requires).toBeUndefined();
    expect({ name: field.name, land: field.land, size: [field.width, field.height] })
      .toEqual({ name: "Playing Field", land: "cloverhollow", size: [1650, 1100] });
  });
});

describe("the playing field", () => {
  // The whole world's area checks (props.test.ts) hold the field too; this is
  // the part that depends on the bridge: nothing hides Fae with it up or down,
  // though the raised bridge stands where the lowered one lands.
  it("never hides Fae, with the bridge up or down", () => {
    expect(hiddenPositions(field, world.tunables.playerRadius)).toEqual([]);
  }, 30_000);

  it("keeps the far bank across the water until the bridge comes down", () => {
    const east = field.spawns["east-bank"];
    if (east === undefined) throw new Error("no east-bank spawn");
    expect(field.crossings?.map((crossing) => crossing.opens)).toEqual(["bridge_down"]);
    // On the deck's line over the creek: water with the bridge up, planks down.
    const deck = { x: 1150, y: 900 };
    expect(standable(recess, deck)).toBe(false);
    const down = play(play(recess, "oak_branch", squirrelCalm).ink, "bridge_lever",
      squirrelCalm).ink;
    expect(variable(down, "bridge_down")).toBe(true);
    expect(standable(down, deck)).toBe(true);
    // Walking out along the deck's line from the near bank: stopped on the
    // bank with the bridge up; over the planks to the far bank with it down.
    const bank = { x: 1010, y: 860 };
    expect(standable(recess, bank)).toBe(true);
    const wet = walk(at("field", "gym", recess, bank, "right"), { x: 1, y: 0.35 }, 200);
    const dry = walk(at("field", "gym", down, bank, "right"), { x: 1, y: 0.35 }, 200);
    expect(wet.player.x).toBeLessThan(1200);
    expect(dry.player.x).toBeGreaterThan(1400);
  });

  it("lays the footbridge down and pulls the lever with bridge_down", () => {
    const shown = (ink: string, id: string): string => {
      const prop = field.props.find((item) => item.id === id);
      if (prop === undefined) throw new Error(`no ${id}`);
      return propStateName(world, ink, prop);
    };
    expect({ bridge: shown(recess, "bridge"), lever: shown(recess, "lever") })
      .toEqual({ bridge: "default", lever: "default" });
    const down = play(play(recess, "oak_branch", squirrelCalm).ink, "bridge_lever",
      squirrelCalm).ink;
    expect({ bridge: shown(down, "bridge"), lever: shown(down, "lever") })
      .toEqual({ bridge: "lowered", lever: "pulled" });
    // The lowered bridge lies flat on the water: walked on, never drawn over Fae.
    const bridge = field.props.find((item) => item.id === "bridge");
    if (bridge === undefined) throw new Error("no bridge");
    const lowered = propState(world, down, bridge);
    expect(lowered.flat).toBe(true);
    expect(lowered.footprint).toEqual([]);
    expect(propCovers(lowered, { x: 1150, y: 860 }, faeBox)).toBe(0);
  });

  it("has every look point and the oak squirrel within reach", () => {
    expect(field.interactables.map((item) => [item.id, item.knot])).toEqual([
      ["oak-branch", "oak_branch"], ["stash", "hood_stash"], ["lever", "bridge_lever"],
      ["hopscotch", "hopscotch"], ["tetherball", "tetherball"],
    ]);
    const near = at("field", "gym", recess);
    const far = at("field", "east-bank", recess);
    for (const item of field.interactables) {
      const side = item.point.x > 1250 ? far : near;
      expect(talkable(side, item.point, item.id), item.id).toBe(true);
    }
    const squirrel = world.critters["oak-squirrel"];
    const species = world.critters.squirrel;
    if (squirrel === undefined || species === undefined) throw new Error("no squirrels");
    expect({ species: squirrel.species, sticker: squirrel.sticker, atlas: squirrel.atlas })
      .toEqual({ species: "squirrel", sticker: species.sticker, atlas: species.atlas });
    expect(field.critters.map((critter) => critter.id)).toEqual(["oak-squirrel"]);
  });
});

describe("the gap and the lever", () => {
  it("needs the squirrel calm and the lasso to swing across", () => {
    expect(play(recess, "oak_branch", before).lines).toEqual([
      "A fizzy squirrel is pelting acorns from the big branch! Nobody's getting near it " +
      "like that.",
    ]);
    const noLasso = play(fresh, "oak_branch", squirrelCalm);
    expect(noLasso.lines).toEqual([
      "The old oak's branch reaches right across the creek. If only I had a rope...",
    ]);
    const swing = play(recess, "oak_branch", squirrelCalm);
    expect(swing.lines).toEqual([
      "The old oak's branch reaches right across the creek.",
      "Fae twirls Coach Ash's lasso, loops it over the branch, and gives it a good tug.",
      "Hold on tight... WHEEEE!",
    ]);
    expect(swing.tags.at(-1)).toContain("travel: field.east-bank");
    expect(variable(swing.ink, "swung")).toBe(true);
    const again = play(swing.ink, "oak_branch", squirrelCalm);
    expect(again.lines).toEqual(["Wheee! Fae swings across the creek again."]);
    expect(again.tags.at(-1)).toContain("travel: field.east-bank");
  });

  it("tells how the kid swung across, once calm", () => {
    const tale = play(recess, "oak_squirrel_calm", squirrelCalm);
    expect(tale.lines).toEqual([
      "Phew! Sorry about all the acorns.",
      "That big branch is my favourite spot. This morning a kid in a purple hood swung on " +
      "it, right across the creek!",
      "They whooped all the way over. Then, fizz! I had to throw something at everybody.",
      "Swing across the creek on that branch... with Coach Ash's lasso!",
    ]);
    expect(play(tale.ink, "oak_squirrel_calm", squirrelCalm).lines)
      .toEqual(["The squirrel hugs an acorn and keeps very, very still."]);
  });

  it("finds the stash and pulls the lever with the lasso", () => {
    const stash = play(recess, "hood_stash", squirrelCalm);
    expect(stash.lines).toEqual([
      "A purple backpack, tucked behind the old stump!",
      "Purple markers... a bottle of fizzy purple soda... and a Star Racer token.",
      "It's the hooded kid's stash! So this is where they ran at PE.",
      "Was that a purple hood, way down the path? ...Gone again.",
    ]);
    expect(play(stash.ink, "hood_stash", squirrelCalm).lines).toEqual([
      "The hooded kid's purple backpack. They haven't come back for it... yet.",
    ]);
    expect(play(fresh, "bridge_lever").lines).toEqual([
      "A lever, way up on the old footbridge's post.",
      "It's much too high to reach!",
    ]);
    const lever = play(recess, "bridge_lever", squirrelCalm);
    expect(lever.lines).toEqual([
      "A lever, way up on the old footbridge's post.",
      "Too high to reach... but not for a lasso!",
      "Fae loops the lasso over the lever's handle and pulls with all her might.",
      "CLUNK! Creeeak... The old footbridge swings down across the creek!",
      "Now there's a way back across. Thanks, Coach Ash!",
    ]);
    expect(play(lever.ink, "bridge_lever", squirrelCalm).lines).toEqual([
      "The lever's down, and the old footbridge is across the creek.",
    ]);
  });

  it("never names the kid in the purple hood", () => {
    const lines = [
      ...play(recess, "oak_squirrel_calm", squirrelCalm).lines,
      ...play(recess, "hood_stash", squirrelCalm).lines,
      ...play(recess, "oak_branch", squirrelCalm).lines,
      ...play(recess, "bridge_lever", squirrelCalm).lines,
    ].join(" ");
    for (const name of ["Milo", "Rosie", "Sue", "Jordan", "Maple", "Holly", "Pip", "Willow"])
      expect(lines, name).not.toContain(name);
  });
});

describe("the journal", () => {
  const notes = (ink: string, facts: InkFacts): string[] => {
    const state = at("field", "gym", ink);
    const critters: Record<string, Mood> = Object.fromEntries(
      Object.keys(facts.calmed).map((id): [string, Mood] => [id, "calm"]));
    return journalNotes(world, { ...state, critters: { ...state.critters, ...critters } });
  };

  it("keeps recess newest, above the flute and the lasso", () => {
    const atRecess = notes(recess, before);
    expect(atRecess.slice(0, 3)).toEqual([
      "A fizzy squirrel is pelting acorns from the old oak by the creek.",
      "Recess! The kid in the purple hood ran out to the playing field. The old oak's branch " +
      "reaches across the creek...",
      "Ms. Willow gave me her very first flute! When I play it, animal friends come running.",
    ]);
    const flutes = atRecess.indexOf(
      "Ms. Willow gave me her very first flute! When I play it, animal friends come running.");
    const lasso = atRecess.indexOf(
      "Coach Ash gave me his lasso! It can pull down things that are up high, and maybe swing " +
      "across gaps too.");
    expect(flutes).toBeGreaterThanOrEqual(0);
    expect(lasso).toBeGreaterThan(flutes);
    const swung = play(recess, "oak_branch", squirrelCalm).ink;
    expect(notes(swung, squirrelCalm)[0]).toBe(
      "I swung across the creek on the lasso! There's a lever up on the old footbridge's post.");
    const all = play(play(swung, "hood_stash", squirrelCalm).ink, "bridge_lever",
      squirrelCalm).ink;
    expect(notes(all, squirrelCalm).slice(0, 2)).toEqual([
      "I pulled the old footbridge's lever with the lasso, and the bridge swung down across " +
      "the creek!",
      "The hooded kid's stash is behind the old stump: purple markers, fizzy soda, and a Star " +
      "Racer token.",
    ]);
  });
});
