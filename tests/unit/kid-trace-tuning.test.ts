import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import type { TraceSpec } from "../../src/core";
import { playTrace } from "./trace-players";

describe("hooded kid Trace tuning", () => {
  it("keeps every kid path playable for careful, late, and pointer players", () => {
    const kid = loadContent().world.critters["hooded-kid"];
    if (kid === undefined || kid.burst.check?.kind !== "trace" || kid.burst.big?.kind !== "trace")
      throw new Error("hooded kid Trace content missing");
    const specs: ReadonlyArray<readonly [string, TraceSpec]> = [
      ["normal", kid.burst.check], ["big", kid.burst.big],
    ];
    for (const [name, spec] of specs) {
      for (const path of spec.paths) {
        const one = { ...spec, paths: [path] };
        expect(playTrace(one, { lag: 0 }), `${name} ${path.id} careful`).toBe("great");
        expect(playTrace(one, { lag: 8 }), `${name} ${path.id} 8 ticks late`).toBe("great");
        if (name === "normal")
          expect(playTrace(one, { lag: 15 }), `${path.id} 15 ticks late`).not.toBe("miss");
        expect(playTrace(one, { lag: 0, pointer: true }), `${name} ${path.id} pointer`)
          .toBe("great");
        expect(playTrace(one, { lag: 0, idle: true }), `${name} ${path.id} idle`).toBe("miss");
      }
    }
  });
});
