import type { MoleHole } from "../core/mole";
import {
  array,
  box,
  boxesApart,
  calibrationHeader,
  calibrationRect,
  edge,
  field,
  insideBox,
  integerBox,
  integerIn,
  isFiniteNumber,
  isPositive,
  number,
  pointField,
  pointTuple,
  record,
  strings,
  type Box,
} from "./parsers";
import type {
  ArcadeContent,
  ClawCalibration,
  CometCalibration,
  CometContent,
  CookCalibration,
  CookContent,
  CookDish,
  CookZone,
  CounterContent,
  FishCalibration,
  FishCatchSpec,
  FishContent,
  FishRarity,
  HeapPlush,
  MoleCalibration,
  MoleContent,
  SkeeCalibration,
  SkeeContent,
  TacoCalibration,
  TacoContent,
} from "../core";

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
    taco: parseTaco(value.taco, file),
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
  let trade: FishContent["trade"];
  if (value.trade !== undefined) {
    field(record(value.trade), file, "fish.trade");
    trade = {
      ticketsPerCatch: integer(value.trade, "ticketsPerCatch", 1, "fish.trade.ticketsPerCatch"),
      coinsPerCatch: integer(value.trade, "coinsPerCatch", 1, "fish.trade.coinsPerCatch"),
    };
  }
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
    ...(trade === undefined ? {} : { trade }),
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

function parseTaco(value: unknown, file: string): TacoContent {
  field(record(value), file, "taco");
  const integer = (source: Record<string, unknown>, name: string, minimum: number,
    label = `taco.${name}`): number => integerIn(source, name, minimum, file, label);
  const orders = integer(value, "orders", 1);
  field(array(value.orderSizes) && value.orderSizes.length >= orders, file, "taco.orderSizes");
  const orderSizes = value.orderSizes.map((item, index) => {
    field(typeof item === "number" && Number.isInteger(item) && item >= 1, file,
      `taco.orderSizes[${index}]`);
    return item;
  });
  field(strings(value.customers) && value.customers.length >= orders &&
    value.customers.every((item) => item.trim().length > 0), file, "taco.customers");
  const toppings = value.toppings;
  field(record(toppings) &&
    typeof toppings.beans === "string" && toppings.beans.length > 0 &&
    typeof toppings.cheese === "string" && toppings.cheese.length > 0 &&
    typeof toppings.salsa === "string" && toppings.salsa.length > 0 &&
    typeof toppings.avocado === "string" && toppings.avocado.length > 0,
  file, "taco.toppings");
  const lines = value.lines;
  field(record(lines) &&
    typeof lines.ready === "string" && typeof lines.serving === "string" &&
    typeof lines.oops === "string" && typeof lines.orderUp === "string" &&
    lines.orderUp.includes("{customer}") &&
    typeof lines.spotless === "string" && lines.spotless.includes("{coins}") &&
    lines.spotless.includes("{snacks}") &&
    typeof lines.great === "string" && lines.great.includes("{orders}") &&
    lines.great.includes("{coins}") && lines.great.includes("{snacks}") &&
    typeof lines.good === "string" && lines.good.includes("{orders}") &&
    lines.good.includes("{coins}") && typeof lines.timeUp === "string",
  file, "taco.lines");
  return {
    orders,
    orderSizes,
    shiftTicks: integer(value, "shiftTicks", 60),
    clearTicks: integer(value, "clearTicks", 1),
    oopsTicks: integer(value, "oopsTicks", 1),
    coinsPerOrder: integer(value, "coinsPerOrder", 1),
    snacksTwoOrders: integer(value, "snacksTwoOrders", 0),
    snacksSpotless: integer(value, "snacksSpotless", 0),
    customers: [...value.customers],
    toppings: {
      beans: toppings.beans,
      cheese: toppings.cheese,
      salsa: toppings.salsa,
      avocado: toppings.avocado,
    },
    lines: {
      ready: lines.ready,
      serving: lines.serving,
      oops: lines.oops,
      orderUp: lines.orderUp,
      spotless: lines.spotless,
      great: lines.great,
      good: lines.good,
      timeUp: lines.timeUp,
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

export function parseTacoCalibration(value: unknown, file: string): TacoCalibration {
  const { raw, image, size, bounds } = calibrationHeader(value, file, { positiveSize: true });
  const servingWindow = calibrationRect(raw, "window", bounds, file);
  const placemat = calibrationRect(raw, "placemat", bounds, file);
  const front = calibrationRect(raw, "front", bounds, file);
  const counterY = number(raw, "counterY", file);
  field(
    counterY >= servingWindow.y + servingWindow.h && counterY <= placemat.y,
    file,
    "counterY",
  );
  field(front.y >= counterY, file, "front");
  return { image, size, servingWindow, counterY, placemat, front };
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
