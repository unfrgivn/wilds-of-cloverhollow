// Playwright's JSON report, from a run (`--reporter=json`) or a listing
// (`--list --reporter=json`): files hold describes, describes hold specs, and
// each spec has one test per project it runs in, with a result per attempt
// (none when only listed).
export type ReportTest = { projectName: string; results: { duration: number }[] };
export type ReportSpec = { title: string; file: string; tests: ReportTest[] };
export type ReportSuite = { title: string; suites?: ReportSuite[]; specs?: ReportSpec[] };

export type Test = { project: string; file: string; titles: string[]; seconds: number };
// Seconds per test, keyed by `listLine`.
export type Timings = Record<string, number>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTest(value: unknown): value is ReportTest {
  return isRecord(value) && typeof value.projectName === "string" &&
    Array.isArray(value.results) &&
    value.results.every((result) => isRecord(result) && typeof result.duration === "number");
}

function isSpec(value: unknown): value is ReportSpec {
  return isRecord(value) && typeof value.title === "string" && typeof value.file === "string" &&
    Array.isArray(value.tests) && value.tests.every(isTest);
}

function isSuite(value: unknown): value is ReportSuite {
  return isRecord(value) && typeof value.title === "string" &&
    (value.suites === undefined || (Array.isArray(value.suites) && value.suites.every(isSuite))) &&
    (value.specs === undefined || (Array.isArray(value.specs) && value.specs.every(isSpec)));
}

export function parseReport(text: string): ReportSuite[] {
  const report: unknown = JSON.parse(text);
  if (!isRecord(report) || !Array.isArray(report.suites) || !report.suites.every(isSuite))
    throw new Error("not a Playwright JSON report");
  return report.suites;
}

export function parseTimings(text: string): Timings {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error("timings: expected an object");
  const timings: Timings = {};
  for (const [key, seconds] of Object.entries(parsed)) {
    if (typeof seconds !== "number") throw new Error(`timings: ${key} is not a number`);
    timings[key] = seconds;
  }
  return timings;
}

export function reportTests(files: ReportSuite[]): Test[] {
  const tests: Test[] = [];
  const visit = (suite: ReportSuite, titles: string[]): void => {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests)
        tests.push({
          project: test.projectName,
          file: spec.file,
          titles: [...titles, spec.title],
          seconds: test.results.reduce((sum, result) => sum + result.duration, 0) / 1000,
        });
    for (const child of suite.suites ?? []) visit(child, [...titles, child.title]);
  };
  // A file's own suite is titled with its path, which isn't a title.
  for (const file of files) visit(file, []);
  return tests;
}

export function fileKey(test: Pick<Test, "project" | "file">): string {
  return `[${test.project}] ${test.file}`;
}

// One line of Playwright's --test-list format; tests/e2e/timings.json keys its
// seconds by it.
export function listLine(test: Pick<Test, "project" | "file" | "titles">): string {
  return [`[${test.project}]`, test.file, ...test.titles].join(" › ");
}
