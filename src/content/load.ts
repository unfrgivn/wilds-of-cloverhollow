import areaData from "../../content/areas/harness.json";
import bedroomData from "../../content/areas/bedroom.json";
import plazaData from "../../content/areas/plaza.json";
import kitchenData from "../../content/areas/kitchen.json";
import parkData from "../../content/areas/park.json";
import schoolData from "../../content/areas/school.json";
import classroomData from "../../content/areas/classroom.json";
import gymData from "../../content/areas/gym.json";
import bayData from "../../content/areas/bay.json";
import passData from "../../content/areas/pass.json";
import trailData from "../../content/areas/trail.json";
import woodsData from "../../content/areas/woods.json";
import arcadeData from "../../content/areas/arcade.json";
import plazaPropsData from "../../content/props/plaza.json";
import fixtureData from "../../content/fixtures/new-game.json";
import harnessFixtureData from "../../content/fixtures/harness.json";
import plazaFixtureData from "../../content/fixtures/plaza.json";
import plazaPartyFixtureData from "../../content/fixtures/plaza-party.json";
import parkFixtureData from "../../content/fixtures/park.json";
import schoolFixtureData from "../../content/fixtures/school.json";
import bayFixtureData from "../../content/fixtures/bay.json";
import passFixtureData from "../../content/fixtures/pass.json";
import trailFixtureData from "../../content/fixtures/trail.json";
import passPartyFixtureData from "../../content/fixtures/pass-party.json";
import woodsFixtureData from "../../content/fixtures/woods.json";
import tunableData from "../../content/tunables.json";
import storyData from "../../content/story/main.ink.json";
import fountainFrogData from "../../content/critters/fountain-frog.json";
import frogData from "../../content/critters/frog.json";
import pupData from "../../content/critters/pup.json";
import catData from "../../content/critters/cat.json";
import raccoonData from "../../content/critters/raccoon.json";
import schoolRaccoonData from "../../content/critters/school-raccoon.json";
import bluebirdData from "../../content/critters/bluebird.json";
import hamsterData from "../../content/critters/hamster.json";
import bunnyData from "../../content/critters/bunny.json";
import squirrelData from "../../content/critters/squirrel.json";
import gullData from "../../content/critters/gull.json";
import owlData from "../../content/critters/owl.json";
import arcadeKeeperData from "../../content/critters/arcade-keeper.json";
import gymPupData from "../../content/critters/gym-pup.json";
import charactersData from "../../content/characters.json";
import battleData from "../../content/battle.json";
import stickerData from "../../content/stickers.json";
import maddieData from "../../content/party/maddie.json";
import sueData from "../../content/party/sue.json";
import jordanData from "../../content/party/jordan.json";
import landsData from "../../content/lands.json";
import { createInkState, createStoryReader } from "../core/ink";
import {
  parsePropCatalogue, parsePropPlacements, placeProps, propRuleErrors, type PropCatalogue,
} from "./props";
import type {
  Area,
  CharacterContent,
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
  SharedCommandId,
  StickerCatalogue,
  Point,
  PartyContent,
  FriendCommand,
  Recurring,
  Den,
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

export function parseStoryJson(value: unknown, file: string): Record<string, unknown> {
  field(record(value), file, "story");
  field(typeof value.inkVersion === "number", file, "story.inkVersion");
  field(Array.isArray(value.root), file, "story.root");
  return value;
}

// Every tag in a compiled story. Ink's JSON starts a tag with a "#" command
// and its text ("^..."); the closing "/#" can sit in an enclosing container
// (an inline conditional's tag closes after its branch), so a tag is the text
// right after its "#".
export function storyTags(story: Record<string, unknown>): string[] {
  const tags: string[] = [];
  const visit = (item: unknown): void => {
    if (!Array.isArray(item)) {
      if (record(item)) Object.values(item).forEach(visit);
      return;
    }
    item.forEach((child, index) => {
      if (child !== "#") {
        visit(child);
        return;
      }
      let text = "";
      for (const next of item.slice(index + 1)) {
        if (typeof next !== "string" || !next.startsWith("^")) break;
        text += next.slice(1);
      }
      tags.push(text.trim());
    });
  };
  visit(story.root);
  return tags;
}

// The tags the core acts on (spec 7): `travel: <area>.<spawn>` must name a
// spawn that exists, and `buy:` sells only `snack <price>`.
export function storyTagErrors(tags: string[], areas: Record<string, Area>): string[] {
  return tags.flatMap((tag) => {
    if (tag.startsWith("travel:")) {
      const [areaId, spawnId, ...extra] = tag.slice("travel:".length).trim().split(".");
      const area = areaId === undefined ? undefined : areas[areaId];
      const known = area !== undefined && spawnId !== undefined && extra.length === 0 &&
        area.spawns[spawnId] !== undefined;
      return known ? [] : [`unknown travel target in "${tag}"`];
    }
    if (tag.startsWith("buy:"))
      return /^buy:\s*snack\s+\d+$/.test(tag) ? [] : [`invalid buy tag "${tag}"`];
    return [];
  });
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
  field(record(value.roam), file, "roam");
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
    },
    roam: {
      wanderSpeed: numberValue(value.roam, "wanderSpeed", file),
      chaseSpeed: numberValue(value.roam, "chaseSpeed", file),
      sight: numberValue(value.roam, "sight", file),
      cooldownTicks: numberValue(value.roam, "cooldownTicks", file),
      pauseTicks: numberValue(value.roam, "pauseTicks", file),
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
        ["cloverhollow", "bay", "pass", "trail", "forest", "enchanted"].some(
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
    value.critters === undefined ||
      (Array.isArray(value.critters) &&
        value.critters.every(
          (item) =>
            record(item) &&
            typeof item.id === "string" &&
            record(item.point) &&
            typeof item.point.x === "number" &&
            typeof item.point.y === "number" &&
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
            record(item.point) &&
            typeof item.point.x === "number" &&
            typeof item.point.y === "number" &&
            direction(item.facing) &&
            polygon(item.footprint) &&
            typeof item.knot === "string" &&
            (item.prompt === "Look" || item.prompt === "Talk") &&
            (item.visibleWhile === undefined ||
              typeof item.visibleWhile === "string"),
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
  field(
    value.ground === undefined || typeof value.ground === "string",
    file,
    "ground",
  );
  field(
    (value.glows === undefined || Array.isArray(value.glows)) &&
      (value.glows === undefined || value.glows.every(
        (item) => record(item) && typeof item.id === "string" &&
          typeof item.frame === "string" && record(item.point) &&
          typeof item.point.x === "number" && typeof item.point.y === "number" &&
          (item.knot === undefined || typeof item.knot === "string") &&
          (item.prompt === undefined || item.prompt === "Look") &&
          (item.flip === undefined || typeof item.flip === "boolean"),
      )),
    file, "glows",
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
            typeof item.baseline === "number" &&
            (item.canopy === undefined || typeof item.canopy === "boolean"),
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
    name: value.name,
    ...(value.land === undefined ? {} : { land: value.land }),
    width: value.width,
    height: value.height,
    walkable: value.walkable,
    blockers: value.blockers,
    ground: value.ground,
    glows: (value.glows ?? []).map((item) => ({
      id: item.id, frame: item.frame, point: { x: item.point.x, y: item.point.y },
      ...(item.knot === undefined ? {} : { knot: item.knot }),
      ...(item.prompt === undefined ? {} : { prompt: item.prompt }),
      ...(item.flip === true ? { flip: true } : {}),
    })),
    occluders: (value.occluders ?? []).map((item) => ({
      id: item.id,
      polygon: item.polygon,
      baseline: item.baseline,
      ...(item.canopy === true ? { canopy: true } : {}),
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
    npcs: (value.npcs ?? []).map((item) => ({
      id: item.id,
      point: { x: item.point.x, y: item.point.y },
      facing: item.facing,
      footprint: item.footprint,
      knot: item.knot,
      prompt: item.prompt,
      ...(item.visibleWhile === undefined
        ? {}
        : { visibleWhile: item.visibleWhile }),
    })),
    props: placeProps(parsePropPlacements(value.props, file), catalogue, file),
    atlases: catalogue?.atlases ?? [],
    spawns,
  };
}

// An area's recurring critters (spec 6): `after` (a calmed() fact) and the
// dens, each `{ point, radius, kinds, chance? }` with `chance` in (0, 1].
function parseRecurring(value: unknown, file: string): Recurring | undefined {
  if (value === undefined) return undefined;
  field(record(value), file, "recurring");
  const after = value.after;
  field(after === undefined || typeof after === "string", file, "recurring.after");
  const dens = value.dens;
  field(Array.isArray(dens) && dens.length > 0, file, "recurring.dens");
  return {
    ...(after === undefined ? {} : { after }),
    dens: dens.map((den: unknown, index): Den => {
      const name = `recurring.dens.${index}`;
      field(record(den), file, name);
      const point = den.point;
      field(record(point) && typeof point.x === "number" && typeof point.y === "number",
        file, `${name}.point`);
      const radius = den.radius;
      field(typeof radius === "number" && radius > 0, file, `${name}.radius`);
      const kinds = den.kinds;
      field(Array.isArray(kinds) && kinds.length > 0, file, `${name}.kinds`);
      const names = kinds.filter((kind): kind is string => typeof kind === "string");
      field(names.length === kinds.length, file, `${name}.kinds`);
      const chance = den.chance ?? 1;
      field(typeof chance === "number" && chance > 0 && chance <= 1, file, `${name}.chance`);
      return { point: { x: point.x, y: point.y }, radius, kinds: names, chance };
    }),
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
  const species = text(value, "species");
  const name = text(value, "name");
  const calmName = text(value, "calmName");
  const atlas = text(value, "atlas");
  const point = (key: string): Point => {
    const item = value[key];
    field(
      record(item) && typeof item.x === "number" && typeof item.y === "number",
      file,
      key,
    );
    return { x: item.x, y: item.y };
  };
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
  const snackRaw = command("snack", ["calm", "energy"]);
  // One entry per party command id (spec 8); the loader checks the roster's
  // ids are all here.
  const friendsRaw = commands.friends;
  field(record(friendsRaw), file, "commands.friends");
  const friends: Record<string, FriendCommand> = {};
  for (const [friendId, raw] of Object.entries(friendsRaw)) {
    field(record(raw), file, `commands.friends.${friendId}`);
    friends[friendId] = {
      calm: number(raw, "calm"),
      great: number(raw, "great"),
      good: number(raw, "good"),
      rest: number(raw, "rest"),
    };
  }
  const friendLinesRaw = lines.friends;
  field(record(friendLinesRaw), file, "lines.friends");
  const friendLines: Record<string, Record<Grade, string>> = {};
  for (const [friendId, raw] of Object.entries(friendLinesRaw))
    friendLines[friendId] = gradeMap(raw, file, `lines.friends.${friendId}`);
  return {
    id,
    species,
    name,
    calmName,
    atlas,
    auraCentre: point("auraCentre"),
    bodyCentre: point("bodyCentre"),
    figureHeight: number(value, "figureHeight"),
    overworldHeight: number(value, "overworldHeight"),
    battleHeight: number(value, "battleHeight"),
    touchRadius: number(value, "touchRadius"),
    calmMax: number(value, "calmMax"),
    energyMax: number(value, "energyMax"),
    coins: number(value, "coins"),
    sticker: stickerValue,
    calmKnot,
    calmPrompt,
    commands: {
      soothe: {
        calm: number(sootheRaw, "calm"),
        great: number(sootheRaw, "great"),
        good: number(sootheRaw, "good"),
      },
      snack: {
        calm: number(snackRaw, "calm"),
        energy: number(snackRaw, "energy"),
      },
      friends,
    },
    timing: timingValue,
    burst: burstValue,
    lines: {
      intro: line("intro"),
      command: line("command"),
      soothe: gradeMap(lines.soothe, file, "lines.soothe"),
      friends: friendLines,
      snack: line("snack"),
      burst: line("burst"),
      burstResult: gradeMap(lines.burstResult, file, "lines.burstResult"),
      soothed: line("soothed"),
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
    id: SharedCommandId,
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
  const rewards = value.rewards;
  field(
    record(rewards) && typeof rewards.sticker === "string" &&
      typeof rewards.coins === "string" && rewards.coins.includes("{coins}"),
    file,
    "rewards",
  );
  return {
    commands: {
      soothe: command("soothe"),
      snack: command("snack"),
      run: command("run"),
    },
    rewards: { sticker: rewards.sticker, coins: rewards.coins },
  };
}

export function parsePartyMember(value: unknown, file: string): PartyContent {
  field(record(value), file, "object");
  const text = (object: Record<string, unknown>, name: string): string => {
    const item = object[name];
    field(typeof item === "string" && item !== "", file, name);
    return item;
  };
  const size = (object: Record<string, unknown>, name: string): number => {
    const item = object[name];
    field(typeof item === "number" && item > 0, file, name);
    return item;
  };
  const box = value.box;
  field(record(box), file, "box");
  const command = value.command;
  field(record(command), file, "command");
  field(typeof value.sits === "boolean", file, "sits");
  field(typeof value.start === "boolean", file, "start");
  field(value.joins === null || typeof value.joins === "string", file, "joins");
  field(
    (value.start && value.joins === null) || (!value.start && typeof value.joins === "string"),
    file,
    "start/joins",
  );
  return {
    id: text(value, "id"),
    name: text(value, "name"),
    atlas: text(value, "atlas"),
    box: { width: size(box, "width"), height: size(box, "height") },
    walkCycleUnits: size(value, "walkCycleUnits"),
    sits: value.sits,
    start: value.start,
    joins: value.joins,
    command: {
      id: text(command, "id"),
      label: text(command, "label"),
      resting: text(command, "resting"),
    },
  };
}

export function partyJoinErrors(
  party: Record<string, PartyContent>,
  storyVariable: (name: string) => unknown,
): string[] {
  return Object.values(party).flatMap((member) =>
    member.joins !== null && storyVariable(member.joins) === undefined
      ? [`party ${member.id}: joins variable ${member.joins} is not declared`]
      : [],
  );
}

// Every critter must answer every party command (numbers and lines), and no
// party command may shadow a shared one.
export function partyErrors(
  party: Record<string, PartyContent>,
  critters: Record<string, Critter>,
): string[] {
  const shared: SharedCommandId[] = ["soothe", "snack", "run"];
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const member of Object.values(party)) {
    const commandId = member.command.id;
    if (shared.some((id) => id === commandId))
      errors.push(`party ${member.id}: command ${commandId} is a shared command`);
    const owner = seen.get(commandId);
    if (owner !== undefined)
      errors.push(`party ${member.id}: command ${commandId} is also ${owner}'s`);
    seen.set(commandId, member.id);
    for (const critter of Object.values(critters)) {
      if (critter.commands.friends[commandId] === undefined)
        errors.push(`critter ${critter.id}: no commands.friends.${commandId}`);
      if (critter.lines.friends[commandId] === undefined)
        errors.push(`critter ${critter.id}: no lines.friends.${commandId}`);
    }
  }
  return errors;
}

// Critter kinds and where they're out (spec 8): every set piece is a kind
// placed once, dens list only the other kinds, a species has one sticker and
// it's in the album, and `after` names a calmed() fact (a set piece or a
// species).
export function critterErrors(
  areas: Record<string, Area>,
  critters: Record<string, Critter>,
  stickers: StickerCatalogue,
): string[] {
  const errors: string[] = [];
  const placed = new Map<string, string>();
  for (const area of Object.values(areas))
    for (const piece of area.critters) {
      if (critters[piece.id] === undefined)
        errors.push(`${area.id}: set piece ${piece.id} isn't a critter kind`);
      const other = placed.get(piece.id);
      if (other !== undefined) errors.push(`${area.id}: set piece ${piece.id} is in ${other} too`);
      placed.set(piece.id, area.id);
    }
  const species = new Map<string, string>();
  for (const kind of Object.values(critters)) {
    const sticker = species.get(kind.species);
    if (sticker !== undefined && sticker !== kind.sticker.id)
      errors.push(`critter ${kind.id}: species ${kind.species} has two stickers, ` +
        `${sticker} and ${kind.sticker.id}`);
    species.set(kind.species, kind.sticker.id);
    if (!stickers.catalogue.some((entry) => entry.id === kind.sticker.id))
      errors.push(`critter ${kind.id}: sticker ${kind.sticker.id} isn't in the album`);
  }
  for (const entry of stickers.catalogue)
    if (critters[entry.critter]?.sticker.id !== entry.id)
      errors.push(`sticker ${entry.id}: critter ${entry.critter} doesn't carry it`);
  if (stickers.catalogue.length > stickers.slots)
    errors.push(`stickers: ${stickers.catalogue.length} stickers for ${stickers.slots} slots`);
  for (const area of Object.values(areas)) {
    const after = area.recurring?.after;
    if (after !== undefined && !placed.has(after) && !species.has(after))
      errors.push(`${area.id}: recurring.after ${after} is neither a set piece nor a species`);
    area.recurring?.dens.forEach((den, index) => {
      for (const kind of den.kinds)
        if (critters[kind] === undefined || placed.has(kind))
          errors.push(`${area.id}: den ${index} lists ${kind}, which isn't a recurring kind`);
    });
  }
  return errors;
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
  const party = value.party;
  field(
    party === undefined ||
      (Array.isArray(party) &&
        party.every((id) => typeof id === "string")),
    file,
    "party",
  );
  return {
    area: value.area,
    spawn: value.spawn,
    ...(value.seed === undefined ? {} : { seed: value.seed }),
    ...(party === undefined ? {} : { party }),
  };
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

// The painted world map's manifest (`assets/ui/map/world-map.json`): each
// land's centre on the painting, in its pixels, for the journal's MAP page.
export function parseMapCentres(
  value: unknown,
  file: string,
): Record<string, { x: number; y: number }> {
  field(record(value), file, "object");
  field(Array.isArray(value.lands), file, "lands");
  const centres: Record<string, { x: number; y: number }> = {};
  value.lands.forEach((item, index) => {
    field(
      record(item) && typeof item.id === "string" && typeof item.x === "number" &&
        typeof item.y === "number",
      file,
      `lands.${index}`,
    );
    centres[item.id] = { x: item.x, y: item.y };
  });
  return centres;
}

export function parseCharacters(
  value: unknown,
  file: string,
): Record<string, CharacterContent> {
  field(record(value), file, "object");
  const characters: Record<string, CharacterContent> = {};
  for (const [id, raw] of Object.entries(value)) {
    field(record(raw) && typeof raw.atlas === "string", file, `${id}.atlas`);
    const ticks = raw.idleTicks;
    field(
      Array.isArray(ticks) &&
        ticks.length > 0 &&
        ticks.every(
          (tick) =>
            typeof tick === "number" && Number.isInteger(tick) && tick > 0,
        ),
      file,
      `${id}.idleTicks`,
    );
    characters[id] = { atlas: raw.atlas, idleTicks: ticks };
  }
  return characters;
}

export function loadContent(): {
  world: World;
  fixtures: Record<string, Fixture>;
} {
  const harness = parseArea(areaData, "content/areas/harness.json");
  const bedroom = parseArea(bedroomData, "content/areas/bedroom.json");
  const plaza = parseArea(plazaData, "content/areas/plaza.json",
    parsePropCatalogue(plazaPropsData, "content/props/plaza.json"));
  const kitchen = parseArea(kitchenData, "content/areas/kitchen.json");
  const park = parseArea(parkData, "content/areas/park.json");
  const school = parseArea(schoolData, "content/areas/school.json");
  const classroom = parseArea(classroomData, "content/areas/classroom.json");
  const gym = parseArea(gymData, "content/areas/gym.json");
  const bay = parseArea(bayData, "content/areas/bay.json");
  Object.defineProperty(bay.spawns, "bus-stop", {
    value: { x: 355, y: 545, facing: "down" },
    enumerable: false,
  });
  const pass = parseArea(passData, "content/areas/pass.json");
  const trail = parseArea(trailData, "content/areas/trail.json");
  const woods = parseArea(woodsData, "content/areas/woods.json");
  const arcade = parseArea(arcadeData, "content/areas/arcade.json");
  field(
    Array.isArray(landsData) &&
      landsData.every(
        (land) =>
          record(land) && typeof land.id === "string" && typeof land.name === "string" &&
          (!("busStop" in land) || typeof land.busStop === "boolean"),
      ),
    "content/lands.json",
    "lands",
  );
  const lands = landsData.map((land) => ({
    id: land.id,
    name: land.name,
    busStop: "busStop" in land && land.busStop === true,
  }));
  const story = parseStoryJson(storyData, "content/story/main.ink.json");
  const critterFiles: [unknown, string][] = [
    [fountainFrogData, "fountain-frog"],
    [frogData, "frog"],
    [pupData, "pup"],
    [catData, "cat"],
    [raccoonData, "raccoon"],
    [schoolRaccoonData, "school-raccoon"],
    [bluebirdData, "bluebird"],
    [hamsterData, "hamster"],
    [bunnyData, "bunny"],
    [squirrelData, "squirrel"],
    [gullData, "gull"],
    [owlData, "owl"],
    [arcadeKeeperData, "arcade-keeper"],
    [gymPupData, "gym-pup"],
  ];
  const critters: Record<string, Critter> = {};
  for (const [data, name] of critterFiles) {
    const file = `content/critters/${name}.json`;
    const critter = parseCritter(data, file);
    field(critter.id === name, file, "id (it must be the file's name)");
    critters[critter.id] = critter;
  }
  const battle = parseBattleContent(battleData, "content/battle.json");
  const stickers = parseStickers(stickerData, "content/stickers.json");
  const characters = parseCharacters(charactersData, "content/characters.json");
  const maddie = parsePartyMember(maddieData, "content/party/maddie.json");
  const sue = parsePartyMember(sueData, "content/party/sue.json");
  const jordan = parsePartyMember(jordanData, "content/party/jordan.json");
  const party = { [maddie.id]: maddie, [sue.id]: sue, [jordan.id]: jordan };
  const storyVariable = createStoryReader(story);
  const initialInk = createInkState(story, 1);
  const joinProblems = partyJoinErrors(party, (name) =>
    storyVariable(initialInk, name),
  );
  if (joinProblems.length > 0)
    throw new Error(`content/party: ${joinProblems.join("; ")}`);
  const partyProblems = partyErrors(party, critters);
  if (partyProblems.length > 0)
    throw new Error(`content/party: ${partyProblems.join("; ")}`);
  const fixtures = {
    "new-game": parseFixture(fixtureData, "content/fixtures/new-game.json"),
    harness: parseFixture(harnessFixtureData, "content/fixtures/harness.json"),
    plaza: parseFixture(plazaFixtureData, "content/fixtures/plaza.json"),
    "plaza-party": parseFixture(
      plazaPartyFixtureData,
      "content/fixtures/plaza-party.json",
    ),
    park: parseFixture(parkFixtureData, "content/fixtures/park.json"),
    school: parseFixture(schoolFixtureData, "content/fixtures/school.json"),
    bay: parseFixture(bayFixtureData, "content/fixtures/bay.json"),
    pass: parseFixture(passFixtureData, "content/fixtures/pass.json"),
    "pass-party": parseFixture(passPartyFixtureData, "content/fixtures/pass-party.json"),
    trail: parseFixture(trailFixtureData, "content/fixtures/trail.json"),
    woods: parseFixture(woodsFixtureData, "content/fixtures/woods.json"),
  };
  for (const [name, fixture] of Object.entries(fixtures))
    for (const id of fixture.party ?? [])
      if (party[id] === undefined)
        throw new Error(`content/fixtures/${name}.json: unknown party member ${id}`);
  const areas = {
    [harness.id]: harness,
    [bedroom.id]: bedroom,
    [plaza.id]: plaza,
    [kitchen.id]: kitchen,
    [park.id]: park,
    [school.id]: school,
    [classroom.id]: classroom,
    [gym.id]: gym,
    [bay.id]: bay,
    [pass.id]: pass,
    [trail.id]: trail,
    [woods.id]: woods,
    [arcade.id]: arcade,
  };
  const ruleProblems = propRuleErrors(areas, (name) => storyVariable(initialInk, name));
  if (ruleProblems.length > 0) throw new Error(`content/areas: ${ruleProblems.join("; ")}`);
  const critterProblems = critterErrors(areas, critters, stickers);
  if (critterProblems.length > 0)
    throw new Error(`content/critters: ${critterProblems.join("; ")}`);
  const tagProblems = storyTagErrors(storyTags(story), areas);
  if (tagProblems.length > 0)
    throw new Error(`content/story/main.ink: ${tagProblems.join("; ")}`);
  return {
    world: {
      tunables: parseTunables(tunableData, "content/tunables.json"),
      areas,
      lands,
      story,
      critters,
      battle,
      stickers,
      characters,
      party,
      storyVariable,
    },
    fixtures,
  };
}
