import type {
  Area,
  CharacterContent,
  Fixture,
  GroundManifest,
  Spawn,
  SurfaceMap,
  Tunables,
  World,
} from "../core";
import { parseAmbient, setAreaAmbient } from "./ambient";
import { parseRecurring } from "./battle-parsers";
import { parseNpcStroll } from "./npc-parsers";
import { parseAreaPuzzles } from "./puzzle-parsers";
import {
  array,
  direction,
  field,
  isFiniteNumber,
  isInteger,
  isPositive,
  number,
  point,
  polygon,
  rawCrossing,
  record,
  string,
  type RawCrossing,
} from "./parsers";
import { parsePropPlacements, placeProps, type PropCatalogue } from "./props";
import { parseSurfaceMap } from "./surfaces";

export function parseTunables(value: unknown, file: string): Tunables {
  field(record(value), file, "object");
  field(record(value.interact), file, "interact");
  field(record(value.follow), file, "follow");
  field(record(value.roam), file, "roam");
  const follow = value.follow;
  const followValue = (name: string): number => number(follow, name, file);
  return {
    walkSpeed: number(value, "walkSpeed", file),
    playerRadius: number(value, "playerRadius", file),
    walkCycleUnits: number(value, "walkCycleUnits", file),
    doorFadeTicks: number(value, "doorFadeTicks", file),
    interact: {
      range: number(value.interact, "range", file),
      revealPerTick: number(value.interact, "revealPerTick", file),
    },
    follow: {
      distance: followValue("distance"),
      stop: followValue("stop"),
      trailSpacing: followValue("trailSpacing"),
      trailMax: followValue("trailMax"),
      catchUp: followValue("catchUp"),
      radius: followValue("radius"),
      slot: followValue("slot"),
      heel: followValue("heel"),
      sitDelayTicks: followValue("sitDelayTicks"),
      settleDelayTicks: followValue("settleDelayTicks"),
    },
    roam: {
      wanderSpeed: number(value.roam, "wanderSpeed", file),
      chaseSpeed: number(value.roam, "chaseSpeed", file),
      sight: number(value.roam, "sight", file),
      cooldownTicks: number(value.roam, "cooldownTicks", file),
      pauseTicks: number(value.roam, "pauseTicks", file),
      noticeTicks: number(value.roam, "noticeTicks", file),
      alertTicks: number(value.roam, "alertTicks", file),
    },
  };
}

export function parseArea(value: unknown, file: string, catalogue?: PropCatalogue): Area {
  field(record(value), file, "object");
  field(typeof value.id === "string", file, "id");
  field(typeof value.width === "number", file, "width");
  field(typeof value.height === "number", file, "height");
  field(typeof value.name === "string", file, "name");
  field(
    value.land === undefined ||
      (typeof value.land === "string" &&
        ["cloverhollow", "bay", "pass", "trail", "forest", "enchanted", "hills"].some(
          (id) => id === value.land,
        )),
    file,
    "land",
  );
  field(polygon(value.walkable), file, "walkable");
  field(
    Array.isArray(value.blockers) && value.blockers.every(polygon),
    file,
    "blockers",
  );
  field(
    value.crossings === undefined ||
      (Array.isArray(value.crossings) && value.crossings.every(rawCrossing)),
    file,
    "crossings",
  );
  const crossings: RawCrossing[] =
    value.crossings === undefined ? [] : value.crossings.filter(rawCrossing);
  const crossingIds = new Set<string>();
  for (const crossing of crossings) {
    field(!crossingIds.has(crossing.id), file, `crossings.${crossing.id} (duplicate id)`);
    crossingIds.add(crossing.id);
  }
  field(
    value.critters === undefined ||
      (Array.isArray(value.critters) &&
        value.critters.every(
          (item) =>
            record(item) &&
            typeof item.id === "string" &&
            point(item.point) &&
            (item.visibleWhile === undefined || typeof item.visibleWhile === "string"),
        )),
    file,
    "critters",
  );
  const recurring = parseRecurring(value.recurring, file);
  field(
    value.npcs === undefined ||
      (Array.isArray(value.npcs) &&
        value.npcs.every(
          (item) =>
            record(item) &&
            typeof item.id === "string" &&
            point(item.point) &&
            direction(item.facing) &&
            polygon(item.footprint) &&
            typeof item.knot === "string" &&
            (item.prompt === "Look" || item.prompt === "Talk" || item.prompt === "Pet") &&
            (item.visibleWhile === undefined || typeof item.visibleWhile === "string") &&
            (item.hiddenWhile === undefined || typeof item.hiddenWhile === "string") &&
            (item.visibleWhenCalmed === undefined ||
              typeof item.visibleWhenCalmed === "string") &&
            (item.visibleAfterCalm === undefined || typeof item.visibleAfterCalm === "string") &&
            (item.hiddenAfterCalm === undefined || typeof item.hiddenAfterCalm === "string"),
        )),
    file,
    "npcs",
  );
  field(
    value.triggers === undefined ||
      (Array.isArray(value.triggers) &&
        value.triggers.every(
          (item) =>
            record(item) &&
            typeof item.id === "string" &&
            polygon(item.polygon) &&
            record(item.target) &&
            typeof item.target.area === "string" &&
            typeof item.target.spawn === "string",
        )),
    file,
    "triggers",
  );
  field(value.ground === undefined || typeof value.ground === "string", file, "ground");
  field(
    value.glows === undefined ||
      (Array.isArray(value.glows) &&
        value.glows.every(
          (item) =>
            record(item) &&
            typeof item.id === "string" &&
            typeof item.frame === "string" &&
            point(item.point) &&
            (item.knot === undefined || typeof item.knot === "string") &&
            (item.prompt === undefined || item.prompt === "Look") &&
            (item.flip === undefined || typeof item.flip === "boolean"),
        )),
    file,
    "glows",
  );
  field(
    value.interactables === undefined ||
      (Array.isArray(value.interactables) &&
        value.interactables.every(
          (item) =>
            record(item) &&
            typeof item.id === "string" &&
            typeof item.knot === "string" &&
            point(item.point) &&
            (item.prompt === "Look" || item.prompt === "Play" || item.prompt === "Talk"),
        )),
    file,
    "interactables",
  );
  field(record(value.spawns), file, "spawns");
  const spawns: Record<string, Spawn> = {};
  for (const [name, raw] of Object.entries(value.spawns)) {
    field(record(raw), file, `spawns.${name}`);
    field(typeof raw.x === "number" && typeof raw.y === "number", file, `spawns.${name}.position`);
    field(direction(raw.facing), file, `spawns.${name}.facing`);
    spawns[name] = { x: raw.x, y: raw.y, facing: raw.facing };
  }
  const puzzles = parseAreaPuzzles(value.puzzles, file, crossingIds);
  const area: Area = {
    id: value.id,
    name: value.name,
    ...(value.land === undefined ? {} : { land: value.land }),
    width: value.width,
    height: value.height,
    walkable: value.walkable,
    blockers: value.blockers,
    ...(crossings.length === 0
      ? {}
      : {
          crossings: crossings.map((crossing) => ({
            id: crossing.id,
            polygon: crossing.polygon,
            opens: crossing.opens,
          })),
        }),
    ground: value.ground,
    glows: (value.glows ?? []).map((item) => ({
      id: item.id,
      frame: item.frame,
      point: { x: item.point.x, y: item.point.y },
      ...(item.knot === undefined ? {} : { knot: item.knot }),
      ...(item.prompt === undefined ? {} : { prompt: item.prompt }),
      ...(item.flip === true ? { flip: true } : {}),
    })),
    triggers: (value.triggers ?? []).map((item) => ({
      id: item.id,
      polygon: item.polygon,
      target: { area: item.target.area, spawn: item.target.spawn },
      ...(item.requires === undefined
        ? {}
        : {
            requires: {
              variable: item.requires.variable,
              knot: item.requires.knot,
            },
          }),
    })),
    interactables: (value.interactables ?? []).map((item) => ({
      id: item.id,
      knot: item.knot,
      point: { x: item.point.x, y: item.point.y },
      ...(item.roam === undefined ? {} : { roam: { radius: item.roam.radius } }),
      prompt: item.prompt,
    })),
    critters: (value.critters ?? []).map((item) => ({
      id: item.id,
      point: { x: item.point.x, y: item.point.y },
      ...(item.visibleWhile === undefined ? {} : { visibleWhile: item.visibleWhile }),
    })),
    ...(recurring === undefined ? {} : { recurring }),
    npcs: (value.npcs ?? []).map((item) => {
      const npcPoint = { x: item.point.x, y: item.point.y };
      const stroll = parseNpcStroll(item.stroll, npcPoint, file, `npcs.${item.id}.stroll`);
      return {
        id: item.id,
        point: npcPoint,
        facing: item.facing,
        footprint: item.footprint,
        knot: item.knot,
        prompt: item.prompt,
        ...(stroll === undefined ? {} : { stroll }),
        ...(item.visibleWhile === undefined ? {} : { visibleWhile: item.visibleWhile }),
        ...(item.hiddenWhile === undefined ? {} : { hiddenWhile: item.hiddenWhile }),
        ...(item.visibleWhenCalmed === undefined
          ? {}
          : { visibleWhenCalmed: item.visibleWhenCalmed }),
        ...(item.visibleAfterCalm === undefined
          ? {}
          : { visibleAfterCalm: item.visibleAfterCalm }),
        ...(item.hiddenAfterCalm === undefined
          ? {}
          : { hiddenAfterCalm: item.hiddenAfterCalm }),
      };
    }),
    props: placeProps(parsePropPlacements(value.props, file), catalogue, file),
    atlases: catalogue?.atlases ?? [],
    spawns,
    ...(puzzles === undefined ? {} : { puzzles }),
  };
  setAreaAmbient(area, parseAmbient(value.ambient, file, value.width, value.height));
  return area;
}

type RawLand = {
  id: string;
  name: string;
  busStop?: boolean;
  revealVariable?: string;
};

function isRawLand(value: unknown): value is RawLand {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (!("busStop" in value) || value.busStop === undefined || typeof value.busStop === "boolean") &&
    (!("revealVariable" in value) ||
      value.revealVariable === undefined ||
      typeof value.revealVariable === "string")
  );
}

export function parseLands(value: unknown, file: string): World["lands"] {
  field(Array.isArray(value) && value.every(isRawLand), file, "lands");
  return value.map((land) => ({
    id: land.id,
    name: land.name,
    busStop: land.busStop === true,
    ...(typeof land.revealVariable === "string" ? { revealVariable: land.revealVariable } : {}),
  }));
}

export function parseFixture(value: unknown, file: string): Fixture {
  field(record(value), file, "object");
  field(typeof value.area === "string", file, "area");
  field(typeof value.spawn === "string", file, "spawn");
  field(value.seed === undefined || typeof value.seed === "number", file, "seed");
  const party = value.party;
  field(
    party === undefined || (Array.isArray(party) && party.every((id) => typeof id === "string")),
    file,
    "party",
  );
  const variables = value.variables;
  field(
    variables === undefined ||
      (record(variables) &&
        Object.values(variables).every((enabled) => typeof enabled === "boolean")),
    file,
    "variables",
  );
  const parsedVariables: Record<string, boolean> = {};
  if (record(variables)) {
    for (const [name, enabled] of Object.entries(variables)) {
      if (typeof enabled === "boolean") parsedVariables[name] = enabled;
    }
  }
  const rawCalms = value.calms;
  field(
    rawCalms === undefined ||
      (record(rawCalms) &&
        Object.values(rawCalms).every(
          (count) => typeof count === "number" && Number.isInteger(count) && count >= 0,
        )),
    file,
    "calms",
  );
  const parsedCalms: Record<string, number> = {};
  if (record(rawCalms)) {
    for (const [species, count] of Object.entries(rawCalms)) {
      if (typeof count === "number") parsedCalms[species] = count;
    }
  }
  return {
    area: value.area,
    spawn: value.spawn,
    ...(value.seed === undefined ? {} : { seed: value.seed }),
    ...(party === undefined ? {} : { party }),
    ...(variables === undefined ? {} : { variables: parsedVariables }),
    ...(rawCalms === undefined ? {} : { calms: parsedCalms }),
  };
}

export function parseGroundManifest(value: unknown, file: string): GroundManifest {
  field(record(value), file, "object");
  const paper = string(value, "paper", file);
  field(array(value.tiles), file, "tiles");
  const tiles = value.tiles.map((item, index) => {
    const label = `tiles.${index}`;
    field(record(item), file, label);
    return {
      file: string(item, "file", file, label),
      x: number(item, "x", file, label),
      y: number(item, "y", file, label),
      width: number(item, "width", file, label),
      height: number(item, "height", file, label),
    };
  });
  return { paper, tiles };
}

// The painted world map's manifest (`assets/ui/map/world-map.json`): each
// land's centre on the painting, in its pixels, for the journal's MAP page.
export function parseMapCentres(
  value: unknown,
  file: string,
): Record<string, { x: number; y: number }> {
  field(record(value), file, "object");
  field(array(value.lands), file, "lands");
  const centres: Record<string, { x: number; y: number }> = {};
  value.lands.forEach((item, index) => {
    const label = `lands.${index}`;
    field(
      record(item) &&
        typeof item.id === "string" &&
        isFiniteNumber(item.x) &&
        isFiniteNumber(item.y),
      file,
      label,
    );
    centres[item.id] = { x: item.x, y: item.y };
  });
  return centres;
}

export function parseCharacters(value: unknown, file: string): Record<string, CharacterContent> {
  field(record(value), file, "object");
  const characters: Record<string, CharacterContent> = {};
  for (const [id, raw] of Object.entries(value)) {
    field(record(raw) && typeof raw.atlas === "string", file, `${id}.atlas`);
    const ticks = raw.idleTicks;
    field(
      array(ticks) &&
        ticks.length > 0 &&
        ticks.every((tick): tick is number => isInteger(tick) && tick > 0),
      file,
      `${id}.idleTicks`,
    );
    const scale = raw.scale;
    field(scale === undefined || isPositive(scale), file, `${id}.scale`);
    characters[id] = {
      atlas: raw.atlas,
      idleTicks: ticks,
      ...(scale === undefined ? {} : { scale }),
    };
  }
  return characters;
}

export function completeSurfaceMaps(
  areas: Record<string, Area>,
  data: Record<string, unknown>,
): Record<string, SurfaceMap> {
  const result: Record<string, SurfaceMap> = {};
  for (const area of Object.values(areas)) {
    const path = `content/surfaces/${area.id}.json`;
    const value = data[area.id];
    if (value === undefined)
      throw new Error(`${path} is missing; it must be registered in src/content/load.ts`);
    result[area.id] = parseSurfaceMap(value, path, area.width, area.height);
  }
  return result;
}
