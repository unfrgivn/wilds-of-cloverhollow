import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";

const content = loadContent();
const flurryCritters = [
  "pup", "gym-pup", "cat", "squirrel", "oak-squirrel", "hamster",
  "raccoon", "school-raccoon", "arcade-keeper", "lodge-keeper", "lifeguard",
];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toyFrames(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(
    new URL("../../public/assets/battle/toys/toys.json", import.meta.url), "utf8",
  ));
  if (!record(parsed) || !record(parsed.frames)) throw new Error("toy frames missing");
  return parsed.frames;
}

describe("catch battle content", () => {
  it("has an atlas frame for every toy named by a catch", () => {
    const frames = toyFrames();
    for (const id of flurryCritters) {
      const critter = content.world.critters[id];
      if (critter === undefined) throw new Error(`${id} missing`);
      const checks = [critter.burst.check, critter.burst.big];
      for (const check of checks) {
        if (check?.kind !== "catch") continue;
        for (const frame of check.toys)
          expect(frames, `${id} names missing toy frame ${frame}`).toHaveProperty(frame);
      }
    }
  });

  it("uses catches in every flurry critter's great and good burst lines", () => {
    for (const id of flurryCritters) {
      const critter = content.world.critters[id];
      if (critter === undefined) throw new Error(`${id} missing`);
      expect(critter.lines.burstResult.great.toLowerCase()).toContain("catches");
      expect(critter.lines.burstResult.good.toLowerCase()).toContain("catches");
    }
  });
});
