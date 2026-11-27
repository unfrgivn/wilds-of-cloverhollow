import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, resetPaused, step } from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

// From the plaza fixture (fountain spawn) to beside the frog; walking left
// enters his touch circle and opens the calm-down battle.
const approachFrog = [["ArrowDown", 25], ["ArrowLeft", 15], ["ArrowDown", 50]] as const;

test(
  "dynamic storybook document title updates across title, plaza, and battle with live regions",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("./");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));

    await expect(page.locator(".title-screen")).toBeVisible();
    await expect(page).toHaveTitle("Wilds of Cloverhollow");

    // Entering Town Plaza updates document.title to match world.areas.plaza.name.
    await resetPaused(page, "plaza");
    await expect(page).toHaveTitle("Town plaza · Wilds of Cloverhollow");

    // Walk into the Fountain Frog with real keys to trigger the battle title.
    for (const [key, ticks] of approachFrog) await hold(page, key, ticks);
    await hold(page, "ArrowLeft", 35);
    await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
    await expect(page).toHaveTitle("Calming Fizzy Frog · Wilds of Cloverhollow");

    // Verify accessible polite live regions on battle reward card and popup layer.
    const rewardCard = page.locator(".battle-reward");
    await expect(rewardCard).toHaveAttribute("role", "status");
    await expect(rewardCard).toHaveAttribute("aria-live", "polite");

    const popupLayer = page.locator(".battle-popups");
    await expect(popupLayer).toHaveAttribute("aria-live", "polite");
    await expect(popupLayer).toHaveAttribute("aria-atomic", "false");
    expect(await popupLayer.getAttribute("aria-hidden")).toBeNull();

    expect(errors).toEqual([]);
  },
);
