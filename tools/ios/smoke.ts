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
  moving: boolean;
  target: string | null;
};
type Layout = { confirm: Box | null; cancel: Box | null; menu: Box | null };
type Box = { x: number; y: number; width: number; height: number };
type DialogueLog = { open: boolean; speaker: string | null; text: string };

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

// AXe's simulator plumbing fails intermittently (SimulatorKit not reporting
// the rotation it needs for landscape coordinates, or a slow automation
// session); the same command succeeds a moment later.
const transientAxeErrors = [
  "Unable to determine rotated simulator orientation",
  "Timed out creating the simulator remote automation session",
];

function runAxe(axe: string, args: string[]): string {
  for (let attempt = 0; ; attempt += 1) {
    const result = spawnSync(axe, args, { encoding: "utf8" });
    if (result.status === 0) return result.stdout;
    const message = result.stderr || result.stdout;
    const transient = transientAxeErrors.some((text) => message.includes(text));
    if (attempt >= 7 || !transient) throw new Error(message);
    spawnSync("sleep", ["2"]);
  }
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
    && "moving" in parsed && typeof parsed.moving === "boolean"
    && "target" in parsed && (parsed.target === null || typeof parsed.target === "string")
  ) {
    return [{
      tick: parsed.tick,
      area: parsed.area,
      x: parsed.x,
      y: parsed.y,
      facing: parsed.facing,
      moving: parsed.moving,
      target: parsed.target,
    }];
  }
  return [];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function box(value: unknown): value is Box | null {
  if (value === null) return true;
  return record(value) && typeof value.x === "number" && typeof value.y === "number" &&
    typeof value.width === "number" && typeof value.height === "number";
}

function parseLayout(line: string): Layout | undefined {
  const match = line.match(/\[cloverhollow\] layout (\{.*\})/);
  if (match === null || match[1] === undefined) return undefined;
  const value: unknown = JSON.parse(match[1]);
  if (!record(value) || !box(value.confirm) || !box(value.cancel) || !box(value.menu))
    return undefined;
  return { confirm: value.confirm, cancel: value.cancel, menu: value.menu };
}

function parseDialogueBox(line: string): Box | undefined {
  const match = line.match(/\[cloverhollow\] dialogue-box (\{.*\})/);
  if (match?.[1] === undefined) return undefined;
  const parsed: unknown = JSON.parse(match[1]);
  return box(parsed) && parsed !== null ? parsed : undefined;
}

function parseDialogue(line: string): DialogueLog | undefined {
  const match = line.match(/\[cloverhollow\] dialogue (\{.*\})/);
  if (match === null || match[1] === undefined) return undefined;
  const value: unknown = JSON.parse(match[1]);
  if (!record(value) || typeof value.open !== "boolean" ||
      (value.speaker !== null && typeof value.speaker !== "string") ||
      typeof value.text !== "string") return undefined;
  return { open: value.open, speaker: value.speaker, text: value.text };
}

async function consume(
  stream: ReadableStream<Uint8Array>,
  transcript: { write: (text: string) => void },
  states: State[],
  layouts: Layout[],
  dialogues: DialogueLog[],
  dialogueBoxes: Box[],
  pointers: string[],
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
        const layout = parseLayout(line);
        if (layout !== undefined) layouts.push(layout);
        const dialogue = parseDialogue(line);
        if (dialogue !== undefined) dialogues.push(dialogue);
        const dialogueBox = parseDialogueBox(line);
        if (dialogueBox !== undefined) dialogueBoxes.push(dialogueBox);
        if (line.includes("[cloverhollow] pointer ")) pointers.push(line);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function waitFor<T>(
  states: T[],
  predicate: (items: T[]) => boolean,
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
  if (frame.width < frame.height) {
    throw new Error(`The simulator is in portrait (${frame.width}x${frame.height}); ` +
      "run `just ios-smoke`, which runs `just ios-sim` to rotate it first");
  }
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
  const layouts: Layout[] = [];
  const dialogues: DialogueLog[] = [];
  const dialogueBoxes: Box[] = [];
  const pointers: string[] = [];
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
  const output = consume(stdout, transcript, states, layouts, dialogues, dialogueBoxes, pointers);
  const errors = consume(stderr, transcript, states, layouts, dialogues, dialogueBoxes, pointers);
  try {
    await waitFor(states, (items) => items.length > 0);
    const before = states[0];
    if (before === undefined) throw new Error("Initial state line disappeared");
    const beforeScreenshot = join(directory, "before.png");
    execFileSync("xcrun", ["simctl", "io", udid, "screenshot", beforeScreenshot]);
    const startX = Math.round(frame.width * 0.17);
    const startY = Math.round(frame.height * 0.62);
    const until = async (predicate: () => boolean, milliseconds: number): Promise<boolean> => {
      for (let waited = 0; waited < milliseconds; waited += 100) {
        if (predicate()) return true;
        await Bun.sleep(100);
      }
      return predicate();
    };
    // AXe occasionally drops a gesture; the pointer log shows whether it
    // reached the web view, so retry once before failing loudly. `axe drag`
    // sends explicit, evenly spaced moves; `axe swipe` sometimes delivers a
    // whole gesture inside one frame, so the game never sees the stick move.
    const drag = async (dx: number, dy: number, seconds: number): Promise<void> => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const before = pointers.length;
        runAxe(axe, [
          "drag", "--start-x", String(startX), "--start-y", String(startY),
          "--end-x", String(Math.round(startX + dx)), "--end-y", String(Math.round(startY + dy)),
          "--duration", String(seconds), "--udid", udid,
        ]);
        if (await until(() => pointers.length > before, 2000)) return;
      }
      throw new Error("Two AXe drags in a row never reached the web view");
    };
    const latest = (): State => {
      const state = states[states.length - 1];
      if (state === undefined) throw new Error("No state line yet");
      return state;
    };
    // Waits for Fae to stop after a swipe (or for 1.5 s if she never moved).
    const settle = async (after: number): Promise<void> => {
      for (let poll = 0; poll < 15; poll += 1) {
        await Bun.sleep(100);
        if (states.some((item) => item.tick > after && !item.moving)) return;
      }
    };
    // Walk with feedback, one axis at a time, until `done` holds. Each step is
    // a 25 pt drag over 0.6 s: about 45% stick, about 43 units, which measured
    // consistently on the simulator. Full-stick drags vary from 77 to 128
    // units, and a leftward drag sometimes releases late (Fae keeps walking
    // until the next touch), so routes are built to tolerate an overshoot.
    const walkTo = async (goal: { x: number; y: number }, done: (state: State) => boolean,
      label: string, axis: "x" | "y" | "both" = "both"): Promise<State> => {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const current = latest();
        if (done(current)) return current;
        const dx = goal.x - current.x;
        const dy = goal.y - current.y;
        const horizontal = axis === "both" ? Math.abs(dx) >= Math.abs(dy) : axis === "x";
        const sign = Math.sign(horizontal ? dx : dy) || 1;
        await drag(horizontal ? sign * 25 : 0, horizontal ? 0 : sign * 25, 0.6);
        await settle(current.tick);
      }
      throw new Error(`walk to ${label} did not converge: ${JSON.stringify(latest())}`);
    };
    const tapConfirm = async (): Promise<void> => {
      const layout = layouts[layouts.length - 1];
      const confirm = layout?.confirm;
      if (confirm === null || confirm === undefined) throw new Error("No confirm layout");
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const before = pointers.length;
        runAxe(axe, ["touch", "-x", String(Math.round(confirm.x + confirm.width / 2)),
          "-y", String(Math.round(confirm.y + confirm.height / 2)),
          "--down", "--up", "--delay", "0.1", "--udid", udid]);
        if (await until(() => pointers.length > before, 2000)) return;
      }
      throw new Error("Two AXe taps in a row never reached the web view");
    };
    const lastDialogue = (): DialogueLog | undefined => dialogues[dialogues.length - 1];
    await waitFor(layouts, (items) => items.length > 0);
    // The web view drops touches for a moment after launch.
    await Bun.sleep(3000);
    // The window is at (610, 300) on the top wall, right beside the door trigger
    // (x 465-585, y 285-335). Line up past the door's edge first, then walk
    // straight up, so the route can never cut through the door.
    // Anywhere in x 588-660 targets the window from below, so rightward steps
    // (+43 each from x 500) land in it without a leftward correction; leftward
    // drags are the ones AXe sometimes releases late.
    await walkTo({ x: 612, y: 410 }, (state) => !state.moving && state.x >= 588 &&
      state.x <= 660, "the window's column", "x");
    const atWindow = await walkTo({ x: 612, y: 345 }, (state) => state.area === "bedroom" &&
      !state.moving && state.target === "window", "the window", "y");
    await tapConfirm();
    await waitFor(dialogues, (items) => lastDialogue()?.open === true && items.length > 0);
    await Bun.sleep(1500);
    const dialogueScreenshot = join(directory, "dialogue.png");
    execFileSync("xcrun", ["simctl", "io", udid, "screenshot", dialogueScreenshot]);
    const dialogueBox = dialogueBoxes[dialogueBoxes.length - 1];
    const controls = layouts[layouts.length - 1];
    if (dialogueBox === undefined || controls === undefined)
      throw new Error("The dialogue box or the touch layout was not logged");
    const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.width &&
      b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    for (const button of [controls.confirm, controls.cancel]) {
      if (button !== null && overlaps(dialogueBox, button)) {
        throw new Error(`The dialogue box ${JSON.stringify(dialogueBox)} covers a button ` +
          JSON.stringify(button));
      }
    }
    await tapConfirm();
    await waitFor(dialogues, () => lastDialogue()?.text.startsWith("The fountain") === true);
    await Bun.sleep(1500);
    const choicesScreenshot = join(directory, "dialogue-choices.png");
    execFileSync("xcrun", ["simctl", "io", udid, "screenshot", choicesScreenshot]);
    await tapConfirm();
    await waitFor(dialogues, () => lastDialogue()?.text.startsWith("Adventure first") === true);
    for (let tap = 0; tap < 4 && lastDialogue()?.open !== false; tap += 1) {
      await Bun.sleep(1500);
      await tapConfirm();
      await until(() => lastDialogue()?.open === false, 2000);
    }
    await waitFor(dialogues, () => lastDialogue()?.open === false);
    await Bun.sleep(300);
    // Step up into the door trigger's band (y 285-335; safe at x >= 588), then
    // walk left along it, straight into the door.
    await walkTo({ x: latest().x, y: 310 }, (state) => !state.moving && state.y <= 330,
      "the door's row", "y");
    await walkTo({ x: 525, y: latest().y }, (state) => state.area === "plaza",
      "through the door", "x");
    await waitFor(states, (items) => items.some((item) => item.area === "plaza"));
    const plaza = states.find((item) => item.area === "plaza");
    if (plaza === undefined) throw new Error("Plaza state line disappeared");
    const plazaScreenshot = join(directory, "plaza.png");
    execFileSync("xcrun", ["simctl", "io", udid, "screenshot", plazaScreenshot]);
    await drag(80, 0, 2.0);
    await waitFor(
      states,
      (items) => items.some((item) => item.tick > plaza.tick &&
        item.area === "plaza" && item.x >= plaza.x + 50),
    );
    const after = states[states.length - 1];
    if (after === undefined) throw new Error("Final state line disappeared");
    const afterScreenshot = join(directory, "after.png");
    execFileSync("xcrun", ["simctl", "io", udid, "screenshot", afterScreenshot]);
    if (after.tick <= plaza.tick || after.area !== "plaza" ||
        after.x < plaza.x + 50 || after.facing !== "right") {
      throw new Error(
        `Native drag failed: before=${JSON.stringify(before)} ` +
          `after=${JSON.stringify(after)}`,
      );
    }
    console.log(`before: ${JSON.stringify(before)}`);
    console.log(`plaza: ${JSON.stringify(plaza)}`);
    console.log(`after: ${JSON.stringify(after)}`);
    console.log(`states: ${JSON.stringify(states)}`);
    console.log(`console transcript: ${transcriptPath}`);
    console.log(`before screenshot: ${beforeScreenshot}`);
    console.log(`window: ${JSON.stringify(atWindow)}`);
    console.log(`dialogue: ${JSON.stringify(dialogues)}`);
    console.log(`dialogue box: ${JSON.stringify(dialogueBoxes[0])} ` +
      `controls: ${JSON.stringify(layouts[layouts.length - 1])}`);
    console.log(`dialogue screenshot: ${dialogueScreenshot}`);
    console.log(`choices screenshot: ${choicesScreenshot}`);
    console.log(`plaza screenshot: ${plazaScreenshot}`);
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
