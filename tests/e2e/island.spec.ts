import { expect, test } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, playAfter, readHash, readState,
  renderInfo, resetPaused,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

test("real keys: Starlight Island & Rowboat Crossing match Bun hash at 1280 & 874",
  async ({ page }) => {
    const path = "tests/sim/scripts/new-game/island.json";
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
    let shells = false;
    let lighthouse = false;
    let glow = false;
    let returned = false;

    await playAfter(
      page,
      "tests/sim/scripts/new-game/golden-flute.json",
      path,
      async () => {
        const state = await readState(page);
        const info = await renderInfo(page);

        if (!arrived && state.area === "island" && state.transition === null) {
          expect(info.props.map((prop) => prop.id)).toEqual(
            expect.arrayContaining(["lighthouse", "driftwood-log", "west-palm", "east-palm"]),
          );
          await expect(page).toHaveScreenshot("island-arrival-1280.png");
          await snapReview("island-1-arrival");
          await checkBothViewports();
          await page.setViewportSize({ width: 874, height: 402 });
          await expect(page).toHaveScreenshot("island-arrival-874.png");
          await page.setViewportSize({ width: 1280, height: 720 });
          arrived = true;
        }

        if (!shells && state.area === "island" &&
            state.dialogue?.knot === "island_shells" &&
            state.dialogue.text.includes("Tide-Pool Pearl Cache") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          await expect(page).toHaveScreenshot("island-shells-1280.png");
          await snapReview("island-2-shells");
          shells = true;
        }

        if (!lighthouse && state.area === "island" &&
            state.dialogue?.knot === "island_lighthouse" &&
            state.dialogue.text.includes("Lighthouse Sea-Breeze Snack Tin") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          await snapReview("island-3-lighthouse");
          lighthouse = true;
        }

        if (!glow && state.area === "island" && state.lantern &&
            state.dialogue?.knot === "island_beacon_glow" &&
            state.dialogue.text.includes("STARLIGHT BEACON VERSE") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          expect(info.lantern.glows).toContain("island-beacon-glow");
          await expect(page).toHaveScreenshot("island-glow-1280.png");
          await snapReview("island-4-glow");
          glow = true;
        }

        if (glow && !returned && state.area === "bay" && state.transition === null) {
          returned = true;
        }
      },
    );

    expect({ arrived, shells, lighthouse, glow, returned }).toEqual({
      arrived: true,
      shells: true,
      lighthouse: true,
      glow: true,
      returned: true,
    });

    const end = await readState(page);
    expect(end.area).toBe("bay");
    expect(end.player).toEqual({ x: 1450, y: 685 });
    expect(end.coins).toBe(210);
    expect(end.snacks).toBe(3);
    expect(await readHash(page)).toBe(await expectedHash);
  },
);
