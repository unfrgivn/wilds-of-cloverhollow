import { expect, test, type Page } from "@playwright/test";

// Milestone 11 contract for the title screen kit (src/ui/title.ts), driven
// through the gallery. API: createTitleScreen(root) -> { render(view),
// onChoose(callback: (id: "continue" | "new-game" | "confirm-yes" |
// "confirm-no") => void) }. The gallery records choices in
// #gallery[data-title-chosen].

test.use({ deviceScaleFactor: 2 });

type Rect = { x: number; y: number; width: number; height: number };
const phone = { width: 874, height: 402 };
const sizes = [
  { ...phone, insets: "0,62,21,62" },
  { width: 1180, height: 820, insets: "0,0,20,0" },
  { width: 1280, height: 720, insets: "0,0,0,0" },
];
const titleStates = ["title-fresh", "title-continue", "title-confirm"];

async function gallery(page: Page, state: string, size = sizes[0]): Promise<void> {
  if (size === undefined) throw new Error("no size");
  await page.setViewportSize({ width: size.width, height: size.height });
  await page.goto(`/cloverhollow/ui-gallery.html?state=${state}&touch=1&insets=${size.insets}`);
  await expect(page.locator(".gallery-stage")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((item) => item.effect?.getComputedTiming().iterations !== Infinity)
    .map((item) => item.finished)));
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width &&
    a.y < b.y + b.height && b.y < a.y + a.height;
}

test.describe("title screen kit", () => {
  for (const state of titleStates) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, { animations: "disabled",
        scale: "device" });
    });
  }

  test("each state shows exactly its parts", async ({ page }) => {
    await gallery(page, "title-fresh");
    await expect(page.locator(".title-screen")).toBeVisible();
    await expect(page.locator(".title-logo")).toHaveText("Wilds of Cloverhollow");
    await expect(page.locator(".title-option-label")).toHaveText(["New game"]);
    await expect(page.locator(".title-confirm")).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.dataset.title)).toBe("open");
    for (const hidden of [".touch-controls", ".sticker-dialogue", ".sticker-prompt",
      ".battle-hud", ".journal-book"]) await expect(page.locator(hidden), hidden).toBeHidden();

    await gallery(page, "title-continue");
    await expect(page.locator(".title-option-label")).toHaveText(["Continue", "New game"]);
    await expect(page.locator(".title-option-detail").first()).toHaveText(
      "Town plaza · 1 sticker");
    await expect(page.locator(".title-option").first()).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".title-confirm")).toBeHidden();

    await gallery(page, "title-confirm");
    await expect(page.locator(".title-confirm")).toBeVisible();
    await expect(page.locator(".title-confirm-text")).toHaveText(
      "Start a new game? Your saved game will be replaced.");
    await expect(page.locator(".title-confirm-button")).toHaveText([
      "Yes, start over", "No, go back"]);
    await expect(page.locator(".title-confirm-button").nth(1))
      .toHaveAttribute("aria-selected", "true");
  });

  for (const size of sizes) {
    for (const state of titleStates) {
      test(`${state} geometry ${size.width}x${size.height}`, async ({ page }) => {
        await gallery(page, state, size);
        const facts = await page.evaluate(() => {
          const style = getComputedStyle(document.documentElement);
          const safe = (name: string): number => parseFloat(style.getPropertyValue(name)) || 0;
          const box = (element: Element): { x: number; y: number; width: number;
            height: number } => {
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          };
          const visible = (selector: string): Element[] => [...document.querySelectorAll(selector)]
            .filter((element) => element.getClientRects().length > 0);
          const confirm = visible(".title-confirm")[0];
          const centre = confirm === undefined ? null : (() => {
            const rect = confirm.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.x + rect.width / 2,
              rect.y + rect.height / 2);
            return hit?.closest(".title-confirm") !== null;
          })();
          return {
            safe: { left: 20 + safe("--safe-left"), right: innerWidth - 20 - safe("--safe-right"),
              top: safe("--safe-top"), bottom: innerHeight - safe("--safe-bottom") },
            logo: visible(".title-logo").map(box),
            options: visible(".title-option").map(box),
            buttons: visible(".title-confirm-button").map(box),
            confirm: confirm === undefined ? null : box(confirm),
            confirmOnTop: centre,
          };
        });
        const inside = (rect: Rect): boolean => rect.x >= facts.safe.left &&
          rect.x + rect.width <= facts.safe.right && rect.y >= facts.safe.top &&
          rect.y + rect.height <= facts.safe.bottom;
        expect(facts.logo.length).toBe(1);
        for (const rect of [...facts.logo, ...facts.options, ...facts.buttons])
          expect(inside(rect), JSON.stringify(rect)).toBe(true);
        for (const rect of [...facts.options, ...facts.buttons])
          expect(Math.min(rect.width, rect.height)).toBeGreaterThanOrEqual(44);
        for (const option of facts.options)
          for (const logo of facts.logo) expect(intersects(option, logo)).toBe(false);
        if (state === "title-confirm") {
          expect(facts.confirm).not.toBeNull();
          expect(facts.confirmOnTop, "the confirm card is on top").toBe(true);
        }
      });
    }
  }

  test("touch taps report each choice", async ({ browser }) => {
    const context = await browser.newContext({ viewport: phone, deviceScaleFactor: 2,
      hasTouch: true });
    const page = await context.newPage();
    const tap = async (selector: string, expected: string): Promise<void> => {
      const bounds = await page.locator(selector).boundingBox();
      if (bounds === null) throw new Error(`${selector} is not visible`);
      await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await expect(page.locator("#gallery")).toHaveAttribute("data-title-chosen", expected);
    };
    await gallery(page, "title-continue");
    await tap(".title-option >> nth=0", "continue");
    await tap(".title-option >> nth=1", "new-game");
    await gallery(page, "title-confirm");
    await tap(".title-confirm-button >> nth=0", "confirm-yes");
    await tap(".title-confirm-button >> nth=1", "confirm-no");
    await context.close();
  });

  test("title text pairs meet contrast targets", async ({ page }) => {
    const results: { label: string; ratio: number; opacity: number }[] = [];
    for (const state of ["title-continue", "title-confirm"]) {
      await gallery(page, state);
      results.push(...await page.evaluate(() => {
        const channel = (value: number): number => {
          const part = value / 255;
          return part <= .03928 ? part / 12.92 : ((part + .055) / 1.055) ** 2.4;
        };
        const parse = (colour: string): number[] =>
          colour.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
        const luminance = (colour: string): number => {
          const [red = 0, green = 0, blue = 0] = parse(colour);
          return .2126 * channel(red) + .7152 * channel(green) + .0722 * channel(blue);
        };
        const background = (element: Element): string | null => {
          for (let node: Element | null = element; node !== null; node = node.parentElement) {
            const colour = getComputedStyle(node).backgroundColor;
            const alpha = parse(colour)[3] ?? 1;
            if (alpha === 0) continue;
            return alpha === 1 ? colour : null;
          }
          return null;
        };
        const opacity = (element: Element): number => {
          let total = 1;
          for (let node: Element | null = element; node !== null; node = node.parentElement)
            total *= Number(getComputedStyle(node).opacity);
          return total;
        };
        return [...document.querySelectorAll(".title-option-label, .title-option-detail, " +
          ".title-confirm-text, .title-confirm-button, .title-logo")]
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => {
            const back = background(element);
            const text = luminance(getComputedStyle(element).color);
            const behind = back === null ? text : luminance(back);
            return { label: `${element.className} "${element.textContent}"`,
              opacity: opacity(element),
              ratio: (Math.max(text, behind) + .05) / (Math.min(text, behind) + .05) };
          });
      }));
    }
    for (const result of results)
      console.log(`${result.label}: ${result.ratio.toFixed(2)}:1, opacity ${result.opacity}`);
    expect(results.length).toBeGreaterThanOrEqual(8);
    for (const result of results) {
      expect(result.ratio, result.label).toBeGreaterThanOrEqual(4.5);
      expect(result.opacity, result.label).toBe(1);
    }
  });

  test("identical title renders do not churn DOM nodes", async ({ page }) => {
    for (const state of titleStates) {
      await gallery(page, state);
      const records = await page.evaluate(() => {
        const screen = document.querySelector(".title-screen");
        if (screen === null) return -1;
        const observer = new MutationObserver(() => undefined);
        observer.observe(screen, { childList: true, characterData: true, subtree: true });
        window.__stickerGallery.renderState();
        window.__stickerGallery.renderState();
        const changes = observer.takeRecords().length;
        observer.disconnect();
        return changes;
      });
      expect(records, state).toBe(0);
    }
  });
});
