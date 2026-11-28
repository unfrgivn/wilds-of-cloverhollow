import { expect, test } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, playAfter, readHash, readState,
  renderInfo, resetPaused,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

test("real keys: Wildlife Sanctuary living meadow matches Bun hash at 1280x720 and 874x402",
  async ({ page }) => {
    const path = "tests/sim/scripts/new-game/sanctuary.json";
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

    const expectedVisibleNpcs = [
      "fern",
      "sanctuary-bluebird",
      "sanctuary-bunny",
      "sanctuary-frog",
      "sanctuary-hamster",
      "sanctuary-moon-owl",
      "sanctuary-owl",
      "sanctuary-pup",
      "sanctuary-raccoon",
    ];

    let arrived = false;
    let fernTalk = false;
    let boardRead = false;
    let frogPet = false;
    let owlPet = false;
    let picnicDone = false;

    await playAfter(
      page,
      "tests/sim/scripts/new-game/m81-festival.json",
      path,
      async () => {
        const state = await readState(page);
        const info = await renderInfo(page);

        if (!arrived && state.area === "sanctuary" && state.transition === null) {
          expect(info.npcs.map((npc) => npc.id).sort()).toEqual(expectedVisibleNpcs);
          for (const npc of info.npcs) expect(npc.frame, npc.id).not.toBe("");
          await expect(page).toHaveScreenshot("sanctuary-arrival-1280.png");
          await checkBothViewports();
          await page.setViewportSize({ width: 874, height: 402 });
          await expect(page).toHaveScreenshot("sanctuary-arrival-874.png");
          await page.setViewportSize({ width: 1280, height: 720 });
          arrived = true;
        }

        if (!fernTalk && state.area === "sanctuary" && state.dialogue?.knot === "ranger_fern" &&
            state.dialogue.text.includes("8 of 17") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          await expect(page).toHaveScreenshot("sanctuary-fern-1280.png");
          fernTalk = true;
        }

        if (!boardRead && state.area === "sanctuary" &&
            state.dialogue?.knot === "sanctuary_board" &&
            state.dialogue.text.includes("8 of 17")) {
          boardRead = true;
        }

        if (!frogPet && state.area === "sanctuary" && state.dialogue?.knot === "pet_frog" &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          await expect(page).toHaveScreenshot("sanctuary-pet-1280.png");
          frogPet = true;
        }

        if (!owlPet && state.area === "sanctuary" && state.dialogue?.knot === "pet_moon_owl" &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          owlPet = true;
        }

        if (!picnicDone && state.area === "sanctuary" &&
            state.dialogue?.knot === "sanctuary_picnic" &&
            state.dialogue.text.includes("honey biscuit")) {
          picnicDone = true;
        }
      },
    );

    expect({
      arrived, fernTalk, boardRead, frogPet, owlPet, picnicDone,
    }).toEqual({
      arrived: true,
      fernTalk: true,
      boardRead: true,
      frogPet: true,
      owlPet: true,
      picnicDone: true,
    });

    const end = await readState(page);
    expect(end.area).toBe("hills");
    expect(end.coins).toBe(175);
    expect(end.snacks).toBe(11);
    expect(await readHash(page)).toBe(await expectedHash);
  },
);
