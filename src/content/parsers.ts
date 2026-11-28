import type { CheckSpec, Direction, Grade, Point, Polygon } from "../core";

export type Box = { x: number; y: number; w: number; h: number };
export type Edge = { y: number; left: number; right: number };
export type RawCrossing = { id: string; polygon: Polygon; opens: string };

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function field(
  condition: boolean,
  file: string,
  name: string,
): asserts condition {
  if (!condition) throw new Error(`${file}: invalid ${name}`);
}

export function array(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

export function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function string(
  source: Record<string, unknown>,
  key: string,
  file: string,
  label = key,
): string {
  const item = source[key];
  field(typeof item === "string", file, label);
  return item;
}

export function optionalString(
  source: Record<string, unknown>,
  key: string,
  file: string,
  label = key,
): string | undefined {
  const item = source[key];
  field(item === undefined || typeof item === "string", file, label);
  return item;
}

export function nonEmptyString(
  source: Record<string, unknown>,
  key: string,
  file: string,
  label = key,
): string {
  const item = source[key];
  field(typeof item === "string" && item.trim().length > 0, file, label);
  return item;
}

export function number(
  source: Record<string, unknown>,
  key: string,
  file: string,
  label = key,
): number {
  const item = source[key];
  field(typeof item === "number" && Number.isFinite(item), file, label);
  return item;
}

export function integer(
  source: Record<string, unknown>,
  key: string,
  file: string,
  label = key,
): number {
  const item = source[key];
  field(typeof item === "number" && Number.isInteger(item), file, label);
  return item;
}

export function integerIn(
  source: Record<string, unknown>,
  key: string,
  minimum: number,
  file: string,
  label = key,
): number {
  const item = source[key];
  field(typeof item === "number" && Number.isInteger(item) && item >= minimum, file, label);
  return item;
}

export function positive(
  source: Record<string, unknown>,
  key: string,
  file: string,
  label = key,
): number {
  const item = source[key];
  field(typeof item === "number" && Number.isFinite(item) && item > 0, file, label);
  return item;
}

export function nonNegative(
  source: Record<string, unknown>,
  key: string,
  file: string,
  label = key,
): number {
  const item = source[key];
  field(typeof item === "number" && Number.isFinite(item) && item >= 0, file, label);
  return item;
}

export function boolean(
  source: Record<string, unknown>,
  key: string,
  file: string,
  label = key,
): boolean {
  const item = source[key];
  field(typeof item === "boolean", file, label);
  return item;
}

export function point(value: unknown): value is Point {
  return record(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

export function pointField(
  source: Record<string, unknown>,
  key: string,
  file: string,
  label = key,
): Point {
  const item = source[key];
  field(point(item), file, label);
  return { x: item.x, y: item.y };
}

export function pointTuple(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 &&
    isFiniteNumber(value[0]) && isFiniteNumber(value[1]);
}

export function polygon(value: unknown): value is Polygon {
  return Array.isArray(value) && value.length >= 3 && value.every(pointTuple);
}

export function box(value: unknown): value is Box {
  return (
    record(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.w) &&
    isFiniteNumber(value.h) &&
    value.w > 0 &&
    value.h > 0
  );
}

export function integerBox(value: unknown): value is Box {
  return (
    record(value) &&
    isInteger(value.x) &&
    isInteger(value.y) &&
    isInteger(value.w) &&
    isInteger(value.h) &&
    value.w > 0 &&
    value.h > 0
  );
}

export function edge(value: unknown): value is Edge {
  return (
    record(value) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.left) &&
    isFiniteNumber(value.right) &&
    value.left < value.right
  );
}

export function insideBox(inner: Box, bounds: Box): boolean {
  return (
    inner.x >= bounds.x &&
    inner.y >= bounds.y &&
    inner.x + inner.w <= bounds.x + bounds.w &&
    inner.y + inner.h <= bounds.y + bounds.h
  );
}

export function boxesApart(a: Box, b: Box): boolean {
  return a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
}

export function direction(value: unknown): value is Direction {
  return value === "up" || value === "down" || value === "left" || value === "right";
}

export function rawCrossing(value: unknown): value is RawCrossing {
  return (
    record(value) &&
    typeof value.id === "string" &&
    polygon(value.polygon) &&
    typeof value.opens === "string"
  );
}

export function gradeMap(
  value: unknown,
  file: string,
  name: string,
): Record<Grade, string> {
  field(record(value), file, name);
  return {
    great: string(value, "great", file, `${name}.great`),
    good: string(value, "good", file, `${name}.good`),
    miss: string(value, "miss", file, `${name}.miss`),
  };
}

export function calibrationHeader(
  value: unknown,
  file: string,
  options?: { positiveSize?: boolean; integerSize?: boolean },
): { raw: Record<string, unknown>; image: string; size: { w: number; h: number }; bounds: Box } {
  field(record(value) && typeof value.image === "string", file, "image");
  const check = options?.integerSize === true ? isInteger : isFiniteNumber;
  field(
    record(value.size) &&
      check(value.size.w) &&
      check(value.size.h) &&
      (options?.positiveSize !== true || (value.size.w > 0 && value.size.h > 0)),
    file,
    "size",
  );
  const size = { w: value.size.w, h: value.size.h };
  return { raw: value, image: value.image, size, bounds: { x: 0, y: 0, w: size.w, h: size.h } };
}

export function calibrationRect(
  source: Record<string, unknown>,
  key: string,
  bounds: Box,
  file: string,
): Box {
  const item = source[key];
  field(box(item), file, key);
  const result = { x: item.x, y: item.y, w: item.w, h: item.h };
  field(insideBox(result, bounds), file, `${key} (inside the image)`);
  return result;
}

// A battle check's spec (spec 8), validated by kind. Every number is an
// integer tick count; the windows must fit inside the check.
export function checkSpec(value: unknown, file: string, name: string): CheckSpec {
  field(record(value), file, name);
  const kind = value.kind;
  field(
    kind === "ring" || kind === "charge" || kind === "chain" || kind === "catch" ||
      kind === "lean" || kind === "trace" || kind === "peekaboo" || kind === "echo" ||
      kind === "which-one" || kind === "whack" || kind === "spin-snag",
    file,
    `${name}.kind`,
  );
  const intField = (key: string): number => integer(value, key, file, `${name}.${key}`);
  const intList = (key: string): number[] => {
    const items = value[key];
    field(
      Array.isArray(items) && items.length > 0 && items.every(isInteger),
      file,
      `${name}.${key}`,
    );
    return [...items];
  };
  if (kind === "ring") {
    const ticks = intField("ticks");
    const targetTick = intField("targetTick");
    const greatWindow = intField("greatWindow");
    const goodWindow = intField("goodWindow");
    field(0 <= greatWindow && greatWindow <= goodWindow, file, `${name}.greatWindow`);
    field(
      targetTick - goodWindow >= 1 && targetTick + goodWindow < ticks,
      file,
      `${name}.targetTick`,
    );
    return { kind, ticks, targetTick, greatWindow, goodWindow };
  }
  if (kind === "charge") {
    const waitTicks = intField("waitTicks");
    const maxTicks = intField("maxTicks");
    const targetTick = intField("targetTick");
    const greatWindow = intField("greatWindow");
    const goodWindow = intField("goodWindow");
    field(waitTicks >= 1, file, `${name}.waitTicks`);
    field(0 <= greatWindow && greatWindow <= goodWindow, file, `${name}.greatWindow`);
    field(
      targetTick - goodWindow >= 1 && targetTick + goodWindow < maxTicks,
      file,
      `${name}.targetTick`,
    );
    return { kind, waitTicks, maxTicks, targetTick, greatWindow, goodWindow };
  }
  if (kind === "lean") {
    const puffTicks = intField("puffTicks");
    const steer = intField("steer");
    const spring = intField("spring");
    const starts = intList("starts");
    const forces = intList("forces");
    field(puffTicks >= 1, file, `${name}.puffTicks`);
    field(spring >= 1, file, `${name}.spring`);
    starts.forEach((start, index) => {
      const previous = starts[index - 1];
      field(
        previous === undefined ? start >= 1 : start >= previous + puffTicks,
        file,
        `${name}.starts`,
      );
    });
    field(forces.every((force) => force >= 1 && force < steer), file, `${name}.forces`);
    return { kind, puffTicks, starts, forces, steer, spring };
  }
  if (kind === "trace") {
    const dryTicks = intField("dryTicks");
    const brushSpeed = positive(value, "brushSpeed", file, `${name}.brushSpeed`);
    const reachRadius = positive(value, "reachRadius", file, `${name}.reachRadius`);
    field(dryTicks >= 1 && dryTicks <= 180, file, `${name}.dryTicks`);
    const rawPaths = value.paths;
    field(Array.isArray(rawPaths) && rawPaths.length > 0, file, `${name}.paths`);
    const paths = rawPaths.map((rawPath, pathIndex) => {
      if (!record(rawPath)) throw new Error(`${file}: invalid ${name}.paths[${pathIndex}]`);
      field(
        typeof rawPath.id === "string" && rawPath.id.length > 0,
        file,
        `${name}.paths[${pathIndex}]`,
      );
      const rawPoints = rawPath.points;
      if (!Array.isArray(rawPoints) || rawPoints.length < 4)
        throw new Error(`${file}: invalid ${name}.paths[${pathIndex}].points`);
      const points = rawPoints.map((rawPoint, pointIndex) => {
        if (!record(rawPoint))
          throw new Error(`${file}: invalid ${name}.paths[${pathIndex}].points[${pointIndex}]`);
        const x = rawPoint.x;
        const y = rawPoint.y;
        field(
          isInteger(x) && isInteger(y) && x >= 0 && x <= 1000 && y >= 0 && y <= 1000,
          file,
          `${name}.paths[${pathIndex}].points[${pointIndex}]`,
        );
        return { x, y };
      });
      let length = 0;
      points.forEach((pt, pointIndex) => {
        const previous = points[pointIndex - 1];
        if (previous !== undefined) {
          const dx = pt.x - previous.x;
          const dy = pt.y - previous.y;
          const segment = Math.sqrt(dx * dx + dy * dy);
          field(segment >= 2 * reachRadius, file, `${name}.paths[${pathIndex}].points`);
          length += segment;
        }
      });
      field(length / brushSpeed <= dryTicks * 0.7, file, `${name}.paths[${pathIndex}]`);
      return { id: rawPath.id, points };
    });
    return { kind, dryTicks, brushSpeed, reachRadius, paths };
  }
  if (kind === "peekaboo") {
    const ticks = intField("ticks");
    const goal = intField("goal");
    const warningTicks = intField("warningTicks");
    const graceTicks = intField("graceTicks");
    field(ticks >= 1 && ticks <= 180, file, `${name}.ticks`);
    field(goal >= 1, file, `${name}.goal`);
    field(warningTicks >= 1, file, `${name}.warningTicks`);
    field(graceTicks >= 0, file, `${name}.graceTicks`);
    const rawPeeks = value.peeks;
    field(Array.isArray(rawPeeks) && rawPeeks.length > 0, file, `${name}.peeks`);
    let peekTicks = 0;
    const peeks = rawPeeks.map((rawPeek, peekIndex) => {
      const label = `${name}.peeks[${peekIndex}]`;
      field(record(rawPeek), file, label);
      const start = rawPeek.start;
      const end = rawPeek.end;
      field(
        isInteger(start) && isInteger(end) && start >= 1 && start < end && end <= ticks,
        file,
        label,
      );
      peekTicks += end - start;
      return { start, end };
    });
    peeks.forEach((peek, index) => {
      const previous = peeks[index - 1];
      field(previous === undefined || peek.start >= previous.end, file, `${name}.peeks`);
    });
    field(ticks - peekTicks >= goal, file, `${name}.goal`);
    return { kind, ticks, goal, warningTicks, graceTicks, peeks };
  }
  if (kind === "echo") {
    const notes = intField("notes");
    const demoTicks = intField("demoTicks");
    const gapTicks = intField("gapTicks");
    const inputTicks = intField("inputTicks");
    field(notes >= 2, file, `${name}.notes`);
    field(demoTicks >= 4, file, `${name}.demoTicks`);
    field(gapTicks >= 1, file, `${name}.gapTicks`);
    field(inputTicks >= notes * 10, file, `${name}.inputTicks`);
    return { kind, notes, demoTicks, gapTicks, inputTicks };
  }
  if (kind === "which-one") {
    const showTicks = intField("showTicks");
    const shuffles = intField("shuffles");
    const swapTicks = intField("swapTicks");
    const pickTicks = intField("pickTicks");
    field(showTicks >= 8, file, `${name}.showTicks`);
    field(shuffles >= 1 && shuffles <= 12, file, `${name}.shuffles`);
    field(swapTicks >= 6, file, `${name}.swapTicks`);
    field(pickTicks >= 30, file, `${name}.pickTicks`);
    return { kind, showTicks, shuffles, swapTicks, pickTicks };
  }
  if (kind === "whack") {
    const pops = intField("pops");
    const stayTicks = intField("stayTicks");
    const gapTicks = intField("gapTicks");
    field(pops >= 2 && pops <= 12, file, `${name}.pops`);
    field(stayTicks >= 10, file, `${name}.stayTicks`);
    field(gapTicks >= 2, file, `${name}.gapTicks`);
    return { kind, pops, stayTicks, gapTicks };
  }
  if (kind === "spin-snag") {
    const spinsNeeded = intField("spinsNeeded");
    const spinTicks = intField("spinTicks");
    const snagTicks = intField("snagTicks");
    const targetTick = intField("targetTick");
    const greatWindow = intField("greatWindow");
    const goodWindow = intField("goodWindow");
    field(spinsNeeded >= 2 && spinsNeeded <= 16, file, `${name}.spinsNeeded`);
    field(spinTicks >= spinsNeeded * 8, file, `${name}.spinTicks`);
    field(0 <= greatWindow && greatWindow <= goodWindow, file, `${name}.greatWindow`);
    field(
      targetTick - goodWindow >= 1 && targetTick + goodWindow < snagTicks,
      file,
      `${name}.targetTick`,
    );
    return { kind, spinsNeeded, spinTicks, snagTicks, targetTick, greatWindow, goodWindow };
  }
  const travelTicks = intField("travelTicks");
  field(travelTicks >= 1, file, `${name}.travelTicks`);
  const arrivals = intList("arrivals");
  const hitWindow = kind === "chain" ? intField("hitWindow") : 0;
  if (kind === "chain") field(hitWindow >= 1, file, `${name}.hitWindow`);
  const gap = kind === "chain" ? 2 * hitWindow + 2 : 8;
  arrivals.forEach((arrival, index) => {
    const previous = arrivals[index - 1];
    field(
      previous === undefined ? arrival >= travelTicks : arrival >= previous + gap,
      file,
      `${name}.arrivals`,
    );
  });
  if (kind === "catch") {
    const toys = value.toys;
    field(
      Array.isArray(toys) &&
        toys.length > 0 &&
        toys.every((item): item is string => typeof item === "string" && item.length > 0),
      file,
      `${name}.toys`,
    );
    return { kind, travelTicks, arrivals, toys: [...toys] };
  }
  const look = value.look;
  field(
    look === "pinecone" || look === "bubble" || look === "dust" || look === "star",
    file,
    `${name}.look`,
  );
  return { kind, travelTicks, hitWindow, arrivals, look };
}

// Soothe's and a friend's check: a catch or a lean is only ever a burst's,
// since its toys' lanes and its puffs' forces come from the burst's roll
// (spec 8).
export function faeSideCheck(value: unknown, file: string, name: string): CheckSpec {
  const spec = checkSpec(value, file, name);
  field(
    spec.kind !== "catch" && spec.kind !== "lean" && spec.kind !== "trace" &&
      spec.kind !== "peekaboo" && spec.kind !== "echo" &&
      spec.kind !== "which-one" && spec.kind !== "whack",
    file,
    `${name}.kind`,
  );
  return spec;
}
