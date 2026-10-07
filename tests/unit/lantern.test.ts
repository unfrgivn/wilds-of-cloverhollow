import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  distanceToPolygon,
  journalNotes,
  parseSave,
  pointInPolygon,
  serializeSave,
  step,
  targetInteractable,
  type ActionFrame,
  type Area,
  type Point,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

// Contract for the blacklight lantern (Milestone 23). Once Jordan has given it
// (`has_lantern`), a lantern press switches it on or off. While it's on, an
// area's `glows` (what the raccoon left behind, glowing under blacklight: paw
// prints, invisible-ink notes, trail markers) are drawn, and those with a knot
// can be read. They're never solid. At Pinecone Pass, prints lead to a note on
// the ski lift's tower and a marker at the pines that reveals the old trail.

const content = loadContent();
const world = content.world;
const radius = world.tunables.playerRadius;
const range = world.tunables.interact.range;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}
const pass = areaFor("pass");

function standable(point: Point): boolean {
  if (!pointInPolygon(point, pass.walkable)) return false;
  if (distanceToPolygon(point, pass.walkable) < radius) return false;
  const solid = [...pass.blockers, ...pass.npcs.map((npc) => npc.footprint)];
  return solid.every(
    (polygon) => !pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius,
  );
}

// A pass state with the lantern given (via the knot that gives it).
function passState(feet: Point, facing: State["facing"], lantern: boolean): State {
  const base = createState(world, { area: "pass", spawn: "bus", seed: 1 });
  const given = world.storyVariable(base.ink, "has_lantern");
  if (given !== false) throw new Error("has_lantern should start false");
  const critters: State["critters"] = { ...base.critters, hamster: "calm" };
  let state: State = { ...base, player: feet, facing, critters };
  if (lantern) {
    // Talk to the calm hamster, which gives the lantern (Milestone 22).
    const hamster = pass.critters.find((item) => item.id === "hamster");
    if (hamster === undefined) throw new Error("no hamster");
    state = { ...state, player: { x: hamster.point.x, y: hamster.point.y + 45 }, facing: "up" };
    state = talkThrough(state);
    state = { ...state, player: feet, facing };
  }
  return state;
}

function talkThrough(state: State): State {
  state = step(world, state, blankInput()).state;
  state = step(world, state, press({ confirm: true })).state;
  if (state.dialogue === null) throw new Error("the talk did not open");
  for (let tick = 0; tick < 900 && state.dialogue !== null; tick += 1) {
    const dialogue = state.dialogue;
    const frame = dialogue.choices.length > 0 && dialogue.revealed >= dialogue.text.length
      ? press({ choose: 0 })
      : press({ confirm: tick % 2 === 1 });
    state = step(world, state, frame).state;
  }
  if (state.dialogue !== null) throw new Error("the talk never closed");
  return state;
}

function toggle(state: State): State {
  state = step(world, state, blankInput()).state;
  return step(world, state, press({ lantern: true })).state;
}

describe("the lantern switch", () => {
  it("starts off, and does nothing before Jordan gives it", () => {
    let state = passState({ x: 700, y: 650 }, "down", false);
    expect(state.lantern).toBe(false);
    state = toggle(state);
    expect(state.lantern).toBe(false);
  });

  it("switches on and off with lantern presses once Fae has it", () => {
    let state = passState({ x: 700, y: 650 }, "down", true);
    expect(world.storyVariable(state.ink, "has_lantern")).toBe(true);
    expect(state.lantern).toBe(false);
    state = toggle(state);
    expect(state.lantern).toBe(true);
    state = step(world, state, press({ lantern: true })).state;
    expect(state.lantern, "held, not pressed again").toBe(true);
    state = toggle(state);
    expect(state.lantern).toBe(false);
  });

  it("ignores the lantern while the journal is open", () => {
    let state = passState({ x: 700, y: 650 }, "down", true);
    state = { ...state, journalOpen: true };
    state = toggle(state);
    expect(state.lantern).toBe(false);
  });

  it("saves the lantern (save version 4; version 2 saves start fresh)", () => {
    const state = toggle(passState({ x: 700, y: 650 }, "down", true));
    const json = serializeSave(state);
    expect(JSON.parse(json).version).toBe(4);
    expect(parseSave(json, state)?.lantern).toBe(true);
    expect(parseSave(JSON.stringify({ version: 2, state }), state)).toBeNull();
  });
});

describe("the pass's glowing secrets", () => {
  const glows = pass.glows;

  it("has paw prints, a note on the lift tower, and a marker at the pines", () => {
    const prints = glows.filter((glow) => glow.frame === "paw_prints");
    expect(prints.length).toBeGreaterThanOrEqual(3);
    for (const print of prints) expect(print.knot).toBeUndefined();
    const note = glows.find((glow) => glow.id === "lift-note");
    expect(note).toMatchObject({ frame: "ink_note", knot: "lift_note", prompt: "Look" });
    const marker = glows.find((glow) => glow.id === "old-trail-marker");
    expect(marker)
      .toMatchObject({ frame: "trail_marker", knot: "old_trail_marker", prompt: "Look" });
  });

  it("puts every glow where Fae can reach it, and the prints lead from the clearing", () => {
    for (const glow of glows) {
      let reachable = false;
      for (let dy = -range; dy <= range && !reachable; dy += 5)
        for (let dx = -range; dx <= range && !reachable; dx += 5)
          if (Math.hypot(dx, dy) <= range - 5 &&
            standable({ x: glow.point.x + dx, y: glow.point.y + dy })) reachable = true;
      expect(reachable, glow.id).toBe(true);
    }
  });

  function spotFacing(id: string): State {
    const glow = glows.find((item) => item.id === id);
    if (glow === undefined) throw new Error(`no ${id}`);
    const around: [number, number, State["facing"]][] =
      [[0, 40, "up"], [40, 0, "left"], [-40, 0, "right"], [0, -40, "down"]];
    for (const [dx, dy, facing] of around) {
      const feet = { x: glow.point.x + dx, y: glow.point.y + dy };
      if (standable(feet)) return passState(feet, facing, true);
    }
    throw new Error(`no standable spot facing ${id}`);
  }

  it("lets Fae read the note only while the lantern is on", () => {
    let state = spotFacing("lift-note");
    expect(targetInteractable(world, state)?.id).not.toBe("glow:lift-note");
    state = toggle(state);
    expect(targetInteractable(world, state)?.id).toBe("glow:lift-note");
  });

  it("reveals the old trail when Fae reads the marker", () => {
    let state = toggle(spotFacing("old-trail-marker"));
    expect(targetInteractable(world, state)?.id).toBe("glow:old-trail-marker");
    expect(world.storyVariable(state.ink, "found_old_trail")).toBe(false);
    state = talkThrough(state);
    expect(world.storyVariable(state.ink, "found_old_trail")).toBe(true);
    const note = journalNotes(world, state)
      .find((item) => item.includes("Whispering Woods"));
    expect(note).toMatch(/trail/i);
  });

  it("never blocks Fae: she walks right over the paw prints", () => {
    const print = glows.find((glow) => glow.frame === "paw_prints");
    if (print === undefined) throw new Error("no prints");
    let state = toggle(passState({ x: print.point.x - 60, y: print.point.y }, "right", true));
    expect(standable(state.player)).toBe(true);
    for (let tick = 0; tick < 30; tick += 1)
      state = step(world, state, press({ move: { x: 1, y: 0 } })).state;
    expect(state.player.x).toBeGreaterThan(print.point.x + 30);
  });
});
