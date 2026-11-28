import { expect, test } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, playAfter, readHash, readState,
  renderInfo, resetPaused,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

test("real keys: Bon Appetit Café full town-life loop matches Bun hash at 1280x720 and 874x402",
  async ({ page }) => {
    const path = "tests/sim/scripts/new-game/cafe.json";
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

    let arrived = false;
    let dadTalk = false;
    let chefStarted = false;
    let barnabyTalk = false;
    let parkTin = false;
    let chefCompleted = false;

    await playAfter(
      page,
      "tests/sim/scripts/new-game/golden-bay.json",
      path,
      async () => {
        const state = await readState(page);
        const info = await renderInfo(page);

        if (!arrived && state.area === "cafe" && state.transition === null) {
          expect(info.npcs.map((npc) => npc.id).sort()).toEqual([
            "barnaby", "bree", "chef", "dad", "toby",
          ]);
          for (const npc of info.npcs) expect(npc.frame, npc.id).not.toBe("");
          await expect(page).toHaveScreenshot("cafe-arrival-1280.png");
          await checkBothViewports();
          await page.setViewportSize({ width: 874, height: 402 });
          await expect(page).toHaveScreenshot("cafe-arrival-874.png");
          await page.setViewportSize({ width: 1280, height: 720 });
          arrived = true;
        }

        if (!dadTalk && state.area === "cafe" && state.dialogue?.knot === "dad" &&
            state.dialogue.text.includes("cinnamon bun before work") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          await expect(page).toHaveScreenshot("cafe-dad-talk-1280.png");
          dadTalk = true;
        }

        if (!chefStarted && state.area === "cafe" && state.dialogue?.knot === "chef_bea" &&
            state.dialogue.text.includes("Star Cinnamon buns")) {
          chefStarted = true;
        }

        if (!barnabyTalk && state.area === "cafe" && state.dialogue?.knot === "barnaby" &&
            state.dialogue.text.includes("fifteen coins")) {
          barnabyTalk = true;
        }

        if (!parkTin && state.area === "park" && state.dialogue?.knot === "park_spice_tin" &&
            state.dialogue.text.includes("Bon Appetit Star Cinnamon")) {
          parkTin = true;
        }

        if (!chefCompleted && state.area === "cafe" && state.dialogue?.knot === "chef_bea" &&
            state.dialogue.text.includes("Bon Appetit Star Pin") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          await expect(page).toHaveScreenshot("cafe-chef-errand-1280.png");
          chefCompleted = true;
        }
      },
    );

    expect({
      arrived, dadTalk, chefStarted, barnabyTalk, parkTin, chefCompleted,
    }).toEqual({
      arrived: true,
      dadTalk: true,
      chefStarted: true,
      barnabyTalk: true,
      parkTin: true,
      chefCompleted: true,
    });

    const end = await readState(page);
    expect(end.area).toBe("plaza");
    expect(end.coins).toBe(91);
    expect(end.snacks).toBe(6);
    expect(await readHash(page)).toBe(await expectedHash);
  },
);
