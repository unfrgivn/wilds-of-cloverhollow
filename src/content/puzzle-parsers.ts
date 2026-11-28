import type {
  AreaPuzzles,
  Direction,
  GrapplePostDef,
  GrapplePostKind,
  PressurePlateDef,
  PrismEmitterDef,
  PrismMirrorDef,
  PrismOrientation,
  PrismReceiverDef,
  PushableDef,
  PushableKind,
  PuzzleGoalDef,
  ResonanceBellDef,
  ResonanceBellStyle,
  SteppingStoneGroupDef,
  VineBridgeDef,
  VineBridgeStyle,
} from "../core";
import {
  array,
  direction,
  field,
  isInteger,
  isPositive,
  nonEmptyString,
  number,
  point,
  polygon,
  record,
  strings,
} from "./parsers";

function isPushableKind(value: unknown): value is PushableKind {
  return value === "rock" || value === "crate" || value === "snowball";
}

function isPrismOrientation(value: unknown): value is PrismOrientation {
  return value === "ne" || value === "se" || value === "sw" || value === "nw";
}

function isBellStyle(value: unknown): value is ResonanceBellStyle {
  return value === "bell" || value === "seashell" || value === "shrine";
}

function isGrappleKind(value: unknown): value is GrapplePostKind {
  return value === "post" || value === "lever" || value === "swing";
}

function isBridgeStyle(value: unknown): value is VineBridgeStyle {
  return value === "vine" || value === "barrier";
}

function optionalPositive(
  source: Record<string, unknown>,
  key: string,
  file: string,
  label: string,
): number | undefined {
  const item = source[key];
  if (item === undefined) return undefined;
  field(isPositive(item), file, label);
  return item;
}

function optionalBoolean(
  source: Record<string, unknown>,
  key: string,
  file: string,
  label: string,
): boolean | undefined {
  const item = source[key];
  if (item === undefined) return undefined;
  field(typeof item === "boolean", file, label);
  return item;
}

function optionalNonEmptyString(
  source: Record<string, unknown>,
  key: string,
  file: string,
  label: string,
): string | undefined {
  const item = source[key];
  if (item === undefined) return undefined;
  field(typeof item === "string" && item.trim().length > 0, file, label);
  return item;
}

function optionalStringList(
  source: Record<string, unknown>,
  key: string,
  file: string,
  label: string,
): string[] | undefined {
  const item = source[key];
  if (item === undefined) return undefined;
  field(strings(item) && item.every((entry) => entry.trim().length > 0), file, label);
  return [...item];
}

function parseUniqueIds(ids: string[], file: string, section: string): Set<string> {
  const seen = new Set<string>();
  for (const id of ids) {
    field(!seen.has(id), file, `${section}.${id} (duplicate id)`);
    seen.add(id);
  }
  return seen;
}

function parsePushables(value: unknown, file: string): PushableDef[] | undefined {
  if (value === undefined) return undefined;
  field(array(value), file, "puzzles.pushables");
  return value.map((item, index) => {
    const label = `puzzles.pushables[${index}]`;
    field(record(item), file, label);
    const id = nonEmptyString(item, "id", file, `${label}.id`);
    field(isPushableKind(item.kind), file, `${label}.kind`);
    const x = number(item, "x", file, `${label}.x`);
    const y = number(item, "y", file, `${label}.y`);
    const radius = optionalPositive(item, "radius", file, `${label}.radius`);
    const slides = optionalBoolean(item, "slides", file, `${label}.slides`);
    const lassoable = optionalBoolean(item, "lassoable", file, `${label}.lassoable`);
    return {
      id,
      kind: item.kind,
      x,
      y,
      ...(radius === undefined ? {} : { radius }),
      ...(slides === undefined ? {} : { slides }),
      ...(lassoable === undefined ? {} : { lassoable }),
    };
  });
}

function parsePlates(value: unknown, file: string): PressurePlateDef[] | undefined {
  if (value === undefined) return undefined;
  field(array(value), file, "puzzles.plates");
  return value.map((item, index) => {
    const label = `puzzles.plates[${index}]`;
    field(record(item), file, label);
    const id = nonEmptyString(item, "id", file, `${label}.id`);
    const x = number(item, "x", file, `${label}.x`);
    const y = number(item, "y", file, `${label}.y`);
    const radius = optionalPositive(item, "radius", file, `${label}.radius`);
    const companionHold = optionalBoolean(item, "companionHold", file, `${label}.companionHold`);
    const preferredCompanion = optionalNonEmptyString(
      item,
      "preferredCompanion",
      file,
      `${label}.preferredCompanion`,
    );
    return {
      id,
      x,
      y,
      ...(radius === undefined ? {} : { radius }),
      ...(companionHold === undefined ? {} : { companionHold }),
      ...(preferredCompanion === undefined ? {} : { preferredCompanion }),
    };
  });
}

function parseEmitters(value: unknown, file: string): PrismEmitterDef[] | undefined {
  if (value === undefined) return undefined;
  field(array(value), file, "puzzles.emitters");
  return value.map((item, index) => {
    const label = `puzzles.emitters[${index}]`;
    field(record(item), file, label);
    const id = nonEmptyString(item, "id", file, `${label}.id`);
    const x = number(item, "x", file, `${label}.x`);
    const y = number(item, "y", file, `${label}.y`);
    field(direction(item.direction), file, `${label}.direction`);
    const requiresLantern = optionalBoolean(
      item,
      "requiresLantern",
      file,
      `${label}.requiresLantern`,
    );
    const lanternRange = optionalPositive(item, "lanternRange", file, `${label}.lanternRange`);
    return {
      id,
      x,
      y,
      direction: item.direction,
      ...(requiresLantern === undefined ? {} : { requiresLantern }),
      ...(lanternRange === undefined ? {} : { lanternRange }),
    };
  });
}

function parseMirrors(value: unknown, file: string): PrismMirrorDef[] | undefined {
  if (value === undefined) return undefined;
  field(array(value), file, "puzzles.mirrors");
  return value.map((item, index) => {
    const label = `puzzles.mirrors[${index}]`;
    field(record(item), file, label);
    const id = nonEmptyString(item, "id", file, `${label}.id`);
    const x = number(item, "x", file, `${label}.x`);
    const y = number(item, "y", file, `${label}.y`);
    field(isPrismOrientation(item.orientation), file, `${label}.orientation`);
    return { id, x, y, orientation: item.orientation };
  });
}

function parseReceivers(value: unknown, file: string): PrismReceiverDef[] | undefined {
  if (value === undefined) return undefined;
  field(array(value), file, "puzzles.receivers");
  return value.map((item, index) => {
    const label = `puzzles.receivers[${index}]`;
    field(record(item), file, label);
    const id = nonEmptyString(item, "id", file, `${label}.id`);
    const x = number(item, "x", file, `${label}.x`);
    const y = number(item, "y", file, `${label}.y`);
    const radius = optionalPositive(item, "radius", file, `${label}.radius`);
    return {
      id,
      x,
      y,
      ...(radius === undefined ? {} : { radius }),
    };
  });
}

function parseBells(value: unknown, file: string): ResonanceBellDef[] | undefined {
  if (value === undefined) return undefined;
  field(array(value), file, "puzzles.bells");
  return value.map((item, index) => {
    const label = `puzzles.bells[${index}]`;
    field(record(item), file, label);
    const id = nonEmptyString(item, "id", file, `${label}.id`);
    const x = number(item, "x", file, `${label}.x`);
    const y = number(item, "y", file, `${label}.y`);
    const rawSeq = item.sequence;
    field(
      array(rawSeq) &&
        rawSeq.length > 0 &&
        rawSeq.every((note): note is Direction => direction(note)),
      file,
      `${label}.sequence`,
    );
    const hintLabel = optionalNonEmptyString(item, "hintLabel", file, `${label}.hintLabel`);
    const radius = optionalPositive(item, "radius", file, `${label}.radius`);
    const rawStyle = item.style;
    field(rawStyle === undefined || isBellStyle(rawStyle), file, `${label}.style`);
    return {
      id,
      x,
      y,
      sequence: [...rawSeq],
      ...(hintLabel === undefined ? {} : { hintLabel }),
      ...(radius === undefined ? {} : { radius }),
      ...(rawStyle === undefined ? {} : { style: rawStyle }),
    };
  });
}

function parseGrapples(value: unknown, file: string): GrapplePostDef[] | undefined {
  if (value === undefined) return undefined;
  field(array(value), file, "puzzles.grapples");
  return value.map((item, index) => {
    const label = `puzzles.grapples[${index}]`;
    field(record(item), file, label);
    const id = nonEmptyString(item, "id", file, `${label}.id`);
    field(isGrappleKind(item.kind), file, `${label}.kind`);
    const x = number(item, "x", file, `${label}.x`);
    const y = number(item, "y", file, `${label}.y`);
    const range = optionalPositive(item, "range", file, `${label}.range`);
    const requiresLasso = optionalBoolean(item, "requiresLasso", file, `${label}.requiresLasso`);
    const rawLandA = item.landA;
    const rawLandB = item.landB;
    field(rawLandA === undefined || point(rawLandA), file, `${label}.landA`);
    field(rawLandB === undefined || point(rawLandB), file, `${label}.landB`);
    if (item.kind === "swing") {
      field(rawLandA !== undefined && rawLandB !== undefined, file, `${label}.landA/landB`);
    }
    return {
      id,
      kind: item.kind,
      x,
      y,
      ...(range === undefined ? {} : { range }),
      ...(requiresLasso === undefined ? {} : { requiresLasso }),
      ...(rawLandA === undefined ? {} : { landA: { x: rawLandA.x, y: rawLandA.y } }),
      ...(rawLandB === undefined ? {} : { landB: { x: rawLandB.x, y: rawLandB.y } }),
    };
  });
}

function parseBridges(value: unknown, file: string): VineBridgeDef[] | undefined {
  if (value === undefined) return undefined;
  field(array(value), file, "puzzles.bridges");
  return value.map((item, index) => {
    const label = `puzzles.bridges[${index}]`;
    field(record(item), file, label);
    const id = nonEmptyString(item, "id", file, `${label}.id`);
    const rawStyle = item.style;
    field(rawStyle === undefined || isBridgeStyle(rawStyle), file, `${label}.style`);
    const opensOn = nonEmptyString(item, "opensOn", file, `${label}.opensOn`);
    field(polygon(item.polygon), file, `${label}.polygon`);
    const rawVisual = item.visualPoint;
    field(rawVisual === undefined || point(rawVisual), file, `${label}.visualPoint`);
    return {
      id,
      ...(rawStyle === undefined ? {} : { style: rawStyle }),
      opensOn,
      polygon: item.polygon,
      ...(rawVisual === undefined ? {} : { visualPoint: { x: rawVisual.x, y: rawVisual.y } }),
    };
  });
}

function parseSteppingStones(
  value: unknown,
  file: string,
): SteppingStoneGroupDef[] | undefined {
  if (value === undefined) return undefined;
  field(array(value), file, "puzzles.steppingStones");
  return value.map((item, index) => {
    const label = `puzzles.steppingStones[${index}]`;
    field(record(item), file, label);
    const id = nonEmptyString(item, "id", file, `${label}.id`);
    field(polygon(item.gapPolygon), file, `${label}.gapPolygon`);
    const rawStones = item.stones;
    field(
      array(rawStones) && rawStones.length > 0 && rawStones.every(point),
      file,
      `${label}.stones`,
    );
    const lanternRange = optionalPositive(item, "lanternRange", file, `${label}.lanternRange`);
    const permanentOnPuzzle = optionalNonEmptyString(
      item,
      "permanentOnPuzzle",
      file,
      `${label}.permanentOnPuzzle`,
    );
    const overridesCrossing = optionalNonEmptyString(
      item,
      "overridesCrossing",
      file,
      `${label}.overridesCrossing`,
    );
    return {
      id,
      gapPolygon: item.gapPolygon,
      stones: rawStones.map((stone) => ({ x: stone.x, y: stone.y })),
      ...(lanternRange === undefined ? {} : { lanternRange }),
      ...(permanentOnPuzzle === undefined ? {} : { permanentOnPuzzle }),
      ...(overridesCrossing === undefined ? {} : { overridesCrossing }),
    };
  });
}

function parseGoals(value: unknown, file: string): PuzzleGoalDef[] | undefined {
  if (value === undefined) return undefined;
  field(array(value), file, "puzzles.goals");
  return value.map((item, index) => {
    const label = `puzzles.goals[${index}]`;
    field(record(item), file, label);
    const id = nonEmptyString(item, "id", file, `${label}.id`);
    const requirePlates = optionalStringList(
      item,
      "requirePlates",
      file,
      `${label}.requirePlates`,
    );
    const requireReceivers = optionalStringList(
      item,
      "requireReceivers",
      file,
      `${label}.requireReceivers`,
    );
    const requireBells = optionalStringList(item, "requireBells", file, `${label}.requireBells`);
    const requireLevers = optionalStringList(
      item,
      "requireLevers",
      file,
      `${label}.requireLevers`,
    );
    const requireSteppingStones = optionalStringList(
      item,
      "requireSteppingStones",
      file,
      `${label}.requireSteppingStones`,
    );
    const requirePuzzles = optionalStringList(
      item,
      "requirePuzzles",
      file,
      `${label}.requirePuzzles`,
    );
    const totalReqs =
      (requirePlates?.length ?? 0) +
      (requireReceivers?.length ?? 0) +
      (requireBells?.length ?? 0) +
      (requireLevers?.length ?? 0) +
      (requireSteppingStones?.length ?? 0) +
      (requirePuzzles?.length ?? 0);
    field(totalReqs > 0, file, `${label} (at least one requirement)`);
    const inkVariable = optionalNonEmptyString(
      item,
      "inkVariable",
      file,
      `${label}.inkVariable`,
    );
    const rawReward = item.rewardCoins;
    field(
      rawReward === undefined || (isInteger(rawReward) && rawReward >= 0),
      file,
      `${label}.rewardCoins`,
    );
    return {
      id,
      ...(requirePlates === undefined ? {} : { requirePlates }),
      ...(requireReceivers === undefined ? {} : { requireReceivers }),
      ...(requireBells === undefined ? {} : { requireBells }),
      ...(requireLevers === undefined ? {} : { requireLevers }),
      ...(requireSteppingStones === undefined ? {} : { requireSteppingStones }),
      ...(requirePuzzles === undefined ? {} : { requirePuzzles }),
      ...(inkVariable === undefined ? {} : { inkVariable }),
      ...(rawReward === undefined ? {} : { rewardCoins: rawReward }),
    };
  });
}

export function parseAreaPuzzles(
  value: unknown,
  file: string,
  crossingIds?: ReadonlySet<string>,
): AreaPuzzles | undefined {
  if (value === undefined) return undefined;
  field(record(value) && !Array.isArray(value), file, "puzzles");

  const pushables = parsePushables(value.pushables, file);
  const plates = parsePlates(value.plates, file);
  const emitters = parseEmitters(value.emitters, file);
  const mirrors = parseMirrors(value.mirrors, file);
  const receivers = parseReceivers(value.receivers, file);
  const bells = parseBells(value.bells, file);
  const grapples = parseGrapples(value.grapples, file);
  const bridges = parseBridges(value.bridges, file);
  const steppingStones = parseSteppingStones(value.steppingStones, file);
  const goals = parseGoals(value.goals, file);

  parseUniqueIds((pushables ?? []).map((item) => item.id), file, "puzzles.pushables");
  const plateIds = parseUniqueIds((plates ?? []).map((item) => item.id), file, "puzzles.plates");
  parseUniqueIds((emitters ?? []).map((item) => item.id), file, "puzzles.emitters");
  parseUniqueIds((mirrors ?? []).map((item) => item.id), file, "puzzles.mirrors");
  const receiverIds = parseUniqueIds(
    (receivers ?? []).map((item) => item.id),
    file,
    "puzzles.receivers",
  );
  const bellIds = parseUniqueIds((bells ?? []).map((item) => item.id), file, "puzzles.bells");
  const grappleIds = parseUniqueIds(
    (grapples ?? []).map((item) => item.id),
    file,
    "puzzles.grapples",
  );
  parseUniqueIds((bridges ?? []).map((item) => item.id), file, "puzzles.bridges");
  const steppingIds = parseUniqueIds(
    (steppingStones ?? []).map((item) => item.id),
    file,
    "puzzles.steppingStones",
  );
  const goalIds = parseUniqueIds((goals ?? []).map((item) => item.id), file, "puzzles.goals");

  for (const bridge of bridges ?? []) {
    field(goalIds.has(bridge.opensOn), file, `puzzles.bridges.${bridge.id}.opensOn`);
  }
  for (const group of steppingStones ?? []) {
    if (group.permanentOnPuzzle !== undefined) {
      field(
        goalIds.has(group.permanentOnPuzzle),
        file,
        `puzzles.steppingStones.${group.id}.permanentOnPuzzle`,
      );
    }
    if (group.overridesCrossing !== undefined && crossingIds !== undefined) {
      field(
        crossingIds.has(group.overridesCrossing),
        file,
        `puzzles.steppingStones.${group.id}.overridesCrossing`,
      );
    }
  }
  for (const goal of goals ?? []) {
    for (const id of goal.requirePlates ?? []) {
      field(plateIds.has(id), file, `puzzles.goals.${goal.id}.requirePlates (${id})`);
    }
    for (const id of goal.requireReceivers ?? []) {
      field(receiverIds.has(id), file, `puzzles.goals.${goal.id}.requireReceivers (${id})`);
    }
    for (const id of goal.requireBells ?? []) {
      field(bellIds.has(id), file, `puzzles.goals.${goal.id}.requireBells (${id})`);
    }
    for (const id of goal.requireLevers ?? []) {
      field(grappleIds.has(id), file, `puzzles.goals.${goal.id}.requireLevers (${id})`);
    }
    for (const id of goal.requireSteppingStones ?? []) {
      field(steppingIds.has(id), file, `puzzles.goals.${goal.id}.requireSteppingStones (${id})`);
    }
    for (const id of goal.requirePuzzles ?? []) {
      field(
        id !== goal.id && goalIds.has(id),
        file,
        `puzzles.goals.${goal.id}.requirePuzzles (${id})`,
      );
    }
  }

  return {
    ...(pushables === undefined ? {} : { pushables }),
    ...(plates === undefined ? {} : { plates }),
    ...(emitters === undefined ? {} : { emitters }),
    ...(mirrors === undefined ? {} : { mirrors }),
    ...(receivers === undefined ? {} : { receivers }),
    ...(bells === undefined ? {} : { bells }),
    ...(grapples === undefined ? {} : { grapples }),
    ...(bridges === undefined ? {} : { bridges }),
    ...(steppingStones === undefined ? {} : { steppingStones }),
    ...(goals === undefined ? {} : { goals }),
  };
}
