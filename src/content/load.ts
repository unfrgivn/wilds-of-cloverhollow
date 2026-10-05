import areaData from "../../content/areas/harness.json";
import fixtureData from "../../content/fixtures/new-game.json";
import tunableData from "../../content/tunables.json";
import type {
  Area,
  Direction,
  Fixture,
  Polygon,
  Spawn,
  Tunables,
  World,
} from "../core";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function field(
  condition: boolean,
  file: string,
  name: string,
): asserts condition {
  if (!condition) throw new Error(`${file}: invalid ${name}`);
}

function polygon(value: unknown): value is Polygon {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.every(
      (item) =>
        Array.isArray(item) &&
        item.length === 2 &&
        typeof item[0] === "number" &&
        typeof item[1] === "number",
    )
  );
}

function direction(value: unknown): value is Direction {
  return (
    value === "up" || value === "down" || value === "left" || value === "right"
  );
}

export function parseTunables(value: unknown, file: string): Tunables {
  field(record(value), file, "object");
  field(typeof value.walkSpeed === "number", file, "walkSpeed");
  field(typeof value.playerRadius === "number", file, "playerRadius");
  return { walkSpeed: value.walkSpeed, playerRadius: value.playerRadius };
}

export function parseArea(value: unknown, file: string): Area {
  field(record(value), file, "object");
  field(typeof value.id === "string", file, "id");
  field(typeof value.width === "number", file, "width");
  field(typeof value.height === "number", file, "height");
  field(polygon(value.walkable), file, "walkable");
  field(
    Array.isArray(value.blockers) && value.blockers.every(polygon),
    file,
    "blockers",
  );
  field(record(value.spawns), file, "spawns");
  const spawns: Record<string, Spawn> = {};
  for (const [name, raw] of Object.entries(value.spawns)) {
    field(record(raw), file, `spawns.${name}`);
    field(
      typeof raw.x === "number" && typeof raw.y === "number",
      file,
      `spawns.${name}.position`,
    );
    field(direction(raw.facing), file, `spawns.${name}.facing`);
    spawns[name] = { x: raw.x, y: raw.y, facing: raw.facing };
  }
  return {
    id: value.id,
    width: value.width,
    height: value.height,
    walkable: value.walkable,
    blockers: value.blockers,
    spawns,
  };
}

export function parseFixture(value: unknown, file: string): Fixture {
  field(record(value), file, "object");
  field(typeof value.area === "string", file, "area");
  field(typeof value.spawn === "string", file, "spawn");
  field(
    value.seed === undefined || typeof value.seed === "number",
    file,
    "seed",
  );
  return value.seed === undefined
    ? { area: value.area, spawn: value.spawn }
    : { area: value.area, spawn: value.spawn, seed: value.seed };
}

export function loadContent(): {
  world: World;
  fixtures: Record<string, Fixture>;
} {
  const area = parseArea(areaData, "content/areas/harness.json");
  const fixtures = {
    "new-game": parseFixture(fixtureData, "content/fixtures/new-game.json"),
  };
  return {
    world: {
      tunables: parseTunables(tunableData, "content/tunables.json"),
      areas: { [area.id]: area },
    },
    fixtures,
  };
}
