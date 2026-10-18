import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, parseSave, stableHash, step } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { qaFlow } from "../../src/shell/qa-flow";

describe("QA menu flow", () => {
  it("wraps, confirms, and cancels without changing the selected pack", () => {
    expect(qaFlow(3, 0, { up: true, down: false, confirm: false, cancel: false }))
      .toEqual({ open: true, selected: 2, action: null });
    expect(qaFlow(3, 2, { up: false, down: true, confirm: true, cancel: false }))
      .toEqual({ open: true, selected: 0, action: 0 });
    expect(qaFlow(3, 1, { up: false, down: false, confirm: false, cancel: true }))
      .toEqual({ open: false, selected: 1, action: null });
  });
});

describe("QA save library", () => {
  it("keeps every pack parseable and fresh, and catches stale run pins", () => {
    const content = loadContent();
    const manifest: { id: string; fixture: string; run: string; tick: number }[] =
      JSON.parse(readFileSync("content/qa/saves.json", "utf8"));
    const template = createState(
      content.world,
      content.fixtures["new-game"] ?? (() => { throw new Error("new-game fixture missing"); })(),
      1,
    );
    for (const pack of manifest) {
      const save = readFileSync(`content/qa/saves/${pack.id}.json`, "utf8");
      const stale = `Pack ${pack.id} is stale; rerun bun tools/qa/build-saves.ts`;
      expect(parseSave(save, template), stale)
        .not.toBeNull();
      let exact = createState(
        content.world,
        content.fixtures[pack.fixture] ?? (() => { throw new Error("fixture missing"); })(), 1,
      );
      const script = parseScript(
        JSON.parse(readFileSync(`tests/sim/scripts/${pack.run}`, "utf8")), pack.run,
      );
      let remaining = pack.tick;
      for (const segment of script) {
        const ticks = Math.min(segment.ticks, remaining);
        for (let index = 0; index < ticks; index += 1)
          exact = step(content.world, exact, segment.frame).state;
        remaining -= ticks;
        if (remaining === 0) break;
      }
      expect(stableHash(exact), stale)
        .toBe(stableHash(parseSave(save, template)));
    }
  });
});
