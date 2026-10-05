import type { Point } from "../core";

export function stickVector(
  origin: Point,
  point: Point,
  radius: number,
  deadZone = 0.12,
): Point {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= radius * deadZone || distance === 0) return { x: 0, y: 0 };
  const scale = Math.min(distance, radius);
  return { x: (dx / distance) * (scale / radius), y: (dy / distance) * (scale / radius) };
}
