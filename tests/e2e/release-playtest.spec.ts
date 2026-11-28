import { expect, test } from "@playwright/test";
import { openHarness, readState, renderInfo, resetPaused, step } from "./helpers";

const EXPANSION_STOPS = [
  { fixture: "milo-house", area: "milo-house", label: "milo-house" },
  { fixture: "rosie-cottage", area: "rosie-cottage", label: "rosie-cottage" },
  { fixture: "summit", area: "summit", label: "summit" },
  { fixture: "island", area: "island", label: "island" },
  { fixture: "festival", area: "sanctuary", label: "festival" },
] as const;

test(
  "release playtest: all 5 expansion stops load cleanly at 1280 and 874 with zero errors",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    const failedAssets: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        failedAssets.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);

    const captureShowcase = process.env.CLOVERHOLLOW_SHOWCASE === "1";

    for (const stop of EXPANSION_STOPS) {
      await resetPaused(page, stop.fixture);
      await step(page, 6);

      const state = await readState(page);
      expect(state.area, stop.fixture).toBe(stop.area);

      const info = await renderInfo(page);
      expect(info.area, stop.fixture).toBe(stop.area);
      for (const npc of info.npcs) {
        expect(npc.frame, `${stop.fixture}:${npc.id}`).not.toBe("");
      }

      if (stop.fixture === "festival") {
        expect(info.npcs.map((n) => n.id)).toEqual(
          expect.arrayContaining(["fern", "milo", "rosie", "dad", "chef"]),
        );
      }

      if (captureShowcase) {
        // Toggle Photo Showcase Mode for a crisp HUD-free owner art review still.
        await page.keyboard.press("p");
        await step(page, 2);
        await page.screenshot({
          path: `art/scratch/inspect/showcase-${stop.label}.jpg`,
          type: "jpeg",
          quality: 90,
          animations: "disabled",
        });
        await page.keyboard.press("p");
        await step(page, 2);
      }

      // Verify clean phone landscape canvas sizing without errors.
      await page.setViewportSize({ width: 874, height: 402 });
      await step(page, 2);
      const phoneBox = await page.locator("canvas").boundingBox();
      expect(phoneBox?.width, `${stop.fixture} phone width`).toBeGreaterThan(600);
      expect(phoneBox?.height, `${stop.fixture} phone height`).toBeGreaterThan(350);
      await page.setViewportSize({ width: 1280, height: 720 });
      await step(page, 2);
    }

    // Verify Journal opens and closes cleanly on post-finale festival state.
    await page.keyboard.press("j");
    await step(page, 2);
    await expect(page.locator(".journal-book")).toBeVisible();
    await page.keyboard.press("Escape");
    await step(page, 2);
    await expect(page.locator(".journal-book")).toBeHidden();

    expect(failedAssets, "HTTP >= 400 asset loads").toEqual([]);
    expect(errors, "console/page errors").toEqual([]);
  },
);
