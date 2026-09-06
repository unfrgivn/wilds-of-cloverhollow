import { readFile, readdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

type ImageResult = { name: string; status: "match" | "different" | "error"; detail?: string };

function imageMagickCommand(tool: "compare" | "identify", args: string[]): string[] {
  if (Bun.which("magick") !== null) return ["magick", tool, ...args];
  if (Bun.which(tool) !== null) return [tool, ...args];
  throw new Error(`ImageMagick is required: install magick or ${tool}`);
}

async function pngs(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

async function compareImage(baseline: string, capture: string, diff: string): Promise<ImageResult> {
  try {
    const dimensions = async (file: string): Promise<string> => {
      const identify = Bun.spawn(imageMagickCommand("identify", ["-format", "%w:%h", file]), { stdout: "pipe", stderr: "pipe" });
      const output = (await new Response(identify.stdout).text()).trim();
      const error = (await new Response(identify.stderr).text()).trim();
      const exitCode = await identify.exited;
      if (exitCode !== 0 || !/^\d+:\d+$/.test(output)) throw new Error(error || `ImageMagick identify exited ${exitCode}`);
      return output;
    };
    const [baselineDimensions, captureDimensions] = await Promise.all([dimensions(baseline), dimensions(capture)]);
    if (baselineDimensions !== captureDimensions) return { name: baseline, status: "different", detail: `dimensions differ (${baselineDimensions} vs ${captureDimensions})` };
    const process = Bun.spawn(imageMagickCommand("compare", ["-metric", "AE", baseline, capture, diff]), { stdout: "pipe", stderr: "pipe" });
    const stderr = (await new Response(process.stderr).text()).trim();
    const exitCode = await process.exited;
    if (exitCode === 0 && /^0(?:\s|$)/.test(stderr)) return { name: baseline, status: "match" };
    if (exitCode === 1 && /^\d+$/.test(stderr)) return { name: baseline, status: "different", detail: `${stderr} pixels differ` };
    return { name: baseline, status: "error", detail: stderr || `ImageMagick exited ${exitCode}` };
  } catch (error) {
    return { name: baseline, status: "error", detail: error instanceof Error ? error.message : String(error) };
  }
}

export async function compareDirectories(baselineDirectory: string, captureDirectory: string, diffDirectory: string): Promise<number> {
  const baselineFiles = await pngs(baselineDirectory);
  const captureFiles = await pngs(captureDirectory);
  if (baselineFiles.length === 0) {
    console.error(`ERROR: baseline is missing or empty: ${baselineDirectory}`);
    return 1;
  }
  if (captureFiles.length === 0) {
    console.error(`ERROR: capture is missing or empty: ${captureDirectory}`);
    return 1;
  }
  const expected = new Set(baselineFiles);
  const actual = new Set(captureFiles);
  let failures = 0;
  for (const name of baselineFiles) {
    if (!actual.has(name)) {
      console.error(`MISSING: ${name}`);
      failures += 1;
      continue;
    }
    const result = await compareImage(join(baselineDirectory, name), join(captureDirectory, name), join(diffDirectory, name));
    if (result.status === "match") {
      await unlink(join(diffDirectory, name)).catch(() => undefined);
      console.log(`MATCH: ${name}`);
    }
    else {
      console.error(`${result.status === "different" ? "DIFF" : "ERROR"}: ${name}${result.detail ? ` (${result.detail})` : ""}`);
      failures += 1;
    }
  }
  for (const name of captureFiles) {
    if (!expected.has(name)) {
      console.error(`NEW: ${name}`);
      failures += 1;
    }
  }
  return failures === 0 ? 0 : 1;
}

async function validateSource(scenario: string, captureDirectory: string): Promise<number> {
  try {
    const value: unknown = JSON.parse(await readFile(join(captureDirectory, "trace.json"), "utf8"));
    if (!isRecord(value)) throw new Error("trace must be an object");
    if (value.scenario_id !== scenario) throw new Error(`trace scenario_id must be ${scenario}`);
    if (value.passed !== true || !Array.isArray(value.errors) || value.errors.length !== 0) throw new Error("trace must be passed with no errors");
    return 0;
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (import.meta.main) {
  const [baseline, capture, diff] = process.argv.slice(2);
  if (baseline === "--validate-source" && capture && diff) process.exit(await validateSource(capture, diff));
  if (!baseline || !capture || !diff) {
    console.error("Usage: visual-evidence.ts <baseline_dir> <capture_dir> <diff_dir>");
    process.exit(2);
  }
  process.exit(await compareDirectories(resolve(baseline), resolve(capture), resolve(diff)));
}
