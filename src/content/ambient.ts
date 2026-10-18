import type { Area } from "../core";

export type AmbientFlyer = {
  id: string;
  animation: string;
  path: [number, number][];
  loopTicks: number;
  phase: number;
  frameTicks: number;
  size: number;
};

const areaAmbient = new WeakMap<Area, AmbientFlyer[]>();

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function field(condition: boolean, file: string, name: string): asserts condition {
  if (!condition) throw new Error(`${file}: invalid ${name}`);
}

export function parseAmbient(
  value: unknown,
  file: string,
  width: number,
  height: number,
): AmbientFlyer[] {
  if (value === undefined) return [];
  field(Array.isArray(value), file, "ambient");
  const ids = new Set<string>();
  return value.map((item, index) => {
    field(record(item), file, `ambient[${index}]`);
    field(typeof item.id === "string" && item.id.length > 0, file, `ambient[${index}].id`);
    field(!ids.has(item.id), file, `ambient[${index}].id (duplicate id)`);
    ids.add(item.id);
    field(typeof item.animation === "string" && item.animation.length > 0, file,
      `ambient[${index}].animation`);
    field(Array.isArray(item.path) && item.path.length >= 3, file, `ambient[${index}].path`);
    const path = item.path.map((point, pointIndex): [number, number] => {
      field(Array.isArray(point) && point.length === 2 &&
        typeof point[0] === "number" && typeof point[1] === "number" &&
        Number.isFinite(point[0]) && Number.isFinite(point[1]), file,
      `ambient[${index}].path[${pointIndex}]`);
      field(point[0] >= 0 && point[0] <= width && point[1] >= 0 && point[1] <= height,
        file, `ambient[${index}].path[${pointIndex}] (outside bounds)`);
      return [point[0], point[1]];
    });
    const integer = (name: string): number => {
      const fieldValue = item[name];
      field(typeof fieldValue === "number" && Number.isInteger(fieldValue), file,
        `ambient[${index}].${name}`);
      return fieldValue;
    };
    const loopTicks = integer("loopTicks");
    const phase = integer("phase");
    const frameTicks = integer("frameTicks");
    field(loopTicks >= 120, file, `ambient[${index}].loopTicks`);
    field(phase >= 0 && phase < loopTicks, file, `ambient[${index}].phase`);
    field(frameTicks >= 1, file, `ambient[${index}].frameTicks`);
    field(typeof item.size === "number" && Number.isFinite(item.size) && item.size > 0,
      file, `ambient[${index}].size`);
    return { id: item.id, animation: item.animation, path, loopTicks, phase, frameTicks,
      size: item.size };
  });
}

export function setAreaAmbient(area: Area, ambient: AmbientFlyer[]): void {
  areaAmbient.set(area, ambient);
}

export function ambientFor(area: Area | undefined): readonly AmbientFlyer[] {
  return area === undefined ? [] : (areaAmbient.get(area) ?? []);
}
