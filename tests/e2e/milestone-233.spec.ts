import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { serializeSave, setInkVariables, type State } from "../../src/core";
import { openHarness, readState, resetPaused, resume, step, walk } from "./helpers";

async function pressZ(page: Page): Promise<void> {
  await page.keyboard.press("z");
  await step(page, 2);
}

async function advanceToFinalTravelLine(page: Page, choice = 0): Promise<void> {
  for (let count = 0; count < 80; count += 1) {
    const dialogue = (await readState(page)).dialogue;
    if (dialogue === null) throw new Error("dialogue closed before travel line");
    if (dialogue.revealed < dialogue.text.length) {
      await pressZ(page);
      continue;
    }
    if (dialogue.choices.length > 0) {
      for (let down = 0; down < choice; down += 1) {
        await page.keyboard.press("ArrowDown");
        await step(page, 1);
      }
      await pressZ(page);
      continue;
    }
    return;
  }
  throw new Error("timed out reaching final travel line");
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
  "Milestone 232: Weather-Aware Travel Vignettes, Departure Foley & 16/16 Valley Legend",
  () => {
    test(
      "renders Sunshower sky badge, watercolor wash, and travel-bus foley on live Star-Line Bus",
      { tag: "@smoke" },
      async ({ page }, testInfo) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (msg) => {
          if (msg.type() === "error") errors.push(msg.text());
        });

        await page.setViewportSize({ width: 1280, height: 720 });
        await openHarness(page);

        try {
          // Reach Plaza bus stop facing Buster's sign via paused sue-cottage -> bay -> plaza hop.
          await resetPaused(page, "sue-cottage");
          await walk(page, "y", 510);
          await walk(page, "x", 150);
          await step(page, 40);
          expect((await readState(page)).area).toBe("bay");

          await walk(page, "y", 545);
          await walk(page, "x", 355);
          await page.keyboard.down("ArrowUp");
          await step(page, 2);
          await page.keyboard.up("ArrowUp");
          await pressZ(page);
          await advanceToFinalTravelLine(page, 0);
          await page.keyboard.press("z");
          await step(page, 40);
          expect((await readState(page)).area).toBe("plaza");

          // Set Cozy Weather to Rainbow Sunshower via live QA console.
          await runQaCommands(page, ["weather sunshower"]);
          await expect(page.locator("html")).toHaveAttribute("data-weather", "sunshower");

          // Board Buster's Star-Line Bus to Bubblegum Bay in live play.
          await page.keyboard.down("ArrowUp");
          await step(page, 2);
          await page.keyboard.up("ArrowUp");
          await pressZ(page);
          expect((await readState(page)).dialogue?.knot).toBe("bus_stop");
          await advanceToFinalTravelLine(page, 0);

          const beforeEffects = await page.evaluate(
            () => (window.__cloverhollow?.sound.effects() ?? []).length,
          );
          await resume(page);
          await page.keyboard.press("z");

          const overlay = page.locator(".travel-overlay");
          await expect(page.locator("html")).toHaveAttribute("data-travel-vignette", "open", {
            timeout: 8000,
          });
          await expect(overlay).toHaveAttribute("data-vignette-id", "bus-coast");
          await expect(overlay.locator(".travel-caption")).toHaveText(
            "Next stop: Bubblegum Bay!",
          );

          const pill = overlay.locator(".travel-weather-pill");
          await expect(pill).toBeVisible();
          await expect(pill).toHaveAttribute("data-weather", "sunshower");
          await expect(pill.locator(".travel-weather-label")).toHaveText("Rainbow Sunshower");
          await expect(overlay.locator(".travel-weather-fx")).toHaveAttribute(
            "data-weather",
            "sunshower",
          );

          await page.waitForFunction(() => {
            const img = document.querySelector(".travel-art");
            const el = document.querySelector(".travel-overlay");
            if (!(img instanceof HTMLImageElement) || !(el instanceof HTMLElement)) return false;
            return (
              img.complete &&
              img.naturalWidth === 800 &&
              Number.parseFloat(getComputedStyle(el).opacity) >= 0.999
            );
          });

          const layout = await page.evaluate(() => {
            const artWrap = document.querySelector(".travel-art-wrap")?.getBoundingClientRect();
            const badge = document.querySelector(".travel-badge")?.getBoundingClientRect();
            const pillEl = document.querySelector<HTMLElement>(".travel-weather-pill");
            const labelEl = document.querySelector<HTMLElement>(".travel-weather-label");
            const caption = document.querySelector(".travel-caption")?.getBoundingClientRect();
            const skip = document.querySelector(".travel-skip-btn")?.getBoundingClientRect();
            const svg = document.querySelector(".travel-weather-icon svg");
            if (
              artWrap === undefined ||
              badge === undefined ||
              pillEl === null ||
              labelEl === null ||
              caption === undefined ||
              skip === undefined ||
              svg === null
            ) {
              return null;
            }
            const pillRect = pillEl.getBoundingClientRect();
            return {
              insideArt:
                pillRect.left >= artWrap.left &&
                pillRect.right <= artWrap.right + 1 &&
                pillRect.top >= artWrap.top &&
                pillRect.bottom <= artWrap.bottom + 1,
              clearOfBadge: badge.right + 8 <= pillRect.left,
              clearOfCaption: pillRect.bottom <= caption.top,
              clearOfSkip: pillRect.bottom <= skip.top,
              clipped: labelEl.scrollWidth > labelEl.clientWidth + 1,
              svgShapes: svg.children.length,
              svgTextNodes: svg.querySelectorAll("text").length,
            };
          });
          expect(layout).not.toBeNull();
          expect(layout?.insideArt).toBe(true);
          expect(layout?.clearOfBadge).toBe(true);
          expect(layout?.clearOfCaption).toBe(true);
          expect(layout?.clearOfSkip).toBe(true);
          expect(layout?.clipped).toBe(false);
          expect(layout?.svgShapes ?? 0).toBeGreaterThan(0);
          expect(layout?.svgTextNodes).toBe(0);

          const firedEffects = await page.evaluate((start) =>
            [...(window.__cloverhollow?.sound.effects() ?? [])].slice(start),
          beforeEffects);
          expect(firedEffects).toContain("travel-bus");

          await page.evaluate(() => document.fonts.ready);
          await captureReview(page, testInfo, "m232-travel-sunshower-1280");

          // Skip cleanly to Bubblegum Bay.
          await page.keyboard.press("z");
          await expect(page.locator("html")).not.toHaveAttribute("data-travel-vignette", "open", {
            timeout: 4000,
          });
          await page.waitForFunction(() => {
            const state = window.__cloverhollow?.getState();
            return state?.area === "bay" && state.transition === null;
          });

          // Reset Cozy Weather back to "clear" cleanly.
          await page.evaluate(() => window.__cloverhollow?.pause());
          await runQaCommands(page, ["weather clear"]);
          await expect(page.locator("html")).toHaveAttribute("data-weather", "clear");
          expect(errors).toEqual([]);
        } finally {
          await page.evaluate(() => {
            localStorage.removeItem("CapacitorStorage.cloverhollow-weather");
          });
        }
      },
    );

    test(
      "crowns Title Screen Continue button with ★ 16/16 Valley Legend when all 16 ribbons earn",
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

        try {
          await runQaCommands(page, [
            "stickers all",
            "prizes all",
            "fish all",
            "gems all",
            "keepsakes on",
          ]);
          const baseComplete = await readState(page);
          const legendState: State = {
            ...baseComplete,
            ink: setInkVariables(baseComplete.ink, {
              h2h_fae_maddie_done: true,
              h2h_fae_sue_done: true,
              h2h_fae_jordan_done: true,
              h2h_sue_jordan_done: true,
              h2h_clubhouse_trio_done: true,
              h2h_sanctuary_encore_done: true,
            }),
            encore: { bosses: {}, trophies: ["trophy-gull"] },
            decor: { swatch: "starlight-cozy", unlockedSwatches: ["starlight-cozy"] },
            puzzles: { "cavern-prism": true },
          };
          const encodedSave = serializeSave(legendState);
          const encodedRecords = JSON.stringify({
            skee: 0,
            mole: 0,
            comet: 0,
            fish: 0,
            cook: 0,
            taco: 620,
          });

          await page.evaluate(
            ({ save, records }) => {
              localStorage.setItem("CapacitorStorage.cloverhollow-save", save);
              localStorage.setItem("CapacitorStorage.cloverhollow-records", records);
              localStorage.removeItem("CapacitorStorage.cloverhollow-weather");
            },
            { save: encodedSave, records: encodedRecords },
          );

          await page.goto("./");
          await page.waitForFunction(() => Boolean(window.__cloverhollow));

          const titleScreen = page.locator(".title-screen");
          await expect(titleScreen).toBeVisible();
          const detail = page.locator(".title-option-detail").first();
          await expect(detail).toHaveText("Clubhouse · ★ 16/16 Valley Legend");

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
          await captureReview(page, testInfo, "m232-title-legend-1280");
          expect(errors).toEqual([]);
        } finally {
          await page.evaluate(() => {
            localStorage.removeItem("CapacitorStorage.cloverhollow-save");
            localStorage.removeItem("CapacitorStorage.cloverhollow-records");
            localStorage.removeItem("CapacitorStorage.cloverhollow-weather");
          });
        }
      },
    );
  },
);
