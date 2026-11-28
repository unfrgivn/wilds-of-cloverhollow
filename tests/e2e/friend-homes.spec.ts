import { expect, test } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, playAfter, readHash, readState,
  renderInfo, resetPaused,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

test("real keys: Sue's Beach Cottage & Jordan's Mountain Cabin match Bun hash at 1280 & 874",
  async ({ page }) => {
    const path = "tests/sim/scripts/new-game/friend-homes.json";
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

    let jordanArrived = false;
    let jordanTable = false;
    let jordanGlow = false;
    let sueArrived = false;
    let sueWorkbench = false;
    let sueSnacks = false;
    let sueGlow = false;

    await playAfter(
      page,
      "tests/sim/scripts/new-game/golden-lantern.json",
      path,
      async () => {
        const state = await readState(page);
        const info = await renderInfo(page);

        if (!jordanArrived && state.area === "jordan-cabin" && state.transition === null) {
          expect(info.props.map((prop) => prop.id)).toContain("firewood-basket");
          await expect(page).toHaveScreenshot("jordan-cabin-arrival-1280.png");
          await checkBothViewports();
          await page.setViewportSize({ width: 874, height: 402 });
          await expect(page).toHaveScreenshot("jordan-cabin-arrival-874.png");
          await page.setViewportSize({ width: 1280, height: 720 });
          jordanArrived = true;
        }

        if (!jordanTable && state.area === "jordan-cabin" &&
            state.dialogue?.knot === "jordan_table" &&
            state.dialogue.text.includes("Pressed Alpine Clover")) {
          jordanTable = true;
        }

        if (!jordanGlow && state.area === "jordan-cabin" && state.lantern &&
            state.dialogue?.knot === "jordan_map_glow" &&
            state.dialogue.text.includes("Crystal Cavern") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          expect(info.lantern.glows).toContain("jordan-map-glow");
          await expect(page).toHaveScreenshot("jordan-cabin-glow-1280.png");
          jordanGlow = true;
        }

        if (!sueArrived && state.area === "sue-cottage" && state.transition === null) {
          expect(info.props.map((prop) => prop.id)).toContain("snack-basket");
          await expect(page).toHaveScreenshot("sue-cottage-arrival-1280.png");
          await checkBothViewports();
          await page.setViewportSize({ width: 874, height: 402 });
          await expect(page).toHaveScreenshot("sue-cottage-arrival-874.png");
          await page.setViewportSize({ width: 1280, height: 720 });
          sueArrived = true;
        }

        if (!sueWorkbench && state.area === "sue-cottage" &&
            state.dialogue?.knot === "sue_workbench" &&
            state.dialogue.text.includes("Sea-Glass Compass")) {
          sueWorkbench = true;
        }

        if (!sueSnacks && state.area === "sue-cottage" &&
            state.dialogue?.knot === "sue_snacks" &&
            state.dialogue.text.includes("Bay Explorers Club")) {
          sueSnacks = true;
        }

        if (!sueGlow && state.area === "sue-cottage" && state.lantern &&
            state.dialogue?.knot === "sue_secret_note" &&
            state.dialogue.text.includes("BAY EXPLORERS CLUB") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          expect(info.lantern.glows).toContain("sue-secret-note");
          await expect(page).toHaveScreenshot("sue-cottage-glow-1280.png");
          sueGlow = true;
        }
      },
    );

    expect({
      jordanArrived, jordanTable, jordanGlow, sueArrived, sueWorkbench, sueSnacks, sueGlow,
    }).toEqual({
      jordanArrived: true,
      jordanTable: true,
      jordanGlow: true,
      sueArrived: true,
      sueWorkbench: true,
      sueSnacks: true,
      sueGlow: true,
    });

    const end = await readState(page);
    expect(end.area).toBe("bay");
    expect(end.coins).toBe(86);
    expect(end.snacks).toBe(5);
    expect(await readHash(page)).toBe(await expectedHash);
  },
);
