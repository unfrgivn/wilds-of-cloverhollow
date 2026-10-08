import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  distanceToPolygon,
  journalNotes,
  npcVisible,
  pointInPolygon,
  presentCritters,
  step,
  targetInteractable,
  type ActionFrame,
  type Area,
  type Direction,
  type Point,
  type State,
} from "../../src/core";
import { createInkState, inkVariable, runInk, type InkFacts } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";

// Contract for Milestone 31, the gym and the lasso. After the glimpse of the
// kid in the purple hood, Ms. Maple ends story time: time for PE. The gym
// doors at the hall's east end, locked until then, open on the school gym.
// Coach Ash's cart was knocked over by the kid, who ran out the back door; a
// fizzy pup has his stopwatch (calmed, it drops it), and his clipboard is
// hooked on the basketball hoop, too high to reach, so he lends Fae his lasso.
// With both back, he lets her keep it. Who the kid is stays a secret.

const content = loadContent();
const world = content.world;
const story = world.story;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}
const school = areaFor("school");
const gym = areaFor("gym");

const calm = (...ids: string[]): InkFacts =>
  ({ calmed: Object.fromEntries(ids.map((id) => [id, true])), coins: 0 });
// Mr. Pip is calm (the arcade is done); the gym pup isn't yet.
const pipCalm = calm("arcade-keeper");
const pupCalm = calm("arcade-keeper", "gym-pup");

// Plays a knot to its end (at a choice, `choice`), returning its lines and the
// story state after.
function play(ink: string, knot: string, facts: InkFacts = pipCalm, choice = 0): {
  lines: string[];
  ink: string;
} {
  const lines: string[] = [];
  let result = runInk(story, ink, { type: "start", knot }, facts);
  for (let count = 0; count < 30; count += 1) {
    if (result.line !== null) lines.push(result.line.text);
    if (result.ended) break;
    result = result.choices.length > 0
      ? runInk(story, result.ink, { type: "choose", index: choice }, facts)
      : runInk(story, result.ink, { type: "next" }, facts);
  }
  return { lines, ink: result.ink };
}
const variable = (ink: string, name: string): unknown => inkVariable(story, ink, name);

const fresh = createInkState(story, 1);
const glimpsed = play(play(play(fresh, "teacher").ink, "rosie").ink, "hood_glimpse").ink;
const peTime = play(glimpsed, "classroom_teacher").ink;
const hunting = play(peTime, "coach").ink;
const sawClipboard = play(hunting, "hoop").ink;
const lent = play(sawClipboard, "coach").ink;
const roped = play(lent, "hoop").ink;
const thanked = play(roped, "coach", pupCalm).ink;

// Fae in `area` with the story `ink`, Mr. Pip calm.
function at(area: string, spawn: string, ink: string, feet?: Point, facing?: Direction): State {
  const base = createState(world, { area, spawn, seed: 1 });
  return { ...base, ink, critters: { ...base.critters, "arcade-keeper": "calm" },
    ...(feet === undefined ? {} : { player: feet }),
    ...(facing === undefined ? {} : { facing }) };
}

// Holds one direction until something happens (a talk, a door, a battle), or
// `ticks`.
function walk(state: State, move: Point, ticks: number): State {
  let next = state;
  for (let tick = 0; tick < ticks && next.dialogue === null && next.transition === null &&
    next.battle === null; tick += 1)
    next = step(world, next, press({ move })).state;
  return next;
}

// Where Fae's feet can stand in an area: on the floor and a player radius
// clear of its edge, every blocker, and every person's footprint.
function standable(area: Area, point: Point): boolean {
  const radius = world.tunables.playerRadius;
  const solid = [...area.blockers, ...area.npcs.map((npc) => npc.footprint)];
  return pointInPolygon(point, area.walkable) &&
    distanceToPolygon(point, area.walkable) >= radius &&
    solid.every((polygon) =>
      !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius);
}

// Whether `id` can be talked to from somewhere Fae can stand, facing it.
function talkable(state: State, point: Point, id: string): boolean {
  const area = areaFor(state.area);
  const spots: [number, number, Direction][] = [];
  for (const reach of [30, 40, 50, 58])
    spots.push([0, reach, "up"], [-reach, 0, "right"], [reach, 0, "left"], [0, -reach, "down"]);
  return spots.some(([dx, dy, facing]) => {
    const feet = { x: point.x + dx, y: point.y + dy };
    return standable(area, feet) &&
      targetInteractable(world, { ...state, player: feet, facing })?.id === id;
  });
}

describe("PE time", () => {
  it("starts when Ms. Maple finishes the story, once Fae has glimpsed the hood", () => {
    // Before the glimpse, she reads her story as before.
    const storyTime = play(fresh, "teacher").ink;
    expect(play(storyTime, "classroom_teacher").lines[0])
      .toBe("Today's story is about a dragon who sneezes bubbles instead of fire!");
    const { lines, ink } = play(glimpsed, "classroom_teacher");
    expect(lines).toEqual([
      "That's the end of our story! Time for PE, everyone.",
      "Coach Ash is waiting for you in the gym, at the end of the hall.",
      "The gym! That's where the kid in the purple hood was headed.",
    ]);
    expect(variable(ink, "pe_time")).toBe(true);
    // Once is enough: after that, her kind word.
    expect(play(ink, "classroom_teacher").lines)
      .toEqual(["Remember, Fae: a kind word can calm almost anything."]);
  });

  it("opens the gym doors at the hall's east end, locked before then", () => {
    const doors = school.triggers.find((trigger) => trigger.id === "gym-doors");
    expect(doors?.target).toEqual({ area: "gym", spawn: "door" });
    expect(doors?.requires).toEqual({ variable: "pe_time", knot: "gym_hall" });
    expect(school.interactables.map((item) => item.id)).not.toContain("gym-hall");
    expect(gym.triggers.map((trigger) => [trigger.id, trigger.target])).toEqual([
      ["door", { area: "school", spawn: "gym-doors" }],
    ]);
    expect(school.spawns["gym-doors"]?.facing).toBe("left");
    expect(gym.spawns["door"]?.facing).toBe("right");
    expect({ name: gym.name, land: gym.land })
      .toEqual({ name: "School Gym", land: "cloverhollow" });
    // From the hall's east end, walking right into the doors.
    const spawn = school.spawns["gym-doors"];
    if (spawn === undefined) throw new Error("no gym-doors spawn");
    const locked = walk(at("school", "gym-doors", glimpsed, spawn, "right"), { x: 1, y: 0 }, 90);
    expect(locked.dialogue).toMatchObject({ knot: "gym_hall",
      text: "The hall to the gym. The doors are locked during story time." });
    const open = walk(at("school", "gym-doors", peTime, spawn, "right"), { x: 1, y: 0 }, 90);
    expect(open.transition?.target).toEqual({ area: "gym", spawn: "door" });
  });

  it("leads back to the hall through the gym's double doors", () => {
    const spawn = gym.spawns["door"];
    if (spawn === undefined) throw new Error("no gym door spawn");
    // Up and left from the spawn, into the doors on the back-left wall.
    const back = walk(at("gym", "door", peTime, spawn, "left"), { x: -1, y: -1 }, 120);
    expect(back.transition?.target).toEqual({ area: "school", spawn: "gym-doors" });
  });
});

describe("the gym", () => {
  it("has Coach Ash on open floor, to talk to", () => {
    const coach = gym.npcs.find((npc) => npc.id === "coach");
    if (coach === undefined) throw new Error("no Coach Ash");
    expect({ knot: coach.knot, prompt: coach.prompt }).toEqual({ knot: "coach", prompt: "Talk" });
    expect(world.characters.coach?.atlas).toBe("assets/characters/coach/coach.json");
    for (const [x, y] of coach.footprint)
      expect(gym.blockers.some((polygon) => pointInPolygon({ x, y }, polygon)),
        "Coach Ash stands inside furniture").toBe(false);
    const state = at("gym", "door", peTime);
    expect(npcVisible(world, state, coach)).toBe(true);
    expect(talkable(state, coach.point, "npc:coach")).toBe(true);
  });

  it("has the hoop, the ball bin, the climbing rope, and the back door to look at", () => {
    expect(gym.interactables.map((item) => [item.id, item.knot, item.prompt])).toEqual(
      expect.arrayContaining([
        ["hoop", "hoop", "Look"],
        ["ball-bin", "ball_bin", "Look"],
        ["climbing-rope", "climbing_rope", "Look"],
        ["back-door", "back_door", "Look"],
      ]));
    const state = at("gym", "door", peTime);
    for (const item of gym.interactables)
      expect(talkable(state, item.point, item.id), item.id).toBe(true);
    expect(play(peTime, "back_door").lines).toEqual([
      "The back door to the playing field. It clicked shut behind the kid in the purple hood.",
      "It only opens from outside. Purple footprints lead right up to it...",
    ]);
  });

  it("has a fizzy pup on the court: a pup, whose sticker is the pup's", () => {
    const kind = world.critters["gym-pup"];
    const pup = world.critters.pup;
    if (kind === undefined || pup === undefined) throw new Error("no pups");
    expect({ species: kind.species, sticker: kind.sticker, atlas: kind.atlas, coins: kind.coins })
      .toEqual({ species: "pup", sticker: pup.sticker, atlas: pup.atlas, coins: 8 });
    expect(gym.critters).toEqual([{ id: "gym-pup", point: expect.any(Object) }]);
    expect(gym.recurring).toBeUndefined();
    const placed = gym.critters[0];
    const coach = gym.npcs.find((npc) => npc.id === "coach");
    const spawn = gym.spawns["door"];
    if (placed === undefined || coach === undefined || spawn === undefined)
      throw new Error("gym pieces missing");
    const gap = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
    // Arriving or going to talk to Coach Ash doesn't bump into it.
    expect(gap(placed.point, spawn)).toBeGreaterThan(kind.touchRadius + 100);
    expect(gap(placed.point, coach.point)).toBeGreaterThanOrEqual(200);
    expect(presentCritters(world, at("gym", "door", peTime)).map((critter) =>
      [critter.key, critter.mood])).toEqual([["gym-pup", "chaos"]]);
  });

  it("starts a battle when Fae walks into the pup, and once calm it's talked to", () => {
    const placed = gym.critters[0];
    const kind = world.critters["gym-pup"];
    if (placed === undefined || kind === undefined) throw new Error("no gym pup");
    const start: Point = { x: placed.point.x - kind.touchRadius - 30, y: placed.point.y };
    const state = walk(at("gym", "door", hunting, start, "right"), { x: 1, y: 0 }, 40);
    expect(state.battle).toMatchObject({ critterId: "gym-pup", den: null });
    expect(state.battle?.message)
      .toBe("A fizzy pup zooms around the gym with something shiny in its mouth!");
    const calmed = { ...at("gym", "door", hunting), critters: { ...state.critters,
      "gym-pup": "calm" as const } };
    expect(talkable(calmed, placed.point, "critter:gym-pup")).toBe(true);
    expect(play(hunting, "gym_pup_calm", pupCalm).lines).toEqual([
      "Woof! The pup flops down and wags its whole body.",
      "I've got Coach Ash's stopwatch back. Good pup!",
    ]);
  });
});

describe("Coach Ash's hunt", () => {
  it("starts with what the kid in the purple hood did, whichever Fae answers", () => {
    const first = play(peTime, "coach");
    expect(first.lines).toEqual([
      "TWEET! Oh, hi, Fae! Whew, what a morning.",
      "A kid in a purple hood dashed through here and knocked over my equipment cart!",
      "Then they ran straight out the back door, to the playing field. Fast kid!",
      "My clipboard went flying, and a fizzy pup ran off with my stopwatch!",
      "That's the spirit!",
    ]);
    const asked = play(peTime, "coach", pipCalm, 1);
    expect(asked.lines.at(-1))
      .toBe("Nope. Just a purple hood and a cloud of dust! Can you help me find my things?");
    for (const ink of [first.ink, asked.ink]) expect(variable(ink, "gym_quest")).toBe(true);
  });

  it("says what's still missing", () => {
    expect(play(hunting, "coach").lines).toEqual([
      "How's the hunt going?",
      "That fizzy pup still has my stopwatch! Calm it down, and maybe it'll drop it.",
      "My clipboard went flying. I heard it clatter somewhere up high.",
    ]);
    expect(play(roped, "coach").lines).toEqual([
      "How's the hunt going?",
      "That fizzy pup still has my stopwatch! Calm it down, and maybe it'll drop it.",
    ]);
    expect(play(lent, "coach").lines).toEqual([
      "How's the hunt going?",
      "That fizzy pup still has my stopwatch! Calm it down, and maybe it'll drop it.",
      "Give that lasso a twirl at the hoop!",
    ]);
  });

  it("lends the lasso for the clipboard on the hoop, which the lasso brings down", () => {
    expect(play(hunting, "hoop").lines)
      .toEqual(["There's Coach Ash's clipboard, hooked on the rim! It's way too high to reach."]);
    expect(variable(sawClipboard, "saw_clipboard")).toBe(true);
    expect(play(sawClipboard, "coach").lines).toEqual([
      "Up on the hoop? I can't reach that either.",
      "Here, take my lasso! I used to rope cones with it at summer camp.",
      "Coach Ash hands Fae a lasso of twisted rainbow rope, with a wooden star on its handle.",
    ]);
    expect(variable(lent, "has_lasso")).toBe(true);
    expect(play(lent, "hoop").lines).toEqual([
      "Fae twirls the lasso once, twice... and loops it right over the clipboard!",
      "Got it! Coach Ash's clipboard.",
    ]);
    expect(variable(roped, "found_clipboard")).toBe(true);
    expect(play(roped, "hoop").lines).toEqual(["The basketball hoop. Nothing stuck up there now!"]);
  });

  it("finds the clipboard before Coach Ash asks, too", () => {
    expect(play(peTime, "hoop").lines)
      .toEqual(["There's a clipboard hooked on the rim! It's way too high to reach."]);
    // The pup calmed first: Coach Ash spots his stopwatch straight away.
    const early = play(peTime, "coach", pupCalm);
    expect(early.lines.slice(-2)).toEqual([
      "Hey, you've got my stopwatch! The pup had it? Thanks, Fae!",
      "Now if only I could find my clipboard. It went flying!",
    ]);
    expect(variable(early.ink, "gym_quest")).toBe(true);
    expect(play(peTime, "gym_pup_calm", pupCalm).lines.at(-1))
      .toBe("It dropped a shiny stopwatch. Whose could it be?");
  });

  it("lets Fae keep the lasso once both are back", () => {
    expect(play(roped, "coach", pupCalm).lines).toEqual([
      "My stopwatch AND my clipboard! You're a star, Fae!",
      "Keep the lasso. It can pull down things that are up high, and swing you across gaps, too!",
    ]);
    expect(variable(thanked, "coach_thanked")).toBe(true);
    expect(play(thanked, "coach", pupCalm).lines)
      .toEqual(["Keep that lasso handy, Fae! And watch out for that purple hood."]);
  });

  it("never names the kid in the purple hood", () => {
    const lines = [
      ...play(peTime, "coach").lines, ...play(peTime, "coach", pipCalm, 1).lines,
      ...play(peTime, "back_door").lines, ...play(roped, "coach", pupCalm).lines,
    ].join(" ");
    for (const name of ["Fae's", "Milo", "Rosie", "Sue", "Jordan", "Maple", "Holly", "Pip"])
      expect(lines, name).not.toContain(name);
  });
});

describe("the journal", () => {
  const notes = (ink: string, facts = pipCalm): string[] => {
    const state = at("school", "front-doors", ink);
    const critters = facts === pupCalm ? { ...state.critters, "gym-pup": "calm" as const }
      : state.critters;
    return journalNotes(world, { ...state, critters });
  };

  it("follows PE and the hunt, newest first", () => {
    const locked = play(glimpsed, "gym_hall").ink;
    expect(notes(locked)[0]).toBe(
      "The gym doors are locked during story time. Ms. Maple will know when it's over.");
    expect(notes(peTime)[0]).toBe("Time for PE! The gym is at the end of the hall.");
    expect(notes(hunting).slice(0, 3)).toEqual([
      "A fizzy pup is zooming around the gym with Coach Ash's stopwatch.",
      "Coach Ash's clipboard went flying, somewhere up high.",
      "The kid in the purple hood knocked over Coach Ash's cart, " +
        "then ran out the back door to the playing field.",
    ]);
    expect(notes(sawClipboard)[1])
      .toBe("Coach Ash's clipboard is stuck on the basketball hoop. It's too high to reach!");
    expect(notes(lent)[1])
      .toBe("Coach Ash lent me his lasso, to get his clipboard down from the hoop.");
    expect(notes(roped, pupCalm)[0])
      .toBe("I found Coach Ash's stopwatch and his clipboard! Back to Coach Ash.");
    const done = notes(thanked, pupCalm);
    expect(done[0]).toBe("Coach Ash gave me his lasso! It can pull down things that are up high, " +
      "and maybe swing across gaps too.");
    expect(done.join(" ")).not.toContain("Time for PE!");
    expect(done.join(" ")).not.toContain("Back to Coach Ash.");
  });
});
