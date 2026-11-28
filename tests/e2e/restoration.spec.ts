import { inflateSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  playBattleCheck,
  readBattle,
  readState,
  resetPaused,
  resume,
  step,
  walk,
} from "./helpers";

async function press(page: Page, key = "Enter"): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function calmActiveBattle(page: Page): Promise<void> {
  for (let action = 0; action < 140; action += 1) {
    const battle = await readBattle(page);
    if (battle === null) break;
    if (battle.phase === "check" && battle.check !== null) {
      await playBattleCheck(page);
      await step(page, 1);
      continue;
    }
    await press(page, "Enter");
  }
  await step(page, 2);
  for (let notices = 0; notices < 6; notices += 1) {
    if (!(await page.locator(".sticker-dialogue").isVisible())) break;
    await press(page, "Enter");
  }
}

function meanPngRgb(png: Buffer): [number, number, number] {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const colorType = png.readUInt8(25);
  const bpp = colorType === 6 ? 4 : 3;
  const idatChunks: Buffer[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const kind = png.subarray(offset + 4, offset + 8).toString("ascii");
    if (kind === "IDAT") idatChunks.push(png.subarray(offset + 8, offset + 8 + length));
    if (kind === "IEND") break;
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idatChunks));
  const stride = width * bpp;
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart] ?? 0;
    for (let x = 0; x < stride; x += 1) {
      const byte = raw[rowStart + 1 + x] ?? 0;
      const a = x >= bpp ? (cur[x - bpp] ?? 0) : 0;
      const b = prev[x] ?? 0;
      const c = x >= bpp ? (prev[x - bpp] ?? 0) : 0;
      let val = byte;
      if (filter === 1) val = (byte + a) & 0xff;
      else if (filter === 2) val = (byte + b) & 0xff;
      else if (filter === 3) val = (byte + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        val = (byte + pr) & 0xff;
      }
      cur[x] = val;
    }
    for (let px = 0; px < width; px += 1) {
      rSum += cur[px * bpp] ?? 0;
      gSum += cur[px * bpp + 1] ?? 0;
      bSum += cur[px * bpp + 2] ?? 0;
    }
    prev.set(cur);
  }
  const total = Math.max(1, width * height);
  return [rSum / total, gSum / total, bSum / total];
}

async function sampleDecalClipsRgb(
  page: Page,
  points: readonly { x: number; y: number }[],
): Promise<[number, number, number][]> {
  const results: [number, number, number][] = [];
  for (const { x, y } of points) {
    const clip = { x: Math.max(0, x - 20), y: Math.max(0, y - 20), width: 40, height: 40 };
    const png = await page.screenshot({ clip });
    results.push(meanPngRgb(png));
  }
  return results;
}

function meanRgbDelta(
  before: readonly [number, number, number][],
  after: readonly [number, number, number][],
): number {
  let sum = 0;
  for (let i = 0; i < before.length; i += 1) {
    const a = before[i] ?? [0, 0, 0];
    const b = after[i] ?? [0, 0, 0];
    sum += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  }
  return sum / Math.max(1, before.length);
}

test.describe("Live Watercolor Chaos-to-Paint Area Restoration (E13)", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "Plaza transitions from chaos scribbles to blooming paint when calming Fountain Frog",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const atlasResponses: { url: string; status: number }[] = [];
      page.on("response", (response) => {
        if (response.url().includes("restoration/")) {
          atlasResponses.push({ url: response.url(), status: response.status() });
        }
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");

      expect(atlasResponses.some((r) => r.url.endsWith("restoration.json") && r.status === 200))
        .toBe(true);
      expect(atlasResponses.some((r) => r.url.endsWith("restoration.webp") && r.status === 200))
        .toBe(true);

      // Stand beside the Fountain Frog clearing where multiple Plaza decals sit in view.
      await hold(page, "ArrowDown", 25);
      await hold(page, "ArrowLeft", 15);
      await hold(page, "ArrowDown", 50);

      const beforeState = await readState(page);
      expect(beforeState.area).toBe("plaza");
      expect(beforeState.critters["fountain-frog"]).toBe("chaos");

      // Plaza camera clamped to [470..1750, 380..1100] when Fae is near (1140, 850).
      // Screen coords for silhouette-clean decals:
      // (780,810)->(310,430), (1190,770)->(720,390),
      // (1340,830)->(870,450), (1340,560)->(870,180).
      const decalScreenPoints = [
        { x: 310, y: 430 },
        { x: 720, y: 390 },
        { x: 870, y: 450 },
        { x: 870, y: 180 },
      ];
      const beforeRgb = await sampleDecalClipsRgb(page, decalScreenPoints);

      if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
        await page.evaluate(() => window.__cloverhollow?.settings.setPhotoMode(true));
        await step(page, 1);
        await page.screenshot({
          path: "art/scratch/e13-plaza-before.jpg",
          type: "jpeg",
          quality: 92,
        });
        await page.evaluate(() => window.__cloverhollow?.settings.setPhotoMode(false));
      }

      // Walk into the Fountain Frog and calm him with real keys.
      await hold(page, "ArrowLeft", 35);
      await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
      await calmActiveBattle(page);

      const afterState = await readState(page);
      expect(afterState.battle).toBeNull();
      expect(afterState.critters["fountain-frog"]).toBe("calm");

      // Walk back to the exact pre-battle vantage point so camera framing matches 1:1.
      await walk(page, "x", beforeState.player.x);
      await walk(page, "y", beforeState.player.y);
      await step(page, 2);

      const afterRgb = await sampleDecalClipsRgb(page, decalScreenPoints);
      // Calming peels purple chaos scribbles away and reveals sunlit wildflowers & dew.
      expect(meanRgbDelta(beforeRgb, afterRgb)).toBeGreaterThan(8);

      if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
        await page.evaluate(() => window.__cloverhollow?.settings.setPhotoMode(true));
        await step(page, 1);
        await page.screenshot({
          path: "art/scratch/e13-plaza-after.jpg",
          type: "jpeg",
          quality: 92,
        });
        await page.evaluate(() => window.__cloverhollow?.settings.setPhotoMode(false));
      }
    },
  );

  test(
    "Live unpaused calming triggers the Watercolor Wash-Bloom Wipe and settles cleanly",
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");
      await hold(page, "ArrowDown", 25);
      await hold(page, "ArrowLeft", 15);
      await hold(page, "ArrowDown", 50);
      await hold(page, "ArrowLeft", 35);
      await expect(page.locator("html")).toHaveAttribute("data-battle", "open");

      // Play until the battle reward screen finishes typing, then unpause right before closing.
      for (let action = 0; action < 140; action += 1) {
        const battle = await readBattle(page);
        if (battle === null) break;
        if (battle.phase === "reward" && battle.revealed >= battle.message.length) break;
        if (battle.phase === "check" && battle.check !== null) {
          await playBattleCheck(page);
          await step(page, 1);
          continue;
        }
        await press(page, "Enter");
      }

      // Resume live 60 Hz play and press Enter to finish reward -> triggers 90-frame wipe!
      await resume(page);
      await page.keyboard.press("Enter");
      await expect(page.locator("html")).not.toHaveAttribute("data-battle", "open");

      // Dismiss any immediate level-up popup if shown, then capture mid-wipe (~350 ms).
      await page.waitForTimeout(320);
      if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
        await page.screenshot({
          path: "art/scratch/e13-plaza-wipe-mid.jpg",
          type: "jpeg",
          quality: 92,
        });
      }

      // After > 1.7 s (90+ frames), the wash-bloom wipe has settled cleanly.
      await page.waitForTimeout(1600);
      const settledState = await readState(page);
      expect(settledState.critters["fountain-frog"]).toBe("calm");
    },
  );

  test(
    "Reduced Motion settles restoration immediately without wipe animation",
    async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "plaza");
    await page.evaluate(() => window.__cloverhollow?.settings.setReducedMotion(true));
    await hold(page, "ArrowDown", 25);
    await hold(page, "ArrowLeft", 15);
    await hold(page, "ArrowDown", 50);

    const beforePoints = [{ x: 310, y: 430 }, { x: 720, y: 390 }, { x: 870, y: 450 }];
    const beforeRgb = await sampleDecalClipsRgb(page, beforePoints);
    const vantage = (await readState(page)).player;

    await hold(page, "ArrowLeft", 35);
    await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
    await calmActiveBattle(page);

    // Walk back to vantage under Reduced Motion: decals snap straight to blooming paint.
    await walk(page, "x", vantage.x);
    await walk(page, "y", vantage.y);
    await step(page, 1);
    const afterImmediate = await sampleDecalClipsRgb(page, beforePoints);
    await step(page, 40);
    const afterLater = await sampleDecalClipsRgb(page, beforePoints);

    expect(meanRgbDelta(beforeRgb, afterImmediate)).toBeGreaterThan(8);
    // Settled immediately with zero wipe drift between tick+1 and tick+41.
    expect(meanRgbDelta(afterImmediate, afterLater)).toBeLessThan(2);
    await page.evaluate(() => window.__cloverhollow?.settings.setReducedMotion(false));
  });

  test(
    "Meadow Park peels chaos scribbles into blooming paint after calming Zoomie Pup",
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "park");

      const beforeState = await readState(page);
      expect(beforeState.area).toBe("park");
      expect(beforeState.calms.pup ?? 0).toBe(0);

      // Walk to west meadow vantage at (395, 735), cleanly clear of all meadow decals.
      await walk(page, "x", 395);
      await walk(page, "y", 735);
      await step(page, 2);
      const vantage = (await readState(page)).player;

      // Park camera clamps to (0, 280) at (395, 735):
      // decals (665,575)->(665,295), (915,630)->(915,350),
      // (540,675)->(540,395), (705,695)->(705,415).
      const parkDecalPoints = [
        { x: 665, y: 295 },
        { x: 915, y: 350 },
        { x: 540, y: 395 },
        { x: 705, y: 415 },
      ];
      const beforeParkRgb = await sampleDecalClipsRgb(page, parkDecalPoints);

      if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
        await page.evaluate(() => window.__cloverhollow?.settings.setPhotoMode(true));
        await step(page, 1);
        await page.screenshot({
          path: "art/scratch/e13-park-before.jpg",
          type: "jpeg",
          quality: 92,
        });
        await page.evaluate(() => window.__cloverhollow?.settings.setPhotoMode(false));
      }

      // Find the wandering Zoomie Pup in Meadow Park and walk into him to calm him!
      const pup = (await readState(page)).wild.find((c) => c.kind === "pup");
      expect(pup).toBeDefined();
      if (pup === undefined) return;
      await walk(page, "x", pup.x);
      for (let tries = 0; tries < 25 && (await readBattle(page)) === null; tries += 1) {
        const cur = await readState(page);
        const livePup = cur.wild.find((c) => c.kind === "pup");
        if (livePup === undefined) break;
        const dx = livePup.x - cur.player.x;
        const dy = livePup.y - cur.player.y;
        const key = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? "ArrowRight" : "ArrowLeft")
          : (dy > 0 ? "ArrowDown" : "ArrowUp");
        await hold(page, key, 10);
      }
      await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
      await calmActiveBattle(page);

      const afterState = await readState(page);
      expect(afterState.battle).toBeNull();
      expect(afterState.calms.pup ?? 0).toBeGreaterThanOrEqual(1);

      // Return to the exact same vantage point and verify blooming Meadow Park.
      await walk(page, "x", vantage.x);
      await walk(page, "y", vantage.y);
      await step(page, 2);

      const afterParkRgb = await sampleDecalClipsRgb(page, parkDecalPoints);
      expect(meanRgbDelta(beforeParkRgb, afterParkRgb)).toBeGreaterThan(8);

      if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
        await page.evaluate(() => window.__cloverhollow?.settings.setPhotoMode(true));
        await step(page, 1);
        await page.screenshot({
          path: "art/scratch/e13-park-after.jpg",
          type: "jpeg",
          quality: 92,
        });
        await page.evaluate(() => window.__cloverhollow?.settings.setPhotoMode(false));
      }
    },
  );
});
