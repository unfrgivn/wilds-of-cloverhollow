import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import type { TraceSpec } from "../../src/core";
import { playTrace } from "./trace-players";

describe("Ms. Rowan Trace tuning", () => {
  it("keeps every normal and giant art path playable for careful and late players", () => {
    const teacher = loadContent().world.critters["art-teacher"];
    if (teacher === undefined || teacher.burst.check.kind !== "trace" ||
      teacher.burst.big?.kind !== "trace")
      throw new Error("art teacher Trace content missing");
    const specs: ReadonlyArray<readonly [string, TraceSpec]> = [
      ["normal", teacher.burst.check], ["big", teacher.burst.big],
    ];
    for (const [size, spec] of specs) {
      for (const path of spec.paths) {
        const one = { ...spec, paths: [path] };
        expect(playTrace(one, { lag: 0 }), `${size} ${path.id} careful`).toBe("great");
        expect(playTrace(one, { lag: 0, pointer: true }), `${size} ${path.id} finger`)
          .toBe("great");
        expect(playTrace(one, { lag: 8 }), `${size} ${path.id} eighth late`).toBe("great");
        expect(playTrace(one, { lag: 15 }), `${size} ${path.id} quarter late`).not.toBe("miss");
        expect(playTrace(one, { lag: 0, idle: true }), `${size} ${path.id} idle`).toBe("miss");
      }
    }
  });
});
