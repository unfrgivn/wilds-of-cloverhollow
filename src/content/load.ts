import areaData from "../../content/areas/harness.json";
import bedroomData from "../../content/areas/bedroom.json";
import plazaData from "../../content/areas/plaza.json";
import fixtureData from "../../content/fixtures/new-game.json";
import harnessFixtureData from "../../content/fixtures/harness.json";
import plazaFixtureData from "../../content/fixtures/plaza.json";
import tunableData from "../../content/tunables.json";
import storyData from "../../content/story/main.ink.json";
import frogData from "../../content/critters/frog.json";
import battleData from "../../content/battle.json";
import stickerData from "../../content/stickers.json";
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
  Critter,
  Grade,
  BattleContent,
  CritterCommandId,
  StickerCatalogue,
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

function storyJson(value: unknown, file: string): Record<string, unknown> {
  field(record(value), file, "story");
  field(typeof value.inkVersion === "number", file, "story.inkVersion");
  field(Array.isArray(value.root), file, "story.root");
  return value;
}

function numberValue(
  value: Record<string, unknown>,
  name: string,
  file: string,
): number {
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
  field(record(value.interact), file, "interact");
  field(record(value.follow), file, "follow");
  const follow = value.follow;
  const followValue = (name: string): number => numberValue(follow, name, file);
  return {
    walkSpeed: value.walkSpeed,
    playerRadius: value.playerRadius,
    walkCycleUnits: value.walkCycleUnits,
    doorFadeTicks: value.doorFadeTicks,
    interact: {
      range: numberValue(value.interact, "range", file),
      revealPerTick: numberValue(value.interact, "revealPerTick", file),
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
      walkCycleUnits: followValue("walkCycleUnits"),
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
    value.critters === undefined ||
      (Array.isArray(value.critters) &&
        value.critters.every(
          (item) =>
            record(item) &&
            typeof item.id === "string" &&
            record(item.point) &&
            typeof item.point.x === "number" &&
            typeof item.point.y === "number",
        )),
    file,
    "critters",
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
  field(
    value.ground === undefined || typeof value.ground === "string",
    file,
    "ground",
  );
  field(
    value.interactables === undefined ||
      (Array.isArray(value.interactables) &&
        value.interactables.every(
          (item) =>
            record(item) &&
            typeof item.id === "string" &&
            typeof item.knot === "string" &&
            record(item.point) &&
            typeof item.point.x === "number" &&
            typeof item.point.y === "number" &&
            (item.prompt === "Look" || item.prompt === "Talk"),
        )),
    file,
    "interactables",
  );
  field(
    value.occluders === undefined ||
      (Array.isArray(value.occluders) &&
        value.occluders.every(
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
    interactables: (value.interactables ?? []).map((item) => ({
      id: item.id,
      knot: item.knot,
      point: { x: item.point.x, y: item.point.y },
      prompt: item.prompt,
    })),
    critters: (value.critters ?? []).map((item) => ({
      id: item.id,
      point: { x: item.point.x, y: item.point.y },
    })),
    spawns,
  };
}

function gradeMap(
  value: unknown,
  file: string,
  name: string,
): Record<Grade, string> {
  field(record(value), file, name);
  const get = (grade: Grade): string => {
    const item = value[grade];
    field(typeof item === "string", file, `${name}.${grade}`);
    return item;
  };
  return { great: get("great"), good: get("good"), miss: get("miss") };
}

export function parseCritter(value: unknown, file: string): Critter {
  field(record(value), file, "object");
  const text = (object: Record<string, unknown>, name: string): string => {
    const item = object[name];
    field(typeof item === "string", file, name);
    return item;
  };
  const number = (object: Record<string, unknown>, name: string): number => {
    const item = object[name];
    field(typeof item === "number" && item >= 0, file, name);
    return item;
  };
  const id = text(value, "id");
  const name = text(value, "name");
  const calmName = text(value, "calmName");
  const atlas = text(value, "atlas");
  const calmKnot = text(value, "calmKnot");
  const calmPrompt = value.calmPrompt;
  field(calmPrompt === "Look" || calmPrompt === "Talk", file, "calmPrompt");
  const sticker = value.sticker;
  field(record(sticker), file, "sticker");
  const stickerValue = {
    id: text(sticker, "id"),
    name: text(sticker, "name"),
    frame: text(sticker, "frame"),
  };
  const commands = value.commands;
  field(record(commands), file, "commands");
  const command = (
    commandName: string,
    keys: string[],
  ): Record<string, number> => {
    const raw = commands[commandName];
    field(record(raw), file, `commands.${commandName}`);
    return Object.fromEntries(keys.map((key) => [key, number(raw, key)]));
  };
  const timing = value.timing;
  field(record(timing), file, "timing");
  const timingValue = {
    aimTicks: number(timing, "aimTicks"),
    targetTick: number(timing, "targetTick"),
    greatWindow: number(timing, "greatWindow"),
    goodWindow: number(timing, "goodWindow"),
  };
  const burst = value.burst;
  field(record(burst), file, "burst");
  const burstValue = {
    ticks: number(burst, "ticks"),
    targetTick: number(burst, "targetTick"),
    greatWindow: number(burst, "greatWindow"),
    goodWindow: number(burst, "goodWindow"),
    bigChance: number(burst, "bigChance"),
  };
  field(burstValue.bigChance <= 1, file, "burst.bigChance");
  const lines = value.lines;
  field(record(lines), file, "lines");
  const line = (key: string): string => text(lines, key);
  const sootheRaw = command("soothe", ["calm", "great", "good"]);
  const playRaw = command("play", ["calm", "great", "good", "rest"]);
  const snackRaw = command("snack", ["calm", "energy"]);
  return {
    id,
    name,
    calmName,
    atlas,
    figureHeight: number(value, "figureHeight"),
    overworldHeight: number(value, "overworldHeight"),
    battleHeight: number(value, "battleHeight"),
    touchRadius: number(value, "touchRadius"),
    calmMax: number(value, "calmMax"),
    energyMax: number(value, "energyMax"),
    snacks: number(value, "snacks"),
    sticker: stickerValue,
    calmKnot,
    calmPrompt,
    commands: {
      soothe: {
        calm: number(sootheRaw, "calm"),
        great: number(sootheRaw, "great"),
        good: number(sootheRaw, "good"),
      },
      play: {
        calm: number(playRaw, "calm"),
        great: number(playRaw, "great"),
        good: number(playRaw, "good"),
        rest: number(playRaw, "rest"),
      },
      snack: {
        calm: number(snackRaw, "calm"),
        energy: number(snackRaw, "energy"),
      },
    },
    timing: timingValue,
    burst: burstValue,
    lines: {
      intro: line("intro"),
      command: line("command"),
      soothe: gradeMap(lines.soothe, file, "lines.soothe"),
      play: gradeMap(lines.play, file, "lines.play"),
      snack: line("snack"),
      playResting: line("playResting"),
      burst: line("burst"),
      burstResult: gradeMap(lines.burstResult, file, "lines.burstResult"),
      soothed: line("soothed"),
      reward: line("reward"),
      rest: line("rest"),
      run: line("run"),
    },
  };
}

export function parseBattleContent(
  value: unknown,
  file: string,
): BattleContent {
  field(record(value) && record(value.commands), file, "commands");
  const commands = value.commands;
  const command = (
    id: CritterCommandId,
  ): { label: string; snackDetail: string | null } => {
    const raw = commands[id];
    field(
      record(raw) &&
        typeof raw.label === "string" &&
        (raw.snackDetail === null || typeof raw.snackDetail === "string"),
      file,
      `commands.${id}`,
    );
    return { label: raw.label, snackDetail: raw.snackDetail };
  };
  return {
    commands: {
      soothe: command("soothe"),
      play: command("play"),
      snack: command("snack"),
      run: command("run"),
    },
  };
}

export function parseStickers(value: unknown, file: string): StickerCatalogue {
  field(
    record(value) &&
      typeof value.slots === "number" &&
      Array.isArray(value.catalogue),
    file,
    "stickers",
  );
  field(value.slots >= 0, file, "slots");
  const catalogue = value.catalogue.map((item, index) => {
    field(
      record(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.critter === "string" &&
        typeof item.frame === "string",
      file,
      `catalogue.${index}`,
    );
    return {
      id: item.id,
      name: item.name,
      critter: item.critter,
      frame: item.frame,
    };
  });
  return { slots: value.slots, catalogue };
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
      typeof item.file === "string" &&
        typeof item.x === "number" &&
        typeof item.y === "number" &&
        typeof item.width === "number" &&
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
      typeof item.id === "string" &&
        typeof item.file === "string" &&
        typeof item.x === "number" &&
        typeof item.y === "number",
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
  const story = storyJson(storyData, "content/story/main.ink.json");
  const frog = parseCritter(frogData, "content/critters/frog.json");
  const battle = parseBattleContent(battleData, "content/battle.json");
  const stickers = parseStickers(stickerData, "content/stickers.json");
  const fixtures = {
    "new-game": parseFixture(fixtureData, "content/fixtures/new-game.json"),
    harness: parseFixture(harnessFixtureData, "content/fixtures/harness.json"),
    plaza: parseFixture(plazaFixtureData, "content/fixtures/plaza.json"),
  };
  const areas = {
    [harness.id]: harness,
    [bedroom.id]: bedroom,
    [plaza.id]: plaza,
  };
  return {
    world: {
      tunables: parseTunables(tunableData, "content/tunables.json"),
      areas,
      story,
      critters: { [frog.id]: frog },
      battle,
      stickers,
    },
    fixtures,
  };
}
