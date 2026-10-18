// Splits one Playwright project into CI shards of about equal running time.
// Playwright's own --shard splits by test count in file order, which put
// every long gameplay flow in the first of two shards (72 minutes against 7).
// Each test weighs its recorded seconds (tests/e2e/timings.json, from
// tools/ci/timings.ts); a test with no record weighs its project's median.
// Longest first, each spec file goes to the lightest shard, so every shard
// computes the same plan.
//
//   bun tools/ci/shard.ts <project> <shard>/<total> <test-list file>
//   bunx playwright test --project=<project> --test-list <test-list file>
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileKey, listLine, parseReport, parseTimings, reportTests, type Test, type Timings }
  from "./report";

function median(values: number[]): number | undefined {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Each test's recorded seconds, or its project's median with no record.
export function weigh(tests: Test[], timings: Timings): number[] {
  const known = new Map<string, number[]>();
  for (const test of tests) {
    const seconds = timings[listLine(test)];
    if (seconds !== undefined)
      known.set(test.project, [...(known.get(test.project) ?? []), seconds]);
  }
  return tests.map((test) => timings[listLine(test)] ?? median(known.get(test.project) ?? []) ?? 1);
}

// What a shard runs: a spec file's tests in order, or, for a file longer than
// half a shard, a run of them cut at about equal times (harness.spec.ts keeps
// its heavy replays together). A file's tests stay together and in order, as
// in Playwright's own sharding: on CI's WebKit the phone battle scene's corner
// check only passed after the desktop one, and harness.spec.ts shares pages.
export type Unit = { tests: Test[]; seconds: number };

export function units(tests: Test[], timings: Timings, shards: number): Unit[] {
  const weights = weigh(tests, timings);
  const files = new Map<string, { test: Test; seconds: number }[]>();
  tests.forEach((test, index) => files.set(fileKey(test),
    [...(files.get(fileKey(test)) ?? []), { test, seconds: weights[index] ?? 0 }]));
  const limit = weights.reduce((sum, seconds) => sum + seconds, 0) / shards / 2;
  return [...files.values()].flatMap((entries) => {
    const seconds = entries.reduce((sum, entry) => sum + entry.seconds, 0);
    const runs = Math.min(entries.length, Math.max(1, Math.ceil(seconds / limit)));
    const cut: Unit[] = [];
    let run: Unit = { tests: [], seconds: 0 };
    let done = 0;
    for (const entry of entries) {
      run.tests.push(entry.test);
      run.seconds += entry.seconds;
      done += entry.seconds;
      if (cut.length < runs - 1 && done >= seconds * (cut.length + 1) / runs) {
        cut.push(run);
        run = { tests: [], seconds: 0 };
      }
    }
    return run.tests.length > 0 ? [...cut, run] : cut;
  });
}

// Longest first, each unit to the lightest shard (the lower one on a tie).
export function plan(tests: Test[], timings: Timings, shards: number): Unit[] {
  const label = (unit: Unit): string => unit.tests[0] === undefined ? "" : listLine(unit.tests[0]);
  const order = units(tests, timings, shards)
    .sort((a, b) => b.seconds - a.seconds || label(a).localeCompare(label(b)));
  const planned = Array.from({ length: shards }, (): Unit => ({ tests: [], seconds: 0 }));
  for (const unit of order) {
    const lightest = planned.reduce((best, shard) => shard.seconds < best.seconds ? shard : best);
    lightest.tests.push(...unit.tests);
    lightest.seconds += unit.seconds;
  }
  return planned;
}

function listProject(project: string): Test[] {
  const listed = spawnSync("bunx",
    ["playwright", "test", "--list", "--reporter=json", `--project=${project}`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (listed.status !== 0) throw new Error(listed.stderr);
  return reportTests(parseReport(listed.stdout)).filter((test) => test.project === project);
}

if (import.meta.main) {
  const [project, shardArg, out] = Bun.argv.slice(2);
  const [shard, total] = (shardArg ?? "").split("/").map(Number);
  if (project === undefined || out === undefined || shard === undefined ||
    total === undefined || !Number.isInteger(shard) || !Number.isInteger(total) ||
    shard < 1 || shard > total)
    throw new Error("usage: bun tools/ci/shard.ts <project> <shard>/<total> <test-list file>");
  const timings = parseTimings(readFileSync("tests/e2e/timings.json", "utf8"));
  const tests = listProject(project);
  const mine = plan(tests, timings, total)[shard - 1] ?? { tests: [], seconds: 0 };
  writeFileSync(out, mine.tests.map((test) => `${listLine(test)}\n`).join(""));
  console.log(`${project} shard ${shard}/${total}: ${mine.tests.length} of ${tests.length} ` +
    `tests, about ${Math.round(mine.seconds)} s`);
}
