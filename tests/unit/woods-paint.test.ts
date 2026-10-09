import { describe, expect, it } from "vitest";
import { areaConnectionErrors, hiddenPositions } from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";
import { faeBox, propCovers, type Area } from "../../src/core";

const { world } = loadContent();
const woods = world.areas.woods;
if (woods === undefined) throw new Error("woods missing");
const area: Area = woods;

describe("Whispering Woods area kit", () => {
  it("uses the 1750x1100 painted forest plate", () => {
    expect(area.width).toBe(1750);
    expect(area.height).toBe(1100);
    // The log-west pocket and the forest behind the tree house.
    expect(area.blockers).toHaveLength(2);
    expect(area.props).toHaveLength(10);
  });

  it("keeps every woodland prop's ground contact solid", () => {
    for (const prop of area.props) {
      const state = prop.states.default;
      expect(state, `${prop.id} default state`).toBeDefined();
      expect(state?.footprint.length, `${prop.id} footprint`).toBeGreaterThan(0);
      expect(state?.footprint.flat().every(([x, y]) =>
        x >= 0 && x <= area.width && y >= 0 && y <= area.height)).toBe(true);
    }
  });

  it("sorts standing Fae behind the non-canopy props from the north", () => {
    const hiders = area.props.filter((prop) => !prop.canopy);
    expect(hiders.map(({ id }) => id))
      .toEqual(["clubhouse", "log-west", "log-south", "log-north"]);
    for (const prop of hiders) {
      const state = prop.states.default;
      if (state === undefined) throw new Error(`${prop.id} state missing`);
      const column = state.front.ys.findIndex((edge, index) =>
        edge > -Infinity && state.silhouette.columns[index]?.length &&
        propCovers(state, {
          x: state.silhouette.left + (index + 0.5) * state.silhouette.step,
          y: edge - 20,
        }, faeBox) > 0);
      if (column < 0) continue;
      const edge = state.front.ys[column] ?? 0;
      const x = state.silhouette.left + (column + 0.5) * state.silhouette.step;
      expect(propCovers(state, { x, y: edge - 20 }, faeBox), prop.id).toBeGreaterThan(0);
      expect(propCovers(state, { x, y: edge + 20 }, faeBox), prop.id).toBe(0);
    }
  });

  it("has no unreachable story points or fully hidden reachable positions", () => {
    expect(areaConnectionErrors(
      world.areas, world.tunables, world.critters, world.party,
    )).toEqual([]);
    expect(hiddenPositions(area, world.tunables.playerRadius)).toEqual([]);
  }, 30_000);
});
