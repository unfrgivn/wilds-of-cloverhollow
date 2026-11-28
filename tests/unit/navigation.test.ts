import { describe, expect, it } from "vitest";
import {
  distanceToPolygon,
  pointInPolygon,
  resolveMove,
  validResolved,
} from "../../src/core/geometry";
import {
  auditAreaNavigation,
  buildNavField,
  clearanceAt,
  findPath,
  gradientAt,
  nearestWalkablePoint,
  segmentWalkable,
} from "../../src/core/nav";
import {
  hiddenPositions,
  navigationQualityErrors,
  propBlockerErrors,
} from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";
import type { Area, Point, Polygon } from "../../src/core/types";

function rect(x0: number, y0: number, x1: number, y1: number): Polygon {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

function makeArea(opts: {
  id?: string;
  width: number;
  height: number;
  walkable: Polygon;
  blockers?: Polygon[];
  spawns?: Area["spawns"];
}): Area {
  return {
    id: opts.id ?? "test-nav",
    name: "Test Nav",
    width: opts.width,
    height: opts.height,
    walkable: opts.walkable,
    blockers: opts.blockers ?? [],
    glows: [],
    triggers: [],
    interactables: [],
    critters: [],
    npcs: [],
    props: [],
    atlases: [],
    spawns: opts.spawns ?? { start: { x: 80, y: 150, facing: "right" } },
  };
}

describe("resolveMove navigation improvements", () => {
  const radius = 20;

  it("funnels Fae smoothly through a tight doorway when approaching off-center", () => {
    // Gap from x=176 to x=224 (width 48): passable x centers are [196, 204].
    const area = makeArea({
      width: 400,
      height: 400,
      walkable: rect(0, 0, 400, 400),
      blockers: [rect(0, 180, 176, 220), rect(224, 180, 400, 220)],
    });

    let pos: Point = { x: 184, y: 260 };
    for (let tick = 0; tick < 50; tick += 1) {
      pos = resolveMove(pos, { x: pos.x, y: pos.y - 4 }, area, radius);
      expect(validResolved(pos, area, radius)).toBe(true);
    }
    expect(pos.y).toBeLessThan(160);
    expect(pos.x).toBeGreaterThanOrEqual(195.5);
    expect(pos.x).toBeLessThanOrEqual(204.5);
  });

  it("stops cleanly without sideways drift when pushing dead-center into a wide blocker", () => {
    const area = makeArea({
      width: 400,
      height: 400,
      walkable: rect(0, 0, 400, 400),
      blockers: [rect(120, 180, 280, 220)],
    });

    let pos: Point = { x: 200, y: 260 };
    for (let tick = 0; tick < 40; tick += 1) {
      pos = resolveMove(pos, { x: pos.x, y: pos.y - 4 }, area, radius);
      expect(validResolved(pos, area, radius)).toBe(true);
    }
    expect(Math.abs(pos.x - 200)).toBeLessThan(0.01);
    expect(pos.y).toBeGreaterThanOrEqual(239.9);
    expect(pos.y).toBeLessThanOrEqual(241);

    // Even a narrower blocker symmetric about x=200 must not cause sideways drift.
    const narrow = makeArea({
      width: 400,
      height: 400,
      walkable: rect(0, 0, 400, 400),
      blockers: [rect(188, 180, 212, 220)],
    });
    let pos2: Point = { x: 200, y: 260 };
    for (let tick = 0; tick < 40; tick += 1) {
      pos2 = resolveMove(pos2, { x: pos2.x, y: pos2.y - 4 }, narrow, radius);
      expect(validResolved(pos2, narrow, radius)).toBe(true);
    }
    expect(Math.abs(pos2.x - 200)).toBeLessThan(0.01);
    expect(pos2.y).toBeGreaterThanOrEqual(239.9);
  });

  it("slides smoothly through a tight diagonal corridor instead of freezing", () => {
    // Two parallel 45-degree walls leaving a 41-unit corridor (margin 0.5 per side) around y = x.
    const southEastWall: Polygon = [
      [40, 69],
      [300, 329],
      [270, 359],
      [10, 99],
    ];
    const northWestWall: Polygon = [
      [69, 40],
      [329, 300],
      [359, 270],
      [99, 10],
    ];
    const area = makeArea({
      width: 400,
      height: 400,
      walkable: rect(0, 0, 400, 400),
      blockers: [southEastWall, northWestWall],
    });

    let pos: Point = { x: 140, y: 140 };
    expect(validResolved(pos, area, radius)).toBe(true);
    for (let tick = 0; tick < 40; tick += 1) {
      pos = resolveMove(pos, { x: pos.x + 4, y: pos.y }, area, radius);
      expect(validResolved(pos, area, radius)).toBe(true);
    }
    expect(pos.x).toBeGreaterThan(210);
    expect(pos.y).toBeGreaterThan(210);
  });

  it("slides smoothly out of an acute V-corner instead of freezing", () => {
    // Triangular walkable polygon with an acute ~35 deg V-corner at (360, 200).
    const area = makeArea({
      width: 400,
      height: 400,
      walkable: [
        [40, 100],
        [360, 200],
        [40, 300],
      ],
    });

    // Near the V tip, clearance to both angled edges is just above radius (20.88).
    let pos: Point = { x: 290, y: 200 };
    expect(validResolved(pos, area, radius)).toBe(true);
    // Push obliquely northwest against the upper wall while pinched by the lower wall.
    for (let tick = 0; tick < 30; tick += 1) {
      pos = resolveMove(pos, { x: pos.x - 2, y: pos.y - 3.5 }, area, radius);
      expect(validResolved(pos, area, radius)).toBe(true);
    }
    expect(pos.x).toBeLessThan(230);
    expect(pos.y).toBeLessThan(190);
  });
});

describe("nav field, pathfinding, and navigation audit", () => {
  const radius = 20;

  it("computes signed clearance, wall-repelling gradients, and nearest walkable points", () => {
    const area = makeArea({
      width: 400,
      height: 360,
      walkable: rect(20, 100, 380, 260),
      spawns: { start: { x: 200, y: 180, facing: "right" } },
    });
    const field = buildNavField(area, radius);

    // Center of 160-tall corridor has clearance 80.
    expect(clearanceAt(field, { x: 200, y: 180 })).toBeCloseTo(80, 1);
    // 25 units inside top wall has clearance 25.
    expect(clearanceAt(field, { x: 200, y: 125 })).toBeCloseTo(25, 1);
    // 20 units outside top wall has negative clearance -20.
    expect(clearanceAt(field, { x: 200, y: 80 })).toBeCloseTo(-20, 1);

    // Gradient points away from top wall (south) and bottom wall (north).
    const nearTop = gradientAt(field, { x: 200, y: 125 });
    expect(nearTop.y).toBeGreaterThan(0.95);
    expect(Math.abs(nearTop.x)).toBeLessThan(0.1);

    const nearBottom = gradientAt(field, { x: 200, y: 235 });
    expect(nearBottom.y).toBeLessThan(-0.95);
    expect(Math.abs(nearBottom.x)).toBeLessThan(0.1);

    const atCenter = gradientAt(field, { x: 200, y: 180 });
    expect(atCenter).toEqual({ x: 0, y: 0 });

    // Valid point returns itself; wall point snaps to nearest valid floor cell.
    expect(nearestWalkablePoint(field, { x: 200, y: 180 })).toEqual({ x: 200, y: 180 });
    const snapped = nearestWalkablePoint(field, { x: 200, y: 95 });
    expect(snapped).not.toBeNull();
    if (snapped !== null) {
      expect(snapped.x).toBe(200);
      expect(snapped.y).toBe(120);
      expect(clearanceAt(field, snapped)).toBeGreaterThanOrEqual(radius);
    }
    // Far away outside search radius returns null.
    expect(nearestWalkablePoint(field, { x: 200, y: 10 }, 4)).toBeNull();
  });

  it("finds clearance-weighted string-pulled paths around a central obstacle", () => {
    const obstacle = rect(210, 110, 290, 190);
    const area = makeArea({
      width: 500,
      height: 300,
      walkable: rect(0, 0, 500, 300),
      blockers: [obstacle],
      spawns: { start: { x: 60, y: 150, facing: "right" } },
    });
    const field = buildNavField(area, radius);
    const start: Point = { x: 60, y: 150 };
    const goal: Point = { x: 440, y: 150 };
    const path = findPath(field, start, goal);

    expect(path.length).toBeGreaterThan(1);
    expect(path.length).toBeLessThanOrEqual(6);
    expect(path[path.length - 1]).toEqual(goal);

    // Every segment along the path must stay clear of walls and obstacle.
    let prev = start;
    for (const wp of path) {
      expect(segmentWalkable(field, prev, wp, radius)).toBe(true);
      expect(pointInPolygon(wp, obstacle)).toBe(false);
      expect(distanceToPolygon(wp, obstacle)).toBeGreaterThanOrEqual(radius);
      prev = wp;
    }
  });

  it("prefers the wider high-clearance corridor center over a tight squeeze", () => {
    // Obstacle shifted south: top passage y in [0..120] (center clearance 60),
    // bottom passage y in [250..300] (tight width 50, max clearance 25).
    const area = makeArea({
      width: 500,
      height: 300,
      walkable: rect(0, 0, 500, 300),
      blockers: [rect(190, 120, 310, 250)],
      spawns: { start: { x: 70, y: 185, facing: "right" } },
    });
    const field = buildNavField(area, radius);
    const path = findPath(field, { x: 70, y: 185 }, { x: 430, y: 185 });

    expect(path.length).toBeGreaterThan(1);
    // Chooses the spacious northern route instead of hugging the tight southern gap.
    const midWaypoints = path.slice(0, -1);
    expect(midWaypoints.some((p) => p.y < 120)).toBe(true);
    expect(midWaypoints.every((p) => p.y < 250)).toBe(true);
    // Intermediate waypoints stay comfortably clear of walls.
    for (const wp of midWaypoints) {
      expect(clearanceAt(field, wp)).toBeGreaterThan(radius + 10);
    }
  });

  it("returns an empty path for truly isolated goals", () => {
    const wall = rect(230, 0, 270, 300);
    const singleSpawn = makeArea({
      width: 500,
      height: 300,
      walkable: rect(0, 0, 500, 300),
      blockers: [wall],
      spawns: { west: { x: 80, y: 150, facing: "right" } },
    });
    const field1 = buildNavField(singleSpawn, radius);
    expect(findPath(field1, { x: 80, y: 150 }, { x: 440, y: 150 })).toEqual([]);

    // Even if the isolated room has its own spawn, A* must still return [] across the wall.
    const twoSpawns = makeArea({
      width: 500,
      height: 300,
      walkable: rect(0, 0, 500, 300),
      blockers: [wall],
      spawns: {
        west: { x: 80, y: 150, facing: "right" },
        east: { x: 420, y: 150, facing: "left" },
      },
    });
    const field2 = buildNavField(twoSpawns, radius);
    expect(findPath(field2, { x: 80, y: 150 }, { x: 420, y: 150 })).toEqual([]);
  });

  it("audits an area with an unreachable pocket, tight corridor, and false gap", () => {
    const area = makeArea({
      id: "synthetic-audit",
      width: 500,
      height: 300,
      walkable: rect(0, 0, 500, 300),
      blockers: [
        // Solid divider sealing off an unreachable eastern pocket [360..500, 0..300].
        rect(320, 0, 360, 300),
        // Tight passable corridor (width 52 -> clearance up to 26) + false gap (width 30 -> c<=15).
        rect(140, 0, 180, 120),
        rect(140, 172, 180, 270),
      ],
      spawns: { start: { x: 70, y: 150, facing: "right" } },
    });

    const report = auditAreaNavigation(area, radius);
    expect(report.areaId).toBe("synthetic-audit");
    expect(report.freeCells).toBe(report.reachableCells + report.unreachableCells);
    expect(report.reachableCells).toBeGreaterThan(100);
    expect(report.unreachableCells).toBeGreaterThan(50);
    expect(report.tightCells).toBeGreaterThan(0);
    expect(report.falseGapCells).toBeGreaterThan(0);
    expect(report.minSpawnClearance).toBeGreaterThanOrEqual(radius);

    expect(report.unreachableClusters.length).toBe(1);
    const cluster = report.unreachableClusters[0];
    expect(cluster).toBeDefined();
    if (cluster !== undefined) {
      expect(cluster.count).toBeGreaterThan(50);
      expect(cluster.cx).toBeGreaterThan(360);
      expect(cluster.cx).toBeLessThan(500);
      expect(cluster.cy).toBeGreaterThan(20);
      expect(cluster.cy).toBeLessThan(280);
    }
  });

  it("passes strict 15-cell navigationQualityErrors and clears key area pockets", () => {
    const { world } = loadContent();
    expect(Object.keys(world.areas).length).toBeGreaterThanOrEqual(35);
    expect(navigationQualityErrors(world.areas, world.tunables)).toEqual([]);

    const radius = world.tunables.playerRadius;
    const cleaned: readonly string[] = [
      "plaza", "pass", "field", "cafe", "island", "kitchen", "enchanted",
    ];
    for (const id of cleaned) {
      const area = world.areas[id];
      expect(area, id).toBeDefined();
      if (area === undefined) continue;
      const navArea: Area = {
        ...area,
        blockers: [
          ...area.blockers,
          ...area.props.flatMap((prop) => prop.states[prop.state]?.footprint ?? []),
          ...area.npcs
            .filter((npc) => npc.stroll === undefined)
            .map((npc) => npc.footprint),
        ],
      };
      const report = auditAreaNavigation(navArea, radius);
      const largeClusters = report.unreachableClusters.filter((cluster) => cluster.count >= 10);
      expect(largeClusters, `${id} clusters >= 10`).toEqual([]);
      expect(propBlockerErrors(area), `${id} propBlockerErrors`).toEqual([]);
      expect(hiddenPositions(area, radius), `${id} hiddenPositions`).toEqual([]);
    }

    const enchanted = world.areas.enchanted;
    if (enchanted !== undefined) {
      const report = auditAreaNavigation(enchanted, radius);
      expect(report.unreachableCells).toBe(0);
      expect(report.unreachableClusters).toEqual([]);
    }
  });

  it("walks smoothly between the Ice Cream Parlor and Bakery in plaza without snagging", () => {
    const { world } = loadContent();
    const plaza = world.areas.plaza;
    expect(plaza).toBeDefined();
    if (plaza === undefined) return;
    const radius = world.tunables.playerRadius;
    const solidPlaza: Area = {
      ...plaza,
      blockers: [
        ...plaza.blockers,
        ...plaza.props.flatMap((prop) => prop.states[prop.state]?.footprint ?? []),
      ],
    };
    const field = buildNavField(solidPlaza, radius);
    const start = { x: 940, y: 390 };
    const goal = { x: 1070, y: 415 };
    const path = findPath(field, start, goal);
    expect(path.length).toBeGreaterThan(0);
    // Direct step-by-step walk right+down passes cleanly between the bakery corner and arch post.
    let pos = start;
    for (let tick = 0; tick < 50; tick += 1) {
      pos = resolveMove(pos, { x: pos.x + 3.88, y: pos.y + 0.97 }, solidPlaza, radius);
    }
    expect(pos.x).toBeGreaterThan(1070);
  });
});
