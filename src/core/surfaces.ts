import type { Point, Polygon } from "./types";

export type Surface = "grass" | "sand" | "wood" | "snow" | "stone" | "tile" | "carpet";
export const surfaces: readonly Surface[] = [
  "grass", "sand", "wood", "snow", "stone", "tile", "carpet",
];

export type SurfaceRegion = { surface: Surface; polygon: Polygon };
export type SurfaceMap = { default: Surface; precedence: "first"; regions: SurfaceRegion[] };

export function surfaceAt(map: SurfaceMap, point: Point): Surface {
  for (const region of map.regions) {
    if (pointInPolygon(point, region.polygon)) return region.surface;
  }
  return map.default;
}

function pointInPolygon(point: Point, polygon: Polygon): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x, y] = polygon[index] ?? [0, 0];
    const [oldX, oldY] = polygon[previous] ?? [0, 0];
    const crosses = (y > point.y) !== (oldY > point.y) &&
      point.x < (oldX - x) * (point.y - y) / (oldY - y) + x;
    if (crosses) inside = !inside;
  }
  return inside;
}
