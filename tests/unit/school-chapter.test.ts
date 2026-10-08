import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  distanceToPolygon,
  journalNotes,
  npcVisible,
  pointInPolygon,
  step,
  targetInteractable,
  type ActionFrame,
  type Area,
  type Direction,
  type Npc,
  type Point,
  type State,
} from "../../src/core";
import { createInkState, inkVariable, runInk, type InkFacts } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";

// Contract for Milestone 30, story time (the school chapter begins). Once
// Mr. Pip is calm ("Someone from school again..."), Ms. Maple in the school
// hallway says story time is starting and goes into her classroom, whose door
// opens. Inside are two classmates, Milo and Rosie. Rosie saw a purple hood
// peek in the door; out in the hall, the kid in the purple hood is glimpsed
// and runs off toward the gym, dropping a purple marker. Who they are stays a
// secret (owner, 2026-10-07).

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
const classroom = areaFor("classroom");

function person(area: Area, id: string): Npc {
  const found = area.npcs.find((npc) => npc.id === id);
  if (found === undefined) throw new Error(`${id} isn't in ${area.id}`);
  return found;
}

const pipCalm: InkFacts = { calmed: { "arcade-keeper": true }, coins: 0 };
const fresh = createInkState(story, 1);

// Plays a knot to its end (the first choice at any choice), returning its
// lines and the story state after.
function play(ink: string, knot: string, facts: InkFacts = pipCalm): {
  lines: string[];
  ink: string;
} {
  const lines: string[] = [];
  let result = runInk(story, ink, { type: "start", knot }, facts);
  for (let count = 0; count < 30; count += 1) {
    if (result.line !== null) lines.push(result.line.text);
    if (result.ended) break;
    result = result.choices.length > 0
      ? runInk(story, result.ink, { type: "choose", index: 0 }, facts)
      : runInk(story, result.ink, { type: "next" }, facts);
  }
  return { lines, ink: result.ink };
}

// Fae in `area` with the story `ink`, Mr. Pip calm (the arcade is done).
function at(area: string, spawn: string, ink: string, feet?: Point, facing?: Direction): State {
  const base = createState(world, { area, spawn, seed: 1 });
  return { ...base, ink, critters: { ...base.critters, "arcade-keeper": "calm" },
    ...(feet === undefined ? {} : { player: feet }),
    ...(facing === undefined ? {} : { facing }) };
}

// Holds one direction until something happens (a talk, a door), or `ticks`.
function walk(state: State, move: Point, ticks: number): State {
  let next = state;
  for (let tick = 0; tick < ticks && next.dialogue === null && next.transition === null; tick += 1)
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

const storyTime = play(fresh, "teacher").ink;
const toldByRosie = play(storyTime, "rosie").ink;
const glimpsed = play(toldByRosie, "hood_glimpse").ink;

describe("story time", () => {
  it("starts once Mr. Pip is calm: Ms. Maple sends Fae in and goes in herself", () => {
    // Before the arcade, chapter one's teacher.
    expect(play(fresh, "teacher", { calmed: {}, coins: 0 }).lines[0])
      .toBe("Good morning, Fae! Class starts when the bell rings.");
    const { lines } = play(fresh, "teacher");
    expect(lines).toEqual([
      "There you are, Fae! Story time is about to start.",
      "Hang your backpack in your cubby and find a spot on the rug.",
      "Story time! Maybe someone in my class saw the kid in the purple hood.",
    ]);
    expect(inkVariable(story, storyTime, "story_time")).toBe(true);
    const maple = person(school, "teacher");
    expect(maple.visibleWhile).toBe("maple_in_hall");
    expect(npcVisible(world, at("school", "front-doors", fresh), maple)).toBe(true);
    expect(npcVisible(world, at("school", "front-doors", storyTime), maple)).toBe(false);
  });

  it("opens the classroom door, which is shut before then", () => {
    const door = school.triggers.find((trigger) => trigger.id === "classroom-door");
    expect(door?.target).toEqual({ area: "classroom", spawn: "door" });
    expect(door?.requires).toEqual({ variable: "story_time", knot: "classroom_closed" });
    expect(classroom.triggers.find((trigger) => trigger.id === "door")?.target)
      .toEqual({ area: "school", spawn: "classroom-door" });
    const spawn = school.spawns["classroom-door"];
    if (spawn === undefined) throw new Error("no classroom-door spawn");
    expect(spawn.facing).toBe("down");
    // From in front of the door, walking up into it.
    const shut = walk(at("school", "classroom-door", fresh, spawn, "up"), { x: 0, y: -1 }, 40);
    expect(shut.dialogue).toMatchObject({ knot: "classroom_closed",
      text: "The classroom door is shut. Story time hasn't started yet." });
    const open = walk(at("school", "classroom-door", storyTime, spawn, "up"),
      { x: 0, y: -1 }, 40);
    expect(open.transition?.target).toEqual({ area: "classroom", spawn: "door" });
    expect({ name: classroom.name, land: classroom.land })
      .toEqual({ name: "Ms. Maple's Classroom", land: "cloverhollow" });
  });
});

describe("the classroom", () => {
  it("has Ms. Maple, Milo, and Rosie on open floor, each someone to talk to", () => {
    const furniture = classroom.blockers;
    for (const someone of classroom.npcs)
      for (const [x, y] of someone.footprint)
        expect(furniture.some((polygon) => pointInPolygon({ x, y }, polygon)),
          `${someone.id} stands inside furniture`).toBe(false);
    const state = at("classroom", "door", storyTime);
    for (const [id, knot] of [["teacher", "classroom_teacher"], ["milo", "milo"],
      ["rosie", "rosie"]] as const) {
      const someone = person(classroom, id);
      expect(someone.knot, id).toBe(knot);
      expect(npcVisible(world, state, someone), id).toBe(true);
      expect(talkable(state, someone.point, `npc:${id}`), id).toBe(true);
    }
  });

  it("has the art wall, the cubbies, and the reading corner to look at", () => {
    expect(classroom.interactables.map((item) => [item.id, item.knot, item.prompt])).toEqual(
      expect.arrayContaining([
        ["art-wall", "art_wall", "Look"],
        ["cubbies", "cubbies", "Look"],
        ["reading-corner", "reading_corner", "Look"],
      ]));
    const wall = play(storyTime, "art_wall", { calmed: {}, coins: 0 }).lines;
    expect(wall).toEqual([
      "The class art wall: rainbows, rockets, and a very wobbly cat.",
      "And a drawing of a masked face, a swirl, and a star.",
      "There's no name on it.",
    ]);
    // With the lantern, Fae has seen that doodle glowing on the ski lift.
    const lit = play(play(fresh, "hamster_calm").ink, "art_wall").lines;
    expect(lit).toContain("Just like the glowing doodle on the ski lift!");
  });

  it("Ms. Maple reads about a dragon who sneezes bubbles, then has a kind word", () => {
    const first = play(storyTime, "classroom_teacher");
    expect(first.lines[0])
      .toBe("Today's story is about a dragon who sneezes bubbles instead of fire!");
    expect(play(first.ink, "classroom_teacher").lines)
      .toEqual(["Remember, Fae: a kind word can calm almost anything."]);
  });

  it("Milo knows about the Star Racer score, and nothing else", () => {
    const first = play(storyTime, "milo");
    expect(first.lines).toEqual([
      "Fae! Did you hear? Somebody beat the Star Racer high score at the arcade!",
      "I've been trying all year. And they scribbled out their initials, so nobody knows who!",
      "Whoever it was must be really, REALLY good at Star Racer.",
    ]);
    expect(play(first.ink, "milo").lines)
      .toEqual(["Milo folds a paper airplane. \"This one's a Star Racer!\""]);
  });
});

describe("the kid in the purple hood", () => {
  const kid = person(school, "hooded-kid");

  it("is glimpsed in the hall once Rosie has seen them peek in", () => {
    expect(play(storyTime, "rosie").lines).toEqual([
      "Psst, Fae! Somebody in a purple hood just peeked in the door!",
      "Then they ran off down the hall.",
      "A purple hood? Here, at school? I have to see!",
    ]);
    expect({ knot: kid.knot, prompt: kid.prompt, visibleWhile: kid.visibleWhile })
      .toEqual({ knot: "hood_glimpse", prompt: "Look", visibleWhile: "hood_waiting" });
    expect(npcVisible(world, at("school", "front-doors", storyTime), kid)).toBe(false);
    const waiting = at("school", "front-doors", toldByRosie);
    expect(npcVisible(world, waiting, kid)).toBe(true);
    expect(talkable(waiting, kid.point, "npc:hooded-kid")).toBe(true);
  });

  it("runs off toward the gym, dropping a purple marker, and is gone", () => {
    expect(play(toldByRosie, "hood_glimpse").lines).toEqual([
      "Hey! You in the purple hood! Wait!",
      "The kid zips around the corner, toward the gym. So fast!",
      "They dropped something... a purple marker.",
      "The same purple as the scribbled-out Star Racer initials!",
    ]);
    expect(inkVariable(story, glimpsed, "saw_hood")).toBe(true);
    expect(npcVisible(world, at("school", "front-doors", glimpsed), kid)).toBe(false);
    expect(play(glimpsed, "rosie").lines.at(-1)).toBe("Did you catch them? They're SO fast.");
    expect(play(glimpsed, "gym_hall").lines).toEqual([
      "The hall to the gym. The doors are locked during story time.",
      "Tiny purple footprints lead right up to them...",
    ]);
  });

  it("is never named or given away: the glimpse names nobody", () => {
    const lines = play(toldByRosie, "hood_glimpse").lines.join(" ");
    for (const name of ["Fae's", "Milo", "Rosie", "Sue", "Jordan", "Maple", "Holly", "Pip"])
      expect(lines, name).not.toContain(name);
    expect(lines).toContain("The kid");
  });
});

describe("the journal", () => {
  const notes = (ink: string): string[] =>
    journalNotes(world, at("school", "front-doors", ink));

  it("sends Fae back to school, then to her classmates, then after the hood", () => {
    expect(notes(fresh)[0]).toBe(
      "Ms. Maple said to be back in time for story time. Back to school!");
    expect(notes(storyTime)[0]).toBe("Story time! Rosie and Milo are in my class. " +
      "Maybe somebody saw the kid in the purple hood.");
    const after = notes(glimpsed);
    expect(after[0]).toBe("A kid in a purple hood ran off toward the gym! " +
      "They dropped a purple marker, the same purple as the Star Racer scribbles.");
    expect(after.join(" ")).not.toContain("Back to school!");
    expect(after.join(" ")).not.toContain("Maybe somebody saw");
  });
});
