// Records how long each test took in CI, for tools/ci/shard.ts. Every e2e
// shard uploads its Playwright report; after a green run (or several: runners
// differ by half again in speed, so a test's seconds are its mean):
//
//   gh run download <run id> --pattern 'e2e-report-*' --dir reports/<run id>
//   bun tools/ci/timings.ts reports/*/*/report.json
import { readFileSync, writeFileSync } from "node:fs";
import { listLine, parseReport, reportTests, type Test, type Timings } from "./report";

// Mean seconds per test over the reports given, to a tenth, in key order.
export function testTimings(tests: Test[]): Timings {
  const seconds = new Map<string, number[]>();
  for (const test of tests)
    seconds.set(listLine(test), [...(seconds.get(listLine(test)) ?? []), test.seconds]);
  return Object.fromEntries([...seconds].sort(([a], [b]) => a.localeCompare(b))
    .map(([key, runs]) => [key,
      Math.round(runs.reduce((sum, value) => sum + value, 0) / runs.length * 10) / 10]));
}

if (import.meta.main) {
  const reports = Bun.argv.slice(2);
  if (reports.length === 0) throw new Error("usage: bun tools/ci/timings.ts <report.json>...");
  const tests = reports.flatMap((path) => reportTests(parseReport(readFileSync(path, "utf8"))));
  writeFileSync("tests/e2e/timings.json", `${JSON.stringify(testTimings(tests), null, 2)}\n`);
  console.log(`tests/e2e/timings.json: ${tests.length} tests`);
}
