import areaData from "../../content/areas/harness.json";
import bedroomData from "../../content/areas/bedroom.json";
import plazaData from "../../content/areas/plaza.json";
import fixtureData from "../../content/fixtures/new-game.json";
import harnessFixtureData from "../../content/fixtures/harness.json";
import plazaFixtureData from "../../content/fixtures/plaza.json";
import tunableData from "../../content/tunables.json";
import type {
  Area,
  Direction,
  Fixture,
  Polygon,
  Spawn,
  Tunables,
  World,
  GroundManifest,
  OccluderManifest,
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

function numberValue(value: Record<string, unknown>, name: string, file: string): number {
  const result = value[name];
  field(typeof result === "number", file, name);
  return result;
}

export function parseTunables(value: unknown, file: string): Tunables {
  field(record(value), file, "object");
  field(typeof value.walkSpeed === "number", file, "walkSpeed");
  field(typeof value.playerRadius === "number", file, "playerRadius");
  field(typeof value.walkCycleUnits === "number", file, "walkCycleUnits");
  field(typeof value.doorFadeTicks === "number", file, "doorFadeTicks");
  field(record(value.follow), file, "follow");
  const followNames = ["distance", "stop", "trailSpacing", "trailMax",
    "catchUp", "radius", "slot", "heel", "sitDelayTicks", "settleDelayTicks",
    "walkCycleUnits"] as const;
  const follow = value.follow;
  const followValue = (name: string): number => numberValue(follow, name, file);
  return {
    walkSpeed: value.walkSpeed,
    playerRadius: value.playerRadius,
    walkCycleUnits: value.walkCycleUnits,
    doorFadeTicks: value.doorFadeTicks,
    follow: {
      distance: followValue(followNames[0]),
      stop: followValue(followNames[1]),
      trailSpacing: followValue(followNames[2]),
      trailMax: followValue(followNames[3]),
      catchUp: followValue(followNames[4]),
      radius: followValue(followNames[5]),
      slot: followValue(followNames[6]),
      heel: followValue(followNames[7]),
      sitDelayTicks: followValue(followNames[8]),
      settleDelayTicks: followValue(followNames[9]),
      walkCycleUnits: followValue(followNames[10]),
    },
  };
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
  field(
    value.triggers === undefined ||
      (Array.isArray(value.triggers) && value.triggers.every((item) =>
        record(item) && typeof item.id === "string" && polygon(item.polygon) &&
        record(item.target) && typeof item.target.area === "string" &&
        typeof item.target.spawn === "string",
      )),
    file,
    "triggers",
  );
  field(
    value.ground === undefined || typeof value.ground === "string",
    file,
    "ground",
  );
  field(
    value.occluders === undefined ||
      (Array.isArray(value.occluders) && value.occluders.every(
        (item) =>
          record(item) &&
          typeof item.id === "string" &&
          polygon(item.polygon) &&
          typeof item.baseline === "number",
      )),
    file,
    "occluders",
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
    ground: value.ground,
    occluders: (value.occluders ?? []).map((item) => ({
      id: item.id,
      polygon: item.polygon,
      baseline: item.baseline,
    })),
    triggers: (value.triggers ?? []).map((item) => ({
      id: item.id,
      polygon: item.polygon,
      target: { area: item.target.area, spawn: item.target.spawn },
    })),
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

export function parseGroundManifest(
  value: unknown,
  file: string,
): GroundManifest {
  field(record(value), file, "object");
  field(typeof value.paper === "string", file, "paper");
  field(Array.isArray(value.tiles), file, "tiles");
  const tiles = value.tiles.map((item, index) => {
    field(record(item), file, `tiles.${index}`);
    field(
      typeof item.file === "string" && typeof item.x === "number" &&
        typeof item.y === "number" && typeof item.width === "number" &&
        typeof item.height === "number",
      file,
      `tiles.${index}`,
    );
    return {
      file: item.file,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    };
  });
  return { paper: value.paper, tiles };
}

export function parseOccluderManifest(
  value: unknown,
  file: string,
): OccluderManifest {
  field(record(value), file, "object");
  field(Array.isArray(value.cutouts), file, "cutouts");
  const cutouts = value.cutouts.map((item, index) => {
    field(record(item), file, `cutouts.${index}`);
    field(
      typeof item.id === "string" && typeof item.file === "string" &&
        typeof item.x === "number" && typeof item.y === "number",
      file,
      `cutouts.${index}`,
    );
    return { id: item.id, file: item.file, x: item.x, y: item.y };
  });
  return { cutouts };
}

export function loadContent(): {
  world: World;
  fixtures: Record<string, Fixture>;
} {
  const harness = parseArea(areaData, "content/areas/harness.json");
  const bedroom = parseArea(bedroomData, "content/areas/bedroom.json");
  const plaza = parseArea(plazaData, "content/areas/plaza.json");
  const fixtures = {
    "new-game": parseFixture(fixtureData, "content/fixtures/new-game.json"),
    harness: parseFixture(harnessFixtureData, "content/fixtures/harness.json"),
    plaza: parseFixture(plazaFixtureData, "content/fixtures/plaza.json"),
  };
  const areas = { [harness.id]: harness, [bedroom.id]: bedroom, [plaza.id]: plaza };
  return {
    world: {
      tunables: parseTunables(tunableData, "content/tunables.json"),
      areas,
    },
    fixtures,
  };
}
