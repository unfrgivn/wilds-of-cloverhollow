#!/usr/bin/env bun
import { mkdir, mkdtemp, rm, writeFile, copyFile, stat, readFile } from "node:fs/promises";
import { join, basename, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

export type ReviewOptions = {
  input: string;
  goal: string;
  model: string;
  output: string;
};

const DEFAULT_MODEL = "github-copilot/gemini-3.5-flash";
const DEFAULT_GOAL = "Transcribe visible dialogue prompts and choices exactly. Report clipped environment labels separately.";
const PROMPT = "Use only the attached image. Do not use tools, delegation, or files. Describe only visually supported details, not expected contents or filename hints. If text is present, transcribe it exactly; if there is no text, say so. Identify clipping separately. If you cannot see the image, say so. Do not infer or invent text.";
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

export function parseArgs(args: string[], environment: Record<string, string | undefined> = process.env): ReviewOptions {
  const positional: string[] = [];
  let model = environment.GODOT_VISION_MODEL ?? DEFAULT_MODEL;
  let output: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--model") {
      model = args[++index] ?? "";
    } else if (argument === "--output") {
      output = args[++index];
    } else if (argument.startsWith("--")) {
      throw new Error(`unknown option: ${argument}`);
    } else {
      positional.push(argument);
    }
  }
  if (positional.length < 1 || positional.length > 2) {
    throw new Error("usage: review-capture.ts INPUT.png [GOAL] --output OUTPUT.txt [--model PROVIDER/MODEL]");
  }
  if (!output) {
    throw new Error("--output is required; review text is never written implicitly");
  }
  if (!model) {
    throw new Error("model cannot be empty");
  }
  return { input: positional[0], goal: positional[1] ?? DEFAULT_GOAL, model, output };
}

export function validatePngHeader(bytes: Uint8Array): void {
  if (bytes.length < 33 || !PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
    throw new Error("input is not a regular PNG");
  }
  const chunkLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8);
  const chunkType = new TextDecoder().decode(bytes.slice(12, 16));
  const width = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16);
  const height = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(20);
  if (chunkLength !== 13 || chunkType !== "IHDR" || width === 0 || height === 0) {
    throw new Error("input is not a regular PNG with a valid IHDR");
  }
}

export function validateReviewPaths(input: string, output: string, outputExists: boolean): void {
  if (resolve(input) === resolve(output)) throw new Error("output must be separate from input");
  if (outputExists) throw new Error(`output exists: ${output}`);
}

async function runReview(options: ReviewOptions): Promise<string> {
  const input = resolve(options.input);
  const output = resolve(options.output);
  const inputInfo = await stat(input).catch(() => undefined);
  if (!inputInfo?.isFile()) throw new Error(`input file not found: ${options.input}`);
  validatePngHeader(new Uint8Array(await readFile(input)));
  validateReviewPaths(input, output, await stat(output).then(() => true).catch(() => false));

  const tempRoot = join(tmpdir(), "opencode");
  await mkdir(tempRoot, { recursive: true });
  await mkdir(dirname(output), { recursive: true });
  const workdir = await mkdtemp(join(tempRoot, "capture-review-"));
  try {
    const attached = join(workdir, basename(input));
    await copyFile(input, attached);
    await writeFile(join(workdir, "opencode.json"), JSON.stringify({
      "$schema": "https://opencode.ai/config.json",
      "agents": {
        "capture-review": {
          "description": "Transcribe one attached capture without tools or delegation.",
          "mode": "subagent",
          "permissions": [{ "action": "*", "resource": "*", "effect": "deny" }]
        }
      }
    }, null, 2));
    const opencode2 = process.env.OPENCODE2_BIN ?? Bun.which("opencode2") ?? "opencode2";
    const child = Bun.spawn([
      "/bin/sh", "-c", "cd \"$1\" || exit 1; opencode=\"$2\"; shift 2; exec \"$opencode\" \"$@\"", "review-capture", workdir, opencode2,
      "run", "--standalone", "--agent", "capture-review",
      "--model", options.model, "--file", attached, `${PROMPT} Additional goal: ${options.goal}`,
    ], { cwd: workdir, stdout: "pipe", stderr: "pipe" });
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; child.kill("SIGTERM"); }, 110_000);
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    clearTimeout(timeout);
    if (timedOut) throw new Error("vision review timed out after 110 seconds");
    if (exitCode !== 0) throw new Error(`vision model unavailable or failed (exit ${exitCode}): ${stderr.trim().slice(0, 500)}`);
    if (!stdout.trim()) throw new Error("vision model returned no review text");
    return `${stdout.trim()}\n`;
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

export async function main(args: string[] = Bun.argv.slice(2)): Promise<number> {
  try {
    const options = parseArgs(args);
    const review = await runReview(options);
    await writeFile(resolve(options.output), review, { flag: "wx" });
    process.stdout.write(`Wrote capture review to ${options.output}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`capture review failed: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (import.meta.main) process.exit(await main());
