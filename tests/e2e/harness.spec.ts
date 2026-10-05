import { expect, test, type Page } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { ActionFrame, State } from "../../src/core";
import { parseScript } from "../../src/content/script";

// Every helper reads the dev hook inside the page and fails loudly if the
// harness build did not install it.

async function openHarness(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
}

/** Restarts from the new-game fixture (seed 1); reset leaves the game paused. */
async function resetPaused(page: Page): Promise<void> {
  await page.evaluate(() => {
    const hook = window.__cloverhollow;
    if (hook === undefined) throw new Error("hook unavailable");
    hook.reset({ seed: 1 });
  });
}

async function resume(page: Page): Promise<void> {
  await page.evaluate(() => {
    const hook = window.__cloverhollow;
    if (hook === undefined) throw new Error("hook unavailable");
    hook.resume();
  });
}

async function step(page: Page, ticks: number): Promise<void> {
  await page.evaluate((count) => {
    const hook = window.__cloverhollow;
    if (hook === undefined) throw new Error("hook unavailable");
    hook.step(count);
  }, ticks);
}

async function queueInput(
  page: Page,
  frame: ActionFrame,
  ticks: number,
): Promise<void> {
  await page.evaluate(
    (segment) => {
      const hook = window.__cloverhollow;
      if (hook === undefined) throw new Error("hook unavailable");
      hook.input(segment.frame, segment.ticks);
    },
    { frame, ticks },
  );
}

async function readState(page: Page): Promise<State> {
  return page.evaluate(() => {
    const hook = window.__cloverhollow;
    if (hook === undefined) throw new Error("hook unavailable");
    return hook.getState();
  });
}

async function readHash(page: Page): Promise<string> {
  return page.evaluate(() => {
    const hook = window.__cloverhollow;
    if (hook === undefined) throw new Error("hook unavailable");
    return hook.hash();
  });
}

/** Runs the same script headlessly in Bun (JavaScriptCore) and returns its hash. */
function bunHash(scriptPath: string): string {
  const result = spawnSync(
    "bun",
    ["tools/sim/run.ts", scriptPath, "--seed", "1", "--json"],
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

/** Decodes a screenshot with the browser's own PNG decoder and reads one pixel. */
async function pixelAt(
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
      const rgba = context.getImageData(input.x, input.y, 1, 1).data;
      return Array.from(rgba.slice(0, 3));
    },
    { data: png.toString("base64"), x, y },
  );
}

test("stepping with a held real key moves 4 units per tick", async ({
  page,
}) => {
  await openHarness(page);
  await resetPaused(page);
  await page.keyboard.down("ArrowRight");
  await step(page, 30);
  await page.keyboard.up("ArrowRight");
  expect((await readState(page)).player.x).toBe(420);
  await expect(page).toHaveScreenshot("harness.png");
});

test("a real key tap shorter than one tick still moves one tick", async ({
  page,
}) => {
  await openHarness(page);
  await resetPaused(page);
  // keydown and keyup both arrive before the next tick samples the keyboard.
  await page.keyboard.press("ArrowRight");
  await step(page, 10);
  const state = await readState(page);
  expect(state.player.x).toBe(304);
  expect(state.facing).toBe("right");
});

test("holding a real key moves the player in real time", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page);
  await resume(page);
  const before = (await readState(page)).player.x;
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowRight");
  expect((await readState(page)).player.x).toBeGreaterThan(before);
});

test("real keys stop at the room wall, radius respected", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page);
  await resume(page);
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(2500);
  await page.keyboard.up("ArrowLeft");
  const x = (await readState(page)).player.x;
  expect(x).toBeGreaterThanOrEqual(60);
  expect(x).toBeLessThan(70);
});

test("real keys stop at a blocker, radius respected", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page);
  await page.keyboard.down("ArrowRight");
  await step(page, 150);
  await page.keyboard.up("ArrowRight");
  const x = (await readState(page)).player.x;
  expect(x).toBeLessThanOrEqual(830.01);
  expect(x).toBeGreaterThan(800);
});

for (const name of ["harness-600", "concave-corners"]) {
  test(`browser (V8) and Bun (JavaScriptCore) agree on ${name}`, async ({
    page,
  }) => {
    const path = `tests/sim/scripts/${name}.json`;
    const script = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
    await openHarness(page);
    await resetPaused(page);
    for (const segment of script)
      await queueInput(page, segment.frame, segment.ticks);
    await step(
      page,
      script.reduce((total, segment) => total + segment.ticks, 0),
    );
    const browserHash = await readHash(page);
    expect(browserHash).toBe(bunHash(path));
    console.log(`${name}: browser and Bun hash ${browserHash}`);
  });
}

test("nothing renders inside wide letterbox bars", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 720 });
  await openHarness(page);
  const png = await page.screenshot();
  const background = [248, 237, 207];
  expect(await pixelAt(page, png, 0, 360)).toEqual(background);
  expect(await pixelAt(page, png, 2399, 360)).toEqual(background);
});
