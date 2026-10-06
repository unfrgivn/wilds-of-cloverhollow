import { expect, test, type Page } from "@playwright/test";

test.use({ deviceScaleFactor: 2 });

const states = ["short", "long", "long-max", "revealing", "speaker-board",
  "two-choices", "three-choices", "prompt", "touch-overlap"];
const dialogueStates = states.filter((state) => state !== "prompt");
const phone = { width: 874, height: 402 };
const sizes = [phone, { width: 1180, height: 820 }, { width: 1280, height: 720 }];

async function gallery(page: Page, state: string, touch = true,
  insets = "0,62,21,62"): Promise<void> {
  await page.setViewportSize(phone);
  const query = `state=${state}&insets=${insets}${touch ? "&touch=1" : ""}`;
  await page.goto(`/cloverhollow/ui-gallery.html?${query}`);
  await expect(page.locator(".gallery-stage")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  }));
}

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

test.describe("sticker gallery", () => {
  for (const state of states) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled",
        scale: "device",
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

  for (const state of dialogueStates) {
    for (const size of sizes) {
      test(`${state} geometry ${size.width}x${size.height}`, async ({ page }) => {
        await page.setViewportSize(size);
        const insets = size.width === 874 ? "0,62,21,62" :
          size.width === 1180 ? "0,0,20,0" : "0,0,0,0";
        await page.goto(`/cloverhollow/ui-gallery.html?state=${state}&touch=1&` +
          `insets=${insets}`);
        const facts = await page.locator(".sticker-dialogue").evaluate((box) => {
          const intersects = (a: DOMRect, b: DOMRect): boolean =>
            a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          const controls = [...document.querySelectorAll<HTMLElement>(
            ".touch-confirm, .touch-cancel, .touch-menu")];
          const choices = [...document.querySelectorAll<HTMLElement>(".sticker-choice")];
          const boxRect = box.getBoundingClientRect();
          const buttonRects = controls.map((button) => button.getBoundingClientRect());
          const text = box.querySelector<HTMLElement>(".sticker-text");
          const lineHeight = text === null ? 1 : parseFloat(getComputedStyle(text).lineHeight);
          const style = getComputedStyle(document.documentElement);
          const safe = {
            top: parseFloat(style.getPropertyValue("--safe-top")) || 0,
            right: parseFloat(style.getPropertyValue("--safe-right")) || 0,
            bottom: parseFloat(style.getPropertyValue("--safe-bottom")) || 0,
            left: parseFloat(style.getPropertyValue("--safe-left")) || 0,
          };
          const insideSafe = (rect: DOMRect): boolean => rect.left >= 20 + safe.left &&
            rect.right <= innerWidth - 20 - safe.right &&
            rect.top >= safe.top && rect.bottom <= innerHeight - 20 - safe.bottom;
          return {
            inside: insideSafe(boxRect),
            boxOverlaps: buttonRects.some((button) => intersects(boxRect, button)),
            choiceOverlaps: choices.some((choice) => buttonRects.some((button) =>
              intersects(choice.getBoundingClientRect(), button))),
            fits: text !== null && text.scrollHeight <= text.clientHeight,
            lines: text === null ? 0 : text.clientHeight / lineHeight,
            choiceSizes: choices.map((choice) => choice.getBoundingClientRect().height),
            stickHidden: getComputedStyle(document.querySelector(".touch-stick") ?? box).display
              === "none",
          };
        });
        expect(facts.inside).toBe(true);
        expect(facts.boxOverlaps).toBe(false);
        expect(facts.choiceOverlaps).toBe(false);
        expect(facts.fits).toBe(true);
        expect(facts.choiceSizes.every((height) => height >= 44)).toBe(true);
        expect(facts.stickHidden).toBe(true);
        if (state === "long-max") expect(facts.lines).toBeLessThanOrEqual(3.01);
      });
    }
  }

  for (const size of sizes) {
    test(`prompt arrow tip ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`/cloverhollow/ui-gallery.html?state=prompt&touch=1&` +
        `insets=${size.width === 874 ? "0,62,21,62" :
          size.width === 1180 ? "0,0,20,0" : "0,0,0,0"}`);
      await expect(page.locator(".touch-stick")).toBeVisible();
      const facts = await page.locator(".sticker-prompt").evaluate((prompt) => {
        const arrow = prompt.querySelector<SVGElement>(".sticker-prompt-arrow");
        const tipElement = prompt.querySelector<SVGCircleElement>(
          ".sticker-prompt-arrow-tip");
        const label = prompt.querySelector<HTMLElement>("span");
        const arrowRect = arrow?.getBoundingClientRect();
        const tipRect = tipElement?.getBoundingClientRect();
        const labelRect = label?.getBoundingClientRect();
        const intersects = arrowRect !== undefined && labelRect !== undefined &&
          arrowRect.left < labelRect.right && arrowRect.right > labelRect.left &&
          arrowRect.top < labelRect.bottom && arrowRect.bottom > labelRect.top;
        const style = getComputedStyle(document.documentElement);
        const safe = {
          top: parseFloat(style.getPropertyValue("--safe-top")) || 0,
          right: parseFloat(style.getPropertyValue("--safe-right")) || 0,
          bottom: parseFloat(style.getPropertyValue("--safe-bottom")) || 0,
          left: parseFloat(style.getPropertyValue("--safe-left")) || 0,
        };
        const tip = tipRect === undefined ? { x: 0, y: 0 } :
          { x: tipRect.left + tipRect.width / 2, y: tipRect.top + tipRect.height / 2 };
        const requested = { x: innerWidth / 2, y: innerHeight / 2 };
        return { error: Math.max(Math.abs(tip.x - requested.x),
            Math.abs(tip.y - requested.y)),
          intersectsLabel: intersects,
          insideSafe: tip.x >= safe.left && tip.x <= innerWidth - safe.right &&
            tip.y <= innerHeight - safe.bottom };
      });
      expect(facts.error).toBeLessThanOrEqual(2);
      expect(facts.intersectsLabel).toBe(false);
      expect(facts.insideSafe).toBe(true);
    });
  }

  test("prompt arrow clamps a top-left request", async ({ page }) => {
    await gallery(page, "prompt");
    await page.evaluate(() => window.__stickerGallery.renderPrompt({
      label: "TALK", x: 0, y: 0, visible: true,
    }));
    await page.evaluate(() => new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    }));
    const safe = await page.locator(".sticker-prompt-arrow-tip").evaluate((tip) => {
      const rect = tip.getBoundingClientRect();
      const style = getComputedStyle(document.documentElement);
      const left = parseFloat(style.getPropertyValue("--safe-left")) || 0;
      const top = parseFloat(style.getPropertyValue("--safe-top")) || 0;
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
        left, top };
    });
    expect(safe.x).toBeGreaterThanOrEqual(safe.left);
    expect(safe.y).toBeGreaterThanOrEqual(safe.top);
  });

  test("text pairs meet contrast targets", async ({ page }) => {
    await gallery(page, "three-choices");
    const ratios = await page.evaluate(() => {
      const luminance = (colour: string): number => {
        const values = colour.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
        const channels = values.slice(0, 3).map((value) => value / 255);
        const linear = channels.map((value) => value <= .03928
          ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        return .2126 * (linear[0] ?? 0) + .7152 * (linear[1] ?? 0) +
          .0722 * (linear[2] ?? 0);
      };
      const ratio = (element: Element): number => {
        const style = getComputedStyle(element);
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return (Math.max(foreground, background) + .05) /
          (Math.min(foreground, background) + .05);
      };
      const text = document.querySelector(".sticker-text-revealed");
      const dialogue = document.querySelector(".sticker-dialogue");
      const speaker = document.querySelector(".sticker-speaker");
      const selected = document.querySelector(".sticker-choice[aria-selected='true']");
      const pairs = [
        { selector: ".sticker-text-revealed", element: text, background: dialogue },
        { selector: ".sticker-speaker", element: speaker, background: speaker },
        { selector: ".sticker-choice[aria-selected='true']", element: selected,
          background: selected },
      ];
      return pairs.map((pair) => ({ selector: pair.selector,
        ratio: pair.element === null || pair.background === null ? 0 :
          ((): number => {
            const foreground = luminance(getComputedStyle(pair.element).color);
            const background = luminance(getComputedStyle(pair.background).backgroundColor);
            return (Math.max(foreground, background) + .05) /
              (Math.min(foreground, background) + .05);
          })() }));
    });
    for (const result of ratios) console.log(`${result.selector}: ${result.ratio.toFixed(2)}:1`);
    expect(ratios.every((result) => result.ratio >= 4.5)).toBe(true);
    expect(ratios[0]?.ratio ?? 0).toBeGreaterThanOrEqual(7);
    await page.goto("/cloverhollow/ui-gallery.html?state=prompt&touch=1");
    const promptRatio = await page.locator(".sticker-prompt span").evaluate((label) => {
      const foreground = getComputedStyle(label).color;
      const background = getComputedStyle(label.parentElement ?? label).backgroundColor;
      const channel = (value: string): number => {
        const part = Number(value.match(/\d+(?:\.\d+)?/)?.[0] ?? 0) / 255;
        return part <= .03928 ? part / 12.92 : ((part + .055) / 1.055) ** 2.4;
      };
      const luminance = (value: string): number => {
        const values = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
        return .2126 * channel(String(values[0] ?? 0)) +
          .7152 * channel(String(values[1] ?? 0)) + .0722 * channel(String(values[2] ?? 0));
      };
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      return (Math.max(foregroundLuminance, backgroundLuminance) + .05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + .05);
    });
    console.log(`.sticker-prompt span: ${promptRatio.toFixed(2)}:1`);
    expect(promptRatio).toBeGreaterThanOrEqual(4.5);
  });

  test("touch choice calls the selected index", async ({ browser }) => {
    const context = await browser.newContext({ viewport: phone, deviceScaleFactor: 2,
      hasTouch: true });
    const page = await context.newPage();
    await gallery(page, "three-choices", true);
    const point = await page.locator(".sticker-choice").nth(2).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x + 20, y: rect.y + 20 };
    });
    await page.touchscreen.tap(point.x, point.y);
    await expect(page.locator("#gallery")).toHaveAttribute("data-chosen", "2");
    await context.close();
  });

  test("identical renders keep their DOM nodes", async ({ page }) => {
    await gallery(page, "three-choices", false);
    const result = await page.evaluate(() => {
      const box = document.querySelector(".sticker-dialogue");
      const text = document.querySelector(".sticker-text-revealed");
      const choice = document.querySelector(".sticker-choice");
      const current = { speaker: "Maddie", text: "Which sticker should we take?",
        revealed: 100, choices: [{ text: "A bright leaf" }, { text: "A tiny moon" },
          { text: "A friendly star" }], selected: 1, canAdvance: false };
      window.__stickerGallery.render(current);
      return box === document.querySelector(".sticker-dialogue") &&
        text === document.querySelector(".sticker-text-revealed") &&
        choice === document.querySelector(".sticker-choice");
    });
    expect(result).toBe(true);
  });
});
