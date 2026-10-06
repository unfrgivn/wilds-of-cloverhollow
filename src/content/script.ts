import type { ActionFrame } from "../core";

export type ScriptSegment = { frame: ActionFrame; ticks: number };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isActionFrame(value: unknown): value is ActionFrame {
  if (!record(value) || !record(value.move)) return false;
  return (
    typeof value.move.x === "number" &&
    typeof value.move.y === "number" &&
    typeof value.confirm === "boolean" &&
    typeof value.cancel === "boolean" &&
    typeof value.menu === "boolean"
    && (value.choose === undefined || typeof value.choose === "number")
  );
}

export function parseScript(
  value: unknown,
  source = "script",
): ScriptSegment[] {
  if (!Array.isArray(value)) throw new Error(`${source}: expected an array`);
  return value.map((item, index) => {
    if (
      !record(item) ||
      !isActionFrame(item.frame) ||
      typeof item.ticks !== "number" ||
      item.ticks < 0
    ) {
      throw new Error(`${source}: invalid segment ${index}`);
    }
    return { frame: item.frame, ticks: item.ticks };
  });
}
