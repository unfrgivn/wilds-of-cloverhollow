import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  queueScript,
  readBattle,
  readState,
  recording,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";

async function centerOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).boundingBox();
  if (box === null) throw new Error(`Missing bounding box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function replayTicks(
  page: Page,
  path: string,
  fixture: string,
  targetTicks: number,
): Promise<void> {
  const upTo: ReturnType<typeof recording> = [];
  let ticks = 0;
  for (const segment of recording(path)) {
    if (ticks >= targetTicks) break;
    const take = Math.min(segment.ticks, targetTicks - ticks);
    upTo.push({ frame: segment.frame, ticks: take });
    ticks += take;
  }
  await resetPaused(page, fixture);
  await queueScript(page, upTo);
  await step(page, targetTicks);
}

test.describe("Milestone 128: Complete Mouse & Touch Pointer Play", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "plays Claw Machine slide and push holds directly with mouse presses (zero keyboard)",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "arcade");

      // Advance recorded arcade setup until the Claw Machine opens in ready phase.
      for (const segment of recording("tests/sim/scripts/arcade/claw.json")) {
        await queueScript(page, [segment]);
        await step(page, segment.ticks);
        const state = await readState(page);
        if (state.arcade?.game === "claw" && state.arcade.phase === "ready") break;
      }
      await step(page, 1);

      const start = await readState(page);
      if (start.arcade?.game !== "claw") throw new Error("Expected Claw Machine open");
      expect(start.arcade.phase).toBe("ready");
      const startX = start.arcade.x;
      const startZ = start.arcade.z;

      // Zero keyboard presses from here: press and hold directly on .arcade-machine.
      const point = await centerOf(page, ".arcade-machine");
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await step(page, 18);

      const sliding = await readState(page);
      if (sliding.arcade?.game !== "claw") throw new Error("Expected claw while sliding");
      expect(sliding.arcade.phase).toBe("sliding");
      expect(sliding.arcade.x).toBeGreaterThan(startX);

      // Release mouse: claw stops sliding and transitions cleanly to aiming.
      await page.mouse.up();
      await step(page, 2);
      const aiming = await readState(page);
      if (aiming.arcade?.game !== "claw") throw new Error("Expected claw while aiming");
      expect(aiming.arcade.phase).toBe("aiming");
      const aimX = aiming.arcade.x;

      // Second mouse press-and-hold pushes the claw back into the box.
      await page.mouse.down();
      await step(page, 18);
      const pushing = await readState(page);
      if (pushing.arcade?.game !== "claw") throw new Error("Expected claw while pushing");
      expect(pushing.arcade.phase).toBe("pushing");
      expect(pushing.arcade.x).toBe(aimX);
      expect(pushing.arcade.z).toBeGreaterThan(startZ);

      // Release mouse: claw drops cleanly.
      await page.mouse.up();
      await step(page, 2);
      const dropping = await readState(page);
      if (dropping.arcade?.game !== "claw") throw new Error("Expected claw while dropping");
      expect(dropping.arcade.phase).toBe("dropping");
      expect(errors).toEqual([]);
    },
  );

  test(
    "plays Comet Cruise directly with mouse clicks on field lanes & keycaps (zero keyboard)",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "arcade");

      // Advance recorded arcade setup until Comet Cruise opens in ready phase.
      for (const segment of recording("tests/sim/scripts/arcade/comet.json")) {
        await queueScript(page, [segment]);
        await step(page, segment.ticks);
        const state = await readState(page);
        if (state.arcade?.game === "comet") break;
      }

      const ready = await readState(page);
      if (ready.arcade?.game !== "comet") throw new Error("Expected Comet Cruise open");
      expect(ready.arcade.phase).toBe("ready");

      // Click .comet-machine while ready (confirm releases cleanly) and step into playing.
      const cabinet = await centerOf(page, ".comet-machine");
      await page.mouse.click(cabinet.x, cabinet.y);
      for (let tries = 0; tries < 70; tries += 1) {
        await step(page, 1);
        const current = await readState(page);
        if (current.arcade?.game === "comet" && current.arcade.phase === "playing") break;
      }

      const playing = await readState(page);
      if (playing.arcade?.game !== "comet") throw new Error("Expected Comet Cruise playing");
      expect(playing.arcade.phase).toBe("playing");
      expect(playing.arcade.lane).toBe(1);

      const fieldBox = await page.locator(".comet-field").boundingBox();
      if (fieldBox === null) throw new Error("Missing .comet-field bounding box");
      const laneCenter = (lane: 0 | 1 | 2): { x: number; y: number } => ({
        x: fieldBox.x + fieldBox.width * ((lane + 0.5) / 3),
        y: fieldBox.y + fieldBox.height * 0.5,
      });

      // Click left third of .comet-field: rocket shifts from lane 1 -> 0.
      const leftLane = laneCenter(0);
      await page.mouse.click(leftLane.x, leftLane.y);
      await step(page, 2);
      expect((await readState(page)).arcade).toMatchObject({ game: "comet", lane: 0 });

      // Click right third of .comet-field twice: rocket shifts 0 -> 1 -> 2.
      const rightLane = laneCenter(2);
      await page.mouse.click(rightLane.x, rightLane.y);
      await step(page, 2);
      expect((await readState(page)).arcade).toMatchObject({ game: "comet", lane: 1 });
      await page.mouse.click(rightLane.x, rightLane.y);
      await step(page, 2);
      expect((await readState(page)).arcade).toMatchObject({ game: "comet", lane: 2 });

      // Click the ← keycap on the cabinet: rocket shifts back 2 -> 1.
      const leftKey = await centerOf(page, ".comet-key.is-left");
      await page.mouse.click(leftKey.x, leftKey.y);
      await step(page, 2);
      expect((await readState(page)).arcade).toMatchObject({ game: "comet", lane: 1 });
      expect(errors).toEqual([]);
    },
  );

  test(
    "holds Wind-Gust Lean directly with mouse press on the battle stage (zero keyboard)",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await replayTicks(page, "tests/sim/scripts/bay/bay.json", "bay", 1024);

      const tapStage = page.locator(".battle-check-tap");
      await expect(tapStage).toBeVisible();

      const info = (await renderInfo(page)).battle;
      if (info.check?.kind !== "lean") throw new Error("Expected active lean check");
      const { track } = info.check;

      // Let the first puff push Fae backward before bracing with the mouse.
      await step(page, 60);
      const before = (await readBattle(page))?.check;
      if (before?.kind !== "lean") throw new Error("Expected lean check mid-puff");
      expect(before.balance).toBeLessThan(0);

      // Hold mouse to the right of the track centre to lean forward into the gust.
      await page.mouse.move(track.x + 120, track.y + 80);
      await page.mouse.down();
      await step(page, 12);
      const afterRight = (await readBattle(page))?.check;
      if (afterRight?.kind !== "lean") throw new Error("Expected lean check while holding right");
      expect(afterRight.balance).toBeGreaterThan(before.balance + 20);

      // Drag left of track centre while still held: Fae leans back left cleanly.
      const peak = afterRight.balance;
      await page.mouse.move(Math.max(20, track.x - 120), track.y + 80);
      await step(page, 6);
      const afterLeft = (await readBattle(page))?.check;
      if (afterLeft?.kind !== "lean") throw new Error("Expected lean check while dragging left");
      expect(afterLeft.balance).toBeLessThan(peak - 20);

      await page.mouse.up();
      expect(errors).toEqual([]);
    },
  );

  test(
    "moves Toy Catch across high, middle, and low lanes with mouse press-and-drag (zero keyboard)",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await replayTicks(page, "tests/sim/scripts/park/pup-win.json", "park", 488);

      const tapStage = page.locator(".battle-check-tap");
      await expect(tapStage).toBeVisible();

      const info = (await renderInfo(page)).battle;
      if (info.check?.kind !== "catch") throw new Error("Expected active catch check");
      const [highY, midY, lowY] = info.check.lanes;
      const x = info.check.catcherX;

      // Hold mouse on high lane for multiple ticks: stays locked on lane 0 without oscillating.
      await page.mouse.move(x, highY);
      await page.mouse.down();
      await step(page, 1);
      expect((await readBattle(page))?.check).toMatchObject({ kind: "catch", catcher: 0 });
      await step(page, 4);
      expect((await readBattle(page))?.check).toMatchObject({ kind: "catch", catcher: 0 });

      // Drag to middle lane: moves cleanly to lane 1.
      await page.mouse.move(x, midY);
      await step(page, 2);
      expect((await readBattle(page))?.check).toMatchObject({ kind: "catch", catcher: 1 });

      // Drag to low lane: moves cleanly to lane 2 and stays locked.
      await page.mouse.move(x, lowY);
      await step(page, 4);
      expect((await readBattle(page))?.check).toMatchObject({ kind: "catch", catcher: 2 });

      // Release mouse: returns cleanly to resting middle lane 1.
      await page.mouse.up();
      await step(page, 2);
      expect((await readBattle(page))?.check).toMatchObject({ kind: "catch", catcher: 1 });
      expect(errors).toEqual([]);
    },
  );
});
