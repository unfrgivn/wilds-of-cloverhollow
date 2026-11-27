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
import eastHallData from "../../content/areas/east-hall.json";
import musicData from "../../content/areas/music.json";
import fieldData from "../../content/areas/field.json";
import clubhouseData from "../../content/areas/clubhouse.json";
import lodgeData from "../../content/areas/lodge.json";
import mistData from "../../content/areas/mist.json";
import enchantedData from "../../content/areas/enchanted.json";
import hillsData from "../../content/areas/hills.json";
import hillsPropsData from "../../content/props/hills.json";
import sanctuaryData from "../../content/areas/sanctuary.json";
import sanctuaryPropsData from "../../content/props/sanctuary.json";
import cavernData from "../../content/areas/cavern.json";
import cavernPropsData from "../../content/props/cavern.json";
import cafeData from "../../content/areas/cafe.json";
import cafePropsData from "../../content/props/cafe.json";
import sueCottageData from "../../content/areas/sue-cottage.json";
import sueCottagePropsData from "../../content/props/sue-cottage.json";
import jordanCabinData from "../../content/areas/jordan-cabin.json";
import jordanCabinPropsData from "../../content/props/jordan-cabin.json";
import artRoomData from "../../content/areas/art-room.json";
import enchantedPropsData from "../../content/props/enchanted.json";
import arcadeGameData from "../../content/arcade.json";
import prizesData from "../../content/prizes.json";
import { isArcadeGameId } from "../core/arcade";
import type { MoleHole } from "../core/mole";
import harnessSurfaceData from "../../content/surfaces/harness.json";
import bedroomSurfaceData from "../../content/surfaces/bedroom.json";
import plazaSurfaceData from "../../content/surfaces/plaza.json";
import kitchenSurfaceData from "../../content/surfaces/kitchen.json";
import parkSurfaceData from "../../content/surfaces/park.json";
import schoolSurfaceData from "../../content/surfaces/school.json";
import classroomSurfaceData from "../../content/surfaces/classroom.json";
import gymSurfaceData from "../../content/surfaces/gym.json";
import baySurfaceData from "../../content/surfaces/bay.json";
import passSurfaceData from "../../content/surfaces/pass.json";
import trailSurfaceData from "../../content/surfaces/trail.json";
import woodsSurfaceData from "../../content/surfaces/woods.json";
import arcadeSurfaceData from "../../content/surfaces/arcade.json";
import eastHallSurfaceData from "../../content/surfaces/east-hall.json";
import musicSurfaceData from "../../content/surfaces/music.json";
import fieldSurfaceData from "../../content/surfaces/field.json";
import clubhouseSurfaceData from "../../content/surfaces/clubhouse.json";
import lodgeSurfaceData from "../../content/surfaces/lodge.json";
import mistSurfaceData from "../../content/surfaces/mist.json";
import enchantedSurfaceData from "../../content/surfaces/enchanted.json";
import hillsSurfaceData from "../../content/surfaces/hills.json";
import sanctuarySurfaceData from "../../content/surfaces/sanctuary.json";
import cavernSurfaceData from "../../content/surfaces/cavern.json";
import cafeSurfaceData from "../../content/surfaces/cafe.json";
import sueCottageSurfaceData from "../../content/surfaces/sue-cottage.json";
import jordanCabinSurfaceData from "../../content/surfaces/jordan-cabin.json";
import artRoomSurfaceData from "../../content/surfaces/art-room.json";
import plazaPropsData from "../../content/props/plaza.json";
import bedroomPropsData from "../../content/props/bedroom.json";
import kitchenPropsData from "../../content/props/kitchen.json";
import schoolPropsData from "../../content/props/school.json";
import classroomPropsData from "../../content/props/classroom.json";
import gymPropsData from "../../content/props/gym.json";
import arcadePropsData from "../../content/props/arcade.json";
import parkPropsData from "../../content/props/park.json";
import bayPropsData from "../../content/props/bay.json";
import passPropsData from "../../content/props/pass.json";
import trailPropsData from "../../content/props/trail.json";
import woodsPropsData from "../../content/props/woods.json";
import eastHallPropsData from "../../content/props/east-hall.json";
import musicPropsData from "../../content/props/music.json";
import fieldPropsData from "../../content/props/field.json";
import artRoomPropsData from "../../content/props/art-room.json";
import clubhousePropsData from "../../content/props/clubhouse.json";
import lodgePropsData from "../../content/props/lodge.json";
import mistPropsData from "../../content/props/mist.json";
import fixtureData from "../../content/fixtures/new-game.json";
import harnessFixtureData from "../../content/fixtures/harness.json";
import plazaFixtureData from "../../content/fixtures/plaza.json";
import plazaPartyFixtureData from "../../content/fixtures/plaza-party.json";
import parkFixtureData from "../../content/fixtures/park.json";
import schoolFixtureData from "../../content/fixtures/school.json";
import bayFixtureData from "../../content/fixtures/bay.json";
import passFixtureData from "../../content/fixtures/pass.json";
import trailFixtureData from "../../content/fixtures/trail.json";
import hillsFixtureData from "../../content/fixtures/hills.json";
import passPartyFixtureData from "../../content/fixtures/pass-party.json";
import woodsFixtureData from "../../content/fixtures/woods.json";
import parkEastFixtureData from "../../content/fixtures/park-east.json";
import hillsNorthFixtureData from "../../content/fixtures/hills-north.json";
import hillsCalmFixtureData from "../../content/fixtures/hills-calm.json";
import hillsLookoutQaFixtureData from "../../content/fixtures/hills-lookout-qa.json";
import kitchenFixtureData from "../../content/fixtures/kitchen.json";
import classroomFixtureData from "../../content/fixtures/classroom.json";
import gymFixtureData from "../../content/fixtures/gym.json";
import eastHallFixtureData from "../../content/fixtures/east-hall.json";
import clubhouseFixtureData from "../../content/fixtures/clubhouse.json";
import lodgeFixtureData from "../../content/fixtures/lodge.json";
import musicFixtureData from "../../content/fixtures/music.json";
import arcadeFixtureData from "../../content/fixtures/arcade.json";
import cavernFixtureData from "../../content/fixtures/cavern.json";
import cafeFixtureData from "../../content/fixtures/cafe.json";
import sanctuaryFixtureData from "../../content/fixtures/sanctuary.json";
import sueCottageFixtureData from "../../content/fixtures/sue-cottage.json";
import jordanCabinFixtureData from "../../content/fixtures/jordan-cabin.json";
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
import lambData from "../../content/critters/lamb.json";
import hedgehogData from "../../content/critters/hedgehog.json";
import squirrelData from "../../content/critters/squirrel.json";
import gullData from "../../content/critters/gull.json";
import owlData from "../../content/critters/owl.json";
import arcadeKeeperData from "../../content/critters/arcade-keeper.json";
import lodgeKeeperData from "../../content/critters/lodge-keeper.json";
import lifeguardData from "../../content/critters/lifeguard.json";
import gymPupData from "../../content/critters/gym-pup.json";
import musicBirdData from "../../content/critters/music-bird.json";
import oakSquirrelData from "../../content/critters/oak-squirrel.json";
import hoodedKidData from "../../content/critters/hooded-kid.json";
import artTeacherData from "../../content/critters/art-teacher.json";
import crabData from "../../content/critters/crab.json";
import penguinData from "../../content/critters/penguin.json";
import principalData from "../../content/critters/principal.json";
import batData from "../../content/critters/bat.json";
import crystalMoleData from "../../content/critters/crystal-mole.json";
import moonOwlData from "../../content/critters/moon-owl.json";
import tacoChefData from "../../content/critters/taco-chef.json";
import charactersData from "../../content/characters.json";
import battleData from "../../content/battle.json";
import levelsData from "../../content/levels.json";
import treatsData from "../../content/treats.json";
import stickerData from "../../content/stickers.json";
import maddieData from "../../content/party/maddie.json";
import sueData from "../../content/party/sue.json";
import jordanData from "../../content/party/jordan.json";
import pondPupData from "../../content/party/pond-pup.json";
import acornSquirrelData from "../../content/party/acorn-squirrel.json";
import ribbonBunnyData from "../../content/party/ribbon-bunny.json";
import landsData from "../../content/lands.json";
import { createInkState, createStoryReader, runInk, storyHasKnot } from "../core/ink";
import { isStorySound } from "../core/sound";
import {
  parsePropCatalogue, parsePropPlacements, placeProps, propRuleErrors, type PropCatalogue,
} from "./props";
import { parseSurfaceMap } from "./surfaces";
import { parseAmbient, setAreaAmbient } from "./ambient";
import {
  array,
  boolean,
  box,
  boxesApart,
  calibrationHeader,
  calibrationRect,
  checkSpec,
  direction,
  edge,
  faeSideCheck,
  field,
  gradeMap,
  insideBox,
  integer,
  integerBox,
  integerIn,
  isFiniteNumber,
  isInteger,
  isPositive,
  nonEmptyString,
  nonNegative,
  number,
  optionalString,
  point,
  pointField,
  pointTuple,
  polygon,
  positive,
  rawCrossing,
  record,
  string,
  strings,
  type Box,
  type RawCrossing,
} from "./parsers";
import type {
  Area,
  CharacterContent,
  Fixture,
  Spawn,
  Tunables,
  World,
  GroundManifest,
  Critter,
  Grade,
  BattleContent,
  SharedCommandId,
  StickerCatalogue,
  PartyContent,
  FriendCommand,
  FeelingId,
  Recurring,
  Den,
  ArcadeContent,
  ClawCalibration,
  CounterContent,
  HeapPlush,
  MoleCalibration,
  CometCalibration,
  CookCalibration,
  CookContent,
  CookDish,
  CookZone,
  FishCalibration,
  FishCatchSpec,
  FishContent,
  FishRarity,
  MoleContent,
  CometContent,
  SkeeCalibration,
  SkeeContent,
  WindUp,
  LevelContent,
  TreatItem,
} from "../core";

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
// Every tag the story uses, checked (spec 7). `prices` are the ticket
// counter's: a `trade` tag must name one of its prizes at its price.
export function storyTagErrors(
  tags: string[],
  areas: Record<string, Area>,
  prices: Record<string, number> = {},
  treatPrices: Record<string, number> = {},
): string[] {
  return tags.flatMap((tag) => {
    if (tag.startsWith("grade:"))
      return /^(great|good|miss)$/.test(tag.slice("grade:".length).trim())
        ? [] : [`invalid grade tag "${tag}"`];
    if (tag.startsWith("travel:")) {
      const [areaId, spawnId, ...extra] = tag.slice("travel:".length).trim().split(".");
      const area = areaId === undefined ? undefined : areas[areaId];
      const known = area !== undefined && spawnId !== undefined && extra.length === 0 &&
        area.spawns[spawnId] !== undefined;
      return known ? [] : [`unknown travel target in "${tag}"`];
    }
    if (tag.startsWith("buy:"))
      return /^buy:\s*snack\s+\d+$/.test(tag) ? [] : [`invalid buy tag "${tag}"`];
    if (tag.startsWith("buy-treat:")) {
      const match = /^buy-treat:\s*([a-z][a-z0-9-]*)\s+(\d+)$/.exec(tag);
      const price = match === null ? undefined : treatPrices[match[1] ?? ""];
      return price !== undefined && price === Number(match?.[2])
        ? [] : [`invalid buy-treat tag "${tag}" (not a treat at its price)`];
    }
    if (tag.startsWith("gift:"))
      return /^gift:\s*(snack|coins)\s+[1-9]\d*$/.test(tag) ? [] : [`invalid gift tag "${tag}"`];
    if (tag.startsWith("feed:"))
      return /^feed:\s*snack\s+[1-9]\d*$/.test(tag) ? [] : [`invalid feed tag "${tag}"`];
    if (tag.startsWith("play:")) {
      const match = /^play:\s*([a-z][a-z0-9-]*)\s+\d+$/.exec(tag);
      return match !== null && isArcadeGameId(match[1] ?? "")
        ? [] : [`invalid play tag "${tag}"`];
    }
    if (tag.startsWith("trade:")) {
      const match = /^trade:\s*([a-z][a-z0-9-]*)\s+(\d+)$/.exec(tag);
      const price = match === null ? undefined : prices[match[1] ?? ""];
      return price !== undefined && price === Number(match?.[2])
        ? [] : [`invalid trade tag "${tag}" (not a counter prize at its price)`];
    }
    if (tag === "ending" || tag === "credits") return [];
    if (tag.startsWith("ending") || tag.startsWith("credits"))
      return [`invalid finale tag "${tag}"`];
    if (tag.startsWith("sound:")) {
      const sound = tag.slice("sound:".length).trim();
      return isStorySound(sound) ? [] : [`unknown sound in "${tag}"`];
    }
    return [];
  });
}

export function talkErrors(
  story: Record<string, unknown>, ink: string, critters: Critter[],
): string[] {
  return critters.flatMap((critter) => {
    if (critter.talk === null) return [];
    const errors: string[] = [];
    for (const knot of critter.talk.knots) {
      if (!storyHasKnot(story, knot)) {
        errors.push(`critter ${critter.id}: unknown talk knot ${knot}`);
        continue;
      }
      const opening = runInk(story, ink, { type: "start", knot });
      opening.choices.forEach((_, index) => {
        const answer = runInk(story, opening.ink, { type: "choose", index });
        const grades = answer.line?.tags.filter(
          (tag) => /^grade:\s*(great|good|miss)\s*$/.test(tag.trim()),
        ) ?? [];
        if (grades.length !== 1)
          errors.push(`critter ${critter.id}: ${knot} choice ${index} must have exactly one grade`);
      });
    }
    return errors;
  });
}

export function endingContentErrors(
  story: Record<string, unknown>,
  areas: Record<string, Area>,
): string[] {
  if (!storyTags(story).includes("ending")) return [];
  const bedroom = areas.bedroom;
  return [
    ...(bedroom === undefined ? ["ending requires area bedroom"] : []),
    ...(bedroom?.spawns.bed === undefined ? ["ending requires bedroom spawn bed"] : []),
    ...(storyHasKnot(story, "morning_start") ? [] : ["ending requires morning_start knot"]),
    ...(storyHasKnot(story, "mom") ? [] : ["ending requires mom knot"]),
  ];
}

// The prize catalogue (content/prizes.json): its atlas and one entry a prize.
function parsePrizes(value: unknown): ArcadeContent["prizes"] {
  const file = "content/prizes.json";
  field(record(value) && typeof value.atlas === "string" && value.atlas.endsWith(".json") &&
    array(value.catalogue), file, "atlas or catalogue");
  const prizes: ArcadeContent["prizes"] = [];
  for (const item of value.catalogue) {
    field(record(item) && typeof item.id === "string" && typeof item.name === "string" &&
      typeof item.frame === "string", file, "catalogue entry");
    field(!prizes.some((prize) => prize.id === item.id), file, `duplicate prize ${item.id}`);
    prizes.push({ id: item.id, name: item.name, frame: item.frame });
  }
  return prizes;
}

// The claw machine (content/arcade.json, spec 8.2): the box, the claw's
// travel, its numbers, the heap, and the lines.
export function parseArcade(value: unknown, prizesValue: unknown): ArcadeContent {
  const file = "content/arcade.json";
  field(record(prizesValue) && typeof prizesValue.atlas === "string",
    "content/prizes.json", "atlas");
  const prizes = parsePrizes(prizesValue);
  field(record(value) && record(value.claw), file, "claw");
  const claw = value.claw;
  const intField = (
    source: Record<string, unknown>,
    name: string,
    minimum: number,
    label = `claw.${name}`,
  ): number => integerIn(source, name, minimum, file, label);
  field(record(claw.box), file, "claw.box");
  const clawBox = {
    width: intField(claw.box, "width", 1, "claw.box.width"),
    depth: intField(claw.box, "depth", 1, "claw.box.depth"),
  };
  const railLeft = intField(claw, "railLeft", 0);
  const railRight = intField(claw, "railRight", 0);
  field(railLeft < railRight && railRight <= clawBox.width, file, "claw rail");
  const depthFront = intField(claw, "depthFront", 0);
  const depthBack = intField(claw, "depthBack", 0);
  field(depthFront < depthBack && depthBack <= clawBox.depth, file, "claw depth");
  const reach = intField(claw, "reach", 1);
  field(array(claw.heap) && claw.heap.length > 0, file, "claw.heap");
  const heap: HeapPlush[] = claw.heap.map((item, index) => {
    const label = `claw.heap[${index}]`;
    field(record(item) && typeof item.prize === "string" && strings(item.on), file, label);
    field(prizes.some((prize) => prize.id === item.prize), file, `${label}.prize`);
    const x = intField(item, "x", railLeft, `${label}.x`);
    const z = intField(item, "z", depthFront, `${label}.z`);
    field(x <= railRight && z <= depthBack, file, `${label} position`);
    const level = intField(item, "level", 0, `${label}.level`);
    return { prize: item.prize, x, z, level, on: item.on };
  });
  heap.forEach((plush, index) => {
    const label = `claw.heap[${index}]`;
    field(heap.findIndex((other) => other.prize === plush.prize) === index, file,
      `${label}: duplicate prize`);
    field(plush.level === 0 ? plush.on.length === 0 : plush.on.length > 0, file,
      `${label}.on: a plush on the floor rests on nothing, one above on something`);
    for (const id of plush.on) {
      const under = heap.find((other) => other.prize === id);
      const near = under !== undefined &&
        (plush.x - under.x) * (plush.x - under.x) + (plush.z - under.z) * (plush.z - under.z) <=
          9 * reach * reach;
      field(under !== undefined && under.level === plush.level - 1 && near, file,
        `${label}.on: ${id} is not one level down within three reaches`);
    }
    // The claw rests over the chute; nothing in the heap may be in reach there.
    field((railLeft - plush.x) * (railLeft - plush.x) +
      (depthFront - plush.z) * (depthFront - plush.z) > reach * reach, file,
      `${label}: in reach of the chute`);
  });
  const lines = claw.lines;
  field(record(lines) && typeof lines.slide === "string" && typeof lines.push === "string" &&
    typeof lines.won === "string" && lines.won.includes("{prize}") &&
    typeof lines.missed === "string" && typeof lines.stuck === "string" &&
    typeof lines.prizeTitle === "string", file, "claw.lines");
  return {
    atlas: prizesValue.atlas,
    claw: {
      box: clawBox, railLeft, railRight, depthFront, depthBack, reach,
      speed: intField(claw, "speed", 1),
      dropTicks: intField(claw, "dropTicks", 1),
      grabTicks: intField(claw, "grabTicks", 1),
      liftTicks: intField(claw, "liftTicks", 1),
      releaseTicks: intField(claw, "releaseTicks", 1),
      heap,
      lines: {
        slide: lines.slide, push: lines.push, won: lines.won, missed: lines.missed,
        stuck: lines.stuck, prizeTitle: lines.prizeTitle,
      },
    },
    skee: parseSkee(value.skee, file),
    mole: parseMole(value.mole, file),
    comet: parseComet(value.comet, file),
    cook: parseCook(value.cook, file),
    fish: parseFish(value.fish, file),
    counter: parseCounter(value.counter, file, prizes, heap),
    prizes,
  };
}

// Skee-ball (spec 8.2): integers throughout; the arrow turns exactly at the
// board's edges; held to the end of the meter, the ball flies off the top; the
// rings smallest first, the outer one on the board; the corner holes on the
// board and clear of the rings; every ball scores at least the floor.
function parseSkee(value: unknown, file: string): SkeeContent {
  field(record(value), file, "skee");
  const integer = (source: Record<string, unknown>, name: string, minimum: number,
    label = `skee.${name}`): number => integerIn(source, name, minimum, file, label);
  field(record(value.board), file, "skee.board");
  const board = {
    width: integer(value.board, "width", 2, "skee.board.width"),
    height: integer(value.board, "height", 1, "skee.board.height"),
  };
  const edge = board.width / 2;
  const sweepStep = integer(value, "sweepStep", 1);
  field(Number.isInteger(edge) && edge % sweepStep === 0, file,
    "skee.sweepStep (the arrow must turn exactly at the board's edges)");
  const powerStep = integer(value, "powerStep", 1);
  const powerTicks = integer(value, "powerTicks", 2);
  field(powerTicks * powerStep > board.height, file,
    "skee.powerTicks (held to the end, the ball must fly off the top)");
  field(record(value.centre), file, "skee.centre");
  const centre = {
    x: integer(value.centre, "x", -edge, "skee.centre.x"),
    y: integer(value.centre, "y", 0, "skee.centre.y"),
  };
  field(array(value.rings) && value.rings.length > 0, file, "skee.rings");
  const rings = value.rings.map((ring, index) => {
    field(record(ring), file, `skee.rings[${index}]`);
    return {
      points: integer(ring, "points", 1, `skee.rings[${index}].points`),
      radius: integer(ring, "radius", 1, `skee.rings[${index}].radius`),
    };
  });
  rings.forEach((ring, index) => {
    const inside = rings[index - 1];
    field(inside === undefined || inside.radius < ring.radius, file,
      `skee.rings[${index}] (rings go from the smallest out)`);
  });
  const outer = rings.at(-1);
  field(outer !== undefined && centre.x - outer.radius >= -edge &&
    centre.x + outer.radius <= edge && centre.y - outer.radius >= 0 &&
    centre.y + outer.radius <= board.height, file, "skee.rings (the outer ring is on the board)");
  field(record(value.corners), file, "skee.corners");
  const corners = {
    points: integer(value.corners, "points", 1, "skee.corners.points"),
    x: integer(value.corners, "x", 1, "skee.corners.x"),
    y: integer(value.corners, "y", 0, "skee.corners.y"),
    radius: integer(value.corners, "radius", 1, "skee.corners.radius"),
  };
  const clear = [-corners.x, corners.x].every((x) =>
    (x - centre.x) * (x - centre.x) + (corners.y - centre.y) * (corners.y - centre.y) >
      (outer.radius + corners.radius) * (outer.radius + corners.radius));
  field(corners.x + corners.radius <= edge && corners.y - corners.radius >= 0 &&
    corners.y + corners.radius <= board.height && clear, file,
  "skee.corners (on the board, clear of the rings)");
  const lines = value.lines;
  field(record(lines) && typeof lines.aim === "string" && typeof lines.power === "string" &&
    typeof lines.result === "string" && lines.result.includes("{score}") &&
    lines.result.includes("{tickets}"), file, "skee.lines");
  return {
    balls: integer(value, "balls", 1),
    board, sweepStep, powerStep, powerTicks,
    rollTicks: integer(value, "rollTicks", 1),
    hopTicks: integer(value, "hopTicks", 1),
    scoreTicks: integer(value, "scoreTicks", 1),
    centre, rings, corners,
    floor: integer(value, "floor", 1),
    pointsPerTicket: integer(value, "pointsPerTicket", 1),
    lines: { aim: lines.aim, power: lines.power, result: lines.result },
  };
}

// The clubhouse microwave (spec 8.2): positive integers throughout; each dish
// frozen, then under, golden, and over in turn before it burns, and stopped
// after that; every way out pays a snack or more, and says how many; the start
// line names the box's `{time}`.
function parseCook(value: unknown, file: string): CookContent {
  field(record(value), file, "cook");
  const integer = (source: Record<string, unknown>, name: string, minimum: number,
    label = `cook.${name}`): number => integerIn(source, name, minimum, file, label);
  const golden = integer(value, "golden", 1);
  field(record(value.dishes), file, "cook.dishes");
  const dishes = value.dishes;
  const dish = (name: CookDish): CookContent["dishes"][CookDish] => {
    const item = dishes[name];
    field(record(item) && typeof item.label === "string" && item.label !== "", file,
      `cook.dishes.${name}`);
    const at = (key: string): number => integer(item, key, 1, `cook.dishes.${name}.${key}`);
    const [time, frozen, burnt, stop] = [at("time"), at("frozen"), at("burnt"), at("stop")];
    field(frozen < time - golden && time + golden < burnt && burnt < stop, file,
      `cook.dishes.${name} (frozen, then under, golden, and over, then burnt, then the stop)`);
    return { label: item.label, time, frozen, burnt, stop };
  };
  field(record(value.snacks), file, "cook.snacks");
  const snacks = value.snacks;
  const paid = (zone: CookZone): number => integer(snacks, zone, 1, `cook.snacks.${zone}`);
  const lines = value.lines;
  field(record(lines) && typeof lines.start === "string" && lines.start.includes("{time}") &&
    typeof lines.frozen === "string", file, "cook.lines");
  const said = (zone: CookZone): string => {
    const line = lines[zone];
    field(typeof line === "string" && line.includes("{snacks}"), file, `cook.lines.${zone}`);
    return line;
  };
  return {
    ticksPerSecond: integer(value, "ticksPerSecond", 1),
    golden,
    dishes: { nuggets: dish("nuggets"), mac: dish("mac") },
    snacks: { under: paid("under"), golden: paid("golden"), over: paid("over"),
      burnt: paid("burnt") },
    dingTicks: integer(value, "dingTicks", 1),
    lines: { start: lines.start, frozen: lines.frozen, under: said("under"),
      golden: said("golden"), over: said("over"), burnt: said("burnt") },
  };
}

function isFishRarity(value: unknown): value is FishRarity {
  return value === "common" || value === "uncommon" || value === "rare";
}

function parseFish(value: unknown, file: string): FishContent {
  field(record(value), file, "fish");
  const integer = (source: Record<string, unknown>, name: string, minimum: number,
    label = `fish.${name}`): number => integerIn(source, name, minimum, file, label);
  const ratio = (source: Record<string, unknown>, name: string, min: number, max: number,
    label = `fish.${name}`): number => {
    const item = source[name];
    field(typeof item === "number" && Number.isFinite(item) && item >= min && item <= max,
      file, label);
    return item;
  };
  const nibbleGapMin = integer(value, "nibbleGapMin", 1);
  const nibbleGapMax = integer(value, "nibbleGapMax", nibbleGapMin);
  field(array(value.catches) && value.catches.length > 0, file, "fish.catches");
  const seen = new Set<string>();
  const catches: FishCatchSpec[] = value.catches.map((item, index) => {
    const label = `fish.catches[${index}]`;
    field(record(item) && typeof item.id === "string" && /^[a-z][a-z0-9-]*$/.test(item.id) &&
      typeof item.name === "string" && item.name.length > 0 &&
      typeof item.frame === "string" && item.frame.length > 0 &&
      isFishRarity(item.rarity) && typeof item.line === "string" && item.line.length > 0,
    file, label);
    field(!seen.has(item.id), file, `${label} (duplicate catch ${item.id})`);
    seen.add(item.id);
    return {
      id: item.id,
      name: item.name,
      frame: item.frame,
      coins: integer(item, "coins", 1, `${label}.coins`),
      snacks: integer(item, "snacks", 0, `${label}.snacks`),
      rarity: item.rarity,
      minPower: ratio(item, "minPower", 0, 1, `${label}.minPower`),
      weight: integer(item, "weight", 1, `${label}.weight`),
      fightSpeed: ratio(item, "fightSpeed", 0.001, 0.2, `${label}.fightSpeed`),
      line: item.line,
    };
  });
  field(catches.some((item) => item.minPower === 0), file,
    "fish.catches (at least one catch must unlock at power 0)");
  const lines = value.lines;
  field(record(lines) && typeof lines.aim === "string" && typeof lines.wait === "string" &&
    typeof lines.bite === "string" && typeof lines.reel === "string" &&
    typeof lines.early === "string" && typeof lines.missed === "string", file, "fish.lines");
  return {
    aimPeriod: integer(value, "aimPeriod", 8),
    castTicks: integer(value, "castTicks", 1),
    biteTicks: integer(value, "biteTicks", 8),
    nibbleGapMin,
    nibbleGapMax,
    reelStart: ratio(value, "reelStart", 0.05, 0.9),
    reelGain: ratio(value, "reelGain", 0.001, 0.2),
    reelDrain: ratio(value, "reelDrain", 0.001, 0.2),
    zoneHalf: ratio(value, "zoneHalf", 0.04, 0.4),
    hookAccel: ratio(value, "hookAccel", 0.0005, 0.1),
    hookGravity: ratio(value, "hookGravity", 0.0005, 0.1),
    hookMaxSpeed: ratio(value, "hookMaxSpeed", 0.005, 0.2),
    reelMaxTicks: integer(value, "reelMaxTicks", 60),
    catches,
    lines: {
      aim: lines.aim,
      wait: lines.wait,
      bite: lines.bite,
      reel: lines.reel,
      early: lines.early,
      missed: lines.missed,
    },
  };
}

// Boop-a-Mole (spec 8.2): positive integers throughout, at least two moles, a
// window that shrinks (or holds) across the round, a boop long enough to show
// both faces, and a result line with `{booped}`, `{moles}`, and `{tickets}`.
function parseMole(value: unknown, file: string): MoleContent {
  field(record(value), file, "mole");
  const integer = (name: string, minimum = 1): number =>
    integerIn(value, name, minimum, file, `mole.${name}`);
  const upFirst = integer("upFirst");
  const upLast = integer("upLast");
  field(upLast <= upFirst, file, "mole.upLast (the window shrinks across the round)");
  const lines = value.lines;
  field(record(lines) && typeof lines.ready === "string" && typeof lines.boop === "string" &&
    typeof lines.result === "string" && ["{booped}", "{moles}", "{tickets}"]
    .every((part) => typeof lines.result === "string" && lines.result.includes(part)),
  file, "mole.lines");
  return {
    moles: integer("moles", 2),
    readyTicks: integer("readyTicks"),
    riseTicks: integer("riseTicks"),
    upFirst,
    upLast,
    duckTicks: integer("duckTicks"),
    boopTicks: integer("boopTicks", 2),
    gapTicks: integer("gapTicks"),
    hammerTicks: integer("hammerTicks"),
    ticketsPerBoop: integer("ticketsPerBoop"),
    lines: { ready: lines.ready, boop: lines.boop, result: lines.result },
  };
}

function parseComet(value: unknown, file: string): CometContent {
  field(record(value), file, "comet");
  const integer = (name: string, minimum = 1): number =>
    integerIn(value, name, minimum, file, `comet.${name}`);
  const lines = value.lines;
  field(record(lines) && typeof lines.ready === "string" && typeof lines.play === "string" &&
    typeof lines.result === "string" && ["{stars}", "{total}", "{tickets}"]
      .every((part) => typeof lines.result === "string" && lines.result.includes(part)),
    file, "comet.lines");
  const ready = typeof lines.ready === "string" ? lines.ready : "";
  const play = typeof lines.play === "string" ? lines.play : "";
  const result = typeof lines.result === "string" ? lines.result : "";
  const stars = integer("stars");
  const rocks = integer("rocks");
  const travelFirst = integer("travelFirst");
  const travelLast = integer("travelLast");
  field(stars >= rocks, file, "comet.stars");
  field(travelLast <= travelFirst, file, "comet.travelLast");
  field(integer("passTicks") >= integer("flashTicks"), file, "comet.passTicks");
  return { stars, rocks, readyTicks: integer("readyTicks"), gapTicks: integer("gapTicks"),
    travelFirst, travelLast, passTicks: integer("passTicks"), flashTicks: integer("flashTicks"),
    moveTicks: integer("moveTicks"), wobbleTicks: integer("wobbleTicks"),
    ticketsPerStar: integer("ticketsPerStar"),
    lines: { ready, play, result } };
}

// The ticket counter: prizes from the catalogue, each once, never one of the
// claw machine's plushes, each at a price of at least one ticket.
function parseCounter(
  value: unknown,
  file: string,
  prizes: ArcadeContent["prizes"],
  heap: HeapPlush[],
): CounterContent {
  field(record(value) && array(value.prizes) && value.prizes.length > 0, file, "counter.prizes");
  const items = value.prizes.map((item, index) => {
    const label = `counter.prizes[${index}]`;
    field(record(item) && typeof item.prize === "string" &&
      prizes.some((prize) => prize.id === item.prize), file, `${label}.prize`);
    field(!heap.some((plush) => plush.prize === item.prize), file,
      `${label} (the claw machine's plushes aren't sold)`);
    return { prize: item.prize, price: integerIn(item, "price", 1, file, `${label}.price`) };
  });
  items.forEach((item, index) =>
    field(items.findIndex((other) => other.prize === item.prize) === index, file,
      `counter.prizes[${index}] (a duplicate prize)`));
  return { prizes: items };
}

// The claw machine painting's calibration (spec 8.2): every number finite,
// the window and the plate inside the image, the floor's back edge above and
// narrower than its front, the ceiling meeting the glass above the back wall,
// and the chute's mouth four points on the floor.
export function parseClawCalibration(value: unknown, file: string): ClawCalibration {
  const { raw, image, size, bounds } = calibrationHeader(value, file);
  const level = (item: unknown): item is { y: number } => record(item) && isFiniteNumber(item.y);
  const rounded = (item: unknown): item is Box & { radius: number } =>
    record(item) && isFiniteNumber(item.radius) && item.radius >= 0 && box(item);
  field(rounded(raw.glass) && insideBox(raw.glass, bounds), file, "glass");
  field(box(raw.plate) && insideBox(raw.plate, bounds), file, "plate");
  field(record(raw.floor) && edge(raw.floor.front) && edge(raw.floor.back) &&
    raw.floor.back.y < raw.floor.front.y &&
    raw.floor.back.right - raw.floor.back.left <
      raw.floor.front.right - raw.floor.front.left, file, "floor");
  field(record(raw.ceiling) && level(raw.ceiling.front) && level(raw.ceiling.back) &&
    raw.ceiling.front.y < raw.ceiling.back.y &&
    raw.ceiling.back.y < raw.floor.back.y, file, "ceiling");
  field(record(raw.chute) && array(raw.chute.mouth) && raw.chute.mouth.length === 4 &&
    raw.chute.mouth.every(pointTuple), file, "chute.mouth");
  const { glass, plate } = raw;
  return {
    image,
    size,
    glass: { x: glass.x, y: glass.y, w: glass.w, h: glass.h, radius: glass.radius },
    floor: { front: { ...raw.floor.front }, back: { ...raw.floor.back } },
    ceiling: { front: { y: raw.ceiling.front.y }, back: { y: raw.ceiling.back.y } },
    chute: { mouth: raw.chute.mouth.map(([x, y]) => [x, y]) },
    plate: { x: plate.x, y: plate.y, w: plate.w, h: plate.h },
  };
}

// The microwave's close-up: every part inside the image; the turntable inside
// the glass; the display and the button clear of the glass; the fridge's front
// below everything else.
export function parseCookCalibration(value: unknown, file: string): CookCalibration {
  const { raw, image, size, bounds } = calibrationHeader(value, file);
  const glass = calibrationRect(raw, "glass", bounds, file);
  const radius = record(raw.glass) ? raw.glass.r : undefined;
  field(isFiniteNumber(radius) && radius >= 0 && 2 * radius <= Math.min(glass.w, glass.h), file,
    "glass.r");
  const plate = raw.plate;
  field(record(plate) && isFiniteNumber(plate.cx) && isFiniteNumber(plate.cy) &&
    isPositive(plate.rx) && isPositive(plate.ry) &&
    insideBox({ x: plate.cx - plate.rx, y: plate.cy - plate.ry, w: 2 * plate.rx,
      h: 2 * plate.ry }, glass), file, "plate (inside the glass)");
  const display = calibrationRect(raw, "display", bounds, file);
  const button = raw.button;
  field(record(button) && isFiniteNumber(button.cx) && isFiniteNumber(button.cy) &&
    isPositive(button.r), file, "button");
  const buttonBox: Box = {
    x: button.cx - button.r, y: button.cy - button.r, w: 2 * button.r, h: 2 * button.r,
  };
  field(insideBox(buttonBox, bounds) && boxesApart(buttonBox, glass) &&
    boxesApart(display, glass) && boxesApart(display, buttonBox),
  file, "display and button (clear of the glass and each other)");
  const front = calibrationRect(raw, "front", bounds, file);
  field([glass, display, buttonBox].every((item) => item.y + item.h <= front.y), file,
    "front (below the glass, the display, and the button)");
  return {
    image,
    size,
    glass: { ...glass, r: radius },
    plate: { cx: plate.cx, cy: plate.cy, rx: plate.rx, ry: plate.ry },
    display,
    button: { cx: button.cx, cy: button.cy, r: button.r },
    front,
  };
}

export function parseFishCalibration(value: unknown, file: string): FishCalibration {
  const { raw, image, size, bounds } = calibrationHeader(value, file, { positiveSize: true });
  const water = calibrationRect(raw, "water", bounds, file);
  const front = calibrationRect(raw, "front", bounds, file);
  const horizonY = number(raw, "horizonY", file);
  const dockY = number(raw, "dockY", file);
  field(horizonY >= 0 && horizonY <= water.y, file, "horizonY");
  field(dockY >= water.y + water.h && dockY <= front.y, file, "dockY");
  const rodTip = pointField(raw, "rodTip", file);
  field(rodTip.x >= 0 && rodTip.x <= size.w && rodTip.y >= 0 && rodTip.y <= size.h, file, "rodTip");
  return { image, size, water, horizonY, dockY, rodTip, front };
}

// The Boop-a-Mole painting's calibration (spec 8.2): every number finite, the
// plate and every hole inside the image, the holes in a plus (far over middle
// over near, left of middle left of right), and no hole's box touching
// another's or the plate.
export function parseMoleCalibration(value: unknown, file: string): MoleCalibration {
  type Hole = { cx: number; cy: number; rx: number; ry: number };
  const { raw, image, size, bounds } = calibrationHeader(value, file);
  const plate = raw.plate;
  field(box(plate) && insideBox(plate, bounds), file, "plate");
  field(record(raw.holes), file, "holes");
  const holes = raw.holes;
  const hole = (name: MoleHole): Hole => {
    const item = holes[name];
    field(record(item) && isFiniteNumber(item.cx) && isFiniteNumber(item.cy) &&
      isPositive(item.rx) && isPositive(item.ry), file, `holes.${name}`);
    return { cx: item.cx, cy: item.cy, rx: item.rx, ry: item.ry };
  };
  const all = {
    up: hole("up"), left: hole("left"), middle: hole("middle"),
    right: hole("right"), down: hole("down"),
  };
  const toBox = (item: Hole): Box =>
    ({ x: item.cx - item.rx, y: item.cy - item.ry, w: 2 * item.rx, h: 2 * item.ry });
  const boxes = Object.values(all).map(toBox);
  field(boxes.every((item) => insideBox(item, bounds) && boxesApart(item, plate)) &&
    boxes.every((item, index) =>
      boxes.slice(index + 1).every((other) => boxesApart(item, other))) &&
    all.up.cy < all.middle.cy && all.middle.cy < all.down.cy &&
    all.left.cx < all.middle.cx && all.middle.cx < all.right.cx,
  file, "holes (a plus, each inside the image, none touching another or the plate)");
  return {
    image,
    size,
    plate: { x: plate.x, y: plate.y, w: plate.w, h: plate.h },
    holes: all,
  };
}

export function parseCometCalibration(value: unknown, file: string): CometCalibration {
  const { raw, image, size, bounds } = calibrationHeader(value, file, {
    positiveSize: true, integerSize: true,
  });
  const parseBox = (name: "marquee" | "screen" | "field" | "deck"): Box => {
    const item = raw[name];
    field(integerBox(item) && insideBox(item, bounds), file, name);
    return item;
  };
  const marquee = parseBox("marquee");
  const screen = parseBox("screen");
  const fieldBox = parseBox("field");
  const deck = parseBox("deck");
  field(insideBox(fieldBox, screen), file, "field (inside screen)");
  field(marquee.y + marquee.h <= screen.y, file, "marquee (above screen)");
  field(deck.y >= screen.y + screen.h, file, "deck (below screen)");
  return { image, size, marquee, screen, field: fieldBox, deck };
}

// The skee-ball painting's calibration (spec 8.2): every number finite; the
// lane narrowing from its foot up to the hump; the board above the hump; the
// board and the plate inside the image, apart.
export function parseSkeeCalibration(value: unknown, file: string): SkeeCalibration {
  const { raw, image, size, bounds } = calibrationHeader(value, file);
  field(record(raw.lane) && edge(raw.lane.near) && edge(raw.lane.far) &&
    raw.lane.far.y < raw.lane.near.y &&
    raw.lane.far.right - raw.lane.far.left < raw.lane.near.right - raw.lane.near.left,
  file, "lane");
  const { board, plate } = raw;
  field(box(board) && insideBox(board, bounds) && board.y + board.h <= raw.lane.far.y,
    file, "board");
  field(box(plate) && insideBox(plate, bounds) && boxesApart(plate, board), file, "plate");
  const copy = (item: Box): Box => ({ x: item.x, y: item.y, w: item.w, h: item.h });
  return {
    image,
    size,
    lane: { near: { ...raw.lane.near }, far: { ...raw.lane.far } },
    board: copy(board),
    plate: copy(plate),
  };
}

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
    value.crossings === undefined || (Array.isArray(value.crossings) && value.crossings.every(
      rawCrossing,
    )), file, "crossings",
  );
  const crossings: RawCrossing[] = value.crossings === undefined
    ? [] : value.crossings.filter(rawCrossing);
  const crossingIds = new Set<string>();
  for (const crossing of crossings) {
    field(!crossingIds.has(crossing.id), file, `crossings.${crossing.id} (duplicate id)`);
    crossingIds.add(crossing.id);
  }
  field(
    value.critters === undefined ||
      (Array.isArray(value.critters) &&
        value.critters.every(
          (item) => record(item) && typeof item.id === "string" && point(item.point) &&
            (item.visibleWhile === undefined || typeof item.visibleWhile === "string"),
        )),
    file, "critters",
  );
  const recurring = parseRecurring(value.recurring, file);
  field(
    value.npcs === undefined ||
      (Array.isArray(value.npcs) &&
        value.npcs.every(
          (item) => record(item) && typeof item.id === "string" && point(item.point) &&
            direction(item.facing) && polygon(item.footprint) && typeof item.knot === "string" &&
            (item.prompt === "Look" || item.prompt === "Talk" || item.prompt === "Pet") &&
            (item.visibleWhile === undefined || typeof item.visibleWhile === "string") &&
            (item.visibleWhenCalmed === undefined || typeof item.visibleWhenCalmed === "string"),
        )),
    file, "npcs",
  );
  field(
    value.triggers === undefined ||
      (Array.isArray(value.triggers) &&
        value.triggers.every(
          (item) => record(item) && typeof item.id === "string" && polygon(item.polygon) &&
            record(item.target) && typeof item.target.area === "string" &&
            typeof item.target.spawn === "string",
        )),
    file, "triggers",
  );
  field(value.ground === undefined || typeof value.ground === "string", file, "ground");
  field(
    value.glows === undefined ||
      (Array.isArray(value.glows) &&
        value.glows.every(
          (item) => record(item) && typeof item.id === "string" && typeof item.frame === "string" &&
            point(item.point) && (item.knot === undefined || typeof item.knot === "string") &&
            (item.prompt === undefined || item.prompt === "Look") &&
            (item.flip === undefined || typeof item.flip === "boolean"),
        )),
    file, "glows",
  );
  field(
    value.interactables === undefined ||
      (Array.isArray(value.interactables) &&
        value.interactables.every(
          (item) => record(item) && typeof item.id === "string" && typeof item.knot === "string" &&
            point(item.point) &&
            (item.prompt === "Look" || item.prompt === "Play" || item.prompt === "Talk"),
        )),
    file, "interactables",
  );
  field(record(value.spawns), file, "spawns");
  const spawns: Record<string, Spawn> = {};
  for (const [name, raw] of Object.entries(value.spawns)) {
    field(record(raw), file, `spawns.${name}`);
    field(typeof raw.x === "number" && typeof raw.y === "number", file, `spawns.${name}.position`);
    field(direction(raw.facing), file, `spawns.${name}.facing`);
    spawns[name] = { x: raw.x, y: raw.y, facing: raw.facing };
  }
  const area: Area = {
    id: value.id,
    name: value.name,
    ...(value.land === undefined ? {} : { land: value.land }),
    width: value.width,
    height: value.height,
    walkable: value.walkable,
    blockers: value.blockers,
    ...(crossings.length === 0 ? {} : { crossings: crossings.map((crossing) => ({
      id: crossing.id, polygon: crossing.polygon, opens: crossing.opens,
    })) }),
    ground: value.ground,
    glows: (value.glows ?? []).map((item) => ({
      id: item.id, frame: item.frame, point: { x: item.point.x, y: item.point.y },
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
      ...(item.visibleWhenCalmed === undefined
        ? {}
        : { visibleWhenCalmed: item.visibleWhenCalmed }),
    })),
    props: placeProps(parsePropPlacements(value.props, file), catalogue, file),
    atlases: catalogue?.atlases ?? [],
    spawns,
  };
  setAreaAmbient(area, parseAmbient(value.ambient, file, value.width, value.height));
  return area;
}

// An area's recurring critters (spec 6): `after` (a calmed() fact) and the
// dens, each `{ point, radius, kinds, chance?, after? }` with `chance` in
// (0, 1] and `after` a calmed() fact that keeps that one den quiet.
function parseRecurring(value: unknown, file: string): Recurring | undefined {
  if (value === undefined) return undefined;
  field(record(value), file, "recurring");
  const after = optionalString(value, "after", file, "recurring.after");
  const dens = value.dens;
  field(array(dens) && dens.length > 0, file, "recurring.dens");
  return {
    ...(after === undefined ? {} : { after }),
    dens: dens.map((den: unknown, index): Den => {
      const name = `recurring.dens.${index}`;
      field(record(den), file, name);
      const pt = pointField(den, "point", file, `${name}.point`);
      const radius = positive(den, "radius", file, `${name}.radius`);
      const kinds = den.kinds;
      field(strings(kinds) && kinds.length > 0, file, `${name}.kinds`);
      const chance = den.chance ?? 1;
      field(isPositive(chance) && chance <= 1, file, `${name}.chance`);
      const denAfter = optionalString(den, "after", file, `${name}.after`);
      return {
        point: pt,
        radius,
        kinds: [...kinds],
        chance,
        ...(denAfter === undefined ? {} : { after: denAfter }),
      };
    }),
  };
}

export function parseCritter(value: unknown, file: string): Critter {
  field(record(value), file, "object");
  const text = (object: Record<string, unknown>, key: string): string => string(object, key, file);
  const nonNeg = (object: Record<string, unknown>, key: string): number =>
    nonNegative(object, key, file);
  const toyScale = value.toyScale === undefined ? 1 : value.toyScale;
  field(isPositive(toyScale), file, "toyScale");
  const id = text(value, "id");
  const level = integerIn(value, "level", 1, file, "level");
  field(level <= 99, file, "level");
  const species = text(value, "species");
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
    return Object.fromEntries(keys.map((key) => [key, nonNeg(raw, key)]));
  };
  const burst = value.burst;
  field(record(burst), file, "burst");
  const burstValue = {
    bigChance: nonNeg(burst, "bigChance"),
    check: checkSpec(burst.check, file, "burst.check"),
    ...(burst.big === undefined ? {} : { big: checkSpec(burst.big, file, "burst.big") }),
  };
  field(burstValue.bigChance <= 1, file, "burst.bigChance");
  if (burstValue.big !== undefined)
    field(burstValue.big.kind === burstValue.check.kind, file, "burst.big.kind");
  const lines = value.lines;
  field(record(lines), file, "lines");
  const line = (key: string): string => text(lines, key);
  const feelings = critterFeelings(value.feelings, file);
  const talkRaw = value.talk;
  let talk: Critter["talk"] = null;
  if (talkRaw !== undefined && talkRaw !== null) {
    field(record(talkRaw) && record(talkRaw.calm) && array(talkRaw.knots), file, "talk");
    const knots = talkRaw.knots;
    field(
      knots.length === 3 && knots.every((item) => typeof item === "string" && item.length > 0),
      file, "talk.knots",
    );
    const calm = talkRaw.calm;
    const calmValue = (grade: Grade): number =>
      integerIn(calm, grade, 1, file, `talk.calm.${grade}`);
    const values = { great: calmValue("great"), good: calmValue("good"), miss: calmValue("miss") };
    field(values.great >= values.good && values.good >= values.miss, file, "talk.calm order");
    const talkAt = integerIn(talkRaw, "talkAt", 1, file, "talk.talkAt");
    field(talkAt < nonNeg(value, "calmMax"), file, "talk.talkAt");
    talk = {
      label: string(talkRaw, "label", file, "talk.label"),
      prompt: nonEmptyString(talkRaw, "prompt", file, "talk.prompt"),
      talkAt,
      knots: [String(knots[0] ?? ""), String(knots[1] ?? ""), String(knots[2] ?? "")],
      calm: values,
    };
  }
  const canRun = value.canRun ?? true;
  field(typeof canRun === "boolean", file, "canRun");
  const sootheRaw = command("soothe", ["calm", "great", "good"]);
  const snackRaw = command("snack", ["calm", "energy"]);
  const friendsRaw = commands.friends;
  field(record(friendsRaw), file, "commands.friends");
  const friends: Record<string, FriendCommand> = {};
  for (const [friendId, raw] of Object.entries(friendsRaw)) {
    field(record(raw), file, `commands.friends.${friendId}`);
    friends[friendId] = {
      calm: nonNeg(raw, "calm"),
      great: nonNeg(raw, "great"),
      good: nonNeg(raw, "good"),
      rest: nonNeg(raw, "rest"),
    };
  }
  const friendLinesRaw = lines.friends;
  field(record(friendLinesRaw), file, "lines.friends");
  const friendLines: Record<string, Record<Grade, string>> = {};
  for (const [friendId, raw] of Object.entries(friendLinesRaw))
    friendLines[friendId] = gradeMap(raw, file, `lines.friends.${friendId}`);
  return {
    id,
    level,
    species,
    name,
    calmName,
    atlas,
    auraCentre: pointField(value, "auraCentre", file),
    bodyCentre: pointField(value, "bodyCentre", file),
    figureHeight: nonNeg(value, "figureHeight"),
    toyScale,
    overworldHeight: nonNeg(value, "overworldHeight"),
    battleHeight: nonNeg(value, "battleHeight"),
    touchRadius: nonNeg(value, "touchRadius"),
    calmMax: nonNeg(value, "calmMax"),
    energyMax: nonNeg(value, "energyMax"),
    coins: nonNeg(value, "coins"),
    sticker: stickerValue,
    calmKnot,
    calmPrompt,
    feelings,
    commands: {
      soothe: {
        calm: nonNeg(sootheRaw, "calm"),
        great: nonNeg(sootheRaw, "great"),
        good: nonNeg(sootheRaw, "good"),
      },
      snack: {
        calm: nonNeg(snackRaw, "calm"),
        energy: nonNeg(snackRaw, "energy"),
      },
      friends,
    },
    burst: burstValue,
    windUp: critterWindUp(value.windUp, file, feelings.length),
    talk,
    canRun,
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
  const hints = value.hints;
  field(
    record(hints) &&
      typeof hints.charge === "string" &&
      typeof hints.chain === "string" &&
      typeof hints.catch === "string" &&
      typeof hints.lean === "string" &&
      typeof hints.trace === "string" &&
      typeof hints.peekaboo === "string" &&
      typeof hints.echo === "string" &&
      hints.echo.trim().length > 0,
    file,
    "hints",
  );
  const commands = value.commands;
  function command(id: "soothe"): BattleContent["commands"]["soothe"];
  function command(id: "snack"): BattleContent["commands"]["snack"];
  function command(id: "run"): BattleContent["commands"]["run"];
  function command(id: SharedCommandId): BattleContent["commands"][SharedCommandId] {
    const raw = commands[id];
    field(record(raw) && typeof raw.label === "string", file, `commands.${id}`);
    if (id === "soothe")
      return { label: raw.label, check: faeSideCheck(raw.check, file, "commands.soothe.check") };
    if (id === "snack") {
      field(typeof raw.snackDetail === "string", file, "commands.snack.snackDetail");
      return { label: raw.label, snackDetail: raw.snackDetail };
    }
    return { label: raw.label };
  }
  const rewards = value.rewards;
  field(
    record(rewards) && typeof rewards.sticker === "string" &&
      typeof rewards.coins === "string" && rewards.coins.includes("{coins}"),
    file,
    "rewards",
  );
  const toyAtlas = value.toyAtlas;
  field(typeof toyAtlas === "string" && toyAtlas.endsWith(".json"), file, "toyAtlas");
  // All five feelings, each with its label and the command that answers it.
  const feelings = value.feelings;
  field(record(feelings) && Object.keys(feelings).every(isFeelingId), file, "feelings");
  const feeling = (id: FeelingId): { label: string; answer: string } => {
    const raw = feelings[id];
    field(record(raw) && typeof raw.label === "string" && raw.label !== "" &&
      typeof raw.answer === "string", file, `feelings.${id}`);
    return { label: raw.label, answer: raw.answer };
  };
  const feelingBonus = value.feelingBonus;
  field(typeof feelingBonus === "number" && Number.isInteger(feelingBonus) && feelingBonus >= 0,
    file, "feelingBonus");
  // Meeting a recurring critter (Milestone 51): lines that name it, the calm
  // a surprise is worth, and how many calms make a species old friends.
  const named = (raw: unknown, name: string): string => {
    field(typeof raw === "string" && raw.includes("{name}"), file, name);
    return raw;
  };
  const touch = value.firstTouch;
  field(record(touch) && record(touch.lines), file, "firstTouch");
  const surprise = touch.surprise;
  field(typeof surprise === "number" && Number.isInteger(surprise) && surprise > 0, file,
    "firstTouch.surprise");
  const friends = value.oldFriends;
  field(record(friends), file, "oldFriends");
  const calms = friends.calms;
  field(typeof calms === "number" && Number.isInteger(calms) && calms >= 1, file,
    "oldFriends.calms");
  const nonEmpty = (raw: unknown, name: string): string => {
    field(typeof raw === "string" && raw.trim().length > 0, file, name);
    return raw;
  };
  const togetherRaw = value.together;
  field(record(togetherRaw), file, "together");
  const chargeMax = integerIn(togetherRaw, "chargeMax", 1, file, "together.chargeMax");
  const togetherCheck = faeSideCheck(togetherRaw.check, file, "together.check");
  field(togetherCheck.kind === "chain", file, "together.check.kind");
  const togetherLines = gradeMap(togetherRaw.lines, file, "together.lines");
  field(
    togetherLines.great.trim().length > 0 &&
      togetherLines.good.trim().length > 0 &&
      togetherLines.miss.trim().length > 0,
    file,
    "together.lines",
  );
  const fluteRaw = value.fluteAssist;
  field(record(fluteRaw) && record(fluteRaw.lines), file, "fluteAssist");
  const lassoRaw = value.lassoAssist;
  field(record(lassoRaw) && record(lassoRaw.lines), file, "lassoAssist");
  return {
    toyAtlas,
    hints: {
      charge: hints.charge,
      chain: hints.chain,
      catch: hints.catch,
      lean: hints.lean,
      trace: hints.trace,
      peekaboo: hints.peekaboo,
      echo: hints.echo,
    },
    commands: {
      soothe: command("soothe"),
      snack: command("snack"),
      run: command("run"),
    },
    feelings: {
      zoomy: feeling("zoomy"),
      curious: feeling("curious"),
      bored: feeling("bored"),
      grumpy: feeling("grumpy"),
      hungry: feeling("hungry"),
    },
    feelingBonus,
    firstTouch: {
      surprise,
      lines: {
        surprised: named(touch.lines.surprised, "firstTouch.lines.surprised"),
        caught: named(touch.lines.caught, "firstTouch.lines.caught"),
      },
    },
    oldFriends: { calms, line: named(friends.line, "oldFriends.line") },
    rewards: { sticker: rewards.sticker, coins: rewards.coins },
    together: {
      chargeMax,
      label: nonEmpty(togetherRaw.label, "together.label"),
      hint: nonEmpty(togetherRaw.hint, "together.hint"),
      check: togetherCheck,
      lines: togetherLines,
    },
    fluteAssist: {
      pupCalm: integerIn(fluteRaw, "pupCalm", 1, file, "fluteAssist.pupCalm"),
      squirrelEnergy: integerIn(fluteRaw, "squirrelEnergy", 1, file, "fluteAssist.squirrelEnergy"),
      squirrelSoften: integerIn(fluteRaw, "squirrelSoften", 1, file, "fluteAssist.squirrelSoften"),
      bunnyCalm: integerIn(fluteRaw, "bunnyCalm", 1, file, "fluteAssist.bunnyCalm"),
      bunnyTogether: integerIn(fluteRaw, "bunnyTogether", 1, file, "fluteAssist.bunnyTogether"),
      lines: {
        pup: nonEmpty(fluteRaw.lines.pup, "fluteAssist.lines.pup"),
        squirrel: nonEmpty(fluteRaw.lines.squirrel, "fluteAssist.lines.squirrel"),
        bunny: nonEmpty(fluteRaw.lines.bunny, "fluteAssist.lines.bunny"),
        both: nonEmpty(fluteRaw.lines.both, "fluteAssist.lines.both"),
        pupBunny: nonEmpty(fluteRaw.lines.pupBunny, "fluteAssist.lines.pupBunny"),
        squirrelBunny: nonEmpty(fluteRaw.lines.squirrelBunny, "fluteAssist.lines.squirrelBunny"),
        all: nonEmpty(fluteRaw.lines.all, "fluteAssist.lines.all"),
      },
    },
    lassoAssist: {
      calm: integerIn(lassoRaw, "calm", 1, file, "lassoAssist.calm"),
      coins: integerIn(lassoRaw, "coins", 1, file, "lassoAssist.coins"),
      lines: {
        windUp: nonEmpty(lassoRaw.lines.windUp, "lassoAssist.lines.windUp"),
        snag: nonEmpty(lassoRaw.lines.snag, "lassoAssist.lines.snag"),
      },
    },
  };
}

const feelingIds: FeelingId[] = ["zoomy", "curious", "bored", "grumpy", "hungry"];
function isFeelingId(value: unknown): value is FeelingId {
  return feelingIds.some((id) => id === value);
}

// A critter kind's feelings (spec 8): one or more, none twice.
function critterFeelings(value: unknown, file: string): FeelingId[] {
  field(Array.isArray(value) && value.length > 0 && value.every(isFeelingId) &&
    new Set(value).size === value.length, file, "feelings");
  return [...value];
}

// A mini-boss's wind-up (spec 8, Milestone 50), or null without one: never on
// the first turn, at least one plain turn between two, and no more bubbles
// than the kind has feelings.
function critterWindUp(value: unknown, file: string, feelings: number): WindUp | null {
  if (value === undefined || value === null) return null;
  field(record(value), file, "windUp");
  const start = integerIn(value, "start", 2, file, "windUp.start");
  const every = integer(value, "every", file, "windUp.every");
  const bubbles = integerIn(value, "bubbles", 1, file, "windUp.bubbles");
  field(bubbles <= feelings, file, "windUp.bubbles");
  field(every > bubbles, file, "windUp.every");
  const lines = value.lines;
  field(record(lines), file, "windUp.lines");
  const line = (key: string): string => nonEmptyString(lines, key, file, `windUp.lines.${key}`);
  return {
    start,
    every,
    bubbles,
    lines: { start: line("start"), puffing: line("puffing"), fizzle: line("fizzle") },
  };
}

// Every feeling's answer is a command Fae can have: Soothe, Snack, or a
// friend's (spec 8). Run answers nothing.
export function feelingErrors(
  battle: BattleContent,
  party: Record<string, PartyContent>,
): string[] {
  const friends = Object.values(party)
    .flatMap((member) => member.command === null ? [] : [member.command.id]);
  const commands = ["soothe", "snack", ...friends];
  return Object.entries(battle.feelings).flatMap(([id, feeling]) =>
    commands.includes(feeling.answer)
      ? []
      : [`content/battle.json: feelings.${id}.answer ${feeling.answer} isn't Soothe, ` +
        "Snack, or a friend's command"]);
}

export function parsePartyMember(value: unknown, file: string): PartyContent {
  field(record(value), file, "object");
  const text = (object: Record<string, unknown>, name: string): string =>
    nonEmptyString(object, name, file, name);
  const size = (object: Record<string, unknown>, name: string): number =>
    positive(object, name, file, name);
  const memberBox = value.box;
  field(record(memberBox), file, "box");
  const flute = value.flute ?? false;
  field(typeof flute === "boolean", file, "flute");
  const command = value.command;
  field(flute ? command === null : record(command), file, "command");
  field(!flute || typeof value.joins === "string", file, "flute/joins");
  const critter = value.critter ?? null;
  field(critter === null || (flute && typeof critter === "string"), file, "critter");
  const sits = boolean(value, "sits", file);
  const start = boolean(value, "start", file);
  field(value.joins === null || typeof value.joins === "string", file, "joins");
  const befriended = optionalString(value, "befriended", file);
  field(!flute || typeof befriended === "string", file, "flute/befriended");
  field(
    (start && value.joins === null) || (!start && typeof value.joins === "string"),
    file,
    "start/joins",
  );
  const scale = value.scale;
  field(scale === undefined || isPositive(scale), file, "scale");
  return {
    id: text(value, "id"),
    name: text(value, "name"),
    atlas: text(value, "atlas"),
    box: { width: size(memberBox, "width"), height: size(memberBox, "height") },
    walkCycleUnits: size(value, "walkCycleUnits"),
    sits,
    start,
    joins: value.joins,
    ...(befriended === undefined ? {} : { befriended }),
    flute,
    critter,
    command: record(command)
      ? {
          id: text(command, "id"),
          label: text(command, "label"),
          resting: text(command, "resting"),
          check: faeSideCheck(command.check, file, "command.check"),
        }
      : null,
    ...(scale === undefined ? {} : { scale }),
  };
}

export function partyJoinErrors(
  party: Record<string, PartyContent>,
  storyVariable: (name: string) => unknown,
): string[] {
  return Object.values(party).flatMap((member) =>
    [
      ...(member.joins !== null && storyVariable(member.joins) === undefined
        ? [`party ${member.id}: joins variable ${member.joins} is not declared`] : []),
      ...(member.befriended !== undefined && storyVariable(member.befriended) === undefined
        ? [`party ${member.id}: befriended variable ${member.befriended} is not declared`] : []),
    ],
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
    if (member.critter !== null && critters[member.critter] === undefined)
      errors.push(`party ${member.id}: no critter ${member.critter}`);
    if (member.command === null) continue;
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
      if (den.after !== undefined && !placed.has(den.after) && !species.has(den.after))
        errors.push(`${area.id}: den ${index} after ${den.after} is neither a set piece ` +
          `nor a species`);
    });
    for (const npc of area.npcs) {
      if (npc.visibleWhenCalmed !== undefined && critters[npc.visibleWhenCalmed] === undefined)
        errors.push(`${area.id}: npc ${npc.id} visibleWhenCalmed ${npc.visibleWhenCalmed} ` +
          `isn't a critter kind`);
    }
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
    ...(variables === undefined
      ? {}
      : { variables: parsedVariables }),
    ...(rawCalms === undefined
      ? {}
      : { calms: parsedCalms }),
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
      record(item) && typeof item.id === "string" && isFiniteNumber(item.x) &&
        isFiniteNumber(item.y),
      file, label,
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
      array(ticks) &&
        ticks.length > 0 &&
        ticks.every((tick): tick is number => isInteger(tick) && tick > 0),
      file, `${id}.idleTicks`,
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
  areas: Record<string, Area>, data: Record<string, unknown>,
): Record<string, import("../core").SurfaceMap> {
  const result: Record<string, import("../core").SurfaceMap> = {};
  for (const area of Object.values(areas)) {
    const path = `content/surfaces/${area.id}.json`;
    const value = data[area.id];
    if (value === undefined)
      throw new Error(`${path} is missing; it must be registered in src/content/load.ts`);
    result[area.id] = parseSurfaceMap(value, path, area.width, area.height);
  }
  return result;
}

function parseLevels(value: unknown, file: string): LevelContent {
  field(record(value), file, "object");
  const rawThresholds = value.thresholds;
  field(
    array(rawThresholds) &&
      rawThresholds.length === 99 &&
      rawThresholds.every((item): item is number => isInteger(item) && item >= 0),
    file,
    "thresholds",
  );
  const rawStats = value.stats;
  field(record(rawStats), file, "stats");
  const stat = (name: string): number => integerIn(rawStats, name, 0, file, `stats.${name}`);
  const rawCritters = value.critters;
  field(record(rawCritters), file, "critters");
  const critters: LevelContent["critters"] = {};
  for (const [id, raw] of Object.entries(rawCritters)) {
    field(record(raw), file, `critters.${id}`);
    const intVal = (name: string): number =>
      integerIn(raw, name, 0, file, `critters.${id}.${name}`);
    const level = integerIn(raw, "level", 1, file, `critters.${id}.level`);
    field(level <= 99, file, `critters.${id}.level`);
    critters[id] = {
      level, calmMax: intVal("calmMax"), burst: intVal("burst"),
      bigBurst: intVal("bigBurst"), xp: intVal("xp"),
    };
  }
  const rawCommands = rawStats.commands;
  field(record(rawCommands), file, "stats.commands");
  const commands: LevelContent["stats"]["commands"] = {};
  for (const [id, raw] of Object.entries(rawCommands)) {
    field(record(raw), file, `stats.commands.${id}`);
    const intVal = (name: string): number =>
      integerIn(raw, name, 0, file, `stats.commands.${id}.${name}`);
    commands[id] = {
      powerBase: intVal("powerBase"), powerPerLevel: intVal("powerPerLevel"),
      magicBase: intVal("magicBase"), magicPerLevel: intVal("magicPerLevel"),
    };
  }
  return {
    thresholds: [...rawThresholds],
    stats: {
      lifeBase: stat("lifeBase"), lifeEvery: stat("lifeEvery"), guardEvery: stat("guardEvery"),
      commands,
    },
    critters,
  };
}

export function parseTreats(
  value: unknown,
  file: string,
  critters: Record<string, Critter>,
): TreatItem[] {
  field(record(value) && array(value.treats) && value.treats.length > 0, file, "treats");
  const species = new Set(Object.values(critters).map((critter) => critter.species));
  const seen = new Set<string>();
  return value.treats.map((item, index): TreatItem => {
    const label = `treats[${index}]`;
    field(record(item), file, label);
    const id = nonEmptyString(item, "id", file, `${label}.id`);
    field(/^[a-z][a-z0-9-]*$/.test(id) && id !== "snack" && id !== "back", file, `${label}.id`);
    field(!seen.has(id), file, `${label}.id (duplicate ${id})`);
    seen.add(id);
    const price = integerIn(item, "price", 1, file, `${label}.price`);
    const energy = integerIn(item, "energy", 1, file, `${label}.energy`);
    const calm = integerIn(item, "calm", 1, file, `${label}.calm`);
    const favouriteCalm = integerIn(item, "favouriteCalm", calm, file, `${label}.favouriteCalm`);
    const rawFavourites = item.favourites;
    field(strings(rawFavourites) && rawFavourites.length > 0, file, `${label}.favourites`);
    const favSeen = new Set<string>();
    for (const entry of rawFavourites) {
      field(species.has(entry), file, `${label}.favourites (unknown species ${entry})`);
      field(!favSeen.has(entry), file, `${label}.favourites (duplicate species ${entry})`);
      favSeen.add(entry);
    }
    return {
      id,
      name: nonEmptyString(item, "name", file, `${label}.name`),
      price,
      energy,
      calm,
      favouriteCalm,
      favourites: [...rawFavourites],
      description: nonEmptyString(item, "description", file, `${label}.description`),
      useLine: nonEmptyString(item, "useLine", file, `${label}.useLine`),
      favouriteLine: nonEmptyString(item, "favouriteLine", file, `${label}.favouriteLine`),
    };
  });
}

export function loadContent(): {
  world: World;
  fixtures: Record<string, Fixture>;
} {
  const levels = parseLevels(levelsData, "content/levels.json");
  const harness = parseArea(areaData, "content/areas/harness.json");
  const bedroom = parseArea(bedroomData, "content/areas/bedroom.json",
    parsePropCatalogue(bedroomPropsData, "content/props/bedroom.json"));
  const plaza = parseArea(plazaData, "content/areas/plaza.json",
    parsePropCatalogue(plazaPropsData, "content/props/plaza.json"));
  const kitchen = parseArea(kitchenData, "content/areas/kitchen.json",
    parsePropCatalogue(kitchenPropsData, "content/props/kitchen.json"));
  const park = parseArea(parkData, "content/areas/park.json",
    parsePropCatalogue(parkPropsData, "content/props/park.json"));
  const school = parseArea(schoolData, "content/areas/school.json",
    parsePropCatalogue(schoolPropsData, "content/props/school.json"));
  const classroom = parseArea(classroomData, "content/areas/classroom.json",
    parsePropCatalogue(classroomPropsData, "content/props/classroom.json"));
  const gym = parseArea(gymData, "content/areas/gym.json",
    parsePropCatalogue(gymPropsData, "content/props/gym.json"));
  const bay = parseArea(bayData, "content/areas/bay.json",
    parsePropCatalogue(bayPropsData, "content/props/bay.json"));
  Object.defineProperty(bay.spawns, "bus-stop", {
    value: { x: 355, y: 545, facing: "down" },
    enumerable: false,
  });
  const pass = parseArea(passData, "content/areas/pass.json",
    parsePropCatalogue(passPropsData, "content/props/pass.json"));
  const trail = parseArea(trailData, "content/areas/trail.json",
    parsePropCatalogue(trailPropsData, "content/props/trail.json"));
  const woods = parseArea(woodsData, "content/areas/woods.json",
    parsePropCatalogue(woodsPropsData, "content/props/woods.json"));
  const arcade = parseArea(arcadeData, "content/areas/arcade.json",
    parsePropCatalogue(arcadePropsData, "content/props/arcade.json"));
  const eastHall = parseArea(eastHallData, "content/areas/east-hall.json",
    parsePropCatalogue(eastHallPropsData, "content/props/east-hall.json"));
  const music = parseArea(musicData, "content/areas/music.json",
    parsePropCatalogue(musicPropsData, "content/props/music.json"));
  const playingField = parseArea(fieldData, "content/areas/field.json",
    parsePropCatalogue(fieldPropsData, "content/props/field.json"));
  const clubhouse = parseArea(clubhouseData, "content/areas/clubhouse.json",
    parsePropCatalogue(clubhousePropsData, "content/props/clubhouse.json"));
  const lodge = parseArea(lodgeData, "content/areas/lodge.json",
    parsePropCatalogue(lodgePropsData, "content/props/lodge.json"));
  const mist = parseArea(mistData, "content/areas/mist.json",
    parsePropCatalogue(mistPropsData, "content/props/mist.json"));
  const enchanted = parseArea(enchantedData, "content/areas/enchanted.json",
    parsePropCatalogue(enchantedPropsData, "content/props/enchanted.json"));
  const hills = parseArea(hillsData, "content/areas/hills.json",
    parsePropCatalogue(hillsPropsData, "content/props/hills.json"));
  const sanctuary = parseArea(sanctuaryData, "content/areas/sanctuary.json",
    parsePropCatalogue(sanctuaryPropsData, "content/props/sanctuary.json"));
  const cavern = parseArea(cavernData, "content/areas/cavern.json",
    parsePropCatalogue(cavernPropsData, "content/props/cavern.json"));
  const cafe = parseArea(cafeData, "content/areas/cafe.json",
    parsePropCatalogue(cafePropsData, "content/props/cafe.json"));
  const sueCottage = parseArea(sueCottageData, "content/areas/sue-cottage.json",
    parsePropCatalogue(sueCottagePropsData, "content/props/sue-cottage.json"));
  const jordanCabin = parseArea(jordanCabinData, "content/areas/jordan-cabin.json",
    parsePropCatalogue(jordanCabinPropsData, "content/props/jordan-cabin.json"));
  const artRoom = parseArea(artRoomData, "content/areas/art-room.json",
    parsePropCatalogue(artRoomPropsData, "content/props/art-room.json"));
  field(
    Array.isArray(landsData) &&
      landsData.every(
        (land) =>
          record(land) && typeof land.id === "string" && typeof land.name === "string" &&
          (!("busStop" in land) || typeof land.busStop === "boolean") &&
          (!("revealVariable" in land) || typeof land.revealVariable === "string"),
      ),
    "content/lands.json",
    "lands",
  );
  const lands = landsData.map((land) => ({
    id: land.id,
    name: land.name,
    busStop: "busStop" in land && land.busStop === true,
    ...(typeof land.revealVariable === "string" ? { revealVariable: land.revealVariable } : {}),
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
    [lambData, "lamb"],
    [hedgehogData, "hedgehog"],
    [squirrelData, "squirrel"],
    [gullData, "gull"],
    [owlData, "owl"],
    [arcadeKeeperData, "arcade-keeper"],
    [lodgeKeeperData, "lodge-keeper"],
    [lifeguardData, "lifeguard"],
    [gymPupData, "gym-pup"],
    [musicBirdData, "music-bird"],
    [oakSquirrelData, "oak-squirrel"],
    [hoodedKidData, "hooded-kid"],
    [artTeacherData, "art-teacher"],
    [crabData, "crab"],
    [penguinData, "penguin"],
    [principalData, "principal"],
    [batData, "bat"],
    [crystalMoleData, "crystal-mole"],
    [moonOwlData, "moon-owl"],
    [tacoChefData, "taco-chef"],
  ];
  const critters: Record<string, Critter> = {};
  for (const [data, name] of critterFiles) {
    const file = `content/critters/${name}.json`;
    const critter = parseCritter(data, file);
    field(critter.id === name, file, "id (it must be the file's name)");
    const levelData = levels.critters[critter.id];
    field(levelData !== undefined, file, "missing level table entry");
    if (levelData !== undefined)
      field(levelData.level === critter.level, file, "level must match content/levels.json");
    critters[critter.id] = critter;
  }
  const battle = parseBattleContent(battleData, "content/battle.json");
  const treats = parseTreats(treatsData, "content/treats.json", critters);
  const arcadeGames = parseArcade(arcadeGameData, prizesData);
  const stickers = parseStickers(stickerData, "content/stickers.json");
  const characters = parseCharacters(charactersData, "content/characters.json");
  const maddie = parsePartyMember(maddieData, "content/party/maddie.json");
  const sue = parsePartyMember(sueData, "content/party/sue.json");
  const jordan = parsePartyMember(jordanData, "content/party/jordan.json");
  const pondPup = parsePartyMember(pondPupData, "content/party/pond-pup.json");
  const acornSquirrel = parsePartyMember(acornSquirrelData,
    "content/party/acorn-squirrel.json");
  const ribbonBunny = parsePartyMember(ribbonBunnyData,
    "content/party/ribbon-bunny.json");
  const party = {
    [maddie.id]: maddie, [sue.id]: sue, [jordan.id]: jordan, [pondPup.id]: pondPup,
    [acornSquirrel.id]: acornSquirrel, [ribbonBunny.id]: ribbonBunny,
  };
  const storyVariable = createStoryReader(story);
  const initialInk = createInkState(story, 1);
  const joinProblems = partyJoinErrors(party, (name) =>
    storyVariable(initialInk, name),
  );
  if (joinProblems.length > 0)
    throw new Error(`content/party: ${joinProblems.join("; ")}`);
  const partyProblems = [...partyErrors(party, critters), ...feelingErrors(battle, party)];
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
    hills: parseFixture(hillsFixtureData, "content/fixtures/hills.json"),
    woods: parseFixture(woodsFixtureData, "content/fixtures/woods.json"),
    "park-east": parseFixture(parkEastFixtureData, "content/fixtures/park-east.json"),
    "hills-north": parseFixture(hillsNorthFixtureData, "content/fixtures/hills-north.json"),
    "hills-calm": parseFixture(hillsCalmFixtureData, "content/fixtures/hills-calm.json"),
    "hills-lookout-qa": parseFixture(
      hillsLookoutQaFixtureData,
      "content/fixtures/hills-lookout-qa.json",
    ),
    kitchen: parseFixture(kitchenFixtureData, "content/fixtures/kitchen.json"),
    classroom: parseFixture(classroomFixtureData, "content/fixtures/classroom.json"),
    gym: parseFixture(gymFixtureData, "content/fixtures/gym.json"),
    "east-hall": parseFixture(eastHallFixtureData, "content/fixtures/east-hall.json"),
    clubhouse: parseFixture(clubhouseFixtureData, "content/fixtures/clubhouse.json"),
    lodge: parseFixture(lodgeFixtureData, "content/fixtures/lodge.json"),
    music: parseFixture(musicFixtureData, "content/fixtures/music.json"),
    arcade: parseFixture(arcadeFixtureData, "content/fixtures/arcade.json"),
    cavern: parseFixture(cavernFixtureData, "content/fixtures/cavern.json"),
    cafe: parseFixture(cafeFixtureData, "content/fixtures/cafe.json"),
    sanctuary: parseFixture(sanctuaryFixtureData, "content/fixtures/sanctuary.json"),
    "sue-cottage": parseFixture(sueCottageFixtureData, "content/fixtures/sue-cottage.json"),
    "jordan-cabin": parseFixture(jordanCabinFixtureData, "content/fixtures/jordan-cabin.json"),
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
    [eastHall.id]: eastHall,
    [music.id]: music,
    [playingField.id]: playingField,
    [clubhouse.id]: clubhouse,
    [lodge.id]: lodge,
    [artRoom.id]: artRoom,
    [mist.id]: mist,
    [enchanted.id]: enchanted,
    [hills.id]: hills,
    [sanctuary.id]: sanctuary,
    [cavern.id]: cavern,
    [cafe.id]: cafe,
    [sueCottage.id]: sueCottage,
    [jordanCabin.id]: jordanCabin,
  };
  const surfaceData: Record<string, unknown> = {
    harness: harnessSurfaceData, bedroom: bedroomSurfaceData, plaza: plazaSurfaceData,
    kitchen: kitchenSurfaceData, park: parkSurfaceData, school: schoolSurfaceData,
    classroom: classroomSurfaceData, gym: gymSurfaceData, bay: baySurfaceData,
    pass: passSurfaceData, trail: trailSurfaceData, woods: woodsSurfaceData,
    arcade: arcadeSurfaceData, "east-hall": eastHallSurfaceData, music: musicSurfaceData,
    field: fieldSurfaceData, clubhouse: clubhouseSurfaceData, lodge: lodgeSurfaceData,
    mist: mistSurfaceData,
    enchanted: enchantedSurfaceData,
    hills: hillsSurfaceData,
    sanctuary: sanctuarySurfaceData,
    cavern: cavernSurfaceData,
    cafe: cafeSurfaceData,
    "sue-cottage": sueCottageSurfaceData,
    "jordan-cabin": jordanCabinSurfaceData,
    "art-room": artRoomSurfaceData,
  };
  const surfaces = completeSurfaceMaps(areas, surfaceData);
  const ruleProblems = propRuleErrors(areas, (name) => storyVariable(initialInk, name));
  if (ruleProblems.length > 0) throw new Error(`content/areas: ${ruleProblems.join("; ")}`);
  const critterProblems = critterErrors(areas, critters, stickers);
  if (critterProblems.length > 0)
    throw new Error(`content/critters: ${critterProblems.join("; ")}`);
  const tagProblems = storyTagErrors(
    storyTags(story),
    areas,
    Object.fromEntries(arcadeGames.counter.prizes.map((item) => [item.prize, item.price])),
    Object.fromEntries(treats.map((item) => [item.id, item.price])),
  );
  if (tagProblems.length > 0)
    throw new Error(`content/story/main.ink: ${tagProblems.join("; ")}`);
  const talkProblems = talkErrors(story, initialInk, Object.values(critters));
  if (talkProblems.length > 0)
    throw new Error(`content/critters: ${talkProblems.join("; ")}`);
  const endingProblems = endingContentErrors(story, areas);
  if (endingProblems.length > 0)
    throw new Error(`content/story/main.ink: ${endingProblems.join("; ")}`);
  return {
    world: {
      tunables: parseTunables(tunableData, "content/tunables.json"),
      areas,
      surfaces,
      lands,
      story,
      critters,
      battle,
      stickers,
      characters,
      party,
      storyVariable,
      arcade: arcadeGames,
      levels,
      treats,
    },
    fixtures,
  };
}
