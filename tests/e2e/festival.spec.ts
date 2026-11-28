import { expect, test } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, playAfter, readHash, readState,
  renderInfo, resetPaused,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

test("real keys: Post-Finale Sunny Cloverhollow Sanctuary Festival matches Bun hash",
  async ({ page }) => {
    const path = "tests/sim/scripts/new-game/festival.json";
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
    let dadTalk = false;
    let miloTalk = false;
    let rosieTalk = false;
    let chefTalk = false;
    let picnicTalk = false;
    let toastTalk = false;

    await playAfter(
      page,
      "tests/sim/scripts/new-game/golden-kid.json",
      path,
      async () => {
        const state = await readState(page);
        const info = await renderInfo(page);

        if (!arrived && state.area === "sanctuary" && state.transition === null &&
            state.dialogue === null) {
          const visibleIds = info.npcs.map((npc) => npc.id);
          expect(visibleIds).toEqual(
            expect.arrayContaining(["fern", "milo", "rosie", "dad", "chef"]),
          );
          for (const npc of info.npcs) expect(npc.frame, npc.id).not.toBe("");
          await expect(page).toHaveScreenshot("festival-arrival-1280.png");
          await snapReview("festival-1-arrival");
          await checkBothViewports();
          await page.setViewportSize({ width: 874, height: 402 });
          await expect(page).toHaveScreenshot("festival-arrival-874.png");
          await page.setViewportSize({ width: 1280, height: 720 });
          arrived = true;
        }

        if (!dadTalk && state.area === "sanctuary" &&
            state.dialogue?.knot === "festival_dad" &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          dadTalk = true;
        }

        if (!miloTalk && state.area === "sanctuary" &&
            state.dialogue?.knot === "festival_milo" &&
            state.dialogue.text.includes("watercolor sketchbook") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          await expect(page).toHaveScreenshot("festival-milo-1280.png");
          await snapReview("festival-2-milo");
          miloTalk = true;
        }

        if (!rosieTalk && state.area === "sanctuary" &&
            state.dialogue?.knot === "festival_rosie" &&
            state.dialogue.text.includes("Clover Festival Lemonade") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          rosieTalk = true;
        }

        if (!chefTalk && state.area === "sanctuary" &&
            state.dialogue?.knot === "festival_chef" &&
            state.dialogue.text.includes("Mrrrow-purrrr") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          await snapReview("festival-3-chef");
          chefTalk = true;
        }

        if (!picnicTalk && state.area === "sanctuary" &&
            state.dialogue?.knot === "sanctuary_picnic" &&
            state.dialogue.text.includes("Milo hops onto") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          picnicTalk = true;
        }

        if (!toastTalk && state.area === "sanctuary" &&
            state.dialogue?.knot === "ranger_fern" &&
            state.dialogue.text.includes("To Sunny Cloverhollow") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          await expect(page).toHaveScreenshot("festival-toast-1280.png");
          await snapReview("festival-4-toast");
          toastTalk = true;
        }
      },
    );

    expect({
      arrived, dadTalk, miloTalk, rosieTalk, chefTalk, picnicTalk, toastTalk,
    }).toEqual({
      arrived: true,
      dadTalk: true,
      miloTalk: true,
      rosieTalk: true,
      chefTalk: true,
      picnicTalk: true,
      toastTalk: true,
    });

    const end = await readState(page);
    expect(end.area).toBe("sanctuary");
    expect(end.coins).toBe(318);
    expect(end.snacks).toBe(8);
    expect(await readHash(page)).toBe(await expectedHash);
  },
);
