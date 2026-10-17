import { expect, test } from "@playwright/test";
import { longFlowTimeout, openHarness, readState, resetPaused, step } from "./helpers";

const dock: readonly (readonly [number, number])[] = [
  [812, 513], [1014, 649], [1590, 262], [1385, 109],
];
function insideDock(point: { x: number; y: number }): boolean {
  let inside = false;
  for (let index = 0, previous = dock.length - 1; index < dock.length; previous = index++) {
    const [x, y] = dock[index]!;
    const [oldX, oldY] = dock[previous]!;
    if ((y > point.y) !== (oldY > point.y) &&
      point.x < (oldX - x) * (point.y - y) / (oldY - y) + x) inside = !inside;
  }
  return inside;
}

// A real-key walk of 329 single ticks, reading the sound log after each: a
// long flow's budget, so a busy machine doesn't time it out.
test.describe.configure({ timeout: longFlowTimeout });

test("real walking changes footsteps from sand to dock wood", async ({ page }) => {
  await openHarness(page);
  await resetPaused(page, "bay");
  let firstWoodPosition: { x: number; y: number } | undefined;
  for (const [key, ticks] of [
    ["ArrowRight", 160], ["ArrowRight", 10], ["ArrowUp", 5],
    ["ArrowRight", 110], ["ArrowUp", 44],
  ] as const) {
    await page.keyboard.down(key);
    for (let tick = 0; tick < ticks; tick += 1) {
      await step(page, 1);
      const hasWood = await page.evaluate(() => window.__cloverhollow?.sound.log()
        .some((entry) => entry.cue === "footstep-wood"));
      if (hasWood && firstWoodPosition === undefined)
        firstWoodPosition = (await readState(page)).player;
    }
    await page.keyboard.up(key);
  }
  const cues = await page.evaluate(() => window.__cloverhollow?.sound.log()
    .map((entry) => entry.cue)
    .filter((cue) => cue === "footstep-sand" || cue === "footstep-wood") ?? []);
  expect(cues).toContain("footstep-sand");
  expect(cues).toContain("footstep-wood");
  expect(cues.indexOf("footstep-sand")).toBeLessThan(cues.indexOf("footstep-wood"));
  expect(firstWoodPosition).toBeDefined();
  expect(insideDock(firstWoodPosition!)).toBe(true);
});
