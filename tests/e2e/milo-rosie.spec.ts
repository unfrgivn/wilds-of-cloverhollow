import { expect, test } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, playAfter, readHash, readState,
  renderInfo, resetPaused,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

test("real keys: Milo's Sketch Loft & Rosie's Flower Cottage match Bun hash at 1280 & 874",
  async ({ page }) => {
    const path = "tests/sim/scripts/new-game/milo-rosie.json";
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

    let miloArrived = false;
    let miloDesk = false;
    let miloGlow = false;
    let rosieArrived = false;
    let rosieTalk = false;
    let rosieGlow = false;

    await playAfter(
      page,
      "tests/sim/scripts/new-game/golden-arcade.json",
      path,
      async () => {
        const state = await readState(page);
        const info = await renderInfo(page);

        if (!miloArrived && state.area === "milo-house" && state.transition === null) {
          expect(info.props.map((prop) => prop.id)).toContain("cushion-stack");
          await expect(page).toHaveScreenshot("milo-house-arrival-1280.png");
          await snapReview("milo-rosie-1-milo-loft");
          await checkBothViewports();
          await page.setViewportSize({ width: 874, height: 402 });
          await expect(page).toHaveScreenshot("milo-house-arrival-874.png");
          await page.setViewportSize({ width: 1280, height: 720 });
          miloArrived = true;
        }

        if (!miloDesk && state.area === "milo-house" &&
            state.dialogue?.knot === "milo_desk" &&
            state.dialogue.text.includes("Star Racer")) {
          miloDesk = true;
        }

        if (!miloGlow && state.area === "milo-house" && state.lantern &&
            state.dialogue?.knot === "milo_loft_glow" &&
            state.dialogue.text.includes("leave me behind") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          expect(info.lantern.glows).toContain("milo-loft-glow");
          await expect(page).toHaveScreenshot("milo-house-glow-1280.png");
          await snapReview("milo-rosie-2-milo-glow");
          miloGlow = true;
        }

        if (!rosieArrived && state.area === "rosie-cottage" && state.transition === null) {
          expect(info.npcs.map((npc) => npc.id)).toEqual(["rosie"]);
          for (const npc of info.npcs) expect(npc.frame, npc.id).not.toBe("");
          expect(info.props.map((prop) => prop.id)).toContain("rattan-stool");
          await expect(page).toHaveScreenshot("rosie-cottage-arrival-1280.png");
          await snapReview("milo-rosie-3-rosie-cottage");
          await checkBothViewports();
          await page.setViewportSize({ width: 874, height: 402 });
          await expect(page).toHaveScreenshot("rosie-cottage-arrival-874.png");
          await page.setViewportSize({ width: 1280, height: 720 });
          rosieArrived = true;
        }

        if (!rosieTalk && state.area === "rosie-cottage" &&
            state.dialogue?.knot === "rosie_home" &&
            state.dialogue.text.includes("Sunlit Clover Tea Snack") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          await expect(page.locator(".sticker-portrait")).toBeVisible();
          await snapReview("milo-rosie-4-rosie-talk");
          rosieTalk = true;
        }

        if (!rosieGlow && state.area === "rosie-cottage" && state.lantern &&
            state.dialogue?.knot === "rosie_cottage_glow" &&
            state.dialogue.text.includes("Enchanted Forest") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          expect(info.lantern.glows).toContain("rosie-cottage-glow");
          await expect(page).toHaveScreenshot("rosie-cottage-glow-1280.png");
          rosieGlow = true;
        }
      },
    );

    expect({
      miloArrived, miloDesk, miloGlow, rosieArrived, rosieTalk, rosieGlow,
    }).toEqual({
      miloArrived: true,
      miloDesk: true,
      miloGlow: true,
      rosieArrived: true,
      rosieTalk: true,
      rosieGlow: true,
    });

    const end = await readState(page);
    expect(end.area).toBe("park");
    expect(end.coins).toBe(127);
    expect(end.snacks).toBe(3);
    expect(await readHash(page)).toBe(await expectedHash);
  },
);
