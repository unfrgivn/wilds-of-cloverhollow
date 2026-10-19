import { expect, test } from "@playwright/test";
import { clawGalleryStates } from "../../src/dev/claw-gallery";
import { cometGalleryStates } from "../../src/dev/comet-gallery";
import { cookGalleryStates } from "../../src/dev/cook-gallery";
import { moleGalleryStates } from "../../src/dev/mole-gallery";
import { skeeGalleryStates } from "../../src/dev/skee-gallery";
import { battleStates, gallery, journalStates, phone, sizes, states } from "./gallery";

test.use({ deviceScaleFactor: 2 });
// Every test loads its own page, so the gallery spreads across workers: in
// order on one, its tests kept that worker busy for minutes after every
// other worker had finished.
test.describe.configure({ mode: "parallel" });

const creditsStates = ["credits", "credits-short"];

// The gallery's screenshots. Its measured checks take none, so they're in
// ui-gallery-checks.spec.ts, which CI runs off the macOS runners (spec 11).
test.describe("sticker gallery", () => {
  for (const size of sizes) {
    for (const state of creditsStates) {
      test(`credits ${state} fits ${size.width}x${size.height}`, async ({ page }) => {
        await gallery(page, state, true, size.width === 874 ? "0,62,21,62" : "0,0,0,0", size);
        const metrics = await page.evaluate(() => {
          const screen = document.querySelector<HTMLElement>(".credits-screen");
          if (screen === null) throw new Error("credits screen missing");
          const rect = screen.getBoundingClientRect();
          const elements = [...screen.querySelectorAll<HTMLElement>("h1, .credits-entry, p")];
          const stickers = [...screen.querySelectorAll<HTMLElement>(".credits-entry")];
          const confirmButton = document.querySelector<HTMLElement>(".touch-confirm");
          return {
            visible: !screen.hidden,
            scrolls: screen.scrollHeight > screen.clientHeight,
            inside: elements.every((item) => {
              const box = item.getBoundingClientRect();
              return box.left >= rect.left && box.right <= rect.right &&
                box.top >= rect.top && box.bottom <= rect.bottom;
            }),
            bodySize: Math.min(...[...screen.querySelectorAll<HTMLElement>(
              ".credits-entry-name, p")]
              .map((item) => Number.parseFloat(getComputedStyle(item).fontSize))),
            confirm: (() => {
              const button = confirmButton;
              if (button === null) return null;
              const box = button.getBoundingClientRect();
              return {
                visible: box.width > 0 && box.height > 0,
                size: Math.min(box.width, box.height),
              };
            })(),
            clear: confirmButton === null || stickers.every((item) => {
              const a = item.getBoundingClientRect();
              const b = confirmButton.getBoundingClientRect();
              return a.right <= b.left || a.left >= b.right ||
                a.bottom <= b.top || a.top >= b.bottom;
            }),
            controlsHidden: [".touch-stick", ".touch-menu", ".touch-cancel"]
              .every((selector) =>
                document.querySelector<HTMLElement>(selector)?.getClientRects().length === 0),
            thanks: (() => {
              const item = screen.querySelector<HTMLElement>(".credits-thanks");
              return item === null ? null : item.getBoundingClientRect();
            })(),
            sections: (() => {
              const rect = (selector: string): DOMRect | null => {
                const item = screen.querySelector<HTMLElement>(selector);
                return item === null ? null : item.getBoundingClientRect();
              };
              return {
                lastFriend: rect(".credits-entry-friends:last-of-type"),
                firstMet: rect(".credits-entry-met"),
                heading: rect("h2:not([hidden]) + ul + h2"),
              };
            })(),
          };
        });
        expect(metrics.visible).toBe(true);
        expect(metrics.inside || metrics.scrolls).toBe(true);
        expect(metrics.bodySize).toBeGreaterThanOrEqual(18);
        expect(metrics.confirm?.visible).toBe(true);
        expect(metrics.confirm?.size).toBeGreaterThanOrEqual(44);
        expect(metrics.clear).toBe(true);
        expect(metrics.controlsHidden).toBe(true);
        expect(metrics.thanks).not.toBeNull();
        expect(metrics.sections.lastFriend).not.toBeNull();
        expect(metrics.sections.firstMet).not.toBeNull();
        expect(metrics.sections.heading).not.toBeNull();
        expect(metrics.sections.heading?.top ?? 0)
          .toBeGreaterThan(metrics.sections.lastFriend?.bottom ?? 0);
        expect(metrics.sections.firstMet?.top ?? 0)
          .toBeGreaterThan(metrics.sections.heading?.bottom ?? 0);
        if (size.height >= 720) {
          expect(metrics.scrolls).toBe(false);
          expect(metrics.thanks?.bottom ?? 0).toBeLessThanOrEqual(size.height);
        }
        await expect(page.locator(".credits-screen h1")).toHaveText("THE END");
        // The stickers show once their atlases are decoded.
        await expect(page.locator(".credits-entry-image").first()).toBeVisible();
        // The largest credits: every friend Fae can make, and the whole catalogue.
        if (state === "credits") {
          await expect(page.locator(".credits-entry-friends .credits-entry-name"))
            .toHaveText(["Maddie", "Sue", "Jordan", "Pond Pup", "Acorn Squirrel"]);
          await expect(page.locator(".credits-entry-met")).toHaveCount(16);
        }
        await expect(page).toHaveScreenshot(`${state}-${size.width}x${size.height}.png`, {
          animations: "disabled", scale: "device",
        });
      });
    }
  }

  for (const state of journalStates) {
    test(`${state} journal baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }

  for (const state of states) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled",
        scale: "device",
      });
    });
  }

  for (const state of battleStates) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }
  for (const state of clawGalleryStates) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }
  for (const state of skeeGalleryStates) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }
  for (const state of moleGalleryStates) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }
  for (const state of cometGalleryStates) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }
  for (const state of cookGalleryStates) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }
  for (const state of ["arcade-ready", "arcade-result", "skee-aiming", "skee-result", "mole-up",
    "mole-result", "comet-coming", "comet-result", "cook-ready", "cook-result"]) {
    test(`${state} desktop visual baseline`, async ({ page }) => {
      await gallery(page, state, false, "0,0,0,0", { width: 1280, height: 720 });
      await expect(page).toHaveScreenshot(`${state}-desktop.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }
  for (const [name, size, insets] of [
    ["phone", phone, "0,62,21,62"],
    ["desktop", { width: 1280, height: 720 }, "0,0,0,0"],
  ] as const) {
    test(`journal prizes shelf ${name} screenshot`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`/cloverhollow/ui-gallery.html?state=journal-prizes&touch=1&` +
        `insets=${insets}`);
      await page.evaluate(() => document.fonts.ready);
      await page.locator(".journal-prizes").scrollIntoViewIfNeeded();
      await expect(page).toHaveScreenshot(`journal-prizes-${name}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }

  test("three-choices desktop visual baseline", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/cloverhollow/ui-gallery.html?state=three-choices");
    await expect(page).toHaveScreenshot("three-choices-desktop.png", {
      animations: "disabled",
      scale: "device",
    });
  });
});
