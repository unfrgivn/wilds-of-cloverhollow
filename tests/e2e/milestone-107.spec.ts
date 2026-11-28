import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  playBattleCheck,
  readBattle,
  readState,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function advanceUntil(
  page: Page,
  predicate: (battle: Awaited<ReturnType<typeof readBattle>>) => boolean,
): Promise<void> {
  for (let count = 0; count < 50; count += 1) {
    const battle = await readBattle(page);
    if (predicate(battle)) return;
    await tapKey(page, "Enter");
  }
  throw new Error("timed out advancing battle phase");
}

async function walkToFrogCommand(page: Page): Promise<void> {
  for (const [key, ticks] of [
    ["ArrowDown", 25],
    ["ArrowLeft", 15],
    ["ArrowDown", 50],
    ["ArrowLeft", 35],
    ["ArrowUp", 38],
  ] as const) {
    await hold(page, key, ticks);
  }
  await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
  await advanceUntil(
    page,
    (battle) => battle?.phase === "command" && battle.revealed >= battle.message.length,
  );
}

async function runQaCommands(page: Page, commands: readonly string[]): Promise<void> {
  await page.keyboard.press("`");
  await expect(page.locator(".qa-console")).toBeVisible();
  for (const command of commands) {
    await page.keyboard.type(command);
    await page.keyboard.press("Enter");
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".qa-console")).toBeHidden();
  await step(page, 1);
}

test(
  "battle popups rise on live calm gain, clean up cleanly, and never fire on battle open",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "plaza-party");
    await walkToFrogCommand(page);

    // Opening a fresh battle must never spawn spurious popups.
    await expect(page.locator(".battle-popup")).toHaveCount(0);

    // Choose Fae's Soothe (index 0) and land a GREAT check for a live calm boost popup.
    await tapKey(page, "Enter");
    await playBattleCheck(page);

    const popup = page.locator(".battle-popup").first();
    await expect(popup).toBeVisible();
    const popupInfo = await popup.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        text: node.textContent ?? "",
        kind: node.getAttribute("data-popup-kind") ?? "",
        color: style.color,
        outlineColor: style.outlineColor,
      };
    });
    expect(popupInfo.text).toMatch(/^\+\d+/);
    expect(["normal", "big", "fav"]).toContain(popupInfo.kind);
    expect(popupInfo.color).toBe("rgb(71, 50, 31)");

    if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
      await page.screenshot({
        path: "art/review/m106-battle-popup-1280.jpg",
        type: "jpeg",
        quality: 90,
      });
    }

    // After 40 game ticks, the ephemeral popup cleans itself up completely.
    await step(page, 40);
    await expect(page.locator(".battle-popup")).toHaveCount(0);
    expect(errors).toEqual([]);
  },
);

test(
  "Photo Mode snaps a framed Cloverhollow Postcard PNG and triggers shutter flash on Space",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("./?qa=woods");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await page.evaluate(() => window.__cloverhollow?.pause());
    await step(page, 1);
    if ((await readState(page)).lantern) {
      await tapKey(page, "l");
    }

    // Outside Photo Mode, snapPostcard returns null cleanly.
    const outsideSnap = await page.evaluate(async () =>
      window.__cloverhollow?.settings.snapPostcard({ download: false }) ?? null,
    );
    expect(outsideSnap).toBeNull();

    // Enter Photo Mode with P.
    await page.keyboard.press("p");
    await step(page, 1);
    await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
    const stateBeforeSnap = await readState(page);

    // Pressing Space flashes the warm-cream shutter overlay and never triggers an interaction.
    await page.keyboard.press("Space");
    await expect(page.locator(".photo-shutter-flash")).toHaveAttribute("data-shutter-count", "1");
    await step(page, 2);
    const stateAfterSnap = await readState(page);
    expect(stateAfterSnap.dialogue).toBeNull();
    expect(stateAfterSnap.battle).toBeNull();
    expect(stateAfterSnap.player).toEqual(stateBeforeSnap.player);

    // Snap a postcard via the dev hook without triggering a browser download.
    const capture = await page.evaluate(async () =>
      window.__cloverhollow?.settings.snapPostcard({ download: false }) ?? null,
    );
    expect(capture).not.toBeNull();
    if (capture === null) throw new Error("expected postcard capture");
    expect(capture.filename).toBe("cloverhollow-postcard-woods.png");
    expect(capture.caption).toBe("The Whispering Woods · Wilds of Cloverhollow");
    expect(capture.width).toBeGreaterThan(1280);
    expect(capture.height).toBeGreaterThan(720);
    expect(capture.dataUrl.startsWith("data:image/png;base64,")).toBe(true);

    // Verify decoded pixels have warm cream border (#fbf6e8) and non-blank interior art.
    const pixelStats = await page.evaluate(async (dataUrl) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx === null) throw new Error("2d context unavailable");
      ctx.drawImage(image, 0, 0);
      const border = ctx.getImageData(4, 4, 1, 1).data;
      const center = ctx.getImageData(
        Math.floor(canvas.width * 0.2),
        Math.floor(canvas.height * 0.2),
        Math.floor(canvas.width * 0.6),
        Math.floor(canvas.height * 0.6),
      ).data;
      const unique = new Set<number>();
      for (let i = 0; i < center.length; i += 64) {
        const key = ((center[i] ?? 0) << 16) | ((center[i + 1] ?? 0) << 8) | (center[i + 2] ?? 0);
        unique.add(key);
      }
      return {
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        borderRgb: [border[0] ?? 0, border[1] ?? 0, border[2] ?? 0],
        uniqueColors: unique.size,
        jpegBase64: canvas.toDataURL("image/jpeg", 0.9).split(",")[1] ?? "",
      };
    }, capture.dataUrl);

    expect(pixelStats.naturalWidth).toBe(capture.width);
    expect(pixelStats.naturalHeight).toBe(capture.height);
    expect(pixelStats.borderRgb).toEqual([251, 246, 232]);
    expect(pixelStats.uniqueColors).toBeGreaterThan(200);

    if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
      writeFileSync(
        "art/review/m106-postcard-sample.jpg",
        Buffer.from(pixelStats.jpegBase64, "base64"),
      );
    }

    await page.keyboard.press("Escape");
    await step(page, 1);
    await expect(page.locator("html")).toHaveAttribute("data-photo", "off");
    expect(errors).toEqual([]);
  },
);

test(
  "Living Clubhouse renders all 26 museum diorama items cleanly spaced",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("./?qa=clubhouse");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await page.evaluate(() => window.__cloverhollow?.pause());
    await step(page, 1);

    await runQaCommands(page, ["prizes all", "stickers all", "keepsakes on"]);

    const info = await renderInfo(page);
    expect(info.area).toBe("clubhouse");
    expect(info.clubhouseDisplay).toBe(26);
    expect(info.drawOrder.filter((item) => item.label.startsWith("clubhouse:prize:"))).toHaveLength(
      13,
    );
    expect(
      info.drawOrder.filter((item) => item.label.startsWith("clubhouse:keepsake:")),
    ).toHaveLength(13);

    // Enter Photo Mode so the review capture is completely unobstructed.
    await page.keyboard.press("p");
    await step(page, 1);
    await expect(page.locator("html")).toHaveAttribute("data-photo", "on");

    if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
      await page.screenshot({
        path: "art/review/m106-clubhouse-diorama-1280.jpg",
        type: "jpeg",
        quality: 90,
      });
    }

    expect(errors).toEqual([]);
  },
);
