import { expect, type Page } from "@playwright/test";

// The UI gallery (src/dev/ui-gallery.ts), shared by its screenshots
// (ui-gallery.spec.ts) and its measured checks (ui-gallery-checks.spec.ts):
// the states, the sizes they're seen at, and a state loaded and settled.
export const states = ["short", "long", "long-max", "revealing", "speaker-board",
  "two-choices", "three-choices", "five-choices", "prompt", "touch-overlap"];
export const battleStates = ["battle-command", "battle-timing", "battle-grade", "battle-burst",
  "battle-charge", "battle-chain", "battle-chain-burst", "battle-catch", "battle-lean",
  "battle-reward", "battle-feelings", "battle-feelings-heart", "battle-windup",
  "battle-level-up",
  "battle-trace", "battle-trace-mid", "battle-trace-dry", "battle-talk", "battle-talk-reply"];
export const journalStates = ["journal-empty", "journal-notes", "journal-full"];
export const phone = { width: 874, height: 402 };
export const sizes = [phone, { width: 1180, height: 820 }, { width: 1280, height: 720 }];

export async function gallery(page: Page, state: string, touch = true,
  insets = "0,62,21,62", size = phone): Promise<void> {
  await page.setViewportSize(size);
  const query = `state=${state}&insets=${insets}${touch ? "&touch=1" : ""}`;
  await page.goto(`/cloverhollow/ui-gallery.html?${query}`);
  // Fonts and the arcade art the state shows, decoded. A wait for a function
  // checks every frame; an expect or a locator's wait retried later.
  await page.waitForFunction(() => document.querySelector("#gallery[data-ready='true']") !== null);
  await expect(page.locator(".gallery-stage")).toBeVisible();
  // A frame later, measure the settled layout, not a pop-in halfway through.
  // Looping animations (the advance arrow's bob) never finish, so skip them.
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    await Promise.all(document.getAnimations()
      .filter((item) => item.effect?.getComputedTiming().iterations !== Infinity)
      .map((item) => item.finished));
  });
}
