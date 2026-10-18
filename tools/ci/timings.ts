// Records how long each test took in CI, for tools/ci/shard.ts. Every e2e
// shard uploads its Playwright report, and a test's seconds are its mean over
// several green runs (runners differ by half again in speed):
//
//   just timings                      # the last three green runs on main
//   bun tools/ci/timings.ts --last 5  # the last five
//   bun tools/ci/timings.ts reports/*/*/report.json
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

function gh(args: string[]): string {
  const result = spawnSync("gh", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`gh ${args.join(" ")}: ${result.stderr}`);
  return result.stdout;
}

function isRunList(value: unknown): value is { databaseId: number }[] {
  return Array.isArray(value) && value.every((run) => typeof run === "object" && run !== null &&
    "databaseId" in run && typeof run.databaseId === "number");
}

// The e2e reports of the last `count` green CI runs on main, downloaded into
// `dir`.
function downloadReports(count: number, dir: string): string[] {
  const runs: unknown = JSON.parse(gh(["run", "list", "--branch", "main", "--workflow", "ci.yml",
    "--status", "success", "--limit", String(count), "--json", "databaseId"]));
  if (!isRunList(runs) || runs.length === 0) throw new Error("no green CI runs on main");
  for (const { databaseId } of runs)
    gh(["run", "download", String(databaseId), "--pattern", "e2e-report-*",
      "--dir", join(dir, String(databaseId))]);
  console.log(`runs ${runs.map((run) => run.databaseId).join(", ")}`);
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith("report.json")).map((path) => join(dir, path));
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  const last = args[0] === "--last" ? Number(args[1] ?? 3) : null;
  if (args.length === 0 || (last !== null && (!Number.isInteger(last) || last < 1)))
    throw new Error("usage: bun tools/ci/timings.ts --last <runs> | <report.json>...");
  const dir = last === null ? null : mkdtempSync(join(tmpdir(), "cloverhollow-timings-"));
  try {
    const reports = dir === null || last === null ? args : downloadReports(last, dir);
    const tests = reports.flatMap((path) => reportTests(parseReport(readFileSync(path, "utf8"))));
    writeFileSync("tests/e2e/timings.json", `${JSON.stringify(testTimings(tests), null, 2)}\n`);
    console.log(`tests/e2e/timings.json: ${tests.length} tests from ${reports.length} reports`);
  } finally {
    if (dir !== null) rmSync(dir, { recursive: true, force: true });
  }
}
