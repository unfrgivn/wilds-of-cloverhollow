import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { step } from "./helpers";

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
  await page.keyboard.press("Escape");
  await expect(page.locator(".qa-console")).toBeHidden();
  await step(page, 2);
}

async function settleAnimations(page: Page, selector: string): Promise<void> {
  await page.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (root === null) return;
    await Promise.all(
      root
        .getAnimations({ subtree: true })
        .filter((anim) => anim.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY)
        .map((anim) => anim.finished.catch(() => undefined)),
    );
  }, selector);
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

test.describe("Milestone 179: Keepsake Dream Blessings (Track E9A)", () => {
  test(
    "renders Dream Blessing plaque in Keepsake Field Note and 13/13 strip in Field Treasures",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("./?qa=clubhouse");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await page.evaluate(() => window.__cloverhollow?.pause());
      await step(page, 1);

      await runQaCommands(page, ["stickers all", "prizes all", "fish all", "keepsakes on"]);

      // 1. Open Journal and verify non-keepsake Field Note hides the Dream Blessing plaque.
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();

      const stickerSlot = page
        .locator('.journal-stickers .journal-slot[data-owned="true"]')
        .first();
      await stickerSlot.click();
      const fieldNote = page.locator(".journal-field-note");
      await expect(fieldNote).toBeVisible();
      await expect(fieldNote).toHaveAttribute("data-field-kind", "sticker");
      await expect(fieldNote.locator(".journal-blessing-plaque")).toBeHidden();
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(fieldNote).toBeHidden();

      // 2. Click Jubilee Festival Ribbon keepsake and inspect Sunny Jubilee plaque.
      const ribbonSlot = page.locator(
        '.journal-keepsakes .journal-slot[data-keepsake="festival-ribbon"]',
      );
      await ribbonSlot.scrollIntoViewIfNeeded();
      await ribbonSlot.click();
      await expect(fieldNote).toBeVisible();
      await expect(fieldNote).toHaveAttribute("data-field-kind", "keepsake");
      await settleAnimations(page, ".journal-field-backdrop");

      const plaque = fieldNote.locator(".journal-blessing-plaque");
      await expect(plaque).toBeVisible();
      await expect(plaque).toHaveAttribute("data-blessing", "festival-ribbon");
      await expect(plaque.locator(".journal-blessing-eyebrow")).toHaveText(
        "DREAM BLESSING · CRAFT",
      );
      await expect(plaque.locator(".journal-blessing-title")).toHaveText("Sunny Jubilee");
      await expect(plaque.locator(".journal-blessing-effect")).toHaveText(
        "+1 clubhouse garden bloom",
      );
      await expect(plaque.locator(".journal-blessing-summary")).toHaveText(
        "Cloverhollow's celebration glows wherever Fae travels.",
      );

      // Verify crisp ink color, zero SVG <text>, and zero clipping/scroll on 1280x720 & 874x402.
      for (const size of [{ width: 1280, height: 720 }, { width: 874, height: 402 }]) {
        await page.setViewportSize(size);
        await step(page, 1);
        const check = await page.evaluate(() => {
          const book = document.querySelector(".journal-book")?.getBoundingClientRect();
          const card = document.querySelector<HTMLElement>(".journal-field-note");
          const plaqueEl = document.querySelector<HTMLElement>(".journal-blessing-plaque");
          const titleEl = document.querySelector<HTMLElement>(".journal-blessing-title");
          const svgs = [...document.querySelectorAll(".journal-blessing-plaque svg")];
          if (!book || !card || !plaqueEl || !titleEl) return null;
          const cardRect = card.getBoundingClientRect();
          const plaqueRect = plaqueEl.getBoundingClientRect();
          return {
            cardInsideBook:
              cardRect.left >= book.left - 1 &&
              cardRect.right <= book.right + 1 &&
              cardRect.top >= book.top - 1 &&
              cardRect.bottom <= book.bottom + 1,
            plaqueInsideCard:
              plaqueRect.left >= cardRect.left - 1 &&
              plaqueRect.right <= cardRect.right + 1 &&
              plaqueRect.top >= cardRect.top - 1 &&
              plaqueRect.bottom <= cardRect.bottom + 1,
            noVerticalScroll: card.scrollHeight <= card.clientHeight + 1,
            noHorizontalOverflow: card.scrollWidth <= card.clientWidth + 1,
            inkColor: getComputedStyle(titleEl).color,
            svgCount: svgs.length,
            svgTextNodes: svgs.reduce((sum, s) => sum + s.querySelectorAll("text").length, 0),
          };
        });
        expect(check, `${size.width}x${size.height} Keepsake Blessing plaque`).toEqual({
          cardInsideBook: true,
          plaqueInsideCard: true,
          noVerticalScroll: true,
          noHorizontalOverflow: true,
          inkColor: "rgb(71, 50, 31)",
          svgCount: 1,
          svgTextNodes: 0,
        });
      }
      await page.setViewportSize({ width: 1280, height: 720 });
      await step(page, 1);

      // 3. Step via ArrowLeft to Starlight Shell Shard (Coastal Harmony) & capture 1280x720 shot.
      await page.keyboard.press("ArrowLeft");
      await step(page, 2);
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Starlight Shell Shard");
      await expect(plaque).toHaveAttribute("data-blessing", "shell-shard");
      await expect(plaque.locator(".journal-blessing-title")).toHaveText("Coastal Harmony");
      await expect(plaque.locator(".journal-blessing-effect")).toHaveText(
        "Clearer harmonic echoes",
      );
      await captureReview(page, testInfo, "m179-keepsake-blessing-1280");

      // 4. Dismiss Field Note, switch to MAP, open Field Treasures at 874x402 phone viewport.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(fieldNote).toBeHidden();

      await page.locator(".journal-map-tab").click();
      await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");

      await page.setViewportSize({ width: 874, height: 402 });
      await step(page, 1);
      const treasuresBtn = page.locator(".journal-treasures-btn");
      await expect(treasuresBtn).toBeVisible();
      await treasuresBtn.click();

      const treasuresCard = page.locator(".journal-treasures-card");
      await expect(treasuresCard).toBeVisible();
      await settleAnimations(page, ".journal-treasures-backdrop");

      const strip = treasuresCard.locator(".journal-treasures-blessings");
      await expect(strip).toBeVisible();
      await expect(strip).toHaveClass(/is-complete/);
      await expect(strip.locator(".journal-treasures-blessings-label")).toHaveText(
        "★ 13/13 All Dream Blessings Active!",
      );
      await expect(strip.locator(".journal-blessing-chip")).toHaveCount(13);
      await expect(strip).toContainText("Sunny Jubilee");
      await expect(strip).toContainText("Coastal Harmony");

      const phoneGeom = await page.evaluate(() => {
        const book = document.querySelector(".journal-book")?.getBoundingClientRect();
        const card = document.querySelector<HTMLElement>(".journal-treasures-card");
        const stripEl = document.querySelector<HTMLElement>(".journal-treasures-blessings");
        if (!book || !card || !stripEl) return null;
        const cardRect = card.getBoundingClientRect();
        const stripRect = stripEl.getBoundingClientRect();
        return {
          cardInsideBook:
            cardRect.left >= book.left - 1 &&
            cardRect.right <= book.right + 1 &&
            cardRect.top >= book.top - 1 &&
            cardRect.bottom <= book.bottom + 1,
          stripInsideCard:
            stripRect.left >= cardRect.left - 1 &&
            stripRect.right <= cardRect.right + 1 &&
            stripRect.top >= cardRect.top - 1 &&
            stripRect.bottom <= cardRect.bottom + 1,
          noHorizontalOverflow: card.scrollWidth <= card.clientWidth + 1,
          stripNoHorizontalOverflow: stripEl.scrollWidth <= stripEl.clientWidth + 1,
        };
      });
      expect(phoneGeom, "874x402 Field Treasures Dream Blessings geometry").toEqual({
        cardInsideBook: true,
        stripInsideCard: true,
        noHorizontalOverflow: true,
        stripNoHorizontalOverflow: true,
      });

      await captureReview(page, testInfo, "m179-treasures-blessings-874");

      expect(errors).toEqual([]);
    },
  );
});
