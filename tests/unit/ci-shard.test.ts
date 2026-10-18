import { describe, expect, it } from "vitest";
import { parseReport, parseTimings, reportTests, type Test } from "../../tools/ci/report";
import { listLine, plan, units } from "../../tools/ci/shard";
import { fileTimings } from "../../tools/ci/timings";

function test(project: string, file: string, ...titles: string[]): Test {
  return { project, file, titles, seconds: 0 };
}

describe("CI shard plan", () => {
  it("weighs a file by its record, and one with none by its project's median per test", () => {
    const tests = [
      test("chromium", "a.spec.ts", "one"), test("chromium", "a.spec.ts", "two"),
      test("chromium", "b.spec.ts", "three"),
      ...["four", "five", "six", "seven"].map((title) => test("chromium", "c.spec.ts", title)),
      ...["eight", "nine", "ten"].map((title) => test("chromium", "new.spec.ts", title)),
      test("webkit", "a.spec.ts", "one"),
    ];
    const timings = { "[chromium] a.spec.ts": 10, "[chromium] b.spec.ts": 30,
      "[chromium] c.spec.ts": 8 };
    // Per test: 5, 30, and 2 recorded, so a new file's three tests weigh 5
    // each; WebKit has nothing recorded, so its test weighs 1.
    expect(units(tests, timings, 1).map((unit) => [unit.tests.length, unit.seconds]))
      .toEqual([[2, 10], [1, 30], [4, 8], [3, 15], [1, 1]]);
  });

  it("splits only a file longer than half a shard, into runs of its tests in order", () => {
    const long = Array.from({ length: 6 }, (_, index) =>
      test("webkit", "long.spec.ts", `${index}`));
    const short = ["x", "y", "z"].map((name) => test("webkit", `${name}.spec.ts`, name));
    const timings = { "[webkit] long.spec.ts": 60, "[webkit] x.spec.ts": 10,
      "[webkit] y.spec.ts": 10, "[webkit] z.spec.ts": 10 };
    // 90 s over 3 shards is 30 each; past 15 s a file splits.
    const planned = units([...long, ...short], timings, 3);
    expect(planned.map((unit) => unit.seconds)).toEqual([10, 20, 10, 20, 10, 10, 10]);
    expect(planned.slice(0, 4).flatMap((unit) => unit.tests)).toEqual(long);
  });

  it("runs every test once, each file's tests together, shards within one unit", () => {
    const tests = Array.from({ length: 23 }, (_, index) =>
      test("chromium", `${index % 7}.spec.ts`, `test ${index}`));
    // 13 to 91 s, 364 in all: no file passes half a shard (91 s), none splits.
    const timings = Object.fromEntries(Array.from({ length: 7 }, (_, index) =>
      [`[chromium] ${index}.spec.ts`, (index + 1) * 13]));
    const shards = plan(tests, timings, 2);
    const lines = shards.flatMap((shard) => shard.tests.map(listLine));
    expect([...lines].sort()).toEqual(tests.map(listLine).sort());
    for (const shard of shards)
      for (const file of new Set(shard.tests.map((each) => each.file)))
        expect(shards.filter((other) => other.tests.some((each) => each.file === file)))
          .toHaveLength(1);
    const loads = shards.map((shard) => shard.seconds);
    const longest = Math.max(...units(tests, timings, 2).map((unit) => unit.seconds));
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(longest);
  });

  it("writes Playwright's --test-list lines", () => {
    expect(listLine(test("webkit", "ui-gallery.spec.ts", "sticker gallery", "journal-full")))
      .toBe("[webkit] › ui-gallery.spec.ts › sticker gallery › journal-full");
  });
});

describe("CI timings", () => {
  const report = JSON.stringify({
    suites: [{
      title: "bay.spec.ts",
      specs: [{ title: "arrive", file: "bay.spec.ts", tests: [
        { projectName: "chromium", results: [{ duration: 1500 }] },
        { projectName: "webkit", results: [{ duration: 2250 }] },
      ] }],
      suites: [{ title: "dock", specs: [{ title: "walk", file: "bay.spec.ts", tests: [
        { projectName: "chromium", results: [{ duration: 1000 }] },
      ] }] }],
    }],
  });

  it("reads each test's titles and seconds from a report, without the file's own title", () => {
    expect(reportTests(parseReport(report))).toEqual([
      { project: "chromium", file: "bay.spec.ts", titles: ["arrive"], seconds: 1.5 },
      { project: "webkit", file: "bay.spec.ts", titles: ["arrive"], seconds: 2.25 },
      { project: "chromium", file: "bay.spec.ts", titles: ["dock", "walk"], seconds: 1 },
    ]);
  });

  it("adds up each file's seconds per project", () => {
    expect(fileTimings(reportTests(parseReport(report))))
      .toEqual({ "[chromium] bay.spec.ts": 2.5, "[webkit] bay.spec.ts": 2.3 });
  });

  it("rejects what isn't a Playwright report or a timings file", () => {
    expect(() => parseReport(JSON.stringify({ suites: [{ specs: [] }] }))).toThrow();
    expect(() => parseTimings(JSON.stringify({ "[chromium] a.spec.ts": "10" }))).toThrow();
  });
});
