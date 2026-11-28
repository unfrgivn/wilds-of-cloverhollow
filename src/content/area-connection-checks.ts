import {
  auditAreaNavigation, distanceToPolygon, orderPartyContent, partySlots, pointInPolygon,
  type Area, type Critter, type PartyContent, type Point, type Polygon, type Tunables,
} from "../core";
import {
  bodyCoverage, hidersOf, possibleStates, reachableParts, solidOf, walkable, type Scenario,
} from "./area-checks";

const distance = (a: Point, b: Point): number =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

const withinRange = (points: readonly Point[], target: Point, range: number): boolean =>
  points.some((point) => (point.x - target.x) ** 2 + (point.y - target.y) ** 2 <= range * range);

function polygonsOverlap(first: Polygon, second: Polygon): boolean {
  const orientation = (a: Point, b: Point, c: Point): number =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const crosses = (a: Point, b: Point, c: Point, d: Point): boolean => {
    const ab = orientation(a, b, c) * orientation(a, b, d);
    const cd = orientation(c, d, a) * orientation(c, d, b);
    return ab <= 0 && cd <= 0;
  };
  for (let i = 0; i < first.length; i += 1) {
    const a = first[i];
    const b = first[(i + 1) % first.length];
    if (a === undefined || b === undefined) continue;
    for (let j = 0; j < second.length; j += 1) {
      const c = second[j];
      const d = second[(j + 1) % second.length];
      if (c !== undefined && d !== undefined && crosses(
        { x: a[0], y: a[1] }, { x: b[0], y: b[1] },
        { x: c[0], y: c[1] }, { x: d[0], y: d[1] },
      )) return true;
    }
  }
  const point = (item: Polygon): Point => ({ x: item[0]?.[0] ?? 0, y: item[0]?.[1] ?? 0 });
  return pointInPolygon(point(first), second) || pointInPolygon(point(second), first);
}

const closedScenario = (area: Area): Scenario =>
  ({ flags: new Set((area.crossings ?? []).map((crossing) => crossing.opens)), open: new Set() });

const openScenario = (area: Area): Scenario => {
  const flags = new Set((area.crossings ?? []).map((crossing) => crossing.opens));
  return { flags, open: flags };
};

export function areaConnectionErrors(
  areas: Record<string, Area>,
  tunables: Tunables,
  critters: Record<string, Critter> = {},
  party: Record<string, PartyContent> = {},
): string[] {
  const radius = tunables.playerRadius;
  const roster = orderPartyContent(Object.values(party));
  const errors: string[] = [];
  for (const area of Object.values(areas)) {
    for (const [name, spawn] of Object.entries(area.spawns))
      for (const crossing of area.crossings ?? [])
        if (pointInPolygon(spawn, crossing.polygon) ||
            distanceToPolygon(spawn, crossing.polygon) < radius)
          errors.push(`${area.id}: spawn ${name} overlaps crossing ${crossing.id}`);
    for (const crossing of area.crossings ?? [])
      for (const trigger of area.triggers)
        if (polygonsOverlap(crossing.polygon, trigger.polygon))
          errors.push(`${area.id}: crossing ${crossing.id} overlaps trigger ${trigger.id}`);
    // One floor: from any spawn, Fae can walk to every other (and so to every
    // door). Furniture that walls part of a room off fails here.
    // Look points and set pieces must be reachable with every crossing shut;
    // the floor must be one piece with every crossing open.
    const before = reachableParts(area, radius, closedScenario(area));
    // Without crossings both scenarios are the same, so the floor is filled once.
    const after = (area.crossings ?? []).length === 0
      ? before : reachableParts(area, radius, openScenario(area));
    if (after.length > 1)
      errors.push(`${area.id}: its floor is split; spawns ${after.map((part) =>
        part.spawns.join(", ")).join(" | ")} can't reach each other`);
    const reachable = before.flatMap((part) => part.points);
    const hiders = hidersOf(area);
    for (const interactable of area.interactables) {
      if (!withinRange(reachable, interactable.point, tunables.interact.range))
        errors.push(`${area.id}: interactable ${interactable.id} is unreachable`);
    }
    const staticSolidsForNpc = (npcId: string): Area["blockers"] => [
      ...area.blockers,
      ...(area.crossings ?? []).map((crossing) => crossing.polygon),
      ...area.props.flatMap((prop) =>
        possibleStates(prop, closedScenario(area)).flatMap((state) => state.footprint),
      ),
      ...area.npcs.filter((other) => other.id !== npcId).map((other) => other.footprint),
    ];
    for (const npc of area.npcs) {
      const range = tunables.interact.range;
      if (!withinRange(reachable, npc.point, range))
        errors.push(`${area.id}: npc ${npc.id} is unreachable`);
      if (npc.stroll !== undefined) {
        const solids = staticSolidsForNpc(npc.id);
        const waypoints = npc.stroll.waypoints;
        for (let index = 0; index < waypoints.length; index += 1) {
          const current = waypoints[index];
          const next = waypoints[(index + 1) % waypoints.length];
          if (current === undefined || next === undefined) continue;
          const midpoint = { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 };
          const samples: [string, Point][] = [
            [`waypoint ${index}`, current],
            [`segment ${index} midpoint`, midpoint],
          ];
          for (const [label, sample] of samples) {
            if (!pointInPolygon(sample, area.walkable))
              errors.push(`${area.id}: npc ${npc.id} stroll ${label} is outside walkable`);
            else if (solids.some((blocker) => pointInPolygon(sample, blocker)))
              errors.push(`${area.id}: npc ${npc.id} stroll ${label} hits a solid blocker`);
          }
          if (!withinRange(reachable, current, range))
            errors.push(`${area.id}: npc ${npc.id} stroll waypoint ${index} is unreachable`);
        }
      }
    }
    for (const critter of area.critters) {
      const config = critter.id;
      const touchRadius = critters[critter.id]?.touchRadius ?? 70;
      if (!withinRange(reachable, critter.point, touchRadius))
        errors.push(`${area.id}: critter ${config} touch circle is unreachable`);
      if (area.triggers.some((trigger) =>
        pointInPolygon(critter.point, trigger.polygon) ||
        distanceToPolygon(critter.point, trigger.polygon) <= touchRadius))
        errors.push(`${area.id}: critter ${config} overlaps a door trigger`);
      if (Object.values(area.spawns).some((spawn) => distance(spawn, critter.point) <= touchRadius))
        errors.push(`${area.id}: critter ${config} overlaps a spawn`);
      if (!reachable.some((point) => distance(point, critter.point) <= tunables.interact.range))
        errors.push(`${area.id}: calm ${config} talk point is unreachable`);
    }
    // A den's critters start at its point (spec 6): it must be on the floor,
    // and far enough from every spawn and door that Fae arriving there isn't
    // in its sight, nor caught the moment she steps through. Single-door
    // peaceful indoor shop portals whose rollWild keeps nearby dens quiet on
    // return still must keep their door and doorstep clear of the den's touch.
    const quietShopDoor = (trigger: Area["triggers"][number]): boolean => {
      const target = areas[trigger.target.area];
      return target !== undefined &&
        target.critters.length === 0 &&
        target.recurring === undefined &&
        target.triggers.length === 1 &&
        target.triggers[0]?.target.area === area.id &&
        target.triggers[0]?.target.spawn === trigger.id;
    };
    const quietShopSpawns = new Set(
      area.triggers.filter(quietShopDoor).map((trigger) => trigger.id),
    );
    area.recurring?.dens.forEach((den, index) => {
      const touch = Math.max(...den.kinds.map((kind) => critters[kind]?.touchRadius ?? 70));
      const clear = tunables.roam.sight + touch;
      if (!walkable(area, solidOf(area, closedScenario(area)), tunables.follow.radius, den.point))
        errors.push(`${area.id}: den ${index} is off the floor`);
      for (const [name, spawn] of Object.entries(area.spawns)) {
        const minGap = quietShopSpawns.has(name) ? touch : clear;
        if (distance(spawn, den.point) <= minGap)
          errors.push(`${area.id}: den ${index} is within ${minGap} of spawn ${name}`);
      }
      for (const trigger of area.triggers) {
        const minGap = quietShopDoor(trigger) ? touch : den.radius + touch;
        if (pointInPolygon(den.point, trigger.polygon) ||
            distanceToPolygon(den.point, trigger.polygon) <= minGap)
          errors.push(`${area.id}: den ${index} reaches door ${trigger.id}`);
      }
      // Its critters must be seen: a den mostly behind scenery hides them.
      // At sample spots on rings round the den, no more than a tenth may have
      // over half a critter's body (50 by 70 units) drawn behind scenery.
      const spots = [0, den.radius / 2, den.radius].flatMap((ring) =>
        Array.from({ length: 16 }, (_, step) => {
          const turn = (step / 16) * 2 * Math.PI;
          return { x: den.point.x + Math.cos(turn) * ring, y: den.point.y + Math.sin(turn) * ring };
        }));
      const hidden = spots.filter((spot) =>
        bodyCoverage(hiders, spot, { half: 25, height: 70 }).coverage > 0.5);
      if (hidden.length > spots.length / 10)
        errors.push(`${area.id}: den ${index} is mostly behind scenery`);
    });
    // Party slots avoid props as they do in play, here in every state at once.
    const scenery = { ...area, blockers: solidOf(area, closedScenario(area)) };
    for (const [name, spawn] of Object.entries(area.spawns)) {
      // The whole roster must fit behind Fae here, whoever is in the party.
      for (const { id, slot } of partySlots(scenery, spawn, tunables.follow, roster))
        if (slot === undefined)
          errors.push(`${area.id}: spawn ${name} has no slot for ${id}`);
      for (const trigger of area.triggers) {
        if (pointInPolygon(spawn, trigger.polygon) ||
            distanceToPolygon(spawn, trigger.polygon) < radius * 2)
          errors.push(`${area.id}: spawn ${name} is within ${radius * 2} units of ${trigger.id}`);
      }
    }
    for (const trigger of area.triggers) {
      const target = areas[trigger.target.area];
      if (target === undefined || target.spawns[trigger.target.spawn] === undefined)
        errors.push(`${area.id}: trigger ${trigger.id} has an invalid target`);
      if (!reachable.some((point) => pointInPolygon(point, trigger.polygon)))
        errors.push(`${area.id}: trigger ${trigger.id} is unreachable`);
    }
  }
  return errors;
}

/**
 * Navigation quality check: flags areas with large pinched-off unreachable
 * floor pockets (>= maxClusterCells on the 10-unit nav grid) or spawns placed
 * below playerRadius clearance.
 */
export function navigationQualityErrors(
  areas: Record<string, Area>,
  tunables: Tunables,
  maxClusterCells = 15,
): string[] {
  const radius = tunables.playerRadius;
  const errors: string[] = [];
  for (const area of Object.values(areas)) {
    const navArea: Area = {
      ...area,
      blockers: [
        ...area.blockers,
        ...area.props.flatMap((prop) => prop.states[prop.state]?.footprint ?? []),
        ...area.npcs.filter((npc) => npc.stroll === undefined).map((npc) => npc.footprint),
      ],
    };
    const report = auditAreaNavigation(navArea, radius);
    if (report.minSpawnClearance < radius - 0.01) {
      errors.push(
        `${area.id}: minimum spawn clearance ${report.minSpawnClearance.toFixed(1)} < ${radius}`,
      );
    }
    for (const cluster of report.unreachableClusters) {
      if (cluster.count >= maxClusterCells) {
        const at = `(${cluster.cx}, ${cluster.cy})`;
        errors.push(`${area.id}: unreachable pocket of ${cluster.count} cells at ${at}`);
      }
    }
  }
  return errors;
}
