import { describe, expect, it } from "vitest";
import { areaConnectionErrors } from "../../src/content/area-checks";
import { loadContent, parseArea } from "../../src/content/load";
import { propRuleErrors } from "../../src/content/props";
import { createState, sceneryArea, step, type Area, type Polygon } from "../../src/core";

const { world, fixtures } = loadContent();
const woods = world.areas.woods;
const woodsFixture = fixtures.woods;
if (woods === undefined || woodsFixture === undefined) throw new Error("woods missing");
const eastSpawn = woods.spawns.east;
if (eastSpawn === undefined) throw new Error("woods east spawn missing");
const crossing: Polygon = [[1000, 450], [1020, 450], [1020, 600], [1000, 600]];
const withCrossing = (opens: string): Area => ({
  ...woods,
  crossings: [{ id: "creek", polygon: crossing, opens }],
});

describe("crossings", () => {
  it("adds a closed crossing and removes it when its real Ink flag opens", () => {
    const state = createState(world, woodsFixture);
    const area = withCrossing("club_open");
    expect(sceneryArea(world, state.ink, area).blockers).toContain(crossing);
    expect(sceneryArea(world, state.ink, withCrossing("maple_in_hall")).blockers)
      .not.toContain(crossing);
  });

  it("stops Fae at a closed crossing and lets her pass when open", () => {
    const state = createState(world, woodsFixture);
    const area = withCrossing("club_open");
    const openWorld = { ...world, areas: { ...world.areas, woods: withCrossing("maple_in_hall") } };
    const closedWorld = { ...world, areas: { ...world.areas, woods: area } };
    const start = { ...state, area: area.id, player: { x: 980, y: 520 } };
    const closed = step(closedWorld, { ...start, area: area.id }, {
      move: { x: 1, y: 0 }, confirm: false, cancel: false, menu: false,
    }).state;
    const open = step(openWorld, { ...start, area: area.id, ink: state.ink }, {
      move: { x: 1, y: 0 }, confirm: false, cancel: false, menu: false,
    }).state;
    expect(closed.player.x).toBeLessThan(1000);
    expect(open.player.x).toBeGreaterThan(closed.player.x);
  });

  it("reports crossing spawn and trigger geometry in connection checks", () => {
    const area = { ...woods, crossings: [{ id: "creek", polygon: crossing, opens: "club_open" }],
      spawns: { ...woods.spawns, bad: { ...eastSpawn, x: 1010, y: 520 } },
      triggers: [{ id: "door", polygon: crossing, target: { area: "woods", spawn: "east" } }] };
    const errors = areaConnectionErrors(
      { woods: area }, world.tunables, world.critters, world.party,
    );
    expect(errors).toContain("woods: spawn bad overlaps crossing creek");
    expect(errors).toContain("woods: crossing creek overlaps trigger door");
  });

  it("keeps crossing flags in the real Ink declaration check", () => {
    const area = withCrossing("not_declared");
    expect(propRuleErrors({ woods: area }, (name) => world.storyVariable(
      createState(world, woodsFixture).ink, name,
    ))).toEqual(["woods: crossing creek reads undeclared Ink variable not_declared"]);
  });

  it("keeps structural loader checks but defers geometry checks", () => {
    const raw = {
      ...woods, props: [],
      crossings: [{ id: "creek", polygon: crossing, opens: "club_open" }],
    };
    expect(parseArea(raw, "woods.json").crossings).toHaveLength(1);
    const duplicate = [raw.crossings[0], raw.crossings[0]];
    expect(() => parseArea({ ...raw, crossings: duplicate }, "woods.json"))
      .toThrow("duplicate id");
  });
});
