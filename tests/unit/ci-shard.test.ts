import { describe, expect, it } from "vitest";
import { listLine, parseReport, parseTimings, reportTests, type Test }
  from "../../tools/ci/report";
import { onRunner, plan, units, weigh } from "../../tools/ci/shard";
import { testTimings } from "../../tools/ci/timings";

function test(project: string, file: string, ...titles: string[]): Test {
  return { project, file, titles, seconds: 0 };
}

function timed(entries: [Test, number][]): Record<string, number> {
  return Object.fromEntries(entries.map(([each, seconds]) => [listLine(each), seconds]));
}

describe("CI shard plan", () => {
  it("weighs a test by its record, and one with none by its project's median", () => {
    const tests = [...["a", "b", "c", "d"].map((name) => test("chromium", "x.spec.ts", name)),
      test("webkit", "x.spec.ts", "a")];
    const timings = { "[chromium] › x.spec.ts › a": 2, "[chromium] › x.spec.ts › b": 9,
      "[chromium] › x.spec.ts › c": 4 };
    // Chromium's median of 2, 4, and 9 is 4; WebKit has no record, so 1.
    expect(weigh(tests, timings)).toEqual([2, 9, 4, 4, 1]);
  });

  it("cuts only a file longer than half a shard, by time, in order", () => {
    // Heavy replays first, light checks after, like harness.spec.ts.
    const long = Array.from({ length: 8 }, (_, index) =>
      test("webkit", "long.spec.ts", `${index}`));
    const short = ["x", "y", "z"].map((name) => test("webkit", `${name}.spec.ts`, name));
    const timings = timed([...long.map((each, index): [Test, number] =>
      [each, index < 2 ? 20 : 2]), ...short.map((each): [Test, number] => [each, 8])]);
    // 76 s over 2 shards: past 19 s a file is cut. The long one (52 s) is cut
    // in three where its running total passes each third (17 and 35 s): after
    // each heavy replay, where cutting by count would put both in one run.
    const planned = units([...long, ...short], timings, 2);
    expect(planned.map((unit) => [unit.tests.length, unit.seconds]))
      .toEqual([[1, 20], [1, 20], [6, 12], [1, 8], [1, 8], [1, 8]]);
    expect(planned.slice(0, 3).flatMap((unit) => unit.tests)).toEqual(long);
  });

  it("runs every test once, each file's tests together, shards within one unit", () => {
    const tests = Array.from({ length: 23 }, (_, index) =>
      test("chromium", `${index % 7}.spec.ts`, `test ${index}`));
    // 1 to 7 s a test: no file passes half of two shards, none is cut.
    const timings = timed(tests.map((each, index): [Test, number] => [each, index % 7 + 1]));
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

  it("runs only the listed spec files on Linux, and every other on a Mac", () => {
    const tests = [test("chromium", "ui-gallery-checks.spec.ts", "sticker gallery", "a"),
      test("chromium", "footsteps.spec.ts", "b"), test("chromium", "ui-gallery.spec.ts", "c")];
    expect(onRunner(tests, "linux").map((each) => each.file))
      .toEqual(["ui-gallery-checks.spec.ts"]);
    expect(onRunner(tests, "macos").map((each) => each.file))
      .toEqual(["footsteps.spec.ts", "ui-gallery.spec.ts"]);
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

  it("records each test's seconds by its list line", () => {
    expect(testTimings(reportTests(parseReport(report)))).toEqual({
      "[chromium] › bay.spec.ts › arrive": 1.5,
      "[chromium] › bay.spec.ts › dock › walk": 1,
      "[webkit] › bay.spec.ts › arrive": 2.3,
    });
  });

  it("averages a test over several runs' reports", () => {
    const tests = reportTests(parseReport(report));
    const slower = tests.map((each) => ({ ...each, seconds: each.seconds * 2 }));
    expect(testTimings([...tests, ...slower])["[chromium] › bay.spec.ts › arrive"]).toBe(2.3);
  });

  it("rejects what isn't a Playwright report or a timings file", () => {
    expect(() => parseReport(JSON.stringify({ suites: [{ specs: [] }] }))).toThrow();
    expect(() => parseTimings(JSON.stringify({ "[chromium] › a.spec.ts › a": "10" }))).toThrow();
  });
});
