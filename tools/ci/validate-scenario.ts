import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type ScenarioEvidence = {
  trace: unknown;
  log: string;
  captureDirectory: string;
  requestedCaptureLabels: string[];
  rendered: boolean;
  expectedTraceError?: string;
};

export type ValidationResult = { ok: boolean; errors: string[] };

export function validateScenarioEvidence(evidence: ScenarioEvidence): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(evidence.trace)) return { ok: false, errors: ["trace must be an object"] };

  const traceErrors = readStringArray(evidence.trace.errors, "trace.errors", errors);
  const traceEvents = readEventArray(evidence.trace.events, errors);
  const badEvents = traceEvents.filter((event) => event.type === "error" || event.type === "noop");
  const failedAssertions = traceEvents.filter((event) => event.passed === false);

  if (evidence.trace.passed !== true) errors.push("trace.passed must be true");
  if (traceErrors.length > 0) errors.push("trace contains errors");
  if (badEvents.length > 0) errors.push("trace contains error/noop events");
  if (failedAssertions.length > 0) errors.push("trace contains failed assertion events");
  if (/ERROR:|SCRIPT ERROR:|Parse Error:/.test(evidence.log)) {
    errors.push("Godot log contains SCRIPT ERROR/Parse Error");
  }
  if (evidence.expectedTraceError !== undefined && !traceErrors.includes(evidence.expectedTraceError)) {
    errors.push(`trace missing expected error: ${evidence.expectedTraceError}`);
  }

  if (evidence.rendered) {
    const files = existingFiles(evidence.captureDirectory);
    for (const label of evidence.requestedCaptureLabels) {
      const matching = files.filter((file) => file.endsWith(`_${label}.png`));
      if (matching.length === 0) {
        errors.push(`missing capture: ${label}`);
        continue;
      }
      if (!matching.some((file) => isNonemptyPng(file))) errors.push(`invalid capture: ${label}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown, name: string, errors: string[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    errors.push(`${name} must be a string array`);
    return [];
  }
  return value;
}

type TraceEvent = Record<string, unknown> & { type?: unknown };

function readEventArray(value: unknown, errors: string[]): TraceEvent[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isRecord)) {
    errors.push("trace.events must be an object array");
    return [];
  }
  return value;
}

function existingFiles(directory: string): string[] {
  try {
    return readdirSync(directory).map((file) => join(directory, file)).filter((file) => statSync(file).isFile());
  } catch {
    return [];
  }
}

function isNonemptyPng(file: string): boolean {
  try {
    const bytes = readFileSync(file);
    return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  } catch {
    return false;
  }
}

function cli(): number {
  const args = process.argv.slice(2);
  const tracePath = valueAfter(args, "--trace");
  const logPath = valueAfter(args, "--log");
  const captureDirectory = valueAfter(args, "--captures");
  const expectedTraceError = valueAfter(args, "--expected-error");
  if (!tracePath || !logPath || !captureDirectory) {
    console.error("usage: validate-scenario.ts --trace FILE --log FILE --captures DIR [--rendered] [--expected-error TEXT]");
    return 2;
  }
  let trace: unknown;
  try {
    trace = JSON.parse(readFileSync(tracePath, "utf8"));
  } catch (error) {
    console.error(`invalid trace: ${String(error)}`);
    return 1;
  }
  const labels: string[] = [];
  if (isRecord(trace) && Array.isArray(trace.events)) {
    for (const event of trace.events) {
      if (isRecord(event) && event.type === "capture" && typeof event.label === "string" && event.label !== "") {
        labels.push(event.label);
      }
    }
  }
  const result = validateScenarioEvidence({
    trace,
    log: readFileSync(logPath, "utf8"),
    captureDirectory,
    requestedCaptureLabels: labels,
    rendered: args.includes("--rendered"),
    expectedTraceError,
  });
  if (!result.ok) {
    for (const error of result.errors) console.error(`validation error: ${error}`);
    return 1;
  }
  console.log("evidence valid");
  return 0;
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

if (import.meta.main) process.exit(cli());
