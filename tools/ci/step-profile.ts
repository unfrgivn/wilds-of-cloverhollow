// Sums where e2e time goes: each test's browser calls, expects, and fixtures
// by kind, plus the rest (test code in Node, such as Bun hash replays).
// Writes $STEP_PROFILE (default step-profile.json).
import { writeFileSync } from "node:fs";
import type { Reporter, TestCase, TestResult, TestStep } from "@playwright/test/reporter";

const counted = new Set(["pw:api", "expect", "fixture"]);

function label(step: TestStep): string {
  // An expect's matcher stays ("toHaveScreenshot"), and a fixture's name;
  // a call's arguments go.
  const title = step.category === "expect" ? step.title.replace(/\(.*?\)/g, "")
    : step.category === "fixture" ? step.title
    : step.title.replace(/"[^"]*"/g, "\"…\"").replace(/\(.*$/, "");
  // Evaluates are the harness's steps and reads: split them by how long.
  const bucket = step.title !== "Evaluate" ? ""
    : step.duration < 10 ? " <10ms" : step.duration < 100 ? " 10-100ms"
    : step.duration < 1000 ? " 100ms-1s" : " >1s";
  return `${step.category} ${title.slice(0, 60)}${bucket}`;
}

// Inside a counted step (an expect's own screenshots, a fixture's calls).
function nested(step: TestStep): boolean {
  for (let parent = step.parent; parent !== undefined; parent = parent.parent)
    if (counted.has(parent.category)) return true;
  return false;
}

type Total = { ms: number; count: number };

export default class StepProfile implements Reporter {
  private readonly totals = new Map<string, Total>();
  private readonly tests: { test: string; ms: number; top: [string, number][] }[] = [];
  private readonly running = new Map<TestResult, Map<string, number>>();

  private add(key: string, ms: number, mine: Map<string, number>): void {
    const total = this.totals.get(key) ?? { ms: 0, count: 0 };
    total.ms += ms;
    total.count += 1;
    this.totals.set(key, total);
    mine.set(key, (mine.get(key) ?? 0) + ms);
  }

  onStepEnd(_test: TestCase, result: TestResult, step: TestStep): void {
    if (!counted.has(step.category) || nested(step)) return;
    const mine = this.running.get(result) ?? new Map<string, number>();
    this.running.set(result, mine);
    this.add(label(step), step.duration, mine);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const mine = this.running.get(result) ?? new Map<string, number>();
    const stepped = [...mine.values()].reduce((sum, ms) => sum + ms, 0);
    this.add("other (test code)", Math.max(0, result.duration - stepped), mine);
    this.tests.push({ test: test.titlePath().filter(Boolean).join(" › "), ms: result.duration,
      top: [...mine].sort((a, b) => b[1] - a[1]).slice(0, 6) });
    this.running.delete(result);
  }

  onEnd(): void {
    writeFileSync(process.env.STEP_PROFILE ?? "step-profile.json", JSON.stringify({
      totals: Object.fromEntries([...this.totals].sort((a, b) => b[1].ms - a[1].ms)),
      tests: this.tests,
    }, null, 1));
  }
}
