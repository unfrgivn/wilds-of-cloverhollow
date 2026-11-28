import { expect, test } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, playAfter, readHash, readState,
  renderInfo, resetPaused,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

test("real keys: Cloverhollow Grocery Market & Sweet Scoop Ice Cream Parlor match Bun hash",
  async ({ page }) => {
    const path = "tests/sim/scripts/new-game/plaza-shops.json";
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

    let marketArrived = false;
    let pippinTalk = false;
    let marketGlow = false;
    let parlorArrived = false;
    let pennyTalk = false;
    let parlorGlow = false;

    await playAfter(
      page,
      "tests/sim/scripts/new-game/golden-arcade.json",
      path,
      async () => {
        const state = await readState(page);
        const info = await renderInfo(page);

        if (!marketArrived && state.area === "market" && state.transition === null) {
          expect(info.npcs.map((npc) => npc.id).sort()).toEqual(["marigold", "pippin"]);
          for (const npc of info.npcs) expect(npc.frame, npc.id).not.toBe("");
          expect(info.props.map((prop) => prop.id).sort()).toEqual([
            "berry-barrel",
            "produce-island",
          ]);
          await expect(page).toHaveScreenshot("market-arrival-1280.png");
          await snapReview("plaza-shops-1-market");
          await checkBothViewports();
          await page.setViewportSize({ width: 874, height: 402 });
          await expect(page).toHaveScreenshot("market-arrival-874.png");
          await page.setViewportSize({ width: 1280, height: 720 });
          marketArrived = true;
        }

        if (!pippinTalk && state.area === "market" &&
            state.dialogue?.knot === "grocer_pippin" &&
            state.dialogue.text.includes("Orchard Apple sample") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          await expect(page.locator(".sticker-portrait")).toBeVisible();
          await snapReview("plaza-shops-2-pippin");
          pippinTalk = true;
        }

        if (!marketGlow && state.area === "market" && state.lantern &&
            state.dialogue?.knot === "market_list_glow" &&
            state.dialogue.text.includes("SECRET ORCHARD TIP") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          expect(info.lantern.glows).toContain("market-list-glow");
          await expect(page).toHaveScreenshot("market-glow-1280.png");
          marketGlow = true;
        }

        if (!parlorArrived && state.area === "parlor" && state.transition === null) {
          expect(info.npcs.map((npc) => npc.id).sort()).toEqual(["danny", "penny"]);
          for (const npc of info.npcs) expect(npc.frame, npc.id).not.toBe("");
          expect(info.props.map((prop) => prop.id).sort()).toEqual([
            "table-east",
            "table-west",
          ]);
          await expect(page).toHaveScreenshot("parlor-arrival-1280.png");
          await snapReview("plaza-shops-3-parlor");
          await checkBothViewports();
          await page.setViewportSize({ width: 874, height: 402 });
          await expect(page).toHaveScreenshot("parlor-arrival-874.png");
          await page.setViewportSize({ width: 1280, height: 720 });
          parlorArrived = true;
        }

        if (!pennyTalk && state.area === "parlor" &&
            state.dialogue?.knot === "scooper_penny" &&
            state.dialogue.text.includes("Strawberry Swirl Dream Sundae") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          await expect(page.locator(".sticker-portrait")).toBeVisible();
          await snapReview("plaza-shops-4-penny");
          pennyTalk = true;
        }

        if (!parlorGlow && state.area === "parlor" && state.lantern &&
            state.dialogue?.knot === "parlor_secret_glow" &&
            state.dialogue.text.includes("SCOOP MASTER SECRET") &&
            state.dialogue.revealed >= state.dialogue.text.length) {
          expect(info.lantern.glows).toContain("parlor-secret-glow");
          await expect(page).toHaveScreenshot("parlor-glow-1280.png");
          parlorGlow = true;
        }
      },
    );

    expect({
      marketArrived, pippinTalk, marketGlow, parlorArrived, pennyTalk, parlorGlow,
    }).toEqual({
      marketArrived: true,
      pippinTalk: true,
      marketGlow: true,
      parlorArrived: true,
      pennyTalk: true,
      parlorGlow: true,
    });

    const end = await readState(page);
    expect(end.area).toBe("plaza");
    expect(end.coins).toBe(107);
    expect(end.snacks).toBe(4);
    expect(end.treats).toEqual({
      "orchard-apple": 1,
      "berry-cone": 1,
    });
    expect(await readHash(page)).toBe(await expectedHash);
  },
);
