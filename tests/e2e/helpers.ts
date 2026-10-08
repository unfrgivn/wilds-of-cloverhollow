import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import type { ActionFrame, State } from "../../src/core";
import { parseScript } from "../../src/content/script";

export async function openHarness(page: Page): Promise<void> {
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
}

export async function resetPaused(
  page: Page,
  fixture = "harness",
): Promise<void> {
  await page.evaluate(async (name) => {
    const hook = window.__cloverhollow;
    if (hook === undefined) throw new Error("hook unavailable");
    await hook.reset({ seed: 1, fixture: name });
  }, fixture);
}

export async function resume(page: Page): Promise<void> {
  await page.evaluate(() => window.__cloverhollow?.resume());
}

export async function step(page: Page, ticks: number): Promise<void> {
  await page.evaluate((count) => window.__cloverhollow?.step(count), ticks);
}

// Queues a whole recorded script in one round trip. A long replay has hundreds
// of segments (chapter one has 290); one evaluate each took over a minute in
// Chromium under load, most of a long flow's time budget.
export async function queueScript(
  page: Page,
  script: { frame: ActionFrame; ticks: number }[],
): Promise<void> {
  await page.evaluate((segments) => {
    for (const segment of segments)
      window.__cloverhollow?.input(segment.frame, segment.ticks);
  }, script);
}

export async function readState(page: Page): Promise<State> {
  const state = await page.evaluate(() => window.__cloverhollow?.getState());
  if (state === undefined) throw new Error("hook unavailable");
  return state;
}

// Walks toward a coordinate on one axis with real keys (Fae walks exactly 4
// units a tick), stopping on arrival, when something stops her (a wall, a
// battle, a conversation), or once a door takes her: the walk ends as its fade
// starts, and the caller steps through it.
export async function walk(page: Page, axis: "x" | "y", target: number): Promise<void> {
  const start = await readState(page);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const before = await readState(page);
    if (before.area !== start.area || before.transition !== null) return;
    const error = target - before.player[axis];
    if (Math.abs(error) <= 2) return;
    const key = axis === "x" ? (error > 0 ? "ArrowRight" : "ArrowLeft")
      : (error > 0 ? "ArrowDown" : "ArrowUp");
    await page.keyboard.down(key);
    await step(page, Math.max(1, Math.min(60, Math.floor(Math.abs(error) / 4))));
    await page.keyboard.up(key);
    if ((await readState(page)).player[axis] === before.player[axis]) return;
  }
}

// The time budget for long real-key flows (a whole battle, or a walk through
// several areas). CI renders in software and runs them many times slower
// than a laptop: the downstairs walk took over 180 s there. A full local run
// (both browsers, five workers) took the trail walk past 90 s.
export const longFlowTimeout = process.env.CI ? 420_000 : 180_000;

// Just the battle, for loops that poll it every step (the full state carries
// the Ink JSON and is slow to ship on CI's software-rendered browsers).
export async function readBattle(page: Page): Promise<State["battle"]> {
  return page.evaluate(() => window.__cloverhollow?.getState().battle ?? null);
}

export async function readHash(page: Page): Promise<string> {
  const hash = await page.evaluate(() => window.__cloverhollow?.hash());
  if (hash === undefined) throw new Error("hook unavailable");
  return hash;
}

export async function renderInfo(page: Page): Promise<{
  area: string;
  drawOrder: { label: string; zIndex: number }[];
  animation: string;
  frame: number;
  party: { id: string; hidden: number; animation: string; frame: number }[];
  fade: number;
  cachedAreaTextures: string[];
  prompt: { visible: boolean; label: string; x: number; y: number };
  dialogue: {
    open: boolean;
    speaker: string | null;
    revealed: number;
    length: number;
    choices: string[];
    selected: number;
  };
  critters: { id: string; kind: string; frame: string; x: number; y: number }[];
  npcs: { id: string; frame: string; facing: string }[];
  canopies: { id: string; alpha: number }[];
  props: {
    id: string;
    state: string;
    strips: { left: number; right: number; zIndex: number }[];
  }[];
  lantern: { on: boolean; glows: string[] };
  // Everything in CSS px, from the one battle layout (spec 8).
  battle: {
    phase: string | null;
    ring: { x: number; y: number; radius: number } | null;
    // The critter in this battle and its current frame.
    critter: { id: string; frame: string } | null;
    layout: {
      critter: { x: number; baseline: number; height: number };
      fae: { x: number; baseline: number; height: number };
      party: { x: number; y: number }[];
    } | null;
    backdrop: { x: number; y: number; width: number; height: number } | null;
    overworldVisible: boolean;
    auraAlpha: number;
  };
}> {
  const info = await page.evaluate(() => window.__cloverhollow?.renderInfo());
  if (info === undefined) throw new Error("hook unavailable");
  return info;
}

export function bunHash(scriptPath: string, fixture = "harness"): string {
  const result = spawnSync(
    "bun",
    [
      "tools/sim/run.ts",
      scriptPath,
      "--fixture",
      fixture,
      "--seed",
      "1",
      "--json",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  const parsed: unknown = JSON.parse(result.stdout);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("hash" in parsed) ||
    typeof parsed.hash !== "string"
  )
    throw new Error(`invalid sim output: ${result.stdout}`);
  return parsed.hash;
}

export async function pixelAt(
  page: Page,
  png: Buffer,
  x: number,
  y: number,
): Promise<number[]> {
  return page.evaluate(
    async (input) => {
      const image = new Image();
      image.src = `data:image/png;base64,${input.data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("2d canvas unavailable");
      context.drawImage(image, 0, 0);
      return Array.from(
        context.getImageData(input.x, input.y, 1, 1).data.slice(0, 3),
      );
    },
    { data: png.toString("base64"), x, y },
  );
}

export function loadScript(path: string): ReturnType<typeof parseScript> {
  return parseScript(JSON.parse(readFileSync(path, "utf8")), path);
}

// Recorded runs played as real key presses through the game's own keyboard
// input: arrows for a frame's move, Z for its confirm, held for the frame's
// ticks (spec 11). A run that needs other inputs can't be played this way.
export type Segment = { frame: ActionFrame; ticks: number };

export function recording(path: string): Segment[] {
  return parseScript(JSON.parse(readFileSync(path, "utf8")), path);
}

function keysFor(frame: ActionFrame): string[] {
  if (frame.cancel || frame.menu || frame.choose !== undefined)
    throw new Error("this run needs more than arrows and Z");
  return [
    ...(frame.move.x > 0 ? ["ArrowRight"] : frame.move.x < 0 ? ["ArrowLeft"] : []),
    ...(frame.move.y > 0 ? ["ArrowDown"] : frame.move.y < 0 ? ["ArrowUp"] : []),
    ...(frame.confirm ? ["z"] : []),
    ...(frame.lantern ? ["l"] : []),
  ];
}

// Plays a run with real keys, pressing and releasing only what changes between
// frames and stepping at most `chunk` ticks at a time, then calling `watch`.
export async function playWithKeys(
  page: Page,
  segments: Segment[],
  chunk: number,
  watch: () => Promise<void>,
): Promise<void> {
  let held: string[] = [];
  for (const segment of segments) {
    const keys = keysFor(segment.frame);
    for (const key of held) if (!keys.includes(key)) await page.keyboard.up(key);
    for (const key of keys) if (!held.includes(key)) await page.keyboard.down(key);
    held = keys;
    for (let done = 0; done < segment.ticks; done += chunk) {
      await step(page, Math.min(chunk, segment.ticks - done));
      await watch();
    }
  }
  for (const key of held) await page.keyboard.up(key);
}

// A recording that starts with another one (east-road.json starts with
// chapter one's run): the shared start is replayed as queued frames, and only
// the rest is played with real keys. The recorder may have run the shared
// run's last segment on into the rest; it's split where the start ends.
export async function playAfter(
  page: Page,
  before: string,
  path: string,
  watch: () => Promise<void> = async () => undefined,
): Promise<void> {
  const start = recording(before);
  const all = recording(path);
  const last = start.length - 1;
  const joined = all[last];
  const same = start.every((segment, index) => index === last
    ? joined !== undefined && JSON.stringify(segment.frame) === JSON.stringify(joined.frame) &&
      joined.ticks >= segment.ticks
    : JSON.stringify(segment) === JSON.stringify(all[index]));
  if (!same || joined === undefined) throw new Error(`${path} doesn't start with ${before}`);
  const carried = joined.ticks - (start[last]?.ticks ?? 0);
  await queueScript(page, start);
  await step(page, start.reduce((total, segment) => total + segment.ticks, 0));
  const rest = all.slice(last + 1);
  await playWithKeys(page,
    carried > 0 ? [{ frame: joined.frame, ticks: carried }, ...rest] : rest, 10, watch);
}
