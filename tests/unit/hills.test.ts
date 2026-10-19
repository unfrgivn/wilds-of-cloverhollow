import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { mapLandName } from "../../src/core/journal";
import { surfaceAt } from "../../src/core/surfaces";

const { world } = loadContent();
const hills = world.areas.hills;
if (hills === undefined) throw new Error("hills area missing");

describe("Clover Hills", () => {
  it("connects park west to woods north and has no bus stop", () => {
    expect(hills.name).toBe("Clover Hills");
    expect(hills.triggers.map((trigger) => trigger.target)).toEqual([
       { area: "park", spawn: "hills" },
       { area: "woods", spawn: "hills" },
    ]);
    expect(world.lands.find((land) => land.id === "hills")?.busStop).toBe(false);
  });

  it("keeps two open meadow dens for new and returning outdoor kinds", () => {
    expect(hills.recurring?.dens).toEqual([
      expect.objectContaining({ point: { x: 450, y: 850 }, radius: 130,
        kinds: ["lamb", "hedgehog", "bunny"] }),
      expect.objectContaining({ point: { x: 700, y: 200 }, radius: 120,
        kinds: ["squirrel", "raccoon"] }),
    ]);
  });

  it("uses sand for the dirt path and stone for the lookout stepping stones", () => {
    const map = world.surfaces.hills;
    if (map === undefined) throw new Error("hills surface map missing");
    expect(surfaceAt(map, { x: 535, y: 570 })).toBe("sand");
    expect(surfaceAt(map, { x: 1132, y: 408 })).toBe("stone");
    expect(surfaceAt(map, { x: 900, y: 900 })).toBe("grass");
  });

  it("keeps the hills map label revealed after her first arrival", () => {
    const hillsLand = { id: "hills", name: "Clover Hills", revealVariable: "visited_hills" };
    expect(mapLandName(hillsLand, "park", () => false)).toBe("???");
    expect(mapLandName(hillsLand, "hills", () => false)).toBe("Clover Hills");
    expect(mapLandName(hillsLand, "park", () => true)).toBe("Clover Hills");
  });

  it("puts a gentle squirrel cache at the upper-right lookout", () => {
    expect(hills.interactables).toEqual([{
      id: "lookout-cache", knot: "hills_lookout", point: { x: 1130, y: 345 }, prompt: "Look",
    }]);
  });
});
