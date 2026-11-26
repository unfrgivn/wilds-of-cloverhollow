import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import type { AmbientFlyer } from "../../src/content/ambient";
import { flyerAt } from "../../src/render/ambient";
import { evaluateAtmosphere } from "../../src/render/atmosphere";
import { fadeAlpha } from "../../src/render/fade";

describe("Milestone 72: smoothstep door fade", () => {
  const transition = (phase: "out" | "in", elapsed: number) => ({
    target: { area: "plaza", spawn: "fountain" },
    phase,
    elapsed,
  });

  it("hits exact endpoints and midpoint, eases smoothly, and stays monotonic", () => {
    expect(fadeAlpha(null, 18)).toBe(0);
    expect(fadeAlpha(transition("out", 0), 18)).toBe(0);
    expect(fadeAlpha(transition("out", 9), 18)).toBe(0.5);
    expect(fadeAlpha(transition("out", 18), 18)).toBe(1);
    expect(fadeAlpha(transition("in", 0), 18)).toBe(1);
    expect(fadeAlpha(transition("in", 9), 18)).toBe(0.5);
    expect(fadeAlpha(transition("in", 18), 18)).toBe(0);

    // Smoothstep S-curve: slower near 0 and 1 than linear.
    expect(fadeAlpha(transition("out", 3), 18)).toBeLessThan(3 / 18);
    expect(fadeAlpha(transition("out", 15), 18)).toBeGreaterThan(15 / 18);

    // Strictly monotonic across all 18 ticks for both out and in.
    let prevOut = -1;
    let prevIn = 2;
    for (let tick = 0; tick <= 18; tick += 1) {
      const outAlpha = fadeAlpha(transition("out", tick), 18);
      const inAlpha = fadeAlpha(transition("in", tick), 18);
      expect(outAlpha).toBeGreaterThan(prevOut);
      expect(inAlpha).toBeLessThan(prevIn);
      prevOut = outAlpha;
      prevIn = inAlpha;
    }
  });
});

describe("Milestone 72: closed Catmull-Rom ambient flyers", () => {
  const square: AmbientFlyer = {
    id: "spline-test",
    animation: "butterfly_pink",
    path: [[0, 0], [100, 0], [100, 100], [0, 100]],
    loopTicks: 200,
    phase: 0,
    frameTicks: 10,
    size: 20,
  };

  it("passes through vertices, curves smoothly, wraps cleanly, and supports >2 frames", () => {
    const start = flyerAt(square, 0);
    const v1 = flyerAt(square, 50);
    const v2 = flyerAt(square, 100);
    const v3 = flyerAt(square, 150);
    const wrapped = flyerAt(square, 200);

    expect(start.x).toBe(0);
    expect(start.y).toBe(0);
    expect(v1.x).toBe(100);
    expect(v2.x).toBe(100);
    expect(v3.x).toBe(0);
    expect(wrapped).toEqual(start);

    // Mid-segment along the top edge curves smoothly outward (y < 0 before bob)
    // rather than staying flat along the linear chord y = 0.
    const midTop = flyerAt(square, 25);
    const bob25 = Math.sin(25 * Math.PI * 2 / 200) * 4;
    expect(midTop.y - bob25).toBeLessThan(-5);
    expect(midTop.flip).toBe(false);

    // Deterministic across repeated calls and cycles across >2 animation frames.
    expect(flyerAt(square, 37, 4)).toEqual(flyerAt(square, 37, 4));
    expect([0, 10, 20, 30, 40].map((t) => flyerAt(square, t, 4).frame)).toEqual([0, 1, 2, 3, 0]);
  });
});

describe("Milestone 72: deterministic biome atmosphere across all areas", () => {
  it("emits finite, bounded, deterministic particles for all 21 real areas and none for harness",
    () => {
      const areas = Object.values(loadContent().world.areas);
      const realAreas = areas.filter((area) => area.id !== "harness");
      expect(realAreas.length).toBeGreaterThanOrEqual(22);

      expect(evaluateAtmosphere("harness", 1200, 800, 120)).toEqual([]);

      for (const area of realAreas) {
        const at120 = evaluateAtmosphere(area.id, area.width, area.height, 120);
        const again = evaluateAtmosphere(area.id, area.width, area.height, 120);
        expect(at120.length, `${area.id} should have atmosphere particles`).toBeGreaterThan(0);
        expect(at120).toEqual(again);
        for (const particle of at120) {
          expect(Number.isFinite(particle.x)).toBe(true);
          expect(Number.isFinite(particle.y)).toBe(true);
          expect(Number.isFinite(particle.scaleX)).toBe(true);
          expect(Number.isFinite(particle.scaleY)).toBe(true);
          expect(Number.isFinite(particle.rotation)).toBe(true);
          expect(Number.isFinite(particle.alpha)).toBe(true);
          expect(particle.alpha).toBeGreaterThanOrEqual(0);
          expect(particle.alpha).toBeLessThanOrEqual(1);
        }
      }
    });
});
