import { describe, expect, test } from "bun:test";
import { validateScenarioEvidence } from "../tools/ci/validate-scenario.ts";

describe("scenario evidence validation", () => {
  test("rejects failed traces, engine script errors, and missing captures", () => {
    const result = validateScenarioEvidence({
      trace: {
        passed: false,
        errors: ["Scenario file not found: res://tests/scenarios/missing.json"],
        events: [{ type: "error" }],
      },
      log: "SCRIPT ERROR: Parse Error: Unexpected token",
      captureDirectory: "/does/not/exist",
      requestedCaptureLabels: ["start"],
      rendered: true,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "trace.passed must be true",
      "trace contains errors",
      "trace contains error/noop events",
      "Godot log contains SCRIPT ERROR/Parse Error",
      "missing capture: start",
    ]);
  });

  test("rejects unknown actions recorded as no-ops", () => {
    const result = validateScenarioEvidence({
      trace: { passed: true, errors: [], events: [{ type: "noop" }] },
      log: "",
      captureDirectory: ".",
      requestedCaptureLabels: [],
      rendered: false,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("trace contains error/noop events");
  });

  test("requires the exact expected error for a missing scenario", () => {
    const result = validateScenarioEvidence({
      trace: { passed: false, errors: ["unrelated startup error"], events: [{ type: "error" }] },
      log: "",
      captureDirectory: ".",
      requestedCaptureLabels: [],
      rendered: false,
      expectedTraceError: "Scenario file not found: res://tests/scenarios/missing.json",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "trace missing expected error: Scenario file not found: res://tests/scenarios/missing.json",
    );
  });

  test("rejects an action list that quit before exhaustion", () => {
    const result = validateScenarioEvidence({
      trace: {
        passed: false,
        errors: ["Scenario did not exhaust all actions before quit."],
        events: [{ type: "error" }],
      },
      log: "",
      captureDirectory: ".",
      requestedCaptureLabels: [],
      rendered: false,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("trace contains errors");
  });

  test("accepts a clean completed trace", () => {
    const result = validateScenarioEvidence({
      trace: { passed: true, errors: [], events: [{ type: "capture", label: "start" }] },
      log: "Godot started cleanly",
      captureDirectory: ".",
      requestedCaptureLabels: [],
      rendered: false,
    });

    expect(result).toEqual({ ok: true, errors: [] });
  });

  test("rejects malformed trace collection shapes", () => {
    const result = validateScenarioEvidence({
      trace: { passed: true, errors: "none", events: { type: "capture" } },
      log: "",
      captureDirectory: ".",
      requestedCaptureLabels: [],
      rendered: false,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "trace.errors must be a string array",
      "trace.events must be an object array",
    ]);
  });

  test("rejects failed assertion events", () => {
    const result = validateScenarioEvidence({
      trace: { passed: true, errors: [], events: [{ type: "check_example", passed: false }] },
      log: "",
      captureDirectory: ".",
      requestedCaptureLabels: [],
      rendered: false,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("trace contains failed assertion events");
  });
});
