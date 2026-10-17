import type { Polygon, Surface, SurfaceMap, SurfaceRegion } from "../core";
import { surfaces } from "../core";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function polygon(value: unknown): value is Polygon {
  return Array.isArray(value) && value.length >= 3 && value.every((item) =>
    Array.isArray(item) && item.length === 2 && typeof item[0] === "number" &&
    typeof item[1] === "number" && Number.isFinite(item[0]) && Number.isFinite(item[1]));
}
function surface(value: unknown): value is Surface {
  return typeof value === "string" && surfaces.some((item) => item === value);
}
function insideBounds(points: Polygon, width: number, height: number): boolean {
  return points.every(([x, y]) => x >= 0 && y >= 0 && x <= width && y <= height);
}

export function parseSurfaceMap(
  value: unknown, file: string, width: number, height: number,
): SurfaceMap {
  if (!record(value)) throw new Error(`${file}: invalid object`);
  if (!surface(value.default)) throw new Error(`${file}: unknown default surface`);
  if (value.precedence !== "first") throw new Error(`${file}: precedence must be first`);
  if (!Array.isArray(value.regions)) throw new Error(`${file}: invalid regions`);
  const regions: SurfaceRegion[] = value.regions.map((raw, index) => {
    if (!record(raw) || !surface(raw.surface) || !polygon(raw.polygon))
      throw new Error(`${file}: invalid regions.${index}`);
    if (!insideBounds(raw.polygon, width, height))
      throw new Error(`${file}: regions.${index}.polygon is outside area`);
    return { surface: raw.surface, polygon: raw.polygon };
  });
  return { default: value.default, precedence: "first", regions };
}
