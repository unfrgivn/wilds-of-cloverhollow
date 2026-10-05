import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const bundleId = "com.unfrgivn.cloverhollow";
type Frame = { width: number; height: number };
type State = {
  tick: number;
  area: string;
  x: number;
  y: number;
  facing: string;
};

function resolveUdid(): string {
  const result = spawnSync("bun", ["tools/ios/sim.ts", "id"], {
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function findAxe(): string {
  const candidates: string[] = [];
  if (process.env.AXE_PATH !== undefined) candidates.push(process.env.AXE_PATH);
  const pathResult = spawnSync("sh", ["-lc", "command -v axe"], {
    encoding: "utf8",
  });
  if (pathResult.status === 0 && pathResult.stdout.trim() !== "") {
    candidates.push(pathResult.stdout.trim());
  }
  const npxRoot = join(homedir(), ".npm", "_npx");
  if (existsSync(npxRoot)) {
    for (const entry of readdirSync(npxRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      candidates.push(
        join(npxRoot, entry.name, "node_modules/mobilebuildmcp/bundled/axe"),
      );
    }
  }
  const axe = candidates.find((candidate) => existsSync(candidate));
  if (axe === undefined) {
    throw new Error(
      "AXe was not found. Set AXE_PATH, install axe on PATH, or run " +
        "brew install cameroncooke/axe/axe.",
    );
  }
  return axe;
}

function runAxe(axe: string, args: string[]): string {
  const result = spawnSync(axe, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

function readFrame(axe: string, udid: string): Frame {
  const parsed: unknown = JSON.parse(runAxe(axe, ["describe-ui", "--udid", udid]));
  if (!Array.isArray(parsed)) throw new Error("AXe describe-ui returned no tree");
  const root = parsed[0];
  if (typeof root !== "object" || root === null || !("frame" in root)) {
    throw new Error("AXe describe-ui did not return an application frame");
  }
  const frame = root.frame;
  if (
    typeof frame !== "object" || frame === null ||
    !("width" in frame) || !("height" in frame) ||
    typeof frame.width !== "number" || typeof frame.height !== "number"
  ) {
    throw new Error("AXe application frame is malformed");
  }
  return { width: frame.width, height: frame.height };
}

function parseStates(line: string): State[] {
  const match = line.match(/\[cloverhollow\] state (\{.*\})/);
  if (match === null || match[1] === undefined) return [];
  const parsed: unknown = JSON.parse(match[1]);
  if (typeof parsed !== "object" || parsed === null) return [];
  if (
    "tick" in parsed && typeof parsed.tick === "number" &&
    "area" in parsed && typeof parsed.area === "string" &&
    "x" in parsed && typeof parsed.x === "number" &&
    "y" in parsed && typeof parsed.y === "number" &&
    "facing" in parsed && typeof parsed.facing === "string"
  ) {
    return [{
      tick: parsed.tick,
      area: parsed.area,
      x: parsed.x,
      y: parsed.y,
      facing: parsed.facing,
    }];
  }
  return [];
}

async function consume(
  stream: ReadableStream<Uint8Array>,
  transcript: { write: (text: string) => void },
  states: State[],
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      pending += decoder.decode(result.value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        transcript.write(`${line}\n`);
        states.push(...parseStates(line));
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function waitFor(
  states: State[],
  predicate: (items: State[]) => boolean,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate(states)) return;
    await Bun.sleep(200);
  }
  throw new Error(
    "No Cloverhollow state line arrived in 20 seconds; " +
      "is the harness build installed? run just ios-sim",
  );
}

async function main(): Promise<void> {
  const udid = resolveUdid();
  const axe = findAxe();
  const frame = readFrame(axe, udid);
  const directory = join(
    process.env.TMPDIR ?? "/tmp",
    "cloverhollow-ios-smoke",
    `${Date.now()}`,
  );
  mkdirSync(directory, { recursive: true });
  const transcriptPath = join(directory, "console-pty.log");
  writeFileSync(transcriptPath, "");
  const transcript = { write: (text: string): void => appendFileSync(transcriptPath, text) };
  const states: State[] = [];
  const child = Bun.spawn({
    cmd: [
      "xcrun", "simctl", "launch", "--console-pty",
      "--terminate-running-process", udid, bundleId,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = child.stdout;
  const stderr = child.stderr;
  if (stdout === null || stderr === null) throw new Error("console-pty had no pipes");
  const output = consume(stdout, transcript, states);
  const errors = consume(stderr, transcript, states);
  try {
    await waitFor(states, (items) => items.length > 0);
    const before = states[0];
    if (before === undefined) throw new Error("Initial state line disappeared");
    const beforeScreenshot = join(directory, "before.png");
    execFileSync("xcrun", ["simctl", "io", udid, "screenshot", beforeScreenshot]);
    const startX = Math.round(frame.width * 0.17);
    const startY = Math.round(frame.height * 0.62);
    runAxe(axe, [
      "swipe", "--start-x", String(startX), "--start-y", String(startY),
      "--end-x", String(startX + 80), "--end-y", String(startY),
      "--duration", "2.0", "--udid", udid,
    ]);
    await waitFor(
      states,
      (items) => items.some((item) => item.tick > before.tick && item.x >= before.x + 50),
    );
    const after = states[states.length - 1];
    if (after === undefined) throw new Error("Final state line disappeared");
    const afterScreenshot = join(directory, "after.png");
    execFileSync("xcrun", ["simctl", "io", udid, "screenshot", afterScreenshot]);
    if (after.tick <= before.tick || after.x < before.x + 50 || after.facing !== "right") {
      throw new Error(
        `Native drag failed: before=${JSON.stringify(before)} ` +
          `after=${JSON.stringify(after)}`,
      );
    }
    console.log(`before: ${JSON.stringify(before)}`);
    console.log(`after: ${JSON.stringify(after)}`);
    console.log(`console transcript: ${transcriptPath}`);
    console.log(`before screenshot: ${beforeScreenshot}`);
    console.log(`after screenshot: ${afterScreenshot}`);
  } catch (error: unknown) {
    const lines = readFileSync(transcriptPath, "utf8").trimEnd().split("\n");
    console.error("last console lines:");
    console.error(lines.slice(-40).join("\n"));
    throw error;
  } finally {
    child.kill();
    await Promise.all([output, errors]);
  }
}

await main();
