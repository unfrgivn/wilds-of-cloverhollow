import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { serializeSave } from "../../src/core";
import { readState, step } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function runQaCommands(page: Page, commands: readonly string[]): Promise<void> {
  await page.keyboard.press("`");
  await expect(page.locator(".qa-console")).toBeVisible();
  for (const command of commands) {
    await page.keyboard.type(command);
    await page.keyboard.press("Enter");
  }
  // Verify live Cheats-tab toggle sync for Keepsakes, Star Gems, and Fish before closing.
  await expect(page.locator('[data-qa-toggle="keepsakes"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('[data-qa-toggle="gems"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-qa-toggle="fish"]')).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator(".qa-console")).toBeHidden();
  await step(page, 2);
}

async function captureReview(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || testInfo.project.name !== "chromium") {
    return;
  }
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
  });
}

test.describe(
  "Milestone 166: Title Screen 100% Valley Explorer Crown & 13-Keepsake Specimen Browser",
  () => {
    test(
      "displays 100% Valley Explorer crown on Title Screen and steps through 4 expansion keepsakes",
      { tag: "@smoke" },
      async ({ page }, testInfo) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (msg) => {
          if (msg.type() === "error") errors.push(msg.text());
        });

        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto("./?qa=clubhouse");
        await page.waitForFunction(() => Boolean(window.__cloverhollow));
        await page.evaluate(() => window.__cloverhollow?.pause());
        await step(page, 1);

        // 1. Build a 100% Valley Explorer save (all 63 collectibles).
        await runQaCommands(page, [
          "stickers all",
          "prizes all",
          "fish all",
          "gems all",
          "keepsakes on",
        ]);
        const completeState = await readState(page);
        const encoded = serializeSave(completeState);

        try {
          // 2. Persist save and reload to the live Title Screen.
          await page.evaluate((payload) => {
            localStorage.setItem("CapacitorStorage.cloverhollow-save", payload);
          }, encoded);
          await page.goto("./");
          await page.waitForFunction(() => Boolean(window.__cloverhollow));

          const titleScreen = page.locator(".title-screen");
          await expect(titleScreen).toBeVisible();
          const detail = page.locator(".title-option-detail").first();
          await expect(detail).toHaveText("Clubhouse · ★ 100% Valley Explorer");

          // Verify crisp contrast & zero clipping on the Continue button detail line.
          const metrics = await page.evaluate(() => {
            const channel = (value: number): number => {
              const part = value / 255;
              return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
            };
            const parse = (colour: string): number[] =>
              colour.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
            const luminance = (colour: string): number => {
              const [red = 0, green = 0, blue = 0] = parse(colour);
              return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
            };
            const detailEl = document.querySelector(".title-option-detail");
            const buttonEl = detailEl?.closest(".title-option") ?? null;
            if (detailEl === null || buttonEl === null) return null;
            const dRect = detailEl.getBoundingClientRect();
            const bRect = buttonEl.getBoundingClientRect();
            const fg = luminance(getComputedStyle(detailEl).color);
            const bg = luminance(getComputedStyle(buttonEl).backgroundColor);
            const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
            return {
              ratio,
              clippedX: detailEl.scrollWidth > detailEl.clientWidth + 1,
              fitsInsideButton:
                dRect.left >= bRect.left &&
                dRect.right <= bRect.right &&
                dRect.top >= bRect.top &&
                dRect.bottom <= bRect.bottom,
            };
          });
          expect(metrics).not.toBeNull();
          expect(metrics?.ratio ?? 0).toBeGreaterThanOrEqual(4.5);
          expect(metrics?.clippedX).toBe(false);
          expect(metrics?.fitsInsideButton).toBe(true);

          await page.evaluate(() => document.fonts.ready);
          await captureReview(page, testInfo, "m166-title-master-1280");

          // 3. Enter the game, open Journal, click star-whistle, and step right 4 times.
          await page.keyboard.press("Enter");
          await expect
            .poll(() => page.evaluate(() => window.__cloverhollow?.boot.title()))
            .toBeNull();
          await page.evaluate(() => window.__cloverhollow?.pause());
          await step(page, 2);

          await tapKey(page, "j");
          await expect(page.locator(".journal-book")).toBeVisible();
          await expect(page.locator(".journal-keepsakes-heading")).toContainText("13/13");

          const whistleSlot = page.locator(
            '.journal-keepsakes .journal-slot[data-keepsake="star-whistle"]',
          );
          await whistleSlot.scrollIntoViewIfNeeded();
          await whistleSlot.click();

          const fieldNote = page.locator(".journal-field-note");
          await expect(fieldNote).toBeVisible();
          await expect(fieldNote).toHaveAttribute("data-field-kind", "keepsake");
          await expect(fieldNote.locator(".journal-field-name")).toHaveText(
            "Golden Star-Line Whistle",
          );
          await expect(fieldNote.locator(".journal-field-counter")).toHaveText("9 / 13");

          const expansionSteps = [
            {
              counter: "10 / 13",
              name: "Rocket Doodle & Clover",
              source: "Milo & Rosie",
              home: "Clubhouse Wall",
              blurb: "starry rocket sketch from Milo's loft",
            },
            {
              counter: "11 / 13",
              name: "Alpine Aurora Sketch",
              source: "Alpine Summit",
              home: "Clubhouse Wall",
              blurb: "Alpine Summit Overlook legend",
            },
            {
              counter: "12 / 13",
              name: "Starlight Shell Shard",
              source: "Starlight Island",
              home: "Clubhouse Post",
              blurb: "Starlight Island's four-note chime",
            },
            {
              counter: "13 / 13",
              name: "Jubilee Festival Ribbon",
              source: "Sanctuary Festival",
              home: "Clubhouse Post",
              blurb: "grand Wildlife Sanctuary celebration",
            },
          ];

          for (const expected of expansionSteps) {
            await page.keyboard.press("ArrowRight");
            await step(page, 1);
            await expect(fieldNote.locator(".journal-field-counter")).toHaveText(expected.counter);
            await expect(fieldNote.locator(".journal-field-name")).toHaveText(expected.name);
            await expect(fieldNote.locator(".journal-field-lands")).toHaveText(expected.source);
            await expect(fieldNote.locator(".journal-field-calms")).toHaveText(expected.home);
            await expect(fieldNote.locator(".journal-field-blurb")).toContainText(expected.blurb);
            const charmCheck = await page.evaluate(() => {
              const svg = document.querySelector(".journal-field-charm svg.journal-keepsake-icon");
              if (svg === null) return null;
              return {
                shapes: svg.children.length,
                textNodes: svg.querySelectorAll("text").length,
              };
            });
            expect(charmCheck).not.toBeNull();
            expect(charmCheck?.shapes ?? 0).toBeGreaterThan(0);
            expect(charmCheck?.textNodes).toBe(0);
          }

          await page.keyboard.press("Escape");
          await step(page, 1);
          await expect(fieldNote).toBeHidden();
          expect(errors).toEqual([]);
        } finally {
          await page.evaluate(() => {
            localStorage.removeItem("CapacitorStorage.cloverhollow-save");
          });
        }
      },
    );
  },
);
