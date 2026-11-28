import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import type { MusicDebugInfo } from "../../src/platform/audio";
import {
  longFlowTimeout,
  openHarness,
  readBattle,
  resetPaused,
  step,
} from "./helpers";

type Rect = { x: number; y: number; width: number; height: number };

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

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

async function readMusic(page: Page): Promise<MusicDebugInfo> {
  const info = await page.evaluate(() => window.__cloverhollow?.sound.music());
  if (info === undefined) throw new Error("hook unavailable");
  return info;
}

async function boxIfVisible(locator: Locator): Promise<Rect | null> {
  if (!(await locator.isVisible())) return null;
  return await locator.boundingBox();
}

async function captureReview(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || testInfo.project.name !== "chromium") {
    return;
  }
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
    animations: "disabled",
  });
}

async function measureContrast(
  page: Page,
  selector: string,
): Promise<{ label: string; ratio: number }[]> {
  return page.evaluate((query) => {
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
    const background = (node: Element): string | null => {
      for (let cur: Element | null = node; cur !== null; cur = cur.parentElement) {
        const colour = getComputedStyle(cur).backgroundColor;
        const alpha = parse(colour)[3] ?? 1;
        if (alpha === 0) continue;
        return alpha === 1 ? colour : null;
      }
      return null;
    };
    return [...document.querySelectorAll(query)]
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => {
        const back = background(node);
        const text = luminance(getComputedStyle(node).color);
        const behind = back === null ? text : luminance(back);
        return {
          label: `${node.className} "${(node.textContent ?? "").trim()}"`,
          ratio: (Math.max(text, behind) + 0.05) / (Math.min(text, behind) + 0.05),
        };
      });
  }, selector);
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
  for (let count = 0; count < 50; count += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "command" && battle.revealed >= battle.message.length) return;
    await tapKey(page, "Enter");
  }
  throw new Error("timed out advancing battle to command phase");
}

test.describe("Milestone 116: Journal Arcade Shelf, Keyboard Jukebox & Key Hints", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "Journal Arcade Records Strip stays hidden at 0 and renders crisp pills under PRIZES",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");

      // Hidden when all four records are 0.
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();
      await expect(page.locator(".journal-records-strip")).toHaveCount(0);
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeHidden();

      // Persist all four personal bests via Capacitor Preferences and reload.
      await page.evaluate(() => {
        localStorage.setItem(
          "CapacitorStorage.cloverhollow-records",
          JSON.stringify({ skee: 220, mole: 14, comet: 18, fish: 5 }),
        );
      });
      await page.reload();
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await resetPaused(page, "plaza");

      await expect
        .poll(() => page.evaluate(() => window.__cloverhollow?.settings.minigameRecords()))
        .toEqual({ skee: 220, mole: 14, comet: 18, fish: 5, cook: 0, taco: 0 });

      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();

      const strip = page.locator(".journal-records-strip");
      await expect(strip).toBeVisible();
      await expect(strip).toHaveAttribute("role", "region");
      await expect(strip).toHaveAttribute("aria-label", "Arcade and fishing records");

      // Attached directly after .journal-prizes.
      const rightAfterPrizes = await page.evaluate(() => {
        const prizes = document.querySelector(".journal-prizes");
        const records = document.querySelector(".journal-records-strip");
        return prizes !== null && records !== null && prizes.nextElementSibling === records;
      });
      expect(rightAfterPrizes).toBe(true);

      await expect(strip.locator(".journal-records-label")).toHaveText("BESTS");
      await expect(strip.locator('[data-record="skee"]')).toHaveText("★ Skee-Ball · 220");
      await expect(strip.locator('[data-record="mole"]')).toHaveText("★ Boop-a-Mole · 14 boops");
      await expect(strip.locator('[data-record="comet"]')).toHaveText("★ Comet Cruise · 18 stars");
      await expect(strip.locator('[data-record="fish"]')).toHaveText("★ Fishing Streak · 5");

      // Scroll the strip cleanly into view on desktop and capture review image.
      await strip.scrollIntoViewIfNeeded();
      await step(page, 1);
      await captureReview(page, testInfo, "m116-journal-records-1280");

      // Verify >= 8.5:1 dark-ink contrast on label and all four pills.
      const contrasts = await measureContrast(
        page,
        ".journal-records-label, .journal-record-pill",
      );
      expect(contrasts).toHaveLength(5);
      for (const entry of contrasts) {
        expect(entry.ratio, entry.label).toBeGreaterThanOrEqual(8.5);
      }

      // Verify zero horizontal overflow or clipping at 1280x720, 874x402, and 667x375.
      for (const size of [
        { width: 1280, height: 720 },
        { width: 874, height: 402 },
        { width: 667, height: 375 },
      ]) {
        await page.setViewportSize(size);
        await step(page, 1);
        await strip.scrollIntoViewIfNeeded();
        const layout = await page.evaluate(() => {
          const pageNode = document.querySelector<HTMLElement>(".journal-stickers-page");
          const stripNode = document.querySelector<HTMLElement>(".journal-records-strip");
          if (pageNode === null || stripNode === null) return null;
          const pageBox = pageNode.getBoundingClientRect();
          const pills = [...stripNode.querySelectorAll<HTMLElement>(".journal-record-pill")];
          return {
            noHorizontalOverflow: pageNode.scrollWidth <= pageNode.clientWidth + 1,
            stripFitsX: stripNode.scrollWidth <= stripNode.clientWidth + 1,
            pillsInsideX: pills.every((pill) => {
              const box = pill.getBoundingClientRect();
              return box.left >= pageBox.left - 1 && box.right <= pageBox.right + 1;
            }),
          };
        });
        expect(layout, `${size.width}x${size.height} records strip`).toEqual({
          noHorizontalOverflow: true,
          stripFitsX: true,
          pillsInsideX: true,
        });
      }

      // Clean up localStorage records so sibling tests remain isolated.
      await page.evaluate(() => {
        localStorage.removeItem("CapacitorStorage.cloverhollow-records");
      });
      expect(errors).toEqual([]);
    },
  );

  test(
    "Music Box Jukebox scrubs tracks with ArrowLeft/ArrowRight and resets on click or Enter",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");

      await tapKey(page, "j");
      const book = page.locator(".journal-book");
      await expect(book).toHaveAttribute("data-journal-page", "notes");
      await page.locator(".journal-options-tab").click();
      await expect(book).toHaveAttribute("data-journal-page", "options");

      const nowPlaying = page.locator(".journal-now-playing");
      await expect(nowPlaying).toHaveText("♫ Cloverhollow Town");
      await expect(nowPlaying).toHaveAttribute("data-browsing", "false");
      expect((await readMusic(page)).track).toBe("home");
      expect((await readMusic(page)).duck).toBe(true);

      // Focus the track pill and scrub forward twice with ArrowRight: home -> cafe -> market.
      await nowPlaying.focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(async () => (await readMusic(page)).track).toBe("cafe");
      await expect(book).toHaveAttribute("data-journal-page", "options");
      await page.keyboard.press("ArrowRight");
      await expect.poll(async () => (await readMusic(page)).track).toBe("market");
      await expect(book).toHaveAttribute("data-journal-page", "options");

      await expect(nowPlaying).toHaveText("♫ Pippin's Basket Waltz");
      await expect(nowPlaying).toHaveAttribute("data-browsing", "true");
      await expect(nowPlaying).toHaveAttribute(
        "aria-label",
        /Track 4 of 31: Pippin's Basket Waltz/,
      );
      expect((await readMusic(page)).duck).toBe(false);

      // Scrub backward once with ArrowLeft: market -> cafe.
      await page.keyboard.press("ArrowLeft");
      await expect.poll(async () => (await readMusic(page)).track).toBe("cafe");
      await expect(nowPlaying).toHaveText("♫ Cinnamon Waltz");
      await expect(nowPlaying).toHaveAttribute("aria-label", /Track 3 of 31: Cinnamon Waltz/);

      // Click .journal-now-playing to reset smoothly back to live area theme.
      await nowPlaying.click();
      await expect.poll(async () => (await readMusic(page)).track).toBe("home");
      expect((await readMusic(page)).duck).toBe(true);
      await expect(nowPlaying).toHaveText("♫ Cloverhollow Town");
      await expect(nowPlaying).toHaveAttribute("data-browsing", "false");

      // Verify Enter key on .journal-now-playing also resets after keyboard scrubbing.
      await nowPlaying.focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(async () => (await readMusic(page)).track).toBe("cafe");
      await page.keyboard.press("Enter");
      await expect.poll(async () => (await readMusic(page)).track).toBe("home");
      await expect(nowPlaying).toHaveAttribute("data-browsing", "false");

      expect(errors).toEqual([]);
    },
  );

  test(
    "Key Hints shows P Photo in free overworld and compact I Field Guide pill in battle command",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza-party");

      // Turn Key Hints ON via harness settings.
      await page.evaluate(() => window.__cloverhollow?.settings.setKeyHints(true));
      await step(page, 1);

      const ribbon = page.locator(".hud-hints");
      const photoPill = ribbon.locator('[data-hint="photo"]');
      const battleHint = page.locator(".hud-battle-hint");
      await expect(ribbon).toBeVisible();
      await expect(photoPill).toBeVisible();
      await expect(photoPill.locator(".hud-hint-key")).toHaveText("P");
      await expect(photoPill.locator(".hud-hint-label")).toHaveText("Photo");
      await expect(battleHint).toBeHidden();

      // P enters Photo Mode and hides the overworld ribbon; Escape restores it.
      await page.keyboard.press("p");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
      await expect(ribbon).toBeHidden();
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");
      await expect(photoPill).toBeVisible();

      // Enter Fizzy Frog battle command phase: overworld ribbon hides, battle guide pill shows.
      await walkToFrogCommand(page);
      await expect(ribbon).toBeHidden();
      await expect(battleHint).toBeVisible();
      const guidePill = battleHint.locator('[data-hint="battle-guide"]');
      await expect(guidePill.locator(".hud-hint-key")).toHaveText("I");
      await expect(guidePill.locator(".hud-hint-label")).toHaveText("Field Guide");

      const hintBox = await battleHint.boundingBox();
      expect(hintBox).not.toBeNull();
      if (hintBox !== null) {
        expect(hintBox.x).toBeGreaterThanOrEqual(0);
        expect(hintBox.y).toBeGreaterThanOrEqual(0);
        expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(1281);
        expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(721);

        for (const [label, locator] of [
          [".battle-commands", page.locator(".battle-commands")],
          [".sticker-dialogue", page.locator(".sticker-dialogue")],
          [".battle-portraits", page.locator(".battle-portraits")],
          [".battle-energy", page.locator(".battle-energy")],
          [".battle-calm", page.locator(".battle-calm")],
        ] as const) {
          const other = await boxIfVisible(locator);
          if (other === null) continue;
          expect(rectsOverlap(hintBox, other), `battle hint must not overlap ${label}`).toBe(false);
        }
      }

      // Press I to open Field Guide Peek and capture review image.
      await page.keyboard.press("i");
      const peekCard = page.locator(".battle-peek-card");
      await expect(peekCard).toBeVisible();
      const peekBox = await peekCard.boundingBox();
      if (hintBox !== null && peekBox !== null) {
        expect(rectsOverlap(hintBox, peekBox), "battle hint must not overlap peek card").toBe(
          false,
        );
      }

      await captureReview(page, testInfo, "m116-battle-hints-1280");

      // Turning Key Hints OFF hides the battle hint pill immediately.
      await page.evaluate(() => window.__cloverhollow?.settings.setKeyHints(false));
      await step(page, 1);
      await expect(battleHint).toBeHidden();
      expect(errors).toEqual([]);
    },
  );
});
