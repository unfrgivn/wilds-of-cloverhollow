import {
  array, boxesApart, calibrationHeader, calibrationRect, field, insideBox, integerIn,
  isFiniteNumber, isPositive, number, pointField, record, strings, type Box,
} from "./parsers";
import type {
  CookCalibration, CookContent, CookDish, CookZone, FishCalibration, FishCatchSpec,
  FishContent, FishRarity, TacoCalibration, TacoContent,
} from "../core";

// The clubhouse microwave (spec 8.2): positive integers throughout; each dish
// frozen, then under, golden, and over in turn before it burns, and stopped
// after that; every way out pays a snack or more, and says how many; the start
// line names the box's `{time}`.
export function parseCook(value: unknown, file: string): CookContent {
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

export function parseFish(value: unknown, file: string): FishContent {
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

export function parseTaco(value: unknown, file: string): TacoContent {
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
