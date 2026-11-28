import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function hasTick(value: unknown): value is { tick: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "tick" in value &&
    typeof value.tick === "number"
  );
}

function runFindTick(scriptPath: string, fixture: string, query: string): number {
  const result = spawnSync("bun", ["tools/sim/find-tick.ts", scriptPath, fixture, query], {
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  const parsed: unknown = JSON.parse(result.stdout);
  if (!hasTick(parsed)) {
    throw new Error(`Unexpected find-tick output: ${result.stdout}`);
  }
  return parsed.tick;
}

describe("Milestone 175: Tick-Resilient Battle Replay Queries", () => {
  it("locates flute-command and lasso-steady-command in golden-flute.json", () => {
    const fluteTick = runFindTick(
      "tests/sim/scripts/new-game/golden-flute.json",
      "new-game",
      "flute-command",
    );
    const lassoTick = runFindTick(
      "tests/sim/scripts/new-game/golden-flute.json",
      "new-game",
      "lasso-steady-command",
    );
    expect(fluteTick).toBeGreaterThan(0);
    expect(lassoTick).toBeGreaterThan(0);
  });

  it("locates kid-lasso-windup in golden-kid.json", () => {
    const kidTick = runFindTick(
      "tests/sim/scripts/new-game/golden-kid.json",
      "new-game",
      "kid-lasso-windup",
    );
    expect(kidTick).toBeGreaterThan(0);
  });
});
