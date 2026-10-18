import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { areaConnectionErrors, reachablePositions } from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createInkState, runInk, type InkFacts } from "../../src/core/ink";
import {
  blankInput, createState, faeBox, journalNotes, propCovers, propState, propStateName,
  step, type ActionFrame, type Point, type State,
} from "../../src/core";

const content = loadContent();
const { world } = content;
const facts: InkFacts =
  { calmed: {}, coins: 0, snacks: 0, prizes: [], plushesLeft: 0, tickets: 0 };

// Plays a knot to its end through the real story, returning the Ink state.
function talk(knot: string, ink = createInkState(world.story, 1)): string {
  let result = runInk(world.story, ink, { type: "start", knot }, facts);
  for (let count = 0; count < 20 && !result.ended; count += 1)
    result = runInk(world.story, result.ink, { type: "next" }, facts);
  if (!result.ended) throw new Error(`${knot} didn't end`);
  return result.ink;
}
function lines(knot: string, ink = createInkState(world.story, 1)): string[] {
  let result = runInk(world.story, ink, { type: "start", knot }, facts);
  const output: string[] = [];
  for (let count = 0; count < 20; count += 1) {
    if (result.line !== null) output.push(result.line.text);
    if (result.ended) return output;
    result = runInk(world.story, result.ink, { type: "next" }, facts);
  }
  throw new Error(`${knot} didn't end`);
}
function openedMist(): State {
  const fixture = content.fixtures["pass-party"];
  if (fixture === undefined) throw new Error("pass-party fixture missing");
  let state = createState(world, fixture);
  const path = "tests/sim/scripts/pass-party/mist.json";
  for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
    for (let tick = 0; tick < segment.ticks; tick += 1)
      state = step(world, state, segment.frame).state;
  return state;
}
const area = world.areas.enchanted;
if (area === undefined) throw new Error("enchanted area missing");
const reachable = new Set(reachablePositions(area, world.tunables.playerRadius)
  .map(({ x, y }) => `${x},${y}`));
const open = [[300, 410], [420, 450], [560, 500], [700, 520], [480, 600],
  [620, 640], [760, 620], [930, 660], [1000, 760], [1250, 770], [900, 820], [1330, 720]];
const closed = [[620, 820], [500, 870], [760, 900], [755, 300], [295, 580],
  [1325, 880], [520, 370], [670, 410], [380, 570], [420, 660], [270, 790],
  [335, 870], [1160, 450], [1080, 560], [1230, 590], [1100, 640], [1180, 710],
  [1420, 730], [1050, 880], [1240, 900], [500, 250], [900, 330], [1550, 600],
  [150, 600], [850, 1030]];
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });
const walk = (state: State, move: Point, ticks: number): State => {
  let next = state;
  for (let tick = 0; tick < ticks; tick += 1)
    next = step(world, next, press({ move })).state;
  return next;
};

describe("The Enchanted Forest floor", () => {
  it("uses the traced outline without blockers", () => {
    expect(area.blockers).toEqual([]);
    for (const point of open)
      expect(reachable.has(`${point[0]},${point[1]}`), `open ${point}`).toBe(true);
    for (const point of closed)
      expect(reachable.has(`${point[0]},${point[1]}`), `feature ${point}`).toBe(false);
  });

  it("keeps every reachable prop out of Fae's body", () => {
    const state = createState(world, { area: "enchanted", spawn: "mist", seed: 1 });
    for (const point of reachablePositions(area, world.tunables.playerRadius)) {
      for (const prop of area.props) {
        const coverage = propCovers(propState(world, state.ink, prop), point, faeBox);
        const limit = prop.id === "stone-lower-right" ||
          prop.id === "stone-lower-right-scribbles" ? 0.05 : 0;
        expect(coverage, `${prop.id} at ${point.x},${point.y}`).toBeLessThanOrEqual(limit);
      }
    }
  }, 30_000);

  it("hears the wish only from the lavender fairy's lore", () => {
    for (const knot of ["fairy_mint", "fairy_sky", "fairy_peach"])
      expect(world.storyVariable(talk(knot), "heard_wish"), knot).toBe(false);
    expect(world.storyVariable(talk("fairy_lavender"), "heard_wish")).toBe(true);
  });

  it("places the hooded kid as a battle set piece and keeps the reveal in its calm knot", () => {
    const kid = world.critters["hooded-kid"];
    expect(kid?.calmKnot).toBe("milo_calm");
    expect(kid?.sticker.name).toBe("Milo");
    expect(area.critters).toEqual([{ id: "hooded-kid", point: { x: 1130, y: 730 } }]);
    expect(area.npcs.some((npc) => npc.id === "hooded-kid-front")).toBe(false);
    const reveal = lines("milo_calm");
    expect(reveal.join(" ")).toContain("I'm really sorry about all the scribbles");
    expect(reveal.join(" ")).toContain("paper plane");
    expect(reveal.join(" ")).toContain("I always notice you, Milo");
  });

  it("changes the pond and tree looks after the wish lore", () => {
    const before = [...lines("mystic_pond"), ...lines("ancient_tree")].join(" ");
    const wished = talk("fairy_lavender");
    expect(world.storyVariable(wished, "heard_wish")).toBe(true);
    const after = [...lines("mystic_pond", wished), ...lines("ancient_tree", wished)].join(" ");
    expect(before).not.toContain("wishes come true");
    expect(after).toContain("wishes come true");
    expect(after).toContain("dreaming the whole land");
  });

  it("starts every forest chaos overlay fizzy and hides each default", () => {
    const state = createState(world, { area: "enchanted", spawn: "mist", seed: 1 });
    const overlayIds = ["tree-scribbles", "stone-upper-scribbles", "stone-left-scribbles",
      "stone-lower-right-scribbles", "pond-fizz"];
    for (const id of overlayIds) {
      const prop = area.props.find((candidate) => candidate.id === id);
      if (prop === undefined) throw new Error(`${id} missing`);
      expect(propStateName(world, state.ink, prop), id).toBe("fizzy");
      expect(prop.states.default?.hidden, id).toBe(true);
      expect(prop.rules).toEqual([{ state: "fizzy", while: "forest_fizzy" }]);
    }
  });

  it("puts newest forest journal notes first", () => {
    const state = createState(world, { area: "enchanted", spawn: "mist", seed: 1 });
    const before = journalNotes(world, state);
    const ink = talk("fairy_lavender", state.ink);
    const after = journalNotes(world, { ...state, ink });
    expect(after.length).toBeGreaterThan(before.length);
    expect(after[0]).toContain("wish");
  });

  it("keeps its story points, spawn, and door reachable", () => {
    expect(areaConnectionErrors(
      world.areas, world.tunables, world.critters, world.party,
    )).toEqual([]);
  }, 30_000);

  it("keeps the forest door shut until the seal opens, then returns through it", () => {
    const mist = world.areas.mist;
    if (mist === undefined) throw new Error("mist area missing");
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    const sealed = createState(world, { ...fixture, area: "mist", spawn: "forest" });
    const shut = walk({ ...sealed, player: { x: 1320, y: 565 }, facing: "right" },
      { x: 1, y: 0 }, 80);
    expect({ area: shut.area, knot: shut.dialogue?.knot }).toEqual({
      area: "mist", knot: "mist_seal",
    });

    const opened = openedMist();
    expect(world.storyVariable(opened.ink, "seal_open")).toBe(true);
    let forest = walk({ ...opened, player: { x: 1320, y: 565 }, facing: "right" },
      { x: 1, y: 0 }, 80);
    for (let tick = 0; tick < 60 && forest.transition !== null; tick += 1)
      forest = step(world, forest, blankInput()).state;
    expect(forest.area).toBe("enchanted");

    let back = walk({ ...forest, player: { x: 290, y: 350 }, facing: "left" },
      { x: -1, y: 0 }, 80);
    for (let tick = 0; tick < 60 && back.transition !== null; tick += 1)
      back = step(world, back, blankInput()).state;
    expect(back.area).toBe("mist");
  }, 30_000);
});
