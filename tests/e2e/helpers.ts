import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import type { ActionFrame, State } from "../../src/core";
import { parseScript } from "../../src/content/script";
import type { CloverhollowHook } from "../../src/dev/hook";

type RenderInfo = ReturnType<CloverhollowHook["renderInfo"]>;

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

// Play the active battle check with a fresh Enter edge and the timing a careful
// player would use. The check's tick is read after every step so this also
// works when a screenshot or assertion has paused partway through a check.
export async function playBattleCheck(page: Page): Promise<void> {
  const battle = await readBattle(page);
  const check = battle?.check;
  if (check === null || check === undefined) throw new Error("no battle check to play");
  if (check.kind === "ring") {
    await step(page, check.spec.targetTick - check.tick - 1);
    await page.keyboard.down("Enter");
    await step(page, 1);
    await page.keyboard.up("Enter");
    return;
  }
  if (check.kind === "charge") {
    // Charging starts on a fresh press and counts held ticks from there.
    await page.keyboard.up("Enter");
    await page.keyboard.down("Enter");
    await step(page, check.spec.targetTick);
    await page.keyboard.up("Enter");
    await step(page, 1);
    return;
  }
  if (check.kind === "catch") {
    // Hold each toy's lane on real arrows as it lands: up high, nothing for
    // the middle, down low.
    let held: string | null = null;
    for (const [index, arrival] of check.spec.arrivals.entries()) {
      const current = await readBattle(page);
      const active = current?.check;
      if (active?.kind !== "catch") throw new Error("the catch ended early");
      // A toy that landed already (the test played part of the catch).
      if (arrival <= active.tick) continue;
      const lane = check.lanes[index] ?? 1;
      const key = lane === 0 ? "ArrowUp" : lane === 2 ? "ArrowDown" : null;
      if (held !== key) {
        if (held !== null) await page.keyboard.up(held);
        if (key !== null) await page.keyboard.down(key);
        held = key;
      }
      await step(page, arrival - active.tick);
    }
    if (held !== null) await page.keyboard.up(held);
    return;
  }
  if (check.kind === "lean") {
    // Lean back toward straight on real arrows whenever she's 5 or more off:
    // right is forward, into the wind.
    let held: string | null = null;
    for (let active = check; ; ) {
      if (!active.results.includes("pending")) break;
      const key = active.balance <= -5 ? "ArrowRight" : active.balance >= 5 ? "ArrowLeft" : null;
      if (held !== key) {
        if (held !== null) await page.keyboard.up(held);
        if (key !== null) await page.keyboard.down(key);
        held = key;
      }
      await step(page, 1);
      const current = (await readBattle(page))?.check;
      if (current?.kind !== "lean") break;
      active = current;
    }
    if (held !== null) await page.keyboard.up(held);
    return;
  }
  for (const arrival of check.spec.arrivals) {
    const current = await readBattle(page);
    const active = current?.check;
    if (active?.kind !== "chain") throw new Error("battle chain ended early");
    await step(page, arrival - active.tick - 1);
    await page.keyboard.down("Enter");
    await step(page, 1);
    await page.keyboard.up("Enter");
  }
}

export async function readHash(page: Page): Promise<string> {
  const hash = await page.evaluate(() => window.__cloverhollow?.hash());
  if (hash === undefined) throw new Error("hook unavailable");
  return hash;
}

// The hook's own render facts (src/dev/hook.ts), so the two never drift.
export async function renderInfo(page: Page): Promise<RenderInfo> {
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
    ...(frame.flute ? ["f"] : []),
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

type Rect = { x: number; y: number; width: number; height: number };
// The claw machine's layout for a gallery state (spec 8.2), the parts the
// e2e tests compare with what's drawn.
export type ExpectedClaw = {
  width: number;
  height: number;
  glass: Rect;
  chute: Rect;
  plate: Rect;
  claw: { x: number; tip: number; size: number; open: boolean; layer: number };
  marker: (Rect & { layer: number }) | null;
  plushes: {
    id: string;
    x: number;
    y: number;
    size: number;
    layer: number;
    hidden: number;
    tug: boolean;
  }[];
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numbers(value: unknown, keys: string[]): value is Record<string, number> {
  return record(value) && keys.every((key) => typeof value[key] === "number");
}

function expectedClaw(value: unknown): value is ExpectedClaw {
  const rect = ["x", "y", "width", "height"];
  return numbers(value, ["width", "height"]) && record(value) &&
    numbers(value.glass, rect) && numbers(value.chute, rect) && numbers(value.plate, rect) &&
    numbers(value.claw, ["x", "tip", "size", "layer"]) && record(value.claw) &&
    typeof value.claw.open === "boolean" &&
    (value.marker === null || numbers(value.marker, [...rect, "layer"])) &&
    Array.isArray(value.plushes) &&
    value.plushes.every((plush) => numbers(plush, ["x", "y", "size", "layer", "hidden"]) &&
      record(plush) && typeof plush.id === "string" && typeof plush.tug === "boolean");
}

// Asks Bun for a close-up's layout (tools/arcade-layout.ts): Node can't load
// the content.
function bunArcadeLayout(game: "claw" | "skee" | "mole", state: string, scale: number):
  unknown {
  const result = spawnSync("bun", ["tools/arcade-layout.ts", game, state, String(scale)],
    { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  const parsed: unknown = JSON.parse(result.stdout);
  return parsed;
}

export function bunClawLayout(state: string, scale: number): ExpectedClaw {
  const parsed = bunArcadeLayout("claw", state, scale);
  if (!expectedClaw(parsed)) throw new Error(`invalid claw layout for ${state}`);
  return parsed;
}

type Disc = { cx: number; cy: number; rx: number; ry: number; points: number; lit: boolean };
// Skee-ball's layout for a gallery state, the parts the e2e tests compare with
// what's drawn.
export type ExpectedSkee = {
  width: number;
  height: number;
  frame: Rect;
  board: Rect;
  plate: Rect;
  hud: { x: number; y: number };
  rings: Disc[];
  corners: Disc[];
  floor: { x: number; y: number; points: number; lit: boolean };
  arrow: { x: number; y: number; angle: number; length: number; set: boolean } | null;
  ghost: { x: number; y: number; radius: number; over: boolean } | null;
  ball: { x: number; y: number; radius: number } | null;
  pop: { x: number; y: number; points: number } | null;
};

function disc(value: unknown): value is Disc {
  return numbers(value, ["cx", "cy", "rx", "ry", "points"]) && record(value) &&
    typeof value.lit === "boolean";
}

function expectedSkee(value: unknown): value is ExpectedSkee {
  const rect = ["x", "y", "width", "height"];
  const nullOr = (item: unknown, keys: string[], flag?: string): boolean => item === null ||
    (numbers(item, keys) && (flag === undefined || (record(item) &&
      typeof item[flag] === "boolean")));
  return numbers(value, ["width", "height"]) && record(value) && numbers(value.frame, rect) &&
    numbers(value.board, rect) && numbers(value.plate, rect) && numbers(value.hud, ["x", "y"]) &&
    Array.isArray(value.rings) && value.rings.every(disc) &&
    Array.isArray(value.corners) && value.corners.every(disc) &&
    numbers(value.floor, ["x", "y", "points"]) && record(value.floor) &&
    typeof value.floor.lit === "boolean" &&
    nullOr(value.arrow, ["x", "y", "angle", "length"], "set") &&
    nullOr(value.ghost, ["x", "y", "radius"], "over") &&
    nullOr(value.ball, ["x", "y", "radius"]) && nullOr(value.pop, ["x", "y", "points"]);
}

export function bunSkeeLayout(state: string, scale: number): ExpectedSkee {
  const parsed = bunArcadeLayout("skee", state, scale);
  if (!expectedSkee(parsed)) throw new Error(`invalid skee-ball layout for ${state}`);
  return parsed;
}

// Boop-a-Mole's layout for a gallery state, the parts the e2e tests compare
// with what's drawn.
export type ExpectedMole = {
  width: number;
  height: number;
  painting: { width: number; height: number; y: number };
  plate: Rect;
  hud: { x: number; y: number };
  holes: {
    hole: string;
    cx: number;
    cy: number;
    box: Rect;
    clip: string;
    mole: { drop: number; face: string } | null;
    key: { x: number; y: number; label: string };
  }[];
  hammer: { x: number; y: number; angle: number; length: number; opacity: number } | null;
  pop: { x: number; y: number } | null;
};

function expectedMole(value: unknown): value is ExpectedMole {
  const rect = ["x", "y", "width", "height"];
  const hole = (item: unknown): boolean => record(item) && typeof item.hole === "string" &&
    numbers(item, ["cx", "cy"]) && numbers(item.box, rect) && typeof item.clip === "string" &&
    (item.mole === null || (numbers(item.mole, ["drop"]) && record(item.mole) &&
      typeof item.mole.face === "string")) &&
    numbers(item.key, ["x", "y"]) && record(item.key) && typeof item.key.label === "string";
  return numbers(value, ["width", "height"]) && record(value) &&
    numbers(value.painting, ["width", "height", "y"]) && numbers(value.plate, rect) &&
    numbers(value.hud, ["x", "y"]) && Array.isArray(value.holes) && value.holes.every(hole) &&
    (value.hammer === null ||
      numbers(value.hammer, ["x", "y", "angle", "length", "opacity"])) &&
    (value.pop === null || numbers(value.pop, ["x", "y"]));
}

export function bunMoleLayout(state: string, scale: number): ExpectedMole {
  const parsed = bunArcadeLayout("mole", state, scale);
  if (!expectedMole(parsed)) throw new Error(`invalid Boop-a-Mole layout for ${state}`);
  return parsed;
}
