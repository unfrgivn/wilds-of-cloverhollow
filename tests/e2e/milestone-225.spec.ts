import { expect, test } from "@playwright/test";
import { gallery } from "./gallery";

const MINIGAME_A11Y_CASES = [
  {
    state: "arcade-ready",
    overlay: ".arcade-overlay",
    live: ".arcade-plate",
    label: "Claw machine",
  },
  {
    state: "skee-aiming",
    overlay: ".skee-overlay",
    live: ".skee-plate",
    label: "Skee-ball",
  },
  {
    state: "mole-ready",
    overlay: ".mole-overlay",
    live: ".mole-plate",
    label: "Boop-a-Mole",
  },
  {
    state: "comet-ready",
    overlay: ".comet-overlay",
    live: ".comet-marquee",
    label: "Comet Cruise",
  },
  {
    state: "cook-ready",
    overlay: ".cook-overlay",
    live: ".cook-front-text",
    label: "The clubhouse microwave",
  },
  {
    state: "arcade-fish-aim",
    overlay: ".fish-overlay",
    live: ".fish-front-text",
    label: "Bubblegum Bay fishing dock",
  },
  {
    state: "arcade-taco-serving",
    overlay: ".taco-overlay",
    live: ".taco-front-text",
    label: "Chef Mateo's Taco Truck Kitchen",
  },
] as const;

test.describe("Milestone 225: 7-of-7 Minigame WCAG 4.1.3 & VoiceOver Parity (Track E19O)", () => {
  test(
    "renders modal dialog semantics and polite atomic live regions on all 7 minigame overlays",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      for (const item of MINIGAME_A11Y_CASES) {
        await gallery(page, item.state, false, "0,0,0,0", { width: 1280, height: 720 });
        const overlay = page.locator(item.overlay);
        await expect(overlay, `${item.state} overlay visible`).toBeVisible();
        await expect(overlay).toHaveAttribute("role", "dialog");
        await expect(overlay).toHaveAttribute("aria-modal", "true");
        await expect(overlay).toHaveAttribute("aria-label", item.label);

        const live = overlay.locator(item.live);
        await expect(live, `${item.state} live caption visible`).toBeVisible();
        await expect(live).toHaveAttribute("aria-live", "polite");
        await expect(live).toHaveAttribute("aria-atomic", "true");
        const text = (await live.textContent())?.trim() ?? "";
        expect(text.length, `${item.state} live caption non-empty`).toBeGreaterThan(0);
      }

      expect(errors).toEqual([]);
    },
  );
});
