import { expect, test } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, playAfter, readHash, readState,
  renderInfo, resetPaused,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

test("real keys: Alpine Summit Overlook & Ski Lift match Bun hash at 1280 & 874",
  async ({ page }) => {
    const path = "tests/sim/scripts/new-game/summit.json";
    const expectedHash = bunHash(path, "new-game");
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "new-game");

    const checkBothViewports = async (): Promise<void> => {
      const desktop = await page.locator("canvas").boundingBox();
      expect(desktop?.width).toBeGreaterThan(900);
      expect(desktop?.height).toBeGreaterThan(600);
      await page.setViewportSize({ width: 874, height: 402 });
      const phone = await page.locator("canvas").boundingBox();
      expect(phone?.width).toBeGreaterThan(600);
      expect(phone?.height).toBeGreaterThan(350);
      await page.setViewportSize({ width: 1280, height: 720 });
    };

    const reviewShots = process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1";
    const snapReview = async (name: string): Promise<void> => {
      if (!reviewShots) return;
      await page.screenshot({
        path: `art/scratch/inspect/${name}.jpg`,
        type: "jpeg",
        quality: 90,
        animations: "disabled",
      });
    };

    let arrived = false;
    let telescope = false;
    let cocoa = false;
    let aurora = false;
    let returned = false;

    await playAfter(
      page,
      "tests/sim/scripts/new-game/golden-lodge.json",
      path,
      async () => {
        const state = await readState(page);
        const info = await renderInfo(page);

        if (!arrived && state.area === "summit" && state.transition === null) {
          expect(info.props.map((prop) => prop.id)).toEqual(
            expect.arrayContaining(["stone-cairn", "bench-thermos"]),
          );
          await expect(page).toHaveScreenshot("summit-arrival-1280.png");
          await snapReview("summit-1-arrival");
          await checkBothViewports();
          await page.setViewportSize({ width: 874, height: 402 });
          await expect(page).toHaveScreenshot("summit-arrival-874.png");
          await page.setViewportSize({ width: 1280, height: 720 });
          arrived = true;
        }

        if (!telescope && state.area === "summit" &&
            state.dialogue?.knot === "summit_telescope" &&
            state.dialogue.text.includes("Bubblegum Bay") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          await expect(page).toHaveScreenshot("summit-telescope-1280.png");
          await snapReview("summit-2-telescope");
          telescope = true;
        }

        if (!cocoa && state.area === "summit" &&
            state.dialogue?.knot === "summit_thermos" &&
            state.dialogue.text.includes("marshmallow cocoa") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          await snapReview("summit-3-cocoa");
          cocoa = true;
        }

        if (!aurora && state.area === "summit" && state.lantern &&
            state.dialogue?.knot === "summit_cairn_glow" &&
            state.dialogue.text.includes("lavender and gold light") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          expect(info.lantern.glows).toContain("summit-cairn-glow");
          await expect(page).toHaveScreenshot("summit-aurora-1280.png");
          await snapReview("summit-4-aurora");
          aurora = true;
        }

        if (aurora && !returned && state.area === "pass" && state.transition === null) {
          returned = true;
        }
      },
    );

    expect({ arrived, telescope, cocoa, aurora, returned }).toEqual({
      arrived: true,
      telescope: true,
      cocoa: true,
      aurora: true,
      returned: true,
    });

    const end = await readState(page);
    expect(end.area).toBe("pass");
    expect(end.player).toEqual({ x: 485, y: 490 });
    expect(end.coins).toBe(138);
    expect(end.snacks).toBe(5);
    expect(await readHash(page)).toBe(await expectedHash);
  },
);
