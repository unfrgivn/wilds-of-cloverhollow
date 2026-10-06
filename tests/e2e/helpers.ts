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

export async function queueInput(
  page: Page,
  frame: ActionFrame,
  ticks: number,
): Promise<void> {
  await page.evaluate(
    (segment) => window.__cloverhollow?.input(segment.frame, segment.ticks),
    { frame, ticks },
  );
}

export async function readState(page: Page): Promise<State> {
  const state = await page.evaluate(() => window.__cloverhollow?.getState());
  if (state === undefined) throw new Error("hook unavailable");
  return state;
}

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
  maddie: { animation: string; frame: number };
  hidden: number;
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
  // Everything in CSS px, from the one battle layout (spec 8).
  critters: { id: string; frame: string }[];
  npcs: { id: string; frame: string; facing: string }[];
  battle: {
    phase: string | null;
    ring: { x: number; y: number; radius: number } | null;
    frogFrame: string;
    layout: {
      frog: { x: number; baseline: number; height: number };
      fae: { x: number; baseline: number; height: number };
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
